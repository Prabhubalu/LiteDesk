const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  userMatchesRuleTarget,
  validateRuleParty
} = require('../../services/sharingRuleService');
const { unionVisibilityFilters } = require('../../services/sharingResolver');

const roles = [
  { _id: 'director', parentRole: 'admin' },
  { _id: 'marketing', parentRole: 'admin' },
  { _id: 'admin', parentRole: null }
];

test('userMatchesRuleTarget — group member', async () => {
  const Group = require('../../models/Group');
  const originalFindOne = Group.findOne;
  Group.findOne = () => ({
    select: () => ({
      lean: async () => ({ members: ['user-marketing-1'] })
    })
  });

  try {
    const user = { _id: 'user-marketing-1', userType: 'INTERNAL' };
    const target = { type: 'group', groupId: 'group-marketing' };
    const match = await userMatchesRuleTarget(user, target, 'org-1', roles);
    assert.equal(match, true);
  } finally {
    Group.findOne = originalFindOne;
  }
});

test('userMatchesRuleTarget — role_subtree', async () => {
  const user = { _id: 'u1', roleId: 'marketing', userType: 'INTERNAL' };
  const target = { type: 'role_subtree', roleId: 'admin' };
  const match = await userMatchesRuleTarget(user, target, 'org-1', roles);
  assert.equal(match, true);
});

test('userMatchesRuleTarget — wrong role', async () => {
  const user = { _id: 'u1', roleId: 'marketing', userType: 'INTERNAL' };
  const target = { type: 'role', roleId: 'director' };
  const match = await userMatchesRuleTarget(user, target, 'org-1', roles);
  assert.equal(match, false);
});

test('validateRuleParty requires role for role source', () => {
  assert.equal(validateRuleParty({ type: 'role' }, ['role', 'group'], 'Source'), 'Source role is required');
});

test('unionVisibilityFilters merges base and grants', () => {
  const base = { ownerId: 'self' };
  const grants = [{ ownerId: { $in: ['director-user'] } }];
  const merged = unionVisibilityFilters(base, grants);
  assert.deepEqual(merged, {
    $or: [base, grants[0]]
  });
});
