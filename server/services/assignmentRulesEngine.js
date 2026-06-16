const Group = require('../models/Group');

function getValueByPath(source, path) {
  if (!path) return undefined;
  const parts = String(path).split('.');
  let current = source;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function normalizeMultiValue(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* ignore invalid JSON */
      }
    }
    return trimmed ? [trimmed] : [];
  }
  return [value];
}

function scalarEqual(left, right) {
  if (left === right) return true;
  if (typeof left === 'string' && typeof right === 'string') {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
  return false;
}

function multiValueOverlap(leftValues, rightValues) {
  return rightValues.some((rightValue) => leftValues.some((leftValue) => scalarEqual(leftValue, rightValue)));
}

function evaluateClause(clause, data) {
  const leftRaw = getValueByPath(data, clause.field);
  const rightRaw = clause.value;
  const operator = String(clause.operator || 'equals').toLowerCase();
  const leftValues = normalizeMultiValue(leftRaw);
  const rightValues = normalizeMultiValue(rightRaw);
  const leftIsMulti = Array.isArray(leftRaw) || leftValues.length > 1
    || (typeof leftRaw === 'string' && String(leftRaw).trim().startsWith('['));
  const rightIsMulti = Array.isArray(rightRaw) || rightValues.length > 1
    || (typeof rightRaw === 'string' && String(rightRaw).trim().startsWith('['));

  switch (operator) {
    case 'equals':
    case '==':
    case '===':
      if (leftIsMulti || rightIsMulti) {
        return multiValueOverlap(leftValues, rightValues);
      }
      if (leftRaw === rightRaw) return true;
      return scalarEqual(leftRaw, rightRaw);
    case 'not_equals':
    case '!=':
    case '!==':
      if (leftIsMulti || rightIsMulti) {
        return !multiValueOverlap(leftValues, rightValues);
      }
      if (leftRaw === rightRaw) return false;
      return !scalarEqual(leftRaw, rightRaw);
    case 'contains':
      if (leftIsMulti) {
        return rightValues.some((rightValue) => multiValueOverlap(leftValues, [rightValue]));
      }
      return String(leftRaw || '').toLowerCase().includes(String(rightRaw || '').toLowerCase());
    case 'in':
      if (rightValues.length === 0) return false;
      if (leftIsMulti || Array.isArray(leftRaw)) return multiValueOverlap(leftValues, rightValues);
      return rightValues.some((rightValue) => scalarEqual(leftRaw, rightValue));
    case 'not_in':
      if (rightValues.length === 0) return true;
      if (leftIsMulti || Array.isArray(leftRaw)) return !multiValueOverlap(leftValues, rightValues);
      return !rightValues.some((rightValue) => scalarEqual(leftRaw, rightValue));
    case 'exists':
      if (Array.isArray(leftRaw)) return leftRaw.length > 0;
      return leftRaw !== undefined && leftRaw !== null && leftRaw !== '';
    case 'gt':
      return Number(leftRaw) > Number(rightRaw);
    case 'gte':
      return Number(leftRaw) >= Number(rightRaw);
    case 'lt':
      return Number(leftRaw) < Number(rightRaw);
    case 'lte':
      return Number(leftRaw) <= Number(rightRaw);
    default:
      return false;
  }
}

function evaluateConditionGroup(group, data) {
  if (!group || !Array.isArray(group.clauses) || group.clauses.length === 0) return true;
  const combinator = String(group.combinator || 'all').toLowerCase();
  const results = group.clauses.map((clause) => evaluateClause(clause, data));
  return combinator === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function chooseUserFromGroup({ mode, group, userWeights = [], context = {} }) {
  const members = Array.isArray(group?.members) ? group.members.map((id) => id.toString()) : [];
  if (mode === 'queue') {
    return { assignedUserId: null, assignmentState: 'queued', strategyDetail: 'queue_claim' };
  }
  if (members.length === 0) {
    return { assignedUserId: null, assignmentState: 'skipped', strategyDetail: 'group_has_no_members' };
  }

  if (mode === 'weighted') {
    const ranked = userWeights
      .map((entry) => ({ userId: entry.userId?.toString(), weight: Number(entry.weight || 0) }))
      .filter((entry) => entry.userId && members.includes(entry.userId) && entry.weight > 0)
      .sort((a, b) => b.weight - a.weight);
    const selected = ranked[0]?.userId || members[0];
    return { assignedUserId: selected, assignmentState: 'assigned', strategyDetail: 'weighted_highest' };
  }

  if (mode === 'availability_based') {
    const available = Array.isArray(context.availableUserIds)
      ? context.availableUserIds.map((id) => id.toString())
      : [];
    const selected = members.find((id) => available.includes(id));
    return selected
      ? { assignedUserId: selected, assignmentState: 'assigned', strategyDetail: 'availability_first' }
      : {
        assignedUserId: null,
        assignmentState: 'queued',
        strategyDetail: 'off_hours_deferred'
      };
  }

  if (mode === 'load_balanced') {
    // Step 7A: simulation-only placeholder; real load metrics added in execution phases.
    return { assignedUserId: members[0], assignmentState: 'assigned', strategyDetail: 'load_balanced_placeholder' };
  }

  if (mode === 'round_robin') {
    const prevRaw = context.previousOwnerId != null ? context.previousOwnerId : context.caseOwnerId;
    const prevStr = prevRaw != null ? String(prevRaw) : null;
    if (members.length === 1) {
      return {
        assignedUserId: members[0],
        assignmentState: 'assigned',
        strategyDetail: 'round_robin_single_member'
      };
    }
    if (prevStr && members.includes(prevStr)) {
      const idx = members.indexOf(prevStr);
      const next = members[(idx + 1) % members.length];
      return { assignedUserId: next, assignmentState: 'assigned', strategyDetail: 'round_robin_rotate' };
    }
    const rid = context.recordId != null ? String(context.recordId) : '';
    let hash = 0;
    for (let i = 0; i < rid.length; i += 1) {
      hash = (hash * 31 + rid.charCodeAt(i)) >>> 0;
    }
    const pick = members[hash % members.length];
    return { assignedUserId: pick, assignmentState: 'assigned', strategyDetail: 'round_robin_seeded' };
  }

  return { assignedUserId: members[0], assignmentState: 'assigned', strategyDetail: 'distribution_fallback_first_member' };
}

async function resolveGroupCandidates(organizationId, primaryGroupId, fallbackGroupIds = []) {
  const groupIds = [primaryGroupId, ...(fallbackGroupIds || [])].filter(Boolean);
  const groups = await Group.find({
    organizationId,
    _id: { $in: groupIds },
    isActive: true
  })
    .select('_id name members isActive')
    .lean();
  const map = new Map(groups.map((group) => [group._id.toString(), group]));
  return groupIds.map((id) => map.get(id.toString())).filter(Boolean);
}

function isCustomAssignTarget(rule) {
  if (rule?.metadata?.assignTargetType === 'custom') return true;
  const ids = rule?.metadata?.customUserIds;
  return Array.isArray(ids) && ids.length > 0;
}

function getCustomUserIds(rule) {
  const ids = rule?.metadata?.customUserIds;
  return Array.isArray(ids) ? ids.map((id) => String(id)).filter(Boolean) : [];
}

function buildVirtualGroupFromCustom(rule) {
  const members = getCustomUserIds(rule);
  return { _id: null, name: 'Custom', members };
}

function getEnabledMemberIds(rule) {
  const ids = rule?.metadata?.enabledMemberIds;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  return ids.map((id) => String(id)).filter(Boolean);
}

function applyPrimaryGroupMemberFilter(group, rule) {
  if (!group) return group;
  const enabledIds = getEnabledMemberIds(rule);
  if (!enabledIds) return group;
  const members = (group.members || [])
    .map((id) => String(id))
    .filter((id) => enabledIds.includes(id));
  return { ...group, members };
}

function normalizeRules(rules) {
  return (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && rule.enabled !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

async function simulateAssignment({ organizationId, appKey, moduleKey, rules, record = {}, context = {} }) {
  const orderedRules = normalizeRules(rules);
  let enrichedContext = { ...context };

  const needsAvailability = orderedRules.some(
    (rule) => rule?.enabled !== false && rule.distribution?.mode === 'availability_based'
  );
  if (needsAvailability && !Array.isArray(context.availableUserIds)) {
    const {
      filterUsersAvailableNow,
      collectMemberIdsForRules
    } = require('./assignmentAvailabilityService');
    const memberIds = await collectMemberIdsForRules(organizationId, orderedRules);
    enrichedContext.availableUserIds = await filterUsersAvailableNow(organizationId, memberIds);
  }

  const trace = [];

  for (const rule of orderedRules) {
    const matched = evaluateConditionGroup(rule.conditions, record);
    trace.push({
      ruleId: rule.ruleId,
      name: rule.name,
      order: rule.order,
      matched
    });

    if (!matched) continue;

    let groupCandidates;
    if (isCustomAssignTarget(rule)) {
      const virtual = buildVirtualGroupFromCustom(rule);
      groupCandidates = virtual.members.length > 0 ? [virtual] : [];
    } else {
      groupCandidates = await resolveGroupCandidates(
        organizationId,
        rule.primaryGroupId,
        rule.fallbackGroupIds || []
      );
      if (groupCandidates.length > 0) {
        groupCandidates[0] = applyPrimaryGroupMemberFilter(groupCandidates[0], rule);
      }
    }

    if (groupCandidates.length === 0) {
      return {
        appKey,
        moduleKey,
        matched: true,
        ruleId: rule.ruleId,
        outcome: {
          state: 'skipped',
          reason: 'no_group_candidates',
          assignedGroupId: null,
          assignedUserId: null
        },
        trace
      };
    }

    let chosenGroup = groupCandidates[0];
    let userDecision = chooseUserFromGroup({
      mode: rule.distribution?.mode || 'queue',
      group: chosenGroup,
      userWeights: rule.distribution?.userWeights || [],
      context: enrichedContext
    });

    if (!userDecision.assignedUserId && userDecision.assignmentState !== 'queued' && groupCandidates.length > 1) {
      for (let index = 1; index < groupCandidates.length; index += 1) {
        const fallbackGroup = groupCandidates[index];
        const fallbackDecision = chooseUserFromGroup({
          mode: rule.distribution?.mode || 'queue',
          group: fallbackGroup,
          userWeights: rule.distribution?.userWeights || [],
          context: enrichedContext
        });
        if (fallbackDecision.assignedUserId || fallbackDecision.assignmentState === 'queued') {
          chosenGroup = fallbackGroup;
          userDecision = {
            ...fallbackDecision,
            strategyDetail: `${fallbackDecision.strategyDetail}|fallback_group`
          };
          break;
        }
      }
    }

    return {
      appKey,
      moduleKey,
      matched: true,
      ruleId: rule.ruleId,
      outcome: {
        state: userDecision.assignmentState,
        reason: userDecision.strategyDetail,
        assignedGroupId: chosenGroup?._id?.toString() || null,
        assignedUserId: userDecision.assignedUserId || null,
        groupName: chosenGroup?.name || null
      },
      trace
    };
  }

  return {
    appKey,
    moduleKey,
    matched: false,
    ruleId: null,
    outcome: {
      state: 'skipped',
      reason: 'no_rule_matched',
      assignedGroupId: null,
      assignedUserId: null
    },
    trace
  };
}

module.exports = {
  simulateAssignment,
  evaluateClause,
  evaluateConditionGroup,
  getValueByPath,
  normalizeMultiValue
};
