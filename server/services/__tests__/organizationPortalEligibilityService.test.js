'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolvePortalEligibility,
  resolvePortalEligibilityConfig,
  matchPrimaryOrganizationType
} = require('../organizationPortalEligibilityService');

describe('organizationPortalEligibilityService', () => {
  it('returns ineligible when business org is missing', () => {
    const result = resolvePortalEligibility(null, {});
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'PORTAL_ORG_MISSING');
  });

  it('returns ineligible for tenant workspace org', () => {
    const result = resolvePortalEligibility({ isTenant: true, types: ['Customer'] }, {});
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'PORTAL_TENANT_ORG_NOT_ELIGIBLE');
  });

  it('returns ineligible when org type is not supported', () => {
    const result = resolvePortalEligibility(
      { isTenant: false, types: ['Internal'], customerStatus: 'Active' },
      {}
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'PORTAL_ORG_UNSUPPORTED_TYPE');
  });

  it('uses default fallback when picklist has no portalEligible flags', () => {
    const result = resolvePortalEligibility(
      {
        isTenant: false,
        types: ['Customer'],
        customerStatus: 'Active'
      },
      { statusTypes: { statusPicklists: { customerStatus: [{ value: 'Active', label: 'Active' }] } } }
    );
    assert.equal(result.eligible, true);
    assert.equal(result.matchedOrganizationType, 'CUSTOMER');
  });

  it('respects custom picklist portalEligible flag over defaults', () => {
    const result = resolvePortalEligibility(
      {
        isTenant: false,
        types: ['Customer'],
        customerStatus: 'Prospect'
      },
      {
        statusTypes: {
          statusPicklists: {
            customerStatus: [{ value: 'Prospect', label: 'Prospect', portalEligible: true }]
          }
        }
      }
    );
    assert.equal(result.eligible, true);
    assert.equal(result.statusValue, 'Prospect');
  });

  it('blocks when picklist explicitly marks status ineligible', () => {
    const result = resolvePortalEligibility(
      {
        isTenant: false,
        types: ['Customer'],
        customerStatus: 'Active'
      },
      {
        statusTypes: {
          statusPicklists: {
            customerStatus: [{ value: 'Active', label: 'Active', portalEligible: false }]
          }
        }
      }
    );
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'PORTAL_ORG_INACTIVE');
  });

  it('uses tenant rule eligibleStatusValues when picklist flags disabled', () => {
    const tenantSettings = {
      portalEligibility: {
        supportedOrganizationTypes: ['Customer'],
        rules: [
          {
            organizationType: 'Customer',
            statusFieldKey: 'customerStatus',
            eligibleStatusValues: ['Gold']
          }
        ],
        usePicklistPortalEligibleFlags: false
      }
    };
    const eligible = resolvePortalEligibility(
      { isTenant: false, types: ['Customer'], customerStatus: 'Gold' },
      tenantSettings
    );
    assert.equal(eligible.eligible, true);

    const blocked = resolvePortalEligibility(
      { isTenant: false, types: ['Customer'], customerStatus: 'Active' },
      tenantSettings
    );
    assert.equal(blocked.eligible, false);
  });

  it('merges tenant portalEligibility config with defaults', () => {
    const config = resolvePortalEligibilityConfig({
      portalEligibility: {
        supportedOrganizationTypes: ['Auditor']
      }
    });
    assert.deepEqual(config.supportedOrganizationTypes, ['Auditor']);
    assert.ok(Array.isArray(config.rules) && config.rules.length > 0);
  });

  it('prioritizes CUSTOMER over PARTNER when both types present', () => {
    const matched = matchPrimaryOrganizationType(['PARTNER', 'CUSTOMER'], ['CUSTOMER', 'PARTNER']);
    assert.equal(matched, 'CUSTOMER');
  });
});
