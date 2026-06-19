const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateUserAssignmentPolicy
} = require('../../services/recordAssignmentService');
const {
  wouldCreateRoleHierarchyCycle,
  getDescendantRoleIdsFromRoles
} = require('../../services/roleHierarchyService');

const roles = [
  { _id: 'owner', parentRole: null },
  { _id: 'admin', parentRole: 'owner' },
  { _id: 'manager', parentRole: 'admin' },
  { _id: 'rep', parentRole: 'manager' }
];

test('evaluateUserAssignmentPolicy — all', () => {
  assert.equal(evaluateUserAssignmentPolicy('all', 'manager', 'owner', roles), true);
});

test('evaluateUserAssignmentPolicy — same_role_or_hierarchy allows self role', () => {
  assert.equal(evaluateUserAssignmentPolicy('same_role_or_hierarchy', 'manager', 'manager', roles), true);
});

test('evaluateUserAssignmentPolicy — same_role_or_hierarchy allows subordinate', () => {
  assert.equal(evaluateUserAssignmentPolicy('same_role_or_hierarchy', 'manager', 'rep', roles), true);
});

test('evaluateUserAssignmentPolicy — same_role_or_hierarchy denies parent role', () => {
  assert.equal(evaluateUserAssignmentPolicy('same_role_or_hierarchy', 'rep', 'manager', roles), false);
});

test('evaluateUserAssignmentPolicy — subordinates_only denies same role', () => {
  assert.equal(evaluateUserAssignmentPolicy('subordinates_only', 'manager', 'manager', roles), false);
});

test('evaluateUserAssignmentPolicy — subordinates_only allows strict subordinate', () => {
  assert.equal(evaluateUserAssignmentPolicy('subordinates_only', 'manager', 'rep', roles), true);
});

test('wouldCreateRoleHierarchyCycle — self parent', () => {
  assert.equal(wouldCreateRoleHierarchyCycle(roles, 'manager', 'manager'), true);
});

test('wouldCreateRoleHierarchyCycle — descendant parent', () => {
  assert.equal(wouldCreateRoleHierarchyCycle(roles, 'admin', 'manager'), true);
});

test('wouldCreateRoleHierarchyCycle — valid reparent', () => {
  assert.equal(wouldCreateRoleHierarchyCycle(roles, 'rep', 'admin'), false);
});

test('getDescendantRoleIdsFromRoles includes root and children', () => {
  const ids = getDescendantRoleIdsFromRoles(roles, 'admin');
  assert.deepEqual(ids.sort(), ['admin', 'manager', 'rep'].sort());
});
