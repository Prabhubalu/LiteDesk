'use strict';

const AssignmentRuleSet = require('../models/AssignmentRuleSet');
const Group = require('../models/Group');
const User = require('../models/User');
const { canReplyLiveChatSessions } = require('../utils/liveChatPermissionUtils');

const DEFAULT_RULE_ID = 'live_chat_default_routing';
const GROUP_NAME = 'Live Chat Agents';

async function ensureLiveChatAgentsGroup(organizationId) {
  const users = await User.find({
    organizationId,
    status: { $in: ['active', 'ACTIVE'] },
  })
    .select('_id role permissions isOwner')
    .lean();

  const memberIds = users
    .filter((user) => canReplyLiveChatSessions(user))
    .map((user) => user._id);

  const resolvedMemberIds = memberIds.length
    ? memberIds
    : users.slice(0, 10).map((user) => user._id);

  if (!resolvedMemberIds.length) return null;

  let group = await Group.findOne({
    organizationId,
    name: GROUP_NAME,
    isActive: { $ne: false },
  });

  if (group) {
    group.members = resolvedMemberIds;
    await group.save();
    return group.toObject ? group.toObject() : group;
  }

  group = await Group.create({
    organizationId,
    name: GROUP_NAME,
    description: 'Default agent pool for Live Chat assignment (created on addon install)',
    members: resolvedMemberIds,
    isActive: true,
    type: 'Team',
  });

  return group.toObject ? group.toObject() : group;
}

/**
 * Seed PLATFORM / live_chat_sessions assignment rules on addon install (idempotent).
 */
async function seedDefaultLiveChatAssignmentRulesForOrganization(
  organizationId,
  { initiatedByUserId = null } = {},
) {
  if (!organizationId) return { created: false, reason: 'invalid_org' };

  const existing = await AssignmentRuleSet.findOne({
    organizationId,
    appKey: 'PLATFORM',
    moduleKey: 'live_chat_sessions',
  }).lean();

  if (Array.isArray(existing?.rules) && existing.rules.length > 0) {
    return { created: false, reason: 'already_configured', ruleCount: existing.rules.length };
  }

  const group = await ensureLiveChatAgentsGroup(organizationId);
  if (!group?._id) {
    return { created: false, reason: 'no_agents_available' };
  }

  const rule = {
    ruleId: DEFAULT_RULE_ID,
    name: 'Route new chats to available agents',
    enabled: true,
    order: 0,
    triggerType: 'immediate',
    triggerConfig: { recheckConditionsAtExecution: true },
    conditions: { combinator: 'all', clauses: [] },
    primaryGroupId: group._id,
    distribution: { mode: 'availability_based' },
    fallbackGroupIds: [],
    escalation: { enabled: false },
    reassignment: { enabled: true, revertMode: 'reapply_rules', lockOnManualOverride: false },
    metadata: { assignTargetType: 'group', seededBy: 'live_chat_install' },
  };

  await AssignmentRuleSet.findOneAndUpdate(
    { organizationId, appKey: 'PLATFORM', moduleKey: 'live_chat_sessions' },
    {
      $set: {
        organizationId,
        appKey: 'PLATFORM',
        moduleKey: 'live_chat_sessions',
        enabled: true,
        simulationOnly: false,
        applyStrategy: 'new_records_only',
        rules: [rule],
        updatedBy: initiatedByUserId || null,
      },
      $setOnInsert: { version: 1 },
    },
    { upsert: true, new: true },
  );

  return { created: true, groupId: String(group._id) };
}

module.exports = {
  seedDefaultLiveChatAssignmentRulesForOrganization,
  ensureLiveChatAgentsGroup,
  GROUP_NAME,
  DEFAULT_RULE_ID,
};
