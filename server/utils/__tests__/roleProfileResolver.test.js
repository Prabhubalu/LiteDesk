const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeFieldPermissionMaps } = require('../../services/roleProfileResolver');

test('mergeFieldPermissionMaps applies role overrides on profile baseline', () => {
  const profile = {
    'SALES.deals.amount': 'read',
    'SALES.people.email': 'hidden'
  };
  const role = {
    'SALES.deals.amount': 'write'
  };

  const merged = mergeFieldPermissionMaps(profile, role);
  assert.equal(merged['SALES.deals.amount'], 'write');
  assert.equal(merged['SALES.people.email'], 'hidden');
});

test('mergeFieldPermissionMaps keeps profile-only keys when role has no override', () => {
  const profile = { 'SALES.deals.stage': 'read' };
  const role = {};
  const merged = mergeFieldPermissionMaps(profile, role);
  assert.equal(merged['SALES.deals.stage'], 'read');
});
