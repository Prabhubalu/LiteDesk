'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateExternalAppEntitlements,
  validateExternalRolePayload
} = require('../../utils/externalRoleValidation');
const {
  shouldSeedPortalRoles,
  shouldSeedExternalAuditorRole,
  filterTemplatesForOrganization
} = require('../portalExternalRoleSeedService');

describe('externalRoleValidation', () => {
  it('rejects external role without app entitlements', () => {
    const error = validateExternalAppEntitlements([]);
    assert.match(error, /at least one app entitlement/i);
  });

  it('rejects SALES entitlement on external role', () => {
    const error = validateExternalAppEntitlements([{
      appKey: 'SALES',
      enabled: true,
      appRoleKey: 'USER'
    }]);
    assert.match(error, /cannot include SALES/i);
  });

  it('accepts PORTAL CUSTOMER entitlement', () => {
    const error = validateExternalAppEntitlements([{
      appKey: 'PORTAL',
      enabled: true,
      appRoleKey: 'CUSTOMER'
    }]);
    assert.equal(error, null);
  });

  it('accepts AUDIT AUDITOR entitlement', () => {
    const error = validateExternalAppEntitlements([{
      appKey: 'AUDIT',
      enabled: true,
      appRoleKey: 'AUDITOR'
    }]);
    assert.equal(error, null);
  });

  it('ignores validation for internal roles', async () => {
    const error = await validateExternalRolePayload({ userType: 'INTERNAL' }, 'org-id');
    assert.equal(error, null);
  });
});

describe('portalExternalRoleSeedService helpers', () => {
  it('seeds portal roles when portal framework flag is enabled', () => {
    const org = { settings: { portalFrameworkV1Enabled: true }, enabledApps: [] };
    assert.equal(shouldSeedPortalRoles(org), true);
  });

  it('seeds portal roles when PORTAL app is enabled', () => {
    const org = { settings: {}, enabledApps: [{ appKey: 'PORTAL', status: 'ACTIVE' }] };
    assert.equal(shouldSeedPortalRoles(org), true);
  });

  it('does not seed portal roles without portal app or framework flag', () => {
    const org = { settings: {}, enabledApps: [{ appKey: 'SALES', status: 'ACTIVE' }] };
    assert.equal(shouldSeedPortalRoles(org), false);
  });

  it('includes External Auditor template when AUDIT app is enabled', () => {
    const org = { settings: {}, enabledApps: [{ appKey: 'AUDIT', status: 'ACTIVE' }] };
    assert.equal(shouldSeedExternalAuditorRole(org), true);
    const templates = filterTemplatesForOrganization(org);
    assert.ok(templates.some((t) => t.name === 'External Auditor'));
  });
});
