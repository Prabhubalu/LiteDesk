import { describe, expect, it } from 'vitest';
import {
  defaultDealOrganizationRoleFromOrgTypes,
  isDealOrganizationRole,
  normalizeDealOrganizationRole,
} from '@/utils/dealOrganizationRoles';

describe('dealOrganizationRoles', () => {
  it('recognizes system deal organization roles', () => {
    expect(isDealOrganizationRole('customer')).toBe(true);
    expect(isDealOrganizationRole('Partner')).toBe(true);
    expect(isDealOrganizationRole('unknown')).toBe(false);
  });

  it('normalizes unknown roles to fallback', () => {
    expect(normalizeDealOrganizationRole('reseller')).toBe('reseller');
    expect(normalizeDealOrganizationRole('nope')).toBe('other');
    expect(normalizeDealOrganizationRole('nope', 'customer')).toBe('customer');
  });

  it('defaults role from organization type', () => {
    expect(defaultDealOrganizationRoleFromOrgTypes(['Partner'])).toBe('partner');
    expect(defaultDealOrganizationRoleFromOrgTypes(['Vendor'])).toBe('vendor');
    expect(defaultDealOrganizationRoleFromOrgTypes(['Distributor'])).toBe('distributor');
    expect(defaultDealOrganizationRoleFromOrgTypes(['Dealer'])).toBe('distributor');
    expect(defaultDealOrganizationRoleFromOrgTypes(['Customer'])).toBe('customer');
    expect(defaultDealOrganizationRoleFromOrgTypes([])).toBe('other');
    expect(defaultDealOrganizationRoleFromOrgTypes(null)).toBe('other');
  });

  it('prefers Customer when org has multiple types', () => {
    expect(defaultDealOrganizationRoleFromOrgTypes(['Partner', 'Customer'])).toBe('customer');
    expect(defaultDealOrganizationRoleFromOrgTypes(['Vendor', 'Partner'])).toBe('partner');
  });
});
