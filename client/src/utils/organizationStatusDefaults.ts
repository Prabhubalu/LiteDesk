/**
 * Platform default status picklists for organization type-scoped status fields.
 * Keep in sync with server/constants/organizationStatusDefaults.js
 */

export type OrganizationStatusPicklistRow = {
  value: string;
  label: string;
  color: string;
  enabled: boolean;
};

export const ORGANIZATION_STATUS_FIELD_KEYS = [
  'customerStatus',
  'partnerStatus',
  'vendorStatus',
] as const;

export type OrganizationStatusFieldKey = (typeof ORGANIZATION_STATUS_FIELD_KEYS)[number];

export const DEFAULT_ORGANIZATION_STATUS_PICKLISTS: Record<
  OrganizationStatusFieldKey,
  OrganizationStatusPicklistRow[]
> = {
  customerStatus: [
    { value: 'Prospect', label: 'Prospect', color: '#6366F1', enabled: true },
    { value: 'Active', label: 'Active', color: '#16A34A', enabled: true },
    { value: 'On Hold', label: 'On Hold', color: '#D97706', enabled: true },
    { value: 'At Risk', label: 'At Risk', color: '#EA580C', enabled: true },
    { value: 'Inactive', label: 'Inactive', color: '#6B7280', enabled: true },
    { value: 'Churned', label: 'Churned', color: '#DC2626', enabled: true },
  ],
  partnerStatus: [
    { value: 'Invited', label: 'Invited', color: '#6366F1', enabled: true },
    { value: 'Onboarding', label: 'Onboarding', color: '#2563EB', enabled: true },
    { value: 'Active', label: 'Active', color: '#16A34A', enabled: true },
    { value: 'Paused', label: 'Paused', color: '#D97706', enabled: true },
    { value: 'Inactive', label: 'Inactive', color: '#6B7280', enabled: true },
  ],
  vendorStatus: [
    { value: 'Prospect', label: 'Prospect', color: '#6366F1', enabled: true },
    { value: 'Onboarding', label: 'Onboarding', color: '#2563EB', enabled: true },
    { value: 'Approved', label: 'Approved', color: '#16A34A', enabled: true },
    { value: 'Suspended', label: 'Suspended', color: '#D97706', enabled: true },
    { value: 'Inactive', label: 'Inactive', color: '#6B7280', enabled: true },
    { value: 'Rejected', label: 'Rejected', color: '#DC2626', enabled: true },
  ],
};

export function getDefaultOrganizationStatusFieldOptions(
  fieldKey: string
): OrganizationStatusPicklistRow[] {
  const key = fieldKey as OrganizationStatusFieldKey;
  const rows = DEFAULT_ORGANIZATION_STATUS_PICKLISTS[key];
  return rows ? rows.map((row) => ({ ...row })) : [];
}
