/**
 * ============================================================================
 * PLATFORM CORE: Deal Relationship Service
 * ============================================================================
 * 
 * Service for managing role-based relationships for Deals.
 * 
 * Key Features:
 * - Syncs legacy fields (contactId, accountId) ↔ role-based arrays (dealPeople, dealOrganizations)
 * - Maintains backward compatibility
 * - Preserves historical references (no hard deletes, uses isActive flag)
 * - Enforces relationship invariants
 * 
 * Usage:
 *   const { syncLegacyToRoleBased, syncRoleBasedToLegacy, addDealPerson, addDealOrganization } = require('./dealRelationshipService');
 *   await syncLegacyToRoleBased(deal, userId);
 * 
 * ============================================================================
 */

/**
 * Sync legacy contactId → dealPeople array
 * Ensures a dealPeople entry exists for contactId with isPrimary=true.
 * Role is independent of Primary; new rows default to decision_maker.
 *
 * @param {Object} deal - Deal document
 * @param {ObjectId} userId - User ID for audit
 * @returns {Promise<void>}
 */
async function syncContactIdToDealPeople(deal, userId) {
  const { normalizeDealPersonRole, DEAL_PERSON_ROLE_DECISION_MAKER } = require('../constants/dealPeopleRoles');

  if (!deal.contactId) {
    return;
  }

  if (!deal.dealPeople) {
    deal.dealPeople = [];
  }

  const contactIdStr = deal.contactId.toString();

  // Exactly one primary person: clear isPrimary on other entries (do not change their roles)
  for (const p of deal.dealPeople) {
    if (p.personId && p.personId.toString() !== contactIdStr) {
      p.isPrimary = false;
    }
    if (p.role) {
      p.role = normalizeDealPersonRole(p.role, DEAL_PERSON_ROLE_DECISION_MAKER);
    }
  }

  const existing = deal.dealPeople.find(
    (p) => p.personId && p.personId.toString() === contactIdStr
  );

  if (!existing) {
    deal.dealPeople.push({
      personId: deal.contactId,
      role: DEAL_PERSON_ROLE_DECISION_MAKER,
      isPrimary: true,
      isActive: true,
      addedAt: new Date(),
      addedBy: userId
    });
  } else {
    existing.isPrimary = true;
    existing.isActive = true;
    existing.role = normalizeDealPersonRole(existing.role, DEAL_PERSON_ROLE_DECISION_MAKER);
    if (!existing.addedBy) {
      existing.addedBy = userId;
    }
  }
}

/**
 * Sync legacy accountId → dealOrganizations array
 * Ensures a dealOrganizations entry exists with role=customer, isPrimary=true
 * Note: organizationId is the tenant org, not the account org
 * 
 * @param {Object} deal - Deal document
 * @param {ObjectId} userId - User ID for audit
 * @returns {Promise<void>}
 */
async function syncAccountIdToDealOrganizations(deal, userId) {
  if (!deal.accountId) {
    return;
  }

  if (!deal.dealOrganizations) {
    deal.dealOrganizations = [];
  }

  const accountIdStr = deal.accountId.toString();

  // Ensure only one primary customer: clear isPrimary on other customer entries
  for (const o of deal.dealOrganizations) {
    if (o.role === 'customer' && o.organizationId && o.organizationId.toString() !== accountIdStr) {
      o.isPrimary = false;
    }
  }

  const existingPrimary = deal.dealOrganizations.find(
    (o) => o.organizationId && o.organizationId.toString() === accountIdStr && o.role === 'customer'
  );

  if (!existingPrimary) {
    deal.dealOrganizations.push({
      organizationId: deal.accountId,
      role: 'customer',
      isPrimary: true,
      isActive: true,
      addedAt: new Date(),
      addedBy: userId
    });
  } else {
    existingPrimary.isPrimary = true;
    existingPrimary.isActive = true;
    if (!existingPrimary.addedBy) {
      existingPrimary.addedBy = userId;
    }
  }
}

/**
 * Sync legacy fields → role-based arrays
 * Called on create/update when legacy fields are present
 * 
 * @param {Object} deal - Deal document
 * @param {ObjectId} userId - User ID for audit
 * @returns {Promise<void>}
 */
async function syncLegacyToRoleBased(deal, userId) {
  await syncContactIdToDealPeople(deal, userId);
  await syncAccountIdToDealOrganizations(deal, userId);
}

/**
 * Sync role-based arrays → legacy fields (for backward compatibility)
 * Sets contactId from primary contact, accountId from primary customer
 * 
 * @param {Object} deal - Deal document
 * @returns {Promise<void>}
 */
async function syncRoleBasedToLegacy(deal) {
  if (deal.dealPeople && Array.isArray(deal.dealPeople)) {
    // Primary is independent of role — sync contactId from isPrimary only
    const primaryContact = deal.dealPeople.find((p) => p.isPrimary && p.isActive);
    if (primaryContact && primaryContact.personId) {
      deal.contactId = primaryContact.personId;
    }
  }

  if (deal.dealOrganizations && Array.isArray(deal.dealOrganizations)) {
    const primaryCustomer = deal.dealOrganizations.find((o) => o.isPrimary && o.isActive && o.role === 'customer');
    if (primaryCustomer && primaryCustomer.organizationId) {
      deal.accountId = primaryCustomer.organizationId;
    }
  }
}

/**
 * Add or update a person relationship to a deal
 * 
 * @param {Object} deal - Deal document
 * @param {ObjectId} personId - People ID
 * @param {string} role - Deal Person Role (decision_maker|champion|influencer|…)
 * @param {boolean} isPrimary - Whether this is the primary person on the deal (independent of role)
 * @param {ObjectId} userId - User ID for audit
 * @returns {Promise<Object>} - The relationship entry
 */
async function addDealPerson(deal, personId, role, isPrimary = false, userId = null) {
  const { normalizeDealPersonRole, DEAL_PERSON_ROLE_DECISION_MAKER } = require('../constants/dealPeopleRoles');

  if (!deal.dealPeople) {
    deal.dealPeople = [];
  }

  const nextRole = normalizeDealPersonRole(role, DEAL_PERSON_ROLE_DECISION_MAKER);
  // One person per deal — update existing row instead of creating another
  const existing = deal.dealPeople.find(
    (p) => p.personId && p.personId.toString() === personId.toString()
  );

  if (isPrimary) {
    for (const p of deal.dealPeople) {
      if (p.personId && p.personId.toString() !== personId.toString()) {
        p.isPrimary = false;
      }
    }
  }

  if (existing) {
    existing.role = nextRole;
    existing.isPrimary = isPrimary;
    existing.isActive = true;
    if (!existing.addedBy) {
      existing.addedBy = userId;
    }
    return existing;
  }

  const newEntry = {
    personId,
    role: nextRole,
    isPrimary,
    isActive: true,
    addedAt: new Date(),
    addedBy: userId
  };

  deal.dealPeople.push(newEntry);
  return newEntry;
}

/**
 * Add or update an organization relationship to a deal
 * 
 * @param {Object} deal - Deal document
 * @param {ObjectId} organizationId - Organization ID
 * @param {string} role - Deal Relationship Role (customer|partner|reseller|distributor|vendor|other)
 * @param {boolean} isPrimary - Whether this is the primary organization (must be customer)
 * @param {ObjectId} userId - User ID for audit
 * @returns {Promise<Object>} - The relationship entry
 */
async function addDealOrganization(deal, organizationId, role, isPrimary = false, userId = null) {
  if (!deal.dealOrganizations) {
    deal.dealOrganizations = [];
  }

  const existing = deal.dealOrganizations.find(
    (o) => o.organizationId && o.organizationId.toString() === organizationId.toString() && o.role === role
  );

  if (existing) {
    existing.isPrimary = isPrimary;
    existing.isActive = true;
    if (!existing.addedBy) {
      existing.addedBy = userId;
    }
    return existing;
  }

  const newEntry = {
    organizationId,
    role,
    isPrimary,
    isActive: true,
    addedAt: new Date(),
    addedBy: userId
  };

  deal.dealOrganizations.push(newEntry);
  return newEntry;
}

/**
 * Remove a person relationship (soft delete: set isActive=false)
 * 
 * @param {Object} deal - Deal document
 * @param {ObjectId} personId - People ID
 * @param {string} role - Role (optional, if not provided removes all roles for this person)
 * @returns {Promise<boolean>} - Whether any relationship was deactivated
 */
async function removeDealPerson(deal, personId, role = null) {
  if (!deal.dealPeople || !Array.isArray(deal.dealPeople)) {
    return false;
  }

  let removed = false;
  for (const entry of deal.dealPeople) {
    if (entry.personId && entry.personId.toString() === personId.toString()) {
      if (!role || entry.role === role) {
        entry.isActive = false;
        removed = true;
      }
    }
  }

  return removed;
}

/**
 * Remove an organization relationship (soft delete: set isActive=false)
 * 
 * @param {Object} deal - Deal document
 * @param {ObjectId} organizationId - Organization ID
 * @param {string} role - Role (optional, if not provided removes all roles for this org)
 * @returns {Promise<boolean>} - Whether any relationship was deactivated
 */
async function removeDealOrganization(deal, organizationId, role = null) {
  if (!deal.dealOrganizations || !Array.isArray(deal.dealOrganizations)) {
    return false;
  }

  let removed = false;
  for (const entry of deal.dealOrganizations) {
    if (entry.organizationId && entry.organizationId.toString() === organizationId.toString()) {
      if (!role || entry.role === role) {
        entry.isActive = false;
        removed = true;
      }
    }
  }

  return removed;
}

module.exports = {
  syncLegacyToRoleBased,
  syncRoleBasedToLegacy,
  syncContactIdToDealPeople,
  syncAccountIdToDealOrganizations,
  addDealPerson,
  addDealOrganization,
  removeDealPerson,
  removeDealOrganization
};
