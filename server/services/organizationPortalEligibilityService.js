'use strict';

/**
 * Resolves whether a business organization qualifies for portal access enablement.
 * Rules are tenant-configurable — not hardcoded status name literals at runtime.
 */

const {
  getDefaultPortalEligibilityConfig,
  ORG_TYPE_PRIORITY,
  DEFAULT_ELIGIBLE_STATUS_BY_ORG_TYPE,
  normalizeOrgTypeToken,
  normalizeOrgTypesList
} = require('../constants/portalEligibilityDefaults');

const INELIGIBILITY_REASONS = Object.freeze({
  NO_BUSINESS_ORG: 'PORTAL_ORG_MISSING',
  TENANT_ORG: 'PORTAL_TENANT_ORG_NOT_ELIGIBLE',
  UNSUPPORTED_TYPE: 'PORTAL_ORG_UNSUPPORTED_TYPE',
  STATUS_MISSING: 'PORTAL_ORG_STATUS_MISSING',
  STATUS_INELIGIBLE: 'PORTAL_ORG_INACTIVE',
  NO_MATCHING_RULE: 'PORTAL_ORG_NO_MATCHING_RULE'
});

/**
 * Merge tenant portalEligibility with platform defaults.
 * @param {object|null|undefined} tenantSettings - TenantModuleConfiguration.settings
 */
function resolvePortalEligibilityConfig(tenantSettings) {
  const defaults = getDefaultPortalEligibilityConfig();
  const fromTenant = tenantSettings?.portalEligibility;
  if (!fromTenant || typeof fromTenant !== 'object') {
    return defaults;
  }

  return {
    supportedOrganizationTypes:
      Array.isArray(fromTenant.supportedOrganizationTypes) && fromTenant.supportedOrganizationTypes.length
        ? fromTenant.supportedOrganizationTypes
        : defaults.supportedOrganizationTypes,
    rules: Array.isArray(fromTenant.rules) && fromTenant.rules.length
      ? fromTenant.rules
      : defaults.rules,
    usePicklistPortalEligibleFlags:
      fromTenant.usePicklistPortalEligibleFlags !== undefined
        ? fromTenant.usePicklistPortalEligibleFlags === true
        : defaults.usePicklistPortalEligibleFlags
  };
}

/**
 * Pick first supported org type on the business org (fixed priority).
 * @param {string[]} orgTypesNormalized
 * @param {string[]} supportedTypes
 */
function matchPrimaryOrganizationType(orgTypesNormalized, supportedTypes) {
  const supportedSet = new Set(supportedTypes.map((t) => normalizeOrgTypeToken(t)));
  for (const priority of ORG_TYPE_PRIORITY) {
    if (orgTypesNormalized.includes(priority) && supportedSet.has(priority)) {
      return priority;
    }
  }
  for (const type of orgTypesNormalized) {
    if (supportedSet.has(type)) {
      return type;
    }
  }
  return null;
}

/**
 * @param {string} matchedTypeToken
 * @param {object} config
 */
function findRuleForType(matchedTypeToken, config) {
  return (config.rules || []).find(
    (rule) => normalizeOrgTypeToken(rule.organizationType) === matchedTypeToken
  );
}

/**
 * @param {object|null|undefined} statusPicklists
 * @param {string} statusFieldKey
 * @param {string} statusValue
 */
function isStatusPortalEligibleViaPicklist(statusPicklists, statusFieldKey, statusValue) {
  if (!statusFieldKey || statusValue == null || statusValue === '') {
    return false;
  }
  if (!statusPicklists) {
    return null;
  }
  const entries = statusPicklists[statusFieldKey];
  if (!Array.isArray(entries)) {
    return null;
  }
  const normalizedValue = String(statusValue).trim().toLowerCase();
  const match = entries.find(
    (entry) => String(entry?.value || '').trim().toLowerCase() === normalizedValue
  );
  if (!match) {
    return false;
  }
  if (match.portalEligible === true) {
    return true;
  }
  if (match.portalEligible === false) {
    return false;
  }
  return null;
}

/**
 * @param {string} matchedTypeToken
 * @param {string} statusValue
 * @param {object} rule
 */
function isStatusEligibleViaRuleList(matchedTypeToken, statusValue, rule) {
  const explicit = Array.isArray(rule?.eligibleStatusValues) ? rule.eligibleStatusValues : [];
  if (explicit.length) {
    const normalizedStatus = String(statusValue).trim().toLowerCase();
    return explicit.some((v) => String(v).trim().toLowerCase() === normalizedStatus);
  }
  const fallback = DEFAULT_ELIGIBLE_STATUS_BY_ORG_TYPE[matchedTypeToken] || [];
  const normalizedStatus = String(statusValue).trim().toLowerCase();
  return fallback.some((v) => String(v).trim().toLowerCase() === normalizedStatus);
}

/**
 * @param {object|null|undefined} businessOrg - SALES organization (isTenant=false)
 * @param {object|null|undefined} tenantSettings - TenantModuleConfiguration.settings
 */
function resolvePortalEligibility(businessOrg, tenantSettings) {
  if (!businessOrg) {
    return {
      eligible: false,
      reason: INELIGIBILITY_REASONS.NO_BUSINESS_ORG,
      matchedOrganizationType: null,
      statusFieldKey: null,
      statusValue: null
    };
  }

  if (businessOrg.isTenant === true) {
    return {
      eligible: false,
      reason: INELIGIBILITY_REASONS.TENANT_ORG,
      matchedOrganizationType: null,
      statusFieldKey: null,
      statusValue: null
    };
  }

  const config = resolvePortalEligibilityConfig(tenantSettings);
  const orgTypesNormalized = normalizeOrgTypesList(businessOrg.types);
  const supportedNormalized = config.supportedOrganizationTypes.map((t) => normalizeOrgTypeToken(t));

  const matchedType = matchPrimaryOrganizationType(orgTypesNormalized, supportedNormalized);
  if (!matchedType) {
    return {
      eligible: false,
      reason: INELIGIBILITY_REASONS.UNSUPPORTED_TYPE,
      matchedOrganizationType: null,
      statusFieldKey: null,
      statusValue: null
    };
  }

  const rule = findRuleForType(matchedType, config);
  if (!rule?.statusFieldKey) {
    return {
      eligible: false,
      reason: INELIGIBILITY_REASONS.NO_MATCHING_RULE,
      matchedOrganizationType: matchedType,
      statusFieldKey: null,
      statusValue: null
    };
  }

  const statusFieldKey = rule.statusFieldKey;
  const statusValue = businessOrg[statusFieldKey];
  if (statusValue == null || String(statusValue).trim() === '') {
    return {
      eligible: false,
      reason: INELIGIBILITY_REASONS.STATUS_MISSING,
      matchedOrganizationType: matchedType,
      statusFieldKey,
      statusValue: null
    };
  }

  let eligible = false;
  if (config.usePicklistPortalEligibleFlags) {
    const statusPicklists = tenantSettings?.statusTypes?.statusPicklists;
    const fromPicklist = isStatusPortalEligibleViaPicklist(
      statusPicklists,
      statusFieldKey,
      statusValue
    );
    if (fromPicklist === true) {
      eligible = true;
    } else if (fromPicklist === false) {
      eligible = false;
    } else {
      eligible = isStatusEligibleViaRuleList(matchedType, statusValue, rule);
    }
  } else {
    eligible = isStatusEligibleViaRuleList(matchedType, statusValue, rule);
  }

  return {
    eligible,
    reason: eligible ? null : INELIGIBILITY_REASONS.STATUS_INELIGIBLE,
    matchedOrganizationType: matchedType,
    statusFieldKey,
    statusValue: String(statusValue)
  };
}

module.exports = {
  INELIGIBILITY_REASONS,
  resolvePortalEligibilityConfig,
  resolvePortalEligibility,
  matchPrimaryOrganizationType,
  isStatusPortalEligibleViaPicklist
};
