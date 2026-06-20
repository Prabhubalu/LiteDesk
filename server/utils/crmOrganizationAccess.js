'use strict';

const mongoose = require('mongoose');
const Organization = require('../models/Organization');

async function getTenantUserIds(tenantOrganizationId) {
  const User = require('../models/User');
  const users = await User.find({ organizationId: tenantOrganizationId }).select('_id').lean();
  return users.map((user) => user._id);
}

function normalizeOrgObjectIds(recordIds = []) {
  const out = [];
  const seen = new Set();
  for (const rawId of recordIds) {
    const id = String(rawId || '').trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(new mongoose.Types.ObjectId(id));
  }
  return out;
}

/**
 * CRM org ids among candidates that are referenced by tenant-scoped records or relationships.
 */
async function getTenantLinkedCrmOrganizationIds(tenantOrganizationId, candidateIds = []) {
  const objectIds = normalizeOrgObjectIds(candidateIds);
  if (!objectIds.length) return [];

  const RelationshipInstance = require('../models/RelationshipInstance');
  const Deal = require('../models/Deal');
  const People = require('../models/People');

  const [fromSource, fromTarget, fromDeals, fromPeople] = await Promise.all([
    RelationshipInstance.distinct('source.recordId', {
      organizationId: tenantOrganizationId,
      'source.moduleKey': 'organizations',
      'source.recordId': { $in: objectIds }
    }),
    RelationshipInstance.distinct('target.recordId', {
      organizationId: tenantOrganizationId,
      'target.moduleKey': 'organizations',
      'target.recordId': { $in: objectIds }
    }),
    Deal.distinct('accountId', {
      organizationId: tenantOrganizationId,
      accountId: { $in: objectIds },
      deletedAt: null
    }),
    People.distinct('organization', {
      organizationId: tenantOrganizationId,
      organization: { $in: objectIds },
      deletedAt: null
    })
  ]);

  const linked = new Set();
  for (const id of [...fromSource, ...fromTarget, ...fromDeals, ...fromPeople]) {
    if (id) linked.add(String(id));
  }
  return [...linked];
}

/**
 * Mongo query for CRM organizations accessible to a tenant workspace.
 * Primary: createdBy in tenant users. Fallback: linked from tenant CRM data.
 */
async function buildTenantAccessibleCrmOrganizationQuery(
  tenantOrganizationId,
  { recordIds = null, masterAccess = false } = {}
) {
  const query = { isTenant: false, deletedAt: null };
  const normalizedIds = recordIds?.length ? normalizeOrgObjectIds(recordIds) : [];
  if (normalizedIds.length) {
    query._id = { $in: normalizedIds };
  }
  if (masterAccess) return query;

  const tenantUserIds = await getTenantUserIds(tenantOrganizationId);
  const linkedIds = normalizedIds.length
    ? await getTenantLinkedCrmOrganizationIds(
      tenantOrganizationId,
      normalizedIds.map((id) => String(id))
    )
    : [];

  const accessClauses = [{ createdBy: { $in: tenantUserIds } }];
  if (tenantUserIds.length) {
    accessClauses.push({ assignedTo: { $in: tenantUserIds } });
  }
  const linkedObjectIds = normalizeOrgObjectIds(linkedIds);
  if (linkedObjectIds.length) {
    accessClauses.push({ _id: { $in: linkedObjectIds } });
  }

  return { ...query, $or: accessClauses };
}

async function findTenantAccessibleCrmOrganization(tenantOrganizationId, recordId, options = {}) {
  const id = String(recordId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const query = await buildTenantAccessibleCrmOrganizationQuery(tenantOrganizationId, {
    recordIds: [id],
    masterAccess: options.masterAccess === true
  });
  return Organization.findOne(query);
}

module.exports = {
  getTenantUserIds,
  normalizeOrgObjectIds,
  getTenantLinkedCrmOrganizationIds,
  buildTenantAccessibleCrmOrganizationQuery,
  findTenantAccessibleCrmOrganization
};
