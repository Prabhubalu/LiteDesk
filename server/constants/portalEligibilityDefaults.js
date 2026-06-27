'use strict';

/**
 * Default portal eligibility config for new tenants.
 * Tenants override via TenantModuleConfiguration.settings.portalEligibility
 * and status picklist portalEligible flags.
 */

const ORG_TYPE_PRIORITY = Object.freeze([
  'CUSTOMER',
  'PARTNER',
  'VENDOR',
  'DEALER',
  'CONTRACTOR',
  'AUDITOR'
]);

const DEFAULT_SUPPORTED_ORGANIZATION_TYPES = Object.freeze([
  'Customer',
  'Partner',
  'Vendor',
  'Dealer',
  'Contractor',
  'Auditor'
]);

/** Fallback when picklist entries lack portalEligible (seed / legacy tenants). */
const DEFAULT_ELIGIBLE_STATUS_BY_ORG_TYPE = Object.freeze({
  CUSTOMER: ['Active'],
  PARTNER: ['Active'],
  VENDOR: ['Approved'],
  DEALER: ['Active'],
  CONTRACTOR: ['Approved'],
  AUDITOR: ['Active', 'Onboarding']
});

const DEFAULT_PORTAL_ELIGIBILITY_RULES = Object.freeze([
  { organizationType: 'Customer', statusFieldKey: 'customerStatus', eligibleStatusValues: [] },
  { organizationType: 'Partner', statusFieldKey: 'partnerStatus', eligibleStatusValues: [] },
  { organizationType: 'Vendor', statusFieldKey: 'vendorStatus', eligibleStatusValues: [] },
  { organizationType: 'Dealer', statusFieldKey: 'customerStatus', eligibleStatusValues: [] },
  { organizationType: 'Contractor', statusFieldKey: 'vendorStatus', eligibleStatusValues: [] },
  { organizationType: 'Auditor', statusFieldKey: 'partnerStatus', eligibleStatusValues: [] }
]);

function getDefaultPortalEligibilityConfig() {
  return {
    supportedOrganizationTypes: [...DEFAULT_SUPPORTED_ORGANIZATION_TYPES],
    rules: DEFAULT_PORTAL_ELIGIBILITY_RULES.map((rule) => ({ ...rule })),
    usePicklistPortalEligibleFlags: true
  };
}

/**
 * Map organization type label → status field key.
 * @param {string} organizationType
 * @returns {string|null}
 */
function defaultStatusFieldForOrgType(organizationType) {
  const token = normalizeOrgTypeToken(organizationType);
  const rule = DEFAULT_PORTAL_ELIGIBILITY_RULES.find(
    (r) => normalizeOrgTypeToken(r.organizationType) === token
  );
  return rule?.statusFieldKey || null;
}

function normalizeOrgTypeToken(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function normalizeOrgTypesList(types) {
  if (!Array.isArray(types)) return [];
  return types.map((t) => normalizeOrgTypeToken(t)).filter(Boolean);
}

module.exports = {
  ORG_TYPE_PRIORITY,
  DEFAULT_SUPPORTED_ORGANIZATION_TYPES,
  DEFAULT_ELIGIBLE_STATUS_BY_ORG_TYPE,
  DEFAULT_PORTAL_ELIGIBILITY_RULES,
  getDefaultPortalEligibilityConfig,
  defaultStatusFieldForOrgType,
  normalizeOrgTypeToken,
  normalizeOrgTypesList
};
