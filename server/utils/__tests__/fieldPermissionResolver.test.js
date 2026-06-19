const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFieldPermissionKey,
  lookupFieldPermission,
  resolveFieldPermission,
  isFieldHidden,
  isFieldReadOnly
} = require('../../services/fieldPermissionResolver');

test('buildFieldPermissionKey normalizes contacts to people', () => {
  assert.equal(buildFieldPermissionKey('SALES', 'contacts', 'email'), 'SALES.people.email');
});

test('lookupFieldPermission resolves app-scoped key', () => {
  const map = { 'SALES.deals.amount': 'read' };
  assert.equal(lookupFieldPermission(map, 'SALES', 'deals', 'amount'), 'read');
});

test('lookupFieldPermission falls back to _CORE key', () => {
  const map = { '_CORE.deals.amount': 'hidden' };
  assert.equal(lookupFieldPermission(map, null, 'deals', 'amount'), 'hidden');
});

test('lookupFieldPermission falls back to flat module key', () => {
  const map = { 'people.email': 'hidden' };
  assert.equal(lookupFieldPermission(map, 'SALES', 'people', 'email'), 'hidden');
});

test('resolveFieldPermission returns write for owner bypass', () => {
  const user = { isOwner: true, fieldPermissions: { 'SALES.deals.amount': 'hidden' } };
  assert.equal(
    resolveFieldPermission(user, { appKey: 'SALES', moduleKey: 'deals', fieldKey: 'amount' }),
    'write'
  );
});

test('resolveFieldPermission returns hidden when mapped', () => {
  const org = { settings: { rbacV2Enabled: true } };
  const user = {
    fieldPermissions: { 'SALES.people.email': 'hidden' },
    organization: org
  };
  assert.equal(
    resolveFieldPermission(user, { appKey: 'SALES', moduleKey: 'people', fieldKey: 'email', organization: org }),
    'hidden'
  );
});

test('isFieldReadOnly detects read state', () => {
  const org = { settings: { rbacV2Enabled: true } };
  const user = {
    fieldPermissions: { 'SALES.deals.amount': 'read' },
    organization: org
  };
  assert.equal(isFieldReadOnly(user, { appKey: 'SALES', moduleKey: 'deals', fieldKey: 'amount', organization: org }), true);
  assert.equal(isFieldHidden(user, { appKey: 'SALES', moduleKey: 'deals', fieldKey: 'amount', organization: org }), false);
});

test('resolveFieldPermission returns null when RBAC v2 off and no perms', () => {
  const user = { fieldPermissions: {} };
  assert.equal(
    resolveFieldPermission(user, { moduleKey: 'deals', fieldKey: 'amount', organization: { settings: {} } }),
    null
  );
});
