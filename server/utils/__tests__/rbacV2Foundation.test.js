const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSalesManagerPermissions,
  buildSalesStandardPermissions,
  buildPlatformFullPermissions
} = require('../../services/profileMatrixBuilders');
const {
  deriveAppAccessFromRole,
  mapRoleNameToLegacyEnum
} = require('../../services/roleEntitlementService');

test('platform full profile grants users.manageRoles', () => {
  const perms = buildPlatformFullPermissions();
  assert.equal(perms.users.manageRoles, true);
  assert.equal(perms.deals.scope, 'all');
});

test('sales manager profile has team scope on deals', () => {
  const perms = buildSalesManagerPermissions();
  assert.equal(perms.deals.scope, 'team');
  assert.equal(perms.deals.delete, false);
});

test('sales standard profile has own scope on deals', () => {
  const perms = buildSalesStandardPermissions();
  assert.equal(perms.deals.scope, 'own');
  assert.equal(perms.deals.create, true);
});

test('deriveAppAccessFromRole maps SALES entitlement', () => {
  const org = {
    enabledApps: [{ appKey: 'SALES', status: 'ACTIVE' }]
  };
  const role = {
    appEntitlements: [
      { appKey: 'SALES', enabled: true, seatConsuming: true, appRoleKey: 'USER' }
    ]
  };
  const { appAccess, allowedApps } = deriveAppAccessFromRole(role, org);
  assert.equal(appAccess.length, 1);
  assert.equal(appAccess[0].appKey, 'SALES');
  assert.equal(appAccess[0].roleKey, 'USER');
  assert.deepEqual(allowedApps, ['SALES']);
});

test('mapRoleNameToLegacyEnum maps sales roles', () => {
  assert.equal(mapRoleNameToLegacyEnum('Sales Executive'), 'user');
  assert.equal(mapRoleNameToLegacyEnum('Sales Manager'), 'manager');
  assert.equal(mapRoleNameToLegacyEnum('Administrator'), 'admin');
});
