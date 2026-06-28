const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  getDescendantRoleIdsFromRoles
} = require('../../services/roleHierarchyService');
const {
  userBypassesSharing,
  getOwnerFieldForModule
} = require('../../services/sharingResolver');

test('getDescendantRoleIds includes self and child roles', () => {
  const roles = [
    { _id: 'admin', parentRole: 'owner' },
    { _id: 'manager', parentRole: 'admin' },
    { _id: 'executive', parentRole: 'manager' },
    { _id: 'owner', parentRole: null }
  ];
  const ids = getDescendantRoleIdsFromRoles(roles, 'manager');
  assert.deepEqual(ids.sort(), ['executive', 'manager'].sort());
});

test('getDescendantRoleIds for executive is only self', () => {
  const roles = [
    { _id: 'admin', parentRole: 'owner' },
    { _id: 'manager', parentRole: 'admin' },
    { _id: 'executive', parentRole: 'manager' }
  ];
  const ids = getDescendantRoleIdsFromRoles(roles, 'executive');
  assert.deepEqual(ids, ['executive']);
});

test('userBypassesSharing for owner and canViewAllData', () => {
  assert.equal(userBypassesSharing({ isOwner: true }), true);
  assert.equal(userBypassesSharing({ _canViewAllData: true }), true);
  assert.equal(userBypassesSharing({ roleId: 'x' }, { canViewAllData: true }), true);
  assert.equal(userBypassesSharing({ roleId: 'x' }), false);
});

test('userBypassesSharing ignores canViewAllData when RBAC v2 enabled', () => {
  const v2Org = { settings: { rbacV2Enabled: true } };
  assert.equal(userBypassesSharing({ _canViewAllData: true }, null, v2Org), false);
  assert.equal(
    userBypassesSharing({ roleId: 'x' }, { canViewAllData: true }, v2Org),
    false
  );
  assert.equal(userBypassesSharing({ isOwner: true }, null, v2Org), true);
});

test('getOwnerFieldForModule maps deals and people', () => {
  assert.equal(getOwnerFieldForModule('deals'), 'assignedTo');
  assert.equal(getOwnerFieldForModule('people'), 'assignedTo');
  assert.equal(getOwnerFieldForModule('cases'), 'assignedTo');
});
