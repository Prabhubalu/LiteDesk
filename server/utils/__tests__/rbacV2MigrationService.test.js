const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveLegacyRoleRename,
  resolveViewerMigrationStrategy,
  mapLegacyUserEnumToRoleName,
  applyRoleV2Backfill
} = require('../../services/rbacV2MigrationService');
const { SYSTEM_PROFILE_KEYS } = require('../../permissions/profileKeys');

test('resolveLegacyRoleRename — rename when target absent', () => {
  const result = resolveLegacyRoleRename('Admin', new Set(['Owner', 'Admin']));
  assert.equal(result.action, 'rename');
  assert.equal(result.targetName, 'Administrator');
});

test('resolveLegacyRoleRename — merge when Administrator exists', () => {
  const result = resolveLegacyRoleRename('Admin', new Set(['Owner', 'Administrator']));
  assert.equal(result.action, 'merge');
  assert.equal(result.targetName, 'Administrator');
});

test('resolveLegacyRoleRename — skip unknown legacy name', () => {
  const result = resolveLegacyRoleRename('Custom', new Set(['Custom']));
  assert.equal(result.action, 'skip');
});

test('resolveViewerMigrationStrategy — rename when no Sales Executive', () => {
  const result = resolveViewerMigrationStrategy({ name: 'Viewer' }, null);
  assert.equal(result.strategy, 'rename_to_executive');
});

test('resolveViewerMigrationStrategy — read only role when executive exists', () => {
  const result = resolveViewerMigrationStrategy({ name: 'Viewer' }, { name: 'Sales Executive' });
  assert.equal(result.strategy, 'reassign_to_read_only_role');
});

test('mapLegacyUserEnumToRoleName maps admin and viewer', () => {
  assert.equal(mapLegacyUserEnumToRoleName('admin'), 'Administrator');
  assert.equal(mapLegacyUserEnumToRoleName('viewer'), 'Viewer');
});

test('applyRoleV2Backfill sets profile and entitlements for Manager rule', () => {
  const role = { name: 'Manager', permissions: {} };
  const profileIdByKey = { [SYSTEM_PROFILE_KEYS.SALES_MANAGER]: 'profile-manager-id' };
  const organization = { enabledApps: [{ appKey: 'SALES', status: 'ACTIVE' }] };
  const updates = applyRoleV2Backfill(role, profileIdByKey, organization, {
    targetName: 'Sales Manager',
    profileKey: SYSTEM_PROFILE_KEYS.SALES_MANAGER,
    appRoleKey: 'MANAGER',
    canManageTeam: true
  });

  assert.equal(updates.privilegeMode, 'profile');
  assert.equal(String(updates.profileId), 'profile-manager-id');
  assert.equal(updates.appEntitlements[0].appRoleKey, 'MANAGER');
  assert.equal(updates.canManageTeam, false);
  assert.equal(updates.canViewAllData, false);
  assert.equal(updates.canExportData, false);
});
