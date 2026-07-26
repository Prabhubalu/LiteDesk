const mongoose = require('mongoose');
const AssignmentRuleSet = require('../models/AssignmentRuleSet');
const AssignmentExecutionLog = require('../models/AssignmentExecutionLog');
const Group = require('../models/Group');
const { simulateAssignment } = require('./assignmentRulesEngine');
const { enqueueOffHoursDeferredAssignment } = require('./assignmentAvailabilityService');
const { emitSalesRecordOwnerAssignedNotify } = require('./assignmentSalesOwnerNotify');
const { getAdapter } = require('./assignment/assignmentModuleRegistry');
const { resolveModuleAppKey } = require('./assignment/assignmentModuleMetadataService');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

function buildExecutionId(prefix = 'asg') {
  return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

function getAssignmentControl(caseRecord) {
  const control = caseRecord.assignmentControl && typeof caseRecord.assignmentControl === 'object'
    ? caseRecord.assignmentControl
    : {};
  return {
    isLocked: Boolean(control.isLocked),
    lockReason: control.lockReason || null,
    lockRuleId: control.lockRuleId || null,
    lockedAt: control.lockedAt || null,
    lockedBy: control.lockedBy || null,
    manualOverrideAt: control.manualOverrideAt || null,
    previousOwnerId: control.previousOwnerId || null
  };
}

function setAssignmentLock(caseRecord, { lockReason, lockRuleId = null, actorId = null, previousOwnerId = null }) {
  const current = getAssignmentControl(caseRecord);
  caseRecord.assignmentControl = {
    ...current,
    isLocked: true,
    lockReason: lockReason || 'assignment_locked',
    lockRuleId: lockRuleId || null,
    lockedAt: new Date(),
    lockedBy: actorId || null,
    previousOwnerId: previousOwnerId || current.previousOwnerId || caseRecord.assignedTo || null
  };
}

function clearAssignmentLock(caseRecord) {
  const current = getAssignmentControl(caseRecord);
  caseRecord.assignmentControl = {
    ...current,
    isLocked: false,
    lockReason: null,
    lockRuleId: null,
    lockedAt: null
  };
}

function isRelevantReevaluation(changedFields = [], adapter = null) {
  if (adapter?.shouldReevaluate) {
    return adapter.shouldReevaluate(changedFields);
  }
  const relevant = new Set([
    'priority',
    'caseType',
    'channel',
    'status',
    'contactId',
    'organizationRefId'
  ]);
  return changedFields.some((field) => relevant.has(field));
}

/**
 * True when automatic assignment must not run on record updates (any changed field).
 * Create flows use changedFields = [].
 * Aligns with AssignmentRuleSet.applyStrategy: new_records_only, manual_re_evaluation, freeze_mode.
 */
function shouldSkipAutoAssignmentOnUpdate(applyStrategy) {
  const s = String(applyStrategy || 'new_records_only').toLowerCase().trim();
  return (
    s === 'new_records_only' ||
    s === 'manual_re_evaluation' ||
    s === 'freeze_mode'
  );
}

const MODULE_APP_KEY_CANDIDATES = {
  people: ['SALES', 'PLATFORM', 'HELPDESK'],
  cases: ['HELPDESK'],
  deals: ['SALES'],
  tasks: ['SALES'],
  organizations: ['SALES'],
  events: ['SALES'],
  items: ['SALES'],
  forms: ['SALES'],
  live_chat_sessions: ['PLATFORM']
};

function buildAppKeyCandidates(appKey, moduleKey) {
  const mk = String(moduleKey || '').toLowerCase();
  const preferred = appKey ? String(appKey).toUpperCase() : null;
  const fallbacks = MODULE_APP_KEY_CANDIDATES[mk] || ['SALES', 'HELPDESK', 'PLATFORM'];
  return [...new Set([preferred, ...fallbacks].filter(Boolean))];
}

async function loadImmediateRuleSet({ organizationId, appKey, moduleKey }) {
  const mk = String(moduleKey || '').toLowerCase();
  const candidates = buildAppKeyCandidates(appKey, mk);

  for (const candidateAppKey of candidates) {
    const ruleSet = await AssignmentRuleSet.findOne({
      organizationId,
      appKey: candidateAppKey,
      moduleKey: mk,
      enabled: true
    }).lean();
    if (!ruleSet) continue;

    const immediateRules = (ruleSet.rules || []).filter(
      (rule) => rule?.enabled !== false && rule.triggerType === 'immediate'
    );
    if (immediateRules.length === 0) continue;

    return {
      ...ruleSet,
      appKey: candidateAppKey,
      rules: immediateRules
    };
  }

  return null;
}

async function findLatestAssignmentLog({ organizationId, appKey, moduleKey, recordId }) {
  return AssignmentExecutionLog.findOne({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    status: 'assigned'
  })
    .sort({ createdAt: -1 })
    .lean();
}

async function resolveEscalationOwner({ organizationId, chainGroupIds = [], currentOwnerId }) {
  if (!Array.isArray(chainGroupIds) || chainGroupIds.length === 0) return null;
  const groups = await Group.find({
    organizationId,
    _id: { $in: chainGroupIds },
    isActive: true
  })
    .select('_id members')
    .lean();
  const map = new Map(groups.map((group) => [group._id.toString(), group]));

  for (const groupId of chainGroupIds) {
    const row = map.get(groupId.toString());
    const members = Array.isArray(row?.members) ? row.members.map((id) => id.toString()) : [];
    const selected = members.find((id) => id !== currentOwnerId) || members[0];
    if (selected) {
      return { assignedTo: selected, groupId: groupId.toString() };
    }
  }
  return null;
}

function calculateSlaElapsedPercent(caseRecord) {
  const cycle = caseRecord?.currentSlaCycle;
  const startedAt = cycle?.startedAt ? new Date(cycle.startedAt) : null;
  const targetAt = cycle?.resolutionTargetAt ? new Date(cycle.resolutionTargetAt) : null;
  if (!startedAt || !targetAt || Number.isNaN(startedAt.getTime()) || Number.isNaN(targetAt.getTime())) {
    return null;
  }
  const totalMs = targetAt.getTime() - startedAt.getTime();
  if (totalMs <= 0) return null;
  const elapsedMs = Date.now() - startedAt.getTime();
  return Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
}

async function maybeApplyEscalation({
  caseRecord,
  rule,
  actorId,
  organizationId,
  appKey,
  moduleKey,
  recordId,
  idempotencyKey
}) {
  if (!rule?.escalation?.enabled || rule.escalation.actionType !== 'reassign_group') {
    return { escalated: false };
  }

  const elapsedPercent = calculateSlaElapsedPercent(caseRecord);
  if (elapsedPercent == null) return { escalated: false };
  if (elapsedPercent < Number(rule.escalation.thresholdPercent || 100)) {
    return { escalated: false };
  }

  const escalationTarget = await resolveEscalationOwner({
    organizationId,
    chainGroupIds: rule.escalation.chainGroupIds || [],
    currentOwnerId: toIdString(caseRecord.assignedTo)
  });
  if (!escalationTarget?.assignedTo) {
    return { escalated: false };
  }

  const previousOwnerId = toIdString(caseRecord.assignedTo);
  if (previousOwnerId === escalationTarget.assignedTo) {
    return { escalated: false };
  }

  caseRecord.assignedTo = escalationTarget.assignedTo;
  caseRecord.updatedBy = actorId || caseRecord.updatedBy || null;
  caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
  caseRecord.activities.push({
    activityType: 'assignment_escalated',
    message: 'Case owner escalated by assignment escalation chain',
    internal: true,
    metadata: {
      ruleId: rule.ruleId,
      assignedGroupId: escalationTarget.groupId,
      elapsedPercent
    },
    actorId: actorId || null,
    actorName: 'Assignment Escalation',
    createdAt: new Date()
  });
  await caseRecord.save();

  await createExecutionLog({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    triggerSource: 'immediate',
    ruleId: rule.ruleId,
    previousOwnerId,
    newOwnerId: escalationTarget.assignedTo,
    assignedGroupId: escalationTarget.groupId,
    status: 'assigned',
    idempotencyKey: `${idempotencyKey}:escalation`,
    details: {
      escalation: true,
      elapsedPercent,
      thresholdPercent: Number(rule.escalation.thresholdPercent || 100)
    }
  });

  return {
    escalated: true,
    previousOwnerId,
    newOwnerId: escalationTarget.assignedTo,
    assignedGroupId: escalationTarget.groupId
  };
}

async function registerManualOwnerOverride({ caseRecord, actorId, previousOwnerId }) {
  if (!caseRecord?._id || !caseRecord?.organizationId) return { processed: false };
  const organizationId = caseRecord.organizationId;
  const appKey = 'HELPDESK';
  const moduleKey = 'cases';
  const recordId = toIdString(caseRecord._id);

  const ruleSet = await loadImmediateRuleSet({ organizationId, appKey, moduleKey });
  const hasLockOnManualOverride = (ruleSet?.rules || []).some(
    (rule) => rule?.reassignment?.lockOnManualOverride === true
  );

  if (hasLockOnManualOverride) {
    setAssignmentLock(caseRecord, {
      lockReason: 'manual_override_lock',
      actorId,
      previousOwnerId
    });
    caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
    caseRecord.activities.push({
      activityType: 'assignment_locked',
      message: 'Assignment locked due to manual owner override',
      internal: true,
      metadata: { reason: 'manual_override' },
      actorId: actorId || null,
      actorName: 'Assignment Engine',
      createdAt: new Date()
    });
    await caseRecord.save();
  } else {
    clearAssignmentLock(caseRecord);
    caseRecord.assignmentControl = {
      ...getAssignmentControl(caseRecord),
      manualOverrideAt: new Date(),
      previousOwnerId: previousOwnerId || caseRecord.assignmentControl?.previousOwnerId || null
    };
    await caseRecord.save();
  }

  await createExecutionLog({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    triggerSource: 'manual_override',
    ruleId: null,
    previousOwnerId,
    newOwnerId: toIdString(caseRecord.assignedTo),
    assignedGroupId: null,
    status: hasLockOnManualOverride ? 'skipped' : 'assigned',
    idempotencyKey: `manual_override:${recordId}:${Date.now()}`,
    details: {
      manualOverride: true,
      lockApplied: hasLockOnManualOverride
    }
  });

  return { processed: true, lockApplied: hasLockOnManualOverride };
}

async function maybeEnqueueOffHoursAssignment({
  organizationId,
  appKey,
  moduleKey,
  recordId,
  ruleSet,
  simulation,
  actorId
}) {
  const state = simulation?.outcome?.state || 'skipped';
  if (state !== 'queued' || simulation?.outcome?.reason !== 'off_hours_deferred') {
    return { deferred: false };
  }
  const matchedRule = (ruleSet?.rules || []).find((rule) => rule.ruleId === simulation.ruleId);
  if (!matchedRule) return { deferred: false };

  const enqueueResult = await enqueueOffHoursDeferredAssignment({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    rule: matchedRule,
    ruleSetVersion: ruleSet.version,
    actorId
  });
  return { deferred: true, enqueueResult };
}

async function createExecutionLog({
  organizationId,
  appKey,
  moduleKey,
  recordId,
  triggerSource,
  ruleId,
  previousOwnerId,
  newOwnerId,
  assignedGroupId,
  status,
  idempotencyKey,
  details
}) {
  await AssignmentExecutionLog.create({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    executionId: buildExecutionId(triggerSource === 'manual_override' ? 'asg_man' : 'asg'),
    triggerSource,
    ruleId: ruleId || null,
    previousOwnerId: mongoose.Types.ObjectId.isValid(previousOwnerId) ? previousOwnerId : null,
    newOwnerId: mongoose.Types.ObjectId.isValid(newOwnerId) ? newOwnerId : null,
    assignedGroupId: mongoose.Types.ObjectId.isValid(assignedGroupId) ? assignedGroupId : null,
    status,
    idempotencyKey,
    isManual: triggerSource === 'manual_override',
    details: details || {}
  });
}

const SALES_MODULE_ASSIGNMENT_PROFILES = {
  people: {
    ownerPath: 'assignedTo',
    reevaluateFields: new Set([
      'assignedTo',
      'lead_owner',
      'organization',
      'participations',
      'derivedStatus',
      'customFields',
      'tags',
      'sales_type',
      'lead_status',
      'contact_status',
      'type',
      'helpdesk_role',
      'do_not_contact'
    ])
  },
  deals: {
    ownerPath: 'assignedTo',
    reevaluateFields: new Set([
      'assignedTo',
      'stage',
      'pipeline',
      'status',
      'priority',
      'amount',
      'accountId',
      'contactId',
      'probability',
      'dealPeople',
      'dealOrganizations',
      'tags',
      'customFields',
      'type',
      'derivedStatus'
    ])
  },
  organizations: {
    ownerPath: 'assignedTo',
    reevaluateFields: new Set([
      'assignedTo',
      'types',
      'customerStatus',
      'partnerStatus',
      'vendorStatus',
      'derivedStatus',
      'customFields',
      'tags',
      'territory',
      'channelRegion',
      'customerTier',
      'partnerTier',
      'accountManager',
      'industry',
      'name'
    ])
  },
  tasks: {
    ownerPath: 'assignedTo',
    reevaluateFields: new Set([
      'assignedTo',
      'status',
      'priority',
      'relatedTo',
      'projectId',
      'tags',
      'customFields',
      'dueDate',
      'title'
    ])
  }
};

function buildSalesRecordForAssignmentRules(moduleKey, recordDoc) {
  const plain =
    recordDoc && typeof recordDoc.toObject === 'function'
      ? recordDoc.toObject({ depopulate: true, flattenMaps: true })
      : { ...(recordDoc || {}) };
  if (moduleKey === 'people') {
    const { getSalesParticipationValues } = require('../utils/getSalesParticipationValues');
    const { role, lead_status, contact_status } = getSalesParticipationValues(plain);
    return {
      ...plain,
      sales_type: role,
      lead_status,
      contact_status,
      type: role
    };
  }
  return plain;
}

function shouldRunSalesReevaluation(moduleKey, changedFields) {
  const adapter = getAdapter(moduleKey);
  if (adapter?.shouldReevaluate) {
    return adapter.shouldReevaluate(changedFields);
  }
  const profile = SALES_MODULE_ASSIGNMENT_PROFILES[moduleKey];
  if (!profile) return false;
  if (!Array.isArray(changedFields) || changedFields.length === 0) return true;
  return changedFields.some((f) => profile.reevaluateFields.has(f));
}

function getOwnerFromRecord(record, ownerPath) {
  const v = record[ownerPath];
  if (v == null) return null;
  if (typeof v === 'object' && v._id) return toIdString(v._id);
  return toIdString(v);
}

function setOwnerOnRecord(record, ownerPath, userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  record[ownerPath] = new mongoose.Types.ObjectId(userId);
  record.markModified(ownerPath);
}

/**
 * Immediate assignment for SALES-backed modules (people, deals, …).
 * Respects rule set simulationOnly; logs to AssignmentExecutionLog; optional activity log line.
 */
async function runImmediateAssignmentForSalesRecord({
  record,
  moduleKey,
  appKey = null,
  actorId,
  triggerSource = 'immediate',
  changedFields = [],
  tenantOrganizationId = null
}) {
  const key = String(moduleKey || '').toLowerCase();
  const resolvedHintAppKey = appKey
    ? String(appKey).toUpperCase()
    : await resolveModuleAppKey(tenantOrganizationId || record?.organizationId, key, null);
  const adapter = getAdapter(key, { appKey: resolvedHintAppKey || 'SALES' });
  const profile = SALES_MODULE_ASSIGNMENT_PROFILES[key];
  const organizationId = tenantOrganizationId || record?.organizationId;
  if ((!profile && !adapter) || !record?._id || !organizationId) {
    return { executed: false, reason: 'invalid_profile_or_record' };
  }
  if (triggerSource === 'immediate' && changedFields.length > 0 && !shouldRunSalesReevaluation(key, changedFields)) {
    return { executed: false, reason: 'no_relevant_changes' };
  }
  const recordId = toIdString(record._id);
  const ownerPath = adapter?.ownerPath || profile?.ownerPath;

  const ruleSet = await loadImmediateRuleSet({
    organizationId,
    appKey: resolvedHintAppKey,
    moduleKey: key
  });
  const appKeyForExecution = ruleSet?.appKey || resolvedHintAppKey || 'SALES';
  if (!ruleSet || !Array.isArray(ruleSet.rules) || ruleSet.rules.length === 0) {
    return { executed: false, reason: 'no_immediate_rules' };
  }
  if (ruleSet.simulationOnly) {
    return { executed: false, reason: 'simulation_only_enabled' };
  }
  if (triggerSource === 'immediate' && changedFields.length > 0 && shouldSkipAutoAssignmentOnUpdate(ruleSet.applyStrategy)) {
    return { executed: false, reason: 'apply_strategy_skips_updates' };
  }

  const idempotencyKey = [
    'sales_immediate',
    key,
    recordId,
    toIdString(record.updatedAt?.getTime?.() || record.updatedAt || Date.now()),
    String(ruleSet.version || 1)
  ].join(':');

  const existing = await AssignmentExecutionLog.findOne({
    organizationId,
    appKey: appKeyForExecution,
    moduleKey: key,
    recordId,
    idempotencyKey
  })
    .select('_id')
    .lean();
  if (existing) {
    return { executed: false, reason: 'idempotent_replay' };
  }

  const previousOwnerId = adapter?.getOwner
    ? adapter.getOwner(record)
    : getOwnerFromRecord(record, ownerPath);
  const ruleInput = buildSalesRecordForAssignmentRules(key, record);
  const simulation = await simulateAssignment({
    organizationId,
    appKey: appKeyForExecution,
    moduleKey: key,
    rules: ruleSet.rules,
    record: ruleInput,
    context: { previousOwnerId, recordId }
  });
  const nextOwnerId = toIdString(simulation?.outcome?.assignedUserId);
  const assignedGroupId = toIdString(simulation?.outcome?.assignedGroupId);
  const state = simulation?.outcome?.state || 'skipped';
  const canAssign = state === 'assigned' && mongoose.Types.ObjectId.isValid(nextOwnerId);
  const ownerChanged = canAssign && previousOwnerId !== nextOwnerId;

  if (ownerChanged) {
    if (adapter?.setOwner) {
      adapter.setOwner(record, nextOwnerId);
    } else {
      setOwnerOnRecord(record, ownerPath, nextOwnerId);
    }
    if (key === 'people') {
      if (!Array.isArray(record.activityLogs)) record.activityLogs = [];
      record.activityLogs.push({
        user: 'Assignment Engine',
        userId: actorId || null,
        action: 'assignment_auto_applied',
        message: 'Assigned by automation rules',
        details: { ruleId: simulation.ruleId, assignedGroupId },
        timestamp: new Date()
      });
    } else if (key === 'deals') {
      if (!Array.isArray(record.activityLogs)) record.activityLogs = [];
      record.activityLogs.push({
        user: 'Assignment Engine',
        userId: actorId || null,
        action: 'assignment_auto_applied',
        details: { ruleId: simulation.ruleId, assignedGroupId },
        timestamp: new Date()
      });
    } else if (key === 'organizations') {
      if (!Array.isArray(record.activityLogs)) record.activityLogs = [];
      record.activityLogs.push({
        user: 'Assignment Engine',
        userId: actorId || null,
        action: 'assignment_auto_applied',
        details: { ruleId: simulation.ruleId, assignedGroupId },
        timestamp: new Date()
      });
    } else if (key === 'tasks') {
      if (!Array.isArray(record.activityLogs)) record.activityLogs = [];
      record.activityLogs.push({
        user: 'Assignment Engine',
        userId: actorId || null,
        action: 'assignment_auto_applied',
        details: { ruleId: simulation.ruleId, assignedGroupId },
        timestamp: new Date()
      });
    }
    await record.save();

    emitSalesRecordOwnerAssignedNotify({
      organizationId,
      moduleKey: key,
      record,
      triggeredBy: actorId || null
    }).catch((err) => {
      console.error(
        '[assignmentExecutionService] immediate SALES assignment notification:',
        err?.message || err
      );
    });
  } else {
    const offHoursDefer = await maybeEnqueueOffHoursAssignment({
      organizationId,
      appKey: appKeyForExecution,
      moduleKey: key,
      recordId,
      ruleSet,
      simulation,
      actorId
    });
    if (offHoursDefer.deferred && offHoursDefer.enqueueResult?.queued) {
      const logLine = {
        user: 'Assignment Engine',
        userId: actorId || null,
        action: 'assignment_deferred',
        message: 'Assignment deferred until business hours',
        details: {
          ruleId: simulation.ruleId,
          runAt: offHoursDefer.enqueueResult.runAt,
          reason: 'off_hours_deferred'
        },
        timestamp: new Date()
      };
      if (Array.isArray(record.activityLogs)) {
        record.activityLogs.push(logLine);
        await record.save();
      }
    }
  }

  await createExecutionLog({
    organizationId,
    appKey: appKeyForExecution,
    moduleKey: key,
    recordId,
    triggerSource,
    ruleId: simulation.ruleId,
    previousOwnerId,
    newOwnerId: canAssign ? nextOwnerId : previousOwnerId,
    assignedGroupId,
    status:
      state === 'assigned' && ownerChanged
        ? 'assigned'
        : state === 'queued'
          ? 'queued'
          : 'skipped',
    idempotencyKey,
    details: {
      ruleSetVersion: ruleSet.version,
      trace: simulation.trace,
      outcome: simulation.outcome,
      ownerChanged
    }
  });

  return {
    executed: true,
    ownerChanged,
    previousOwnerId,
    newOwnerId: canAssign ? nextOwnerId : previousOwnerId,
    assignedGroupId,
    ruleId: simulation.ruleId,
    outcome: simulation.outcome
  };
}

async function runImmediateAssignmentForCase({
  caseRecord,
  actorId,
  triggerSource = 'immediate',
  changedFields = []
}) {
  if (!caseRecord?._id || !caseRecord?.organizationId) {
    return { executed: false, reason: 'invalid_case_record' };
  }
  if (triggerSource === 'immediate' && changedFields.length > 0 && !isRelevantReevaluation(changedFields)) {
    return { executed: false, reason: 'no_relevant_changes' };
  }

  const organizationId = caseRecord.organizationId;
  const appKey = 'HELPDESK';
  const moduleKey = 'cases';
  const recordId = toIdString(caseRecord._id);
  const assignmentControl = getAssignmentControl(caseRecord);
  if (assignmentControl.isLocked) {
    return { executed: false, reason: 'assignment_locked' };
  }

  const ruleSet = await loadImmediateRuleSet({ organizationId, appKey, moduleKey });
  if (!ruleSet || !Array.isArray(ruleSet.rules) || ruleSet.rules.length === 0) {
    return { executed: false, reason: 'no_immediate_rules' };
  }
  if (ruleSet.simulationOnly) {
    return { executed: false, reason: 'simulation_only_enabled' };
  }
  if (triggerSource === 'immediate' && changedFields.length > 0 && shouldSkipAutoAssignmentOnUpdate(ruleSet.applyStrategy)) {
    return { executed: false, reason: 'apply_strategy_skips_updates' };
  }

  const idempotencyKey = [
    'immediate',
    recordId,
    toIdString(caseRecord.updatedAt?.getTime?.() || caseRecord.updatedAt || Date.now()),
    String(ruleSet.version || 1)
  ].join(':');

  const existing = await AssignmentExecutionLog.findOne({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    idempotencyKey
  })
    .select('_id status')
    .lean();
  if (existing) {
    return { executed: false, reason: 'idempotent_replay' };
  }

  const previousOwnerId = toIdString(caseRecord.assignedTo);
  const simulation = await simulateAssignment({
    organizationId,
    appKey,
    moduleKey,
    rules: ruleSet.rules,
    record: typeof caseRecord.toObject === 'function' ? caseRecord.toObject() : caseRecord,
    context: { previousOwnerId, recordId }
  });
  const nextOwnerId = toIdString(simulation?.outcome?.assignedUserId);
  const assignedGroupId = toIdString(simulation?.outcome?.assignedGroupId);
  const state = simulation?.outcome?.state || 'skipped';
  const canAssign = state === 'assigned' && mongoose.Types.ObjectId.isValid(nextOwnerId);
  const ownerChanged = canAssign && previousOwnerId !== nextOwnerId;
  const matchedRule = (ruleSet.rules || []).find((rule) => rule.ruleId === simulation.ruleId);

  if (ownerChanged) {
    clearAssignmentLock(caseRecord);
    caseRecord.assignedTo = nextOwnerId;
    caseRecord.updatedBy = actorId || caseRecord.updatedBy || null;
    caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
    caseRecord.activities.push({
      activityType: 'assignment_auto_applied',
      message: 'Case owner auto-assigned by assignment rules',
      internal: true,
      metadata: {
        ruleId: simulation.ruleId,
        assignedGroupId,
        strategy: simulation?.outcome?.reason || null
      },
      actorId: actorId || null,
      actorName: 'Assignment Engine',
      createdAt: new Date()
    });
    await caseRecord.save();
  } else if (
    simulation.matched &&
    state === 'queued' &&
    mongoose.Types.ObjectId.isValid(assignedGroupId)
  ) {
    // Queue distribution does not set assignedTo; still record so the case timeline / activity UI reflects the rule.
    caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
    const groupLabel = simulation?.outcome?.groupName || 'group queue';
    caseRecord.activities.push({
      activityType: 'assignment_queued',
      message: `Assignment rule matched: queued in ${groupLabel} (claim). Case owner is unchanged until someone claims it.`,
      internal: true,
      metadata: {
        ruleId: simulation.ruleId,
        assignedGroupId,
        strategy: simulation?.outcome?.reason || 'queue_claim'
      },
      actorId: actorId || null,
      actorName: 'Assignment Engine',
      createdAt: new Date()
    });
    await caseRecord.save();
  } else if (
    simulation.matched &&
    state === 'queued' &&
    simulation?.outcome?.reason === 'off_hours_deferred' &&
    matchedRule
  ) {
    const offHoursDefer = await maybeEnqueueOffHoursAssignment({
      organizationId,
      appKey,
      moduleKey,
      recordId,
      ruleSet,
      simulation,
      actorId
    });
    caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
    const runAtLabel = offHoursDefer.enqueueResult?.runAt
      ? new Date(offHoursDefer.enqueueResult.runAt).toISOString()
      : null;
    caseRecord.activities.push({
      activityType: 'assignment_deferred',
      message: runAtLabel
        ? `Assignment deferred — no agents available outside business hours. Retrying ${runAtLabel}.`
        : 'Assignment deferred until business hours (no agents currently available).',
      internal: true,
      metadata: {
        ruleId: simulation.ruleId,
        reason: 'off_hours_deferred',
        runAt: runAtLabel,
        queued: Boolean(offHoursDefer.enqueueResult?.queued)
      },
      actorId: actorId || null,
      actorName: 'Assignment Engine',
      createdAt: new Date()
    });
    await caseRecord.save();
  } else if (simulation.matched && state === 'assigned' && canAssign && !ownerChanged) {
    caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
    const reason = simulation?.outcome?.reason || '';
    const msg =
      reason === 'round_robin_single_member'
        ? 'Assignment rule matched, but the primary group has only one member — case owner unchanged.'
        : 'Assignment rule matched; case owner is already the user selected by this rule (no change).';
    caseRecord.activities.push({
      activityType: 'assignment_rule_matched',
      message: msg,
      internal: true,
      metadata: {
        ruleId: simulation.ruleId,
        assignedGroupId,
        strategy: reason,
        selectedUserId: nextOwnerId
      },
      actorId: actorId || null,
      actorName: 'Assignment Engine',
      createdAt: new Date()
    });
    await caseRecord.save();
  } else if (!simulation.matched && changedFields.length > 0) {
    const previousRuleLog = await findLatestAssignmentLog({ organizationId, appKey, moduleKey, recordId });
    const lastRuleId = previousRuleLog?.ruleId || null;
    const lastRule = (ruleSet.rules || []).find((rule) => rule.ruleId === lastRuleId);
    const revertMode = lastRule?.reassignment?.revertMode || matchedRule?.reassignment?.revertMode || 'reapply_rules';

    if (revertMode === 'revert_previous_owner' && mongoose.Types.ObjectId.isValid(previousRuleLog?.previousOwnerId)) {
      const fallbackOwnerId = toIdString(previousRuleLog.previousOwnerId);
      if (fallbackOwnerId && fallbackOwnerId !== previousOwnerId) {
        caseRecord.assignedTo = fallbackOwnerId;
        caseRecord.updatedBy = actorId || caseRecord.updatedBy || null;
        caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
        caseRecord.activities.push({
          activityType: 'assignment_reverted',
          message: 'Case owner reverted to previous owner by reassignment policy',
          internal: true,
          metadata: { revertMode, sourceRuleId: lastRuleId },
          actorId: actorId || null,
          actorName: 'Assignment Engine',
          createdAt: new Date()
        });
        await caseRecord.save();
      }
    }

    if (revertMode === 'lock_current_owner') {
      setAssignmentLock(caseRecord, {
        lockReason: 'lock_current_owner',
        lockRuleId: lastRuleId || null,
        actorId,
        previousOwnerId
      });
      caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
      caseRecord.activities.push({
        activityType: 'assignment_locked',
        message: 'Case owner locked by reassignment policy',
        internal: true,
        metadata: { revertMode, sourceRuleId: lastRuleId },
        actorId: actorId || null,
        actorName: 'Assignment Engine',
        createdAt: new Date()
      });
      await caseRecord.save();
    }
  }

  await createExecutionLog({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    triggerSource,
    ruleId: simulation.ruleId,
    previousOwnerId,
    newOwnerId: canAssign ? nextOwnerId : previousOwnerId,
    assignedGroupId,
    status: state === 'assigned' && ownerChanged ? 'assigned' : state === 'queued' ? 'queued' : 'skipped',
    idempotencyKey,
    details: {
      ruleSetVersion: ruleSet.version,
      trace: simulation.trace,
      outcome: simulation.outcome,
      ownerChanged
    }
  });

  const escalationResult = matchedRule
    ? await maybeApplyEscalation({
        caseRecord,
        rule: matchedRule,
        actorId,
        organizationId,
        appKey,
        moduleKey,
        recordId,
        idempotencyKey
      })
    : { escalated: false };

  return {
    executed: true,
    ownerChanged: ownerChanged || Boolean(escalationResult.escalated),
    escalated: Boolean(escalationResult.escalated),
    previousOwnerId,
    newOwnerId: escalationResult.escalated
      ? escalationResult.newOwnerId
      : canAssign
        ? nextOwnerId
        : previousOwnerId,
    assignedGroupId: escalationResult.escalated ? escalationResult.assignedGroupId : assignedGroupId,
    ruleId: simulation.ruleId,
    outcome: simulation.outcome
  };
}

async function enrichLiveChatSessionRecord(organizationId, sessionRecord) {
  const adapter = getAdapter('live_chat_sessions', { appKey: 'PLATFORM' });
  const row = adapter.normalizeRecord(sessionRecord);
  if (row.queueId) {
    const { getQueueById } = require('./liveChatQueueService');
    const queue = await getQueueById(organizationId, row.queueId);
    if (queue?.queueKey) row.queueKey = queue.queueKey;
  }
  return row;
}

async function runImmediateAssignmentForLiveChatSession({
  sessionRecord,
  actorId,
  triggerSource = 'immediate',
  changedFields = [],
  triggeredBy = null,
}) {
  const adapter = getAdapter('live_chat_sessions', { appKey: 'PLATFORM' });
  if (!sessionRecord?._id || !sessionRecord?.organizationId) {
    return { executed: false, reason: 'invalid_session_record', assigned: false };
  }
  if (triggerSource === 'immediate' && changedFields.length > 0 && !adapter.shouldReevaluate(changedFields)) {
    return { executed: false, reason: 'no_relevant_changes', assigned: false };
  }

  const organizationId = sessionRecord.organizationId;
  const appKey = 'PLATFORM';
  const moduleKey = 'live_chat_sessions';
  const recordId = toIdString(sessionRecord._id);

  // Any existing owner blocks auto-routing (including claim-on-reply races).
  if (sessionRecord.assignedAgentId) {
    return { executed: false, reason: 'already_assigned', assigned: false };
  }

  const ruleSet = await loadImmediateRuleSet({ organizationId, appKey, moduleKey });
  if (!ruleSet || !Array.isArray(ruleSet.rules) || ruleSet.rules.length === 0) {
    if (String(sessionRecord.lifecycleStatus || '') !== 'closed') {
      sessionRecord.lifecycleStatus = sessionRecord.lifecycleStatus || 'waiting';
      sessionRecord.updatedAt = new Date();
      await sessionRecord.save();
    }
    return { executed: false, reason: 'no_immediate_rules', assigned: false };
  }
  if (ruleSet.simulationOnly) {
    return { executed: false, reason: 'simulation_only_enabled', assigned: false };
  }
  if (triggerSource === 'immediate' && changedFields.length > 0 && shouldSkipAutoAssignmentOnUpdate(ruleSet.applyStrategy)) {
    return { executed: false, reason: 'apply_strategy_skips_updates', assigned: false };
  }

  const idempotencyKey = [
    'live_chat_immediate',
    recordId,
    toIdString(sessionRecord.updatedAt?.getTime?.() || sessionRecord.updatedAt || Date.now()),
    String(ruleSet.version || 1)
  ].join(':');

  const existing = await AssignmentExecutionLog.findOne({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    idempotencyKey
  })
    .select('_id')
    .lean();
  if (existing) {
    return { executed: false, reason: 'idempotent_replay', assigned: false };
  }

  const previousOwnerId = adapter.getOwner(sessionRecord);
  const recordInput = await enrichLiveChatSessionRecord(organizationId, sessionRecord);

  const needsPresence = (ruleSet.rules || []).some(
    (rule) => rule?.enabled !== false && rule.distribution?.mode === 'availability_based'
  );
  let simulateContext = adapter.buildSimulateContext(sessionRecord, recordId);
  if (needsPresence) {
    const { collectMemberIdsForRules } = require('./assignmentAvailabilityService');
    const { listOnlineUserIds } = require('./liveChatPresenceService');
    const memberIds = await collectMemberIdsForRules(organizationId, ruleSet.rules);
    simulateContext = {
      ...simulateContext,
      availableUserIds: await listOnlineUserIds(organizationId, memberIds),
    };
  }

  const simulation = await simulateAssignment({
    organizationId,
    appKey,
    moduleKey,
    rules: ruleSet.rules,
    record: recordInput,
    context: simulateContext,
  });

  const nextOwnerId = toIdString(simulation?.outcome?.assignedUserId);
  const assignedGroupId = toIdString(simulation?.outcome?.assignedGroupId);
  const state = simulation?.outcome?.state || 'skipped';
  const canAssign = state === 'assigned' && mongoose.Types.ObjectId.isValid(nextOwnerId);
  const ownerChanged = canAssign && previousOwnerId !== nextOwnerId;

  let didAssign = false;
  if (ownerChanged) {
    const {
      LIVE_CHAT_ASSIGNED_BY,
      applySessionAgentAssignment,
    } = require('./liveChatSessionAssignmentTrackingService');
    const applyResult = await applySessionAgentAssignment({
      organizationId,
      sessionId: sessionRecord._id,
      agentId: nextOwnerId,
      assignedBy: LIVE_CHAT_ASSIGNED_BY.QUEUE_ROUTING,
      performedByUserId: triggeredBy || actorId || null,
      previousAgentId: null,
      lifecycleStatus: 'assigned',
      metadata: {
        claimOnly: true,
        ruleId: simulation.ruleId,
        assignedGroupId,
        strategyDetail: simulation?.outcome?.reason || null,
      },
    });
    if (applyResult.applied) {
      didAssign = true;
      adapter.setOwner(sessionRecord, nextOwnerId);
      sessionRecord.lifecycleStatus = 'assigned';
      sessionRecord.updatedAt = new Date();
    } else if (
      applyResult.reason === 'assignment_conflict'
      || applyResult.reason === 'already_assigned'
    ) {
      return {
        executed: true,
        assigned: false,
        ownerChanged: false,
        previousOwnerId,
        newOwnerId: previousOwnerId,
        assignedGroupId: null,
        ruleId: simulation.ruleId,
        outcome: simulation.outcome,
        reason: applyResult.reason,
        agentId: null,
        queueId: sessionRecord.queueId || null,
      };
    }
  } else if (simulation.matched && state === 'queued') {
    sessionRecord.lifecycleStatus = 'waiting';
    sessionRecord.updatedAt = new Date();
    await sessionRecord.save();
  } else if (String(sessionRecord.status || '') !== 'closed') {
    sessionRecord.lifecycleStatus = sessionRecord.lifecycleStatus || 'waiting';
    sessionRecord.updatedAt = new Date();
    await sessionRecord.save();
  }

  await createExecutionLog({
    organizationId,
    appKey,
    moduleKey,
    recordId,
    triggerSource,
    ruleId: simulation.ruleId,
    previousOwnerId,
    newOwnerId: didAssign ? nextOwnerId : previousOwnerId,
    assignedGroupId,
    status:
      state === 'assigned' && didAssign
        ? 'assigned'
        : state === 'queued'
          ? 'queued'
          : 'skipped',
    idempotencyKey,
    details: {
      ruleSetVersion: ruleSet.version,
      trace: simulation.trace,
      outcome: simulation.outcome,
      ownerChanged: didAssign,
    },
  });

  return {
    executed: true,
    assigned: didAssign,
    ownerChanged: didAssign,
    previousOwnerId,
    newOwnerId: didAssign ? nextOwnerId : previousOwnerId,
    assignedGroupId,
    ruleId: simulation.ruleId,
    outcome: simulation.outcome,
    reason: didAssign ? 'assigned' : state,
    agentId: didAssign ? nextOwnerId : null,
    queueId: sessionRecord.queueId || null,
  };
}

/**
 * Generic immediate assignment for any module with a registered or inferred adapter.
 */
async function runImmediateAssignmentForRecord({
  record,
  moduleKey,
  appKey = null,
  actorId,
  triggerSource = 'immediate',
  changedFields = [],
  tenantOrganizationId = null
}) {
  const key = String(moduleKey || '').toLowerCase();
  const organizationId = tenantOrganizationId || record?.organizationId;
  if (!record?._id || !organizationId) {
    return { executed: false, reason: 'invalid_record' };
  }

  const resolvedAppKey = appKey
    ? String(appKey).toUpperCase()
    : await resolveModuleAppKey(organizationId, key, null);
  const adapter = getAdapter(key, { appKey: resolvedAppKey });
  if (!adapter) {
    return { executed: false, reason: 'unsupported_module' };
  }

  if (key === 'cases') {
    return runImmediateAssignmentForCase({
      caseRecord: record,
      actorId,
      triggerSource,
      changedFields
    });
  }

  if (key === 'live_chat_sessions') {
    return runImmediateAssignmentForLiveChatSession({
      sessionRecord: record,
      actorId,
      triggerSource,
      changedFields,
      triggeredBy: actorId,
    });
  }

  if (SALES_MODULE_ASSIGNMENT_PROFILES[key]) {
    return runImmediateAssignmentForSalesRecord({
      record,
      moduleKey: key,
      actorId,
      triggerSource,
      changedFields,
      tenantOrganizationId: organizationId
    });
  }

  if (triggerSource === 'immediate' && changedFields.length > 0 && !adapter.shouldReevaluate(changedFields)) {
    return { executed: false, reason: 'no_relevant_changes' };
  }

  const app = resolvedAppKey || adapter.appKey || 'SALES';
  const recordId = toIdString(record._id);
  const ruleSet = await loadImmediateRuleSet({ organizationId, appKey: app, moduleKey: key });
  if (!ruleSet || !Array.isArray(ruleSet.rules) || ruleSet.rules.length === 0) {
    return { executed: false, reason: 'no_immediate_rules' };
  }
  if (ruleSet.simulationOnly) {
    return { executed: false, reason: 'simulation_only_enabled' };
  }
  if (triggerSource === 'immediate' && changedFields.length > 0 && shouldSkipAutoAssignmentOnUpdate(ruleSet.applyStrategy)) {
    return { executed: false, reason: 'apply_strategy_skips_updates' };
  }

  const idempotencyKey = [
    'generic_immediate',
    key,
    recordId,
    toIdString(record.updatedAt?.getTime?.() || record.updatedAt || Date.now()),
    String(ruleSet.version || 1)
  ].join(':');

  const existing = await AssignmentExecutionLog.findOne({
    organizationId,
    appKey: app,
    moduleKey: key,
    recordId,
    idempotencyKey
  })
    .select('_id')
    .lean();
  if (existing) {
    return { executed: false, reason: 'idempotent_replay' };
  }

  const previousOwnerId = adapter.getOwner(record);
  const ruleInput = adapter.normalizeRecord(record);
  const simulation = await simulateAssignment({
    organizationId,
    appKey: app,
    moduleKey: key,
    rules: ruleSet.rules,
    record: ruleInput,
    context: adapter.buildSimulateContext(record, recordId)
  });
  const nextOwnerId = toIdString(simulation?.outcome?.assignedUserId);
  const assignedGroupId = toIdString(simulation?.outcome?.assignedGroupId);
  const state = simulation?.outcome?.state || 'skipped';
  const canAssign = state === 'assigned' && mongoose.Types.ObjectId.isValid(nextOwnerId);
  const ownerChanged = canAssign && previousOwnerId !== nextOwnerId;

  if (ownerChanged) {
    adapter.setOwner(record, nextOwnerId);
    const logPath = adapter.activityLogPath;
    if (logPath && Array.isArray(record[logPath])) {
      record[logPath].push({
        user: 'Assignment Engine',
        userId: actorId || null,
        action: 'assignment_auto_applied',
        message: 'Assigned by automation rules',
        details: { ruleId: simulation.ruleId, assignedGroupId },
        timestamp: new Date()
      });
    }
    await record.save();

    if (app === 'SALES') {
      emitSalesRecordOwnerAssignedNotify({
        organizationId,
        moduleKey: key,
        record,
        triggeredBy: actorId || null
      }).catch((err) => {
        console.error('[assignmentExecutionService] generic SALES assignment notification:', err?.message || err);
      });
    }
  }

  await createExecutionLog({
    organizationId,
    appKey: app,
    moduleKey: key,
    recordId,
    triggerSource,
    ruleId: simulation.ruleId,
    previousOwnerId,
    newOwnerId: canAssign ? nextOwnerId : previousOwnerId,
    assignedGroupId,
    status:
      state === 'assigned' && ownerChanged
        ? 'assigned'
        : state === 'queued'
          ? 'queued'
          : 'skipped',
    idempotencyKey,
    details: {
      ruleSetVersion: ruleSet.version,
      trace: simulation.trace,
      outcome: simulation.outcome,
      ownerChanged
    }
  });

  return {
    executed: true,
    ownerChanged,
    previousOwnerId,
    newOwnerId: canAssign ? nextOwnerId : previousOwnerId,
    assignedGroupId,
    ruleId: simulation.ruleId,
    outcome: simulation.outcome
  };
}

module.exports = {
  runImmediateAssignmentForCase,
  runImmediateAssignmentForLiveChatSession,
  runImmediateAssignmentForSalesRecord,
  runImmediateAssignmentForRecord,
  registerManualOwnerOverride,
  buildSalesRecordForAssignmentRules,
  shouldRunSalesReevaluation,
  shouldSkipAutoAssignmentOnUpdate,
  SALES_MODULE_ASSIGNMENT_PROFILES,
  toIdString,
  getOwnerFromRecord,
  setOwnerOnRecord
};
