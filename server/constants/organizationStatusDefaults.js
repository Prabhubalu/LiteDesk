/**
 * Platform default status picklists for organization type-scoped status fields.
 * Keep in sync with client/src/utils/organizationStatusDefaults.ts
 */

const ORGANIZATION_STATUS_FIELD_KEYS = Object.freeze([
  'customerStatus',
  'partnerStatus',
  'vendorStatus',
]);

/** @type {Record<string, Array<{ value: string, label: string, color: string, enabled: boolean }>>} */
const DEFAULT_ORGANIZATION_STATUS_PICKLISTS = Object.freeze({
  customerStatus: Object.freeze([
    { value: 'Prospect', label: 'Prospect', color: '#6366F1', enabled: true },
    { value: 'Active', label: 'Active', color: '#16A34A', enabled: true },
    { value: 'On Hold', label: 'On Hold', color: '#D97706', enabled: true },
    { value: 'At Risk', label: 'At Risk', color: '#EA580C', enabled: true },
    { value: 'Inactive', label: 'Inactive', color: '#6B7280', enabled: true },
    { value: 'Churned', label: 'Churned', color: '#DC2626', enabled: true },
  ]),
  partnerStatus: Object.freeze([
    { value: 'Invited', label: 'Invited', color: '#6366F1', enabled: true },
    { value: 'Onboarding', label: 'Onboarding', color: '#2563EB', enabled: true },
    { value: 'Active', label: 'Active', color: '#16A34A', enabled: true },
    { value: 'Paused', label: 'Paused', color: '#D97706', enabled: true },
    { value: 'Inactive', label: 'Inactive', color: '#6B7280', enabled: true },
  ]),
  vendorStatus: Object.freeze([
    { value: 'Prospect', label: 'Prospect', color: '#6366F1', enabled: true },
    { value: 'Onboarding', label: 'Onboarding', color: '#2563EB', enabled: true },
    { value: 'Approved', label: 'Approved', color: '#16A34A', enabled: true },
    { value: 'Suspended', label: 'Suspended', color: '#D97706', enabled: true },
    { value: 'Inactive', label: 'Inactive', color: '#6B7280', enabled: true },
    { value: 'Rejected', label: 'Rejected', color: '#DC2626', enabled: true },
  ]),
});

function getDefaultOrganizationStatusFieldOptions(fieldKey) {
  const key = String(fieldKey || '').trim();
  const rows = DEFAULT_ORGANIZATION_STATUS_PICKLISTS[key];
  if (!rows) return [];
  return rows.map((row) => ({ ...row }));
}

function getDefaultOrganizationStatusPicklistsPolicy() {
  return {
    customerStatus: getDefaultOrganizationStatusFieldOptions('customerStatus'),
    partnerStatus: getDefaultOrganizationStatusFieldOptions('partnerStatus'),
    vendorStatus: getDefaultOrganizationStatusFieldOptions('vendorStatus'),
  };
}

function mergeOrganizationStatusPicklistsWithDefaults(picklists) {
  const defaults = getDefaultOrganizationStatusPicklistsPolicy();
  if (!picklists || typeof picklists !== 'object') return defaults;
  return {
    customerStatus:
      Array.isArray(picklists.customerStatus) && picklists.customerStatus.length > 0
        ? picklists.customerStatus
        : defaults.customerStatus,
    partnerStatus:
      Array.isArray(picklists.partnerStatus) && picklists.partnerStatus.length > 0
        ? picklists.partnerStatus
        : defaults.partnerStatus,
    vendorStatus:
      Array.isArray(picklists.vendorStatus) && picklists.vendorStatus.length > 0
        ? picklists.vendorStatus
        : defaults.vendorStatus,
  };
}

module.exports = {
  ORGANIZATION_STATUS_FIELD_KEYS,
  DEFAULT_ORGANIZATION_STATUS_PICKLISTS,
  getDefaultOrganizationStatusFieldOptions,
  getDefaultOrganizationStatusPicklistsPolicy,
  mergeOrganizationStatusPicklistsWithDefaults,
};
