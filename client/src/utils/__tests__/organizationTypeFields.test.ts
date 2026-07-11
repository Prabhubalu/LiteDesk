import { describe, expect, it } from 'vitest';
import {
  getOrganizationFieldsForType,
  getOrganizationFieldsForTypes,
  getOrganizationTypesForField,
  shouldShowOrganizationFieldForTypes,
  filterOrganizationSubmitPayloadByTypes,
  buildOrganizationSubmitPayload,
  getPrimaryOrganizationStatusFieldKey,
  resolveOrganizationKeyFieldStatus,
  isOrganizationDerivedStatusSystemOwned,
  resolveOrganizationDerivedStatusSaveFieldKey,
} from '@/platform/fields/organizationFieldModel';
import {
  getAllowedStatusesForOrganizationStatusField,
  getDefaultStatusForOrganizationStatusField,
} from '@/platform/organizations/organizationIntents';
import { organizationTypeDefsToPicklistOptions, isRetiredOrganizationTypeValue } from '@/utils/organizationTypeConfig';

describe('organization type field visibility', () => {
  it('returns platform defaults when no tenant override', () => {
    expect(getOrganizationFieldsForType('Customer', null)).toContain('customerStatus');
    expect(getOrganizationFieldsForType('Dealer', null)).toContain('dealerLevel');
  });

  it('uses tenant typeDefs fields when provided', () => {
    const defs = [{ value: 'Customer', fields: ['customerTier'] }];
    expect(getOrganizationFieldsForType('Customer', defs)).toEqual(['customerTier']);
  });

  it('unions fields across multiple selected types', () => {
    const fields = getOrganizationFieldsForTypes(['Customer', 'Partner'], null);
    expect(fields).toContain('customerStatus');
    expect(fields).toContain('partnerStatus');
  });

  it('always shows identity fields regardless of types', () => {
    expect(shouldShowOrganizationFieldForTypes('name', [], null)).toBe(true);
    expect(shouldShowOrganizationFieldForTypes('customerStatus', [], null)).toBe(false);
    expect(shouldShowOrganizationFieldForTypes('customerStatus', ['Customer'], null)).toBe(true);
  });

  it('maps field keys back to organization types', () => {
    expect(getOrganizationTypesForField('customerStatus')).toEqual(['Customer']);
    expect(getOrganizationTypesForField('dealerLevel')).toEqual(['Dealer']);
  });

  it('strips type-scoped fields from submit payload when type not selected', () => {
    const filtered = filterOrganizationSubmitPayloadByTypes(
      {
        name: 'Acme',
        types: ['Partner'],
        customerStatus: 'Active',
        partnerStatus: 'Invited',
        dealerLevel: 'Gold',
      },
      ['Partner'],
      null
    );
    expect(filtered.name).toBe('Acme');
    expect(filtered.partnerStatus).toBe('Invited');
    expect(filtered.customerStatus).toBeUndefined();
    expect(filtered.dealerLevel).toBeUndefined();
  });

  it('buildOrganizationSubmitPayload omits hidden fields on create', () => {
    const payload = buildOrganizationSubmitPayload(
      {
        name: ' Acme ',
        types: ['Customer'],
        customerStatus: 'Prospect',
        partnerStatus: 'Invited',
        industry: '',
      },
      null,
      'create'
    );
    expect(payload.name).toBe('Acme');
    expect(payload.customerStatus).toBe('Prospect');
    expect(payload.partnerStatus).toBeUndefined();
    expect(payload.industry).toBeUndefined();
  });

  it('resolves intent status options per status field', () => {
    expect(getAllowedStatusesForOrganizationStatusField('customerStatus', ['Customer'])).toContain(
      'Prospect'
    );
    expect(getAllowedStatusesForOrganizationStatusField('customerStatus', ['Partner'])).toEqual([]);
    expect(getDefaultStatusForOrganizationStatusField('partnerStatus', ['Partner'])).toBe('Invited');
    expect(getDefaultStatusForOrganizationStatusField('vendorStatus', ['Vendor'])).toBe('Prospect');
  });

  it('builds organization type picklist options with platform defaults', () => {
    expect(organizationTypeDefsToPicklistOptions(null).map((o) => o.value)).toEqual([
      'Customer',
      'Partner',
      'Vendor',
    ]);
    expect(
      organizationTypeDefsToPicklistOptions([
        { value: 'Customer', label: 'Customer', enabled: true },
        { value: 'Partner', label: 'Partner', enabled: false },
      ]    ).map((o) => o.value)
    ).toEqual(['Customer']);
  });

  it('filters retired organization types from picklist options', () => {
    expect(isRetiredOrganizationTypeValue('Dealer')).toBe(true);
    expect(
      organizationTypeDefsToPicklistOptions([
        { value: 'Customer', label: 'Customer', enabled: true },
        { value: 'Dealer', label: 'Dealer', enabled: true },
      ]).map((o) => o.value)
    ).toEqual(['Customer']);
  });

  it('resolves Key Fields derivedStatus from primary type status when derivedStatus is empty', () => {
    expect(getPrimaryOrganizationStatusFieldKey(['Customer', 'Partner'])).toBe('customerStatus');
    expect(
      resolveOrganizationKeyFieldStatus({
        types: ['Customer'],
        customerStatus: 'Prospect',
        derivedStatus: null,
      })
    ).toBe('Prospect');
    expect(
      resolveOrganizationKeyFieldStatus({
        types: ['Customer'],
        customerStatus: 'Prospect',
        derivedStatus: 'Active',
      })
    ).toBe('Active');
    expect(isOrganizationDerivedStatusSystemOwned({ derivedStatus: 'Active' })).toBe(true);
    expect(
      resolveOrganizationDerivedStatusSaveFieldKey({
        types: ['Customer'],
        derivedStatus: null,
      })
    ).toBe('customerStatus');
    expect(
      resolveOrganizationDerivedStatusSaveFieldKey({
        types: ['Customer'],
        derivedStatus: 'Active',
      })
    ).toBeNull();
  });
});
