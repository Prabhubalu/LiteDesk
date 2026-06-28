const mongoose = require('mongoose');
const AssignmentRuleSet = require('../models/AssignmentRuleSet');
const AssignmentScheduleJob = require('../models/AssignmentScheduleJob');
const AssignmentExecutionLog = require('../models/AssignmentExecutionLog');
const Group = require('../models/Group');
const { simulateAssignment } = require('./assignmentRulesEngine');
const { loadRecordForAssignmentJob } = require('../utils/assignmentRecordLoader');
const assignmentExecution = require('./assignmentExecutionService');
const { getAdapter } = require('./assignment/assignmentModuleRegistry');
const {
  getNextOpenInstantForUsers,
  collectMemberIdsForRule
} = require('./assignmentAvailabilityService');
const { emitNotification } = require('./notificationEngine');
const notificationDomainEvents = require('../constants/domainEvents');
const { emitSalesRecordOwnerAssignedNotify } = require('./assignmentSalesOwnerNotify');

const CASE_APP_KEY = 'HELPDESK';
const CASE_MODULE_KEY = 'cases';

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

/** Context for round_robin / distribution: current owner + record id. */
function buildSimulateContext(appKey, moduleKey, recordDoc, recordId) {
  const mk = String(moduleKey || '').toLowerCase();
  const rid = recordId || toIdString(recordDoc?._id);
  const adapter = getAdapter(mk, { appKey });
  if (adapter?.buildSimulateContext) {
    return adapter.buildSimulateContext(recordDoc, rid);
  }
  return { recordId: rid };
}

function isRelevantChange(changedFields = []) {
  if (!Array.isArray(changedFields) || changedFields.length === 0) return true;
  const relevant = new Set(['priority', 'caseType', 'channel', 'status', 'contactId', 'organizationRefId']);
  return changedFields.some((field) => relevant.has(field));
}

function getFutureDateFromNow(minutes) {
  return new Date(Date.now() + Math.max(Number(minutes) || 1, 1) * 60 * 1000);
}

function resolveScheduledRunAt(triggerConfig = {}, now = new Date()) {
  const cfg = triggerConfig || {};
  if (cfg.runAt) {
    const explicit = new Date(cfg.runAt);
    if (!Number.isNaN(explicit.getTime())) return explicit;
  }

  if (cfg.frequency === 'weekly') {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (cfg.frequency === 'custom' && Number(cfg.everyMinutes) > 0) {
    return new Date(now.getTime() + Number(cfg.everyMinutes) * 60 * 1000);
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

function resolveNextRecurringRunAt(rule, baseDate = new Date()) {
  const cfg = rule.triggerConfig || {};
  if (cfg.frequency === 'weekly') {
    return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (cfg.frequency === 'custom' && Number(cfg.everyMinutes) > 0) {
    return new Date(baseDate.getTime() + Number(cfg.everyMinutes) * 60 * 1000);
  }
  return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
}

function buildJobDedupeKey({ organizationId, recordId, ruleId, executionMode, version, runAt }) {
  return [
    'asgjob',
    toIdString(organizationId),
    recordId,
    ruleId,
    executionMode,
    String(version || 1),
    new Date(runAt).toISOString()
  ].join(':');
}

function createExecutionId(prefix) {
  return `${prefix}_${Date.now()}_${Math.round(Math.random() * 100000)}`;
}

function getAssignmentControl(record) {
  const control = record?.assignmentControl && typeof record.assignmentControl === 'object'
    ? record.assignmentControl
    : {};
  return {
    isLocked: Boolean(control.isLocked),
    lockReason: control.lockReason || null
  };
}

function setAssignmentLock(record, { reason, ruleId }) {
  const current = record.assignmentControl && typeof record.assignmentControl === 'object'
    ? record.assignmentControl
    : {};
  record.assignmentControl = {
    ...current,
    isLocked: true,
    lockReason: reason || 'assignment_locked',
    lockRuleId: ruleId || null,
    lockedAt: new Date()
  };
}

function calculateSlaElapsedPercent(record) {
  const cycle = record?.currentSlaCycle;
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

async function loadRuleSetForAssignment(organizationId, appKey, moduleKey) {
  return AssignmentRuleSet.findOne({
    organizationId,
    appKey: String(appKey || '').toUpperCase(),
    moduleKey: String(moduleKey || '').toLowerCase(),
    enabled: true
  }).lean();
}

async function enqueueDelayedScheduledJobs({
  organizationId,
  appKey,
  moduleKey,
  recordDoc,
  actorId,
  changedFields = [],
  isRelevantChangeFn
}) {
  const recordId = toIdString(recordDoc?._id);
  if (!recordId || !organizationId) return { queued: 0, reason: 'invalid_record' };
  if (typeof isRelevantChangeFn === 'function' && !isRelevantChangeFn(changedFields)) {
    return { queued: 0, reason: 'no_relevant_changes' };
  }

  const ruleSet = await loadRuleSetForAssignment(organizationId, appKey, moduleKey);
  if (!ruleSet || ruleSet.simulationOnly) return { queued: 0, reason: 'ruleset_missing_or_simulation_only' };
  if (
    Array.isArray(changedFields) &&
    changedFields.length > 0 &&
    assignmentExecution.shouldSkipAutoAssignmentOnUpdate(ruleSet.applyStrategy)
  ) {
    return { queued: 0, reason: 'apply_strategy_skips_updates' };
  }

  const ak = String(appKey || '').toUpperCase();
  const mk = String(moduleKey || '').toLowerCase();
  const recordSnapshot =
    ak === 'SALES'
      ? assignmentExecution.buildSalesRecordForAssignmentRules(mk, recordDoc)
      : typeof recordDoc.toObject === 'function'
        ? recordDoc.toObject()
        : recordDoc;

  const candidateRules = (ruleSet.rules || []).filter(
    (rule) => rule?.enabled !== false && ['delayed', 'scheduled'].includes(rule.triggerType)
  );
  if (candidateRules.length === 0) return { queued: 0, reason: 'no_delayed_or_scheduled_rules' };

  let queued = 0;
  const now = new Date();

  const simContext = buildSimulateContext(ak, mk, recordDoc, recordId);

  for (const rule of candidateRules) {
    const probe = await simulateAssignment({
      organizationId,
      appKey: ak,
      moduleKey: mk,
      rules: [rule],
      record: recordSnapshot,
      context: simContext
    });
    if (!probe.matched) continue;

    const executionMode = rule.triggerType;
    const runAt =
      executionMode === 'delayed'
        ? getFutureDateFromNow(rule.triggerConfig?.delayMinutes || 5)
        : resolveScheduledRunAt(rule.triggerConfig, now);

    const dedupeKey = buildJobDedupeKey({
      organizationId,
      recordId,
      ruleId: rule.ruleId,
      executionMode,
      version: ruleSet.version,
      runAt
    });

    try {
      await AssignmentScheduleJob.create({
        organizationId,
        appKey: ak,
        moduleKey: mk,
        recordId,
        ruleId: rule.ruleId,
        executionMode,
        runAt,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        dedupeKey,
        snapshotVersion: ruleSet.version,
        details: {
          actorId: actorId || null,
          recheckConditionsAtExecution: rule.triggerConfig?.recheckConditionsAtExecution !== false
        }
      });
      queued += 1;
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  return { queued };
}

async function enqueueAssignmentJobsForCase({ caseRecord, actorId, changedFields = [] }) {
  if (!caseRecord?._id || !caseRecord?.organizationId) return { queued: 0, reason: 'invalid_case_record' };
  return enqueueDelayedScheduledJobs({
    organizationId: caseRecord.organizationId,
    appKey: CASE_APP_KEY,
    moduleKey: CASE_MODULE_KEY,
    recordDoc: caseRecord,
    actorId,
    changedFields,
    isRelevantChangeFn: isRelevantChange
  });
}

async function enqueueAssignmentJobsForSalesRecord({
  record,
  moduleKey,
  actorId,
  changedFields = [],
  tenantOrganizationId = null
}) {
  const key = String(moduleKey || '').toLowerCase();
  const organizationId = tenantOrganizationId || record?.organizationId;
  if (!record?._id || !organizationId) return { queued: 0, reason: 'invalid_record' };
  return enqueueDelayedScheduledJobs({
    organizationId,
    appKey: 'SALES',
    moduleKey: key,
    recordDoc: record,
    actorId,
    changedFields,
    isRelevantChangeFn: (fields) => assignmentExecution.shouldRunSalesReevaluation(key, fields)
  });
}

async function applyScheduledAssignmentForCase(job, record, rule, ruleSetVersion) {
  const previousOwnerId = toIdString(record.assignedTo);
  const assignmentControl = getAssignmentControl(record);
  if (assignmentControl.isLocked) {
    return { ownerChanged: false, state: 'skipped', reason: 'assignment_locked' };
  }

  const simulation = await simulateAssignment({
    organizationId: job.organizationId,
    appKey: job.appKey,
    moduleKey: job.moduleKey,
    rules: [rule],
    record: typeof record.toObject === 'function' ? record.toObject() : record,
    context: { previousOwnerId, recordId: toIdString(job.recordId) }
  });

  const state = simulation?.outcome?.state || 'skipped';
  const assignedUserId = toIdString(simulation?.outcome?.assignedUserId);
  const assignedGroupId = toIdString(simulation?.outcome?.assignedGroupId);
  const canAssign = state === 'assigned' && isValidObjectId(assignedUserId);
  const ownerChanged = canAssign && previousOwnerId !== assignedUserId;

  if (!simulation.matched) {
    if (rule?.reassignment?.revertMode === 'lock_current_owner') {
      setAssignmentLock(record, { reason: 'lock_current_owner', ruleId: rule.ruleId });
      record.activities = Array.isArray(record.activities) ? record.activities : [];
      record.activities.push({
        activityType: 'assignment_locked',
        message: 'Case owner locked by scheduled reassignment policy',
        internal: true,
        metadata: { revertMode: 'lock_current_owner', sourceRuleId: rule.ruleId },
        actorId: null,
        actorName: 'Assignment Scheduler',
        createdAt: new Date()
      });
      await record.save();
    } else if (rule?.reassignment?.revertMode === 'revert_previous_owner') {
      const previousLog = await AssignmentExecutionLog.findOne({
        organizationId: job.organizationId,
        appKey: job.appKey,
        moduleKey: job.moduleKey,
        recordId: job.recordId,
        status: 'assigned'
      })
        .sort({ createdAt: -1 })
        .lean();
      const fallbackOwnerId = toIdString(previousLog?.previousOwnerId);
      if (fallbackOwnerId && fallbackOwnerId !== previousOwnerId && isValidObjectId(fallbackOwnerId)) {
        record.assignedTo = fallbackOwnerId;
        record.activities = Array.isArray(record.activities) ? record.activities : [];
        record.activities.push({
          activityType: 'assignment_reverted',
          message: 'Case owner reverted by scheduled reassignment policy',
          internal: true,
          metadata: { revertMode: 'revert_previous_owner', sourceRuleId: rule.ruleId },
          actorId: null,
          actorName: 'Assignment Scheduler',
          createdAt: new Date()
        });
        await record.save();
      }
    }
  }

  if (ownerChanged) {
    record.assignedTo = assignedUserId;
    record.activities = Array.isArray(record.activities) ? record.activities : [];
    record.activities.push({
      activityType: 'assignment_scheduled_applied',
      message: 'Case owner assigned by scheduled assignment rule',
      internal: true,
      metadata: { ruleId: rule.ruleId, assignedGroupId },
      actorId: null,
      actorName: 'Assignment Scheduler',
      createdAt: new Date()
    });
    await record.save();
  }

  const elapsedPercent = calculateSlaElapsedPercent(record);
  const canEscalate =
    rule?.escalation?.enabled &&
    rule.escalation.actionType === 'reassign_group' &&
    elapsedPercent != null &&
    elapsedPercent >= Number(rule.escalation.thresholdPercent || 100);
  let escalatedOwner = null;
  if (canEscalate) {
    const escalationTarget = await resolveEscalationOwner({
      organizationId: job.organizationId,
      chainGroupIds: rule.escalation.chainGroupIds || [],
      currentOwnerId: toIdString(record.assignedTo)
    });
    if (escalationTarget?.assignedTo && escalationTarget.assignedTo !== toIdString(record.assignedTo)) {
      record.assignedTo = escalationTarget.assignedTo;
      record.activities = Array.isArray(record.activities) ? record.activities : [];
      record.activities.push({
        activityType: 'assignment_escalated',
        message: 'Case owner escalated by scheduled escalation chain',
        internal: true,
        metadata: {
          sourceRuleId: rule.ruleId,
          assignedGroupId: escalationTarget.groupId,
          elapsedPercent
        },
        actorId: null,
        actorName: 'Assignment Scheduler',
        createdAt: new Date()
      });
      await record.save();
      escalatedOwner = escalationTarget;
    }
  }

  const finalOwnerId = escalatedOwner?.assignedTo || (ownerChanged ? assignedUserId : previousOwnerId);
  const finalGroupId = escalatedOwner?.groupId || assignedGroupId;
  const finalStatus =
    state === 'queued'
      ? 'queued'
      : ownerChanged || Boolean(escalatedOwner)
        ? 'assigned'
        : 'skipped';

  await AssignmentExecutionLog.create({
    organizationId: job.organizationId,
    appKey: job.appKey,
    moduleKey: job.moduleKey,
    recordId: job.recordId,
    executionId: createExecutionId('asg_sched'),
    triggerSource: job.executionMode,
    ruleId: rule.ruleId,
    previousOwnerId: isValidObjectId(previousOwnerId) ? previousOwnerId : null,
    newOwnerId: isValidObjectId(finalOwnerId) ? finalOwnerId : null,
    assignedGroupId: isValidObjectId(finalGroupId)
      ? finalGroupId
      : null,
    status: finalStatus,
    idempotencyKey: job.dedupeKey,
    isManual: false,
    details: {
      ruleSetVersion,
      ruleId: rule.ruleId,
      trace: simulation.trace,
      outcome: simulation.outcome,
      ownerChanged,
      escalated: Boolean(escalatedOwner)
    }
  });

  if (ownerChanged || Boolean(escalatedOwner)) {
    await emitNotification({
      eventType: notificationDomainEvents.CASE_ASSIGNED,
      entity: {
        type: 'Case',
        id: toIdString(record._id),
        title: record.title || '',
        status: record.status || '',
        priority: record.priority || '',
        previousOwnerId,
        assignedGroupId: finalGroupId || null
      },
      organizationId: record.organizationId,
      triggeredBy: null,
      sourceAppKey: 'HELPDESK'
    });
  }

  if (Boolean(escalatedOwner)) {
    await emitNotification({
      eventType: notificationDomainEvents.CASE_ESCALATED,
      entity: {
        type: 'Case',
        id: toIdString(record._id),
        title: record.title || '',
        status: record.status || '',
        priority: record.priority || '',
        previousOwnerId,
        assignedGroupId: escalatedOwner.groupId || null
      },
      organizationId: record.organizationId,
      triggeredBy: null,
      sourceAppKey: 'HELPDESK'
    });
  }

  return { ownerChanged: ownerChanged || Boolean(escalatedOwner), state };
}

async function applyScheduledAssignmentForModule(job, record, rule, ruleSetVersion) {
  const mk = String(job.moduleKey || '').toLowerCase();
  const adapter = getAdapter(mk, { appKey: job.appKey });
  if (!adapter) {
    return { ownerChanged: false, state: 'skipped', reason: 'unsupported_module' };
  }

  const previousOwnerId = adapter.getOwner(record);
  const recordForRules = mk === 'people'
    ? assignmentExecution.buildSalesRecordForAssignmentRules(mk, record)
    : adapter.normalizeRecord(record);
  const simulation = await simulateAssignment({
    organizationId: job.organizationId,
    appKey: job.appKey,
    moduleKey: job.moduleKey,
    rules: [rule],
    record: recordForRules,
    context: adapter.buildSimulateContext(record, toIdString(job.recordId))
  });
  const assignedUserId = toIdString(simulation?.outcome?.assignedUserId);
  const assignedGroupId = toIdString(simulation?.outcome?.assignedGroupId);
  const state = simulation?.outcome?.state || 'skipped';
  const canAssign = state === 'assigned' && isValidObjectId(assignedUserId);
  const ownerChanged = canAssign && previousOwnerId !== assignedUserId;

  if (ownerChanged) {
    adapter.setOwner(record, assignedUserId);
    const logPath = adapter.activityLogPath;
    if (logPath && Array.isArray(record[logPath])) {
      record[logPath].push({
        user: 'Assignment Scheduler',
        userId: null,
        action: 'assignment_scheduled_applied',
        details: { ruleId: rule.ruleId, assignedGroupId },
        timestamp: new Date()
      });
    }
    await record.save();

    if (String(job.appKey || '').toUpperCase() === 'SALES') {
      emitSalesRecordOwnerAssignedNotify({
        organizationId: job.organizationId,
        moduleKey: mk,
        record,
        triggeredBy: null
      }).catch((err) => {
        console.error('[assignmentSchedulingService] scheduled assignment notification:', err?.message || err);
      });
    }
  }

  const finalStatus = state === 'queued' ? 'queued' : ownerChanged ? 'assigned' : 'skipped';

  await AssignmentExecutionLog.create({
    organizationId: job.organizationId,
    appKey: job.appKey,
    moduleKey: job.moduleKey,
    recordId: toIdString(job.recordId),
    executionId: `asg_sched_${Date.now()}_${Math.round(Math.random() * 100000)}`,
    triggerSource: 'scheduled',
    ruleId: rule.ruleId,
    previousOwnerId,
    newOwnerId: canAssign ? assignedUserId : previousOwnerId,
    assignedGroupId,
    status: finalStatus,
    idempotencyKey: job.dedupeKey || null,
    details: {
      ruleSetVersion,
      outcome: simulation.outcome,
      ownerChanged
    }
  });

  return { ownerChanged, state };
}

async function applyScheduledAssignmentForSales(job, record, rule, ruleSetVersion, moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  const profile = assignmentExecution.SALES_MODULE_ASSIGNMENT_PROFILES[key];
  if (!profile) {
    return { ownerChanged: false, state: 'skipped', reason: 'unknown_sales_module' };
  }

  const ownerPath = profile.ownerPath;
  const previousOwnerId = assignmentExecution.getOwnerFromRecord(record, ownerPath);
  const recordForRules = assignmentExecution.buildSalesRecordForAssignmentRules(key, record);
  const simulation = await simulateAssignment({
    organizationId: job.organizationId,
    appKey: job.appKey,
    moduleKey: job.moduleKey,
    rules: [rule],
    record: recordForRules,
    context: { previousOwnerId, recordId: toIdString(job.recordId) }
  });
  const assignedUserId = toIdString(simulation?.outcome?.assignedUserId);
  const assignedGroupId = toIdString(simulation?.outcome?.assignedGroupId);
  const state = simulation?.outcome?.state || 'skipped';
  const canAssign = state === 'assigned' && isValidObjectId(assignedUserId);
  const ownerChanged = canAssign && previousOwnerId !== assignedUserId;

  if (ownerChanged) {
    assignmentExecution.setOwnerOnRecord(record, ownerPath, assignedUserId);
    if (!Array.isArray(record.activityLogs)) record.activityLogs = [];
    record.activityLogs.push({
      user: 'Assignment Scheduler',
      userId: null,
      action: 'assignment_scheduled_applied',
      details: { ruleId: rule.ruleId, assignedGroupId },
      timestamp: new Date()
    });
    await record.save();

    emitSalesRecordOwnerAssignedNotify({
      organizationId: job.organizationId,
      moduleKey: key,
      record,
      triggeredBy: null
    }).catch((err) => {
      console.error(
        '[assignmentSchedulingService] scheduled SALES assignment notification:',
        err?.message || err
      );
    });
  }

  const finalStatus =
    state === 'queued' ? 'queued' : ownerChanged ? 'assigned' : 'skipped';

  await AssignmentExecutionLog.create({
    organizationId: job.organizationId,
    appKey: job.appKey,
    moduleKey: job.moduleKey,
    recordId: job.recordId,
    executionId: createExecutionId('asg_sched_sales'),
    triggerSource: job.executionMode,
    ruleId: rule.ruleId,
    previousOwnerId: isValidObjectId(previousOwnerId) ? previousOwnerId : null,
    newOwnerId: isValidObjectId(assignedUserId) && ownerChanged ? assignedUserId : isValidObjectId(previousOwnerId) ? previousOwnerId : null,
    assignedGroupId: isValidObjectId(assignedGroupId) ? assignedGroupId : null,
    status: finalStatus,
    idempotencyKey: job.dedupeKey,
    isManual: false,
    details: {
      ruleSetVersion,
      trace: simulation.trace,
      outcome: simulation.outcome,
      ownerChanged
    }
  });

  return { ownerChanged, state };
}

async function processDueAssignmentJobs() {
  const now = new Date();
  const jobs = await AssignmentScheduleJob.find({
    status: 'pending',
    runAt: { $lte: now }
  })
    .sort({ runAt: 1 })
    .limit(50);

  let processed = 0;
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  /** @type {Record<string, number>} */
  const skipReasons = {};
  function noteSkip(reason) {
    const key = String(reason || 'unknown');
    skipReasons[key] = (skipReasons[key] || 0) + 1;
  }

  for (const job of jobs) {
    try {
      job.status = 'running';
      job.attempts = Number(job.attempts || 0) + 1;
      await job.save();

      const record = await loadRecordForAssignmentJob(job);
      if (!record) {
        job.status = 'skipped';
        job.lastError = 'record_not_found';
        await job.save();
        noteSkip('record_not_found');
        skipped += 1;
        processed += 1;
        continue;
      }

      const ruleSet = await loadRuleSetForAssignment(job.organizationId, job.appKey, job.moduleKey);
      const rules = ruleSet?.rules || [];
      const rule = rules.find((item) => item.ruleId === job.ruleId && item.enabled !== false);
      if (!rule) {
        job.status = 'skipped';
        job.lastError = 'rule_not_found';
        await job.save();
        noteSkip('rule_not_found');
        skipped += 1;
        processed += 1;
        continue;
      }

      if (ruleSet.simulationOnly) {
        job.status = 'skipped';
        job.lastError = 'ruleset_simulation_only';
        await job.save();
        noteSkip('ruleset_simulation_only');
        skipped += 1;
        processed += 1;
        continue;
      }

      if (job.details?.waitForBusinessHours) {
        const memberIds = await collectMemberIdsForRule(job.organizationId, rule);
        const nextAt = await getNextOpenInstantForUsers(job.organizationId, memberIds, now);
        if (nextAt && nextAt > now) {
          job.status = 'pending';
          job.runAt = nextAt;
          job.lastError = null;
          await job.save();
          noteSkip('rescheduled_off_hours');
          skipped += 1;
          processed += 1;
          continue;
        }
      }

      if (rule.triggerConfig?.recheckConditionsAtExecution !== false) {
        const mk = String(job.moduleKey || '').toLowerCase();
        const adapter = getAdapter(mk, { appKey: job.appKey });
        const recordForProbe =
          mk === 'people'
            ? assignmentExecution.buildSalesRecordForAssignmentRules(mk, record)
            : adapter?.normalizeRecord
              ? adapter.normalizeRecord(record)
              : typeof record.toObject === 'function'
                ? record.toObject()
                : record;
        const probeContext = buildSimulateContext(job.appKey, job.moduleKey, record, toIdString(job.recordId));
        const probe = await simulateAssignment({
          organizationId: job.organizationId,
          appKey: job.appKey,
          moduleKey: job.moduleKey,
          rules: [rule],
          record: recordForProbe,
          context: probeContext
        });
        if (!probe.matched) {
          job.status = 'skipped';
          job.lastError = 'rule_no_longer_matches';
          await job.save();
          noteSkip('rule_no_longer_matches');
          skipped += 1;
          processed += 1;
          continue;
        }
      }

      if (job.appKey === CASE_APP_KEY && job.moduleKey === CASE_MODULE_KEY) {
        await applyScheduledAssignmentForCase(job, record, rule, ruleSet.version);
      } else if (job.appKey === 'SALES' && assignmentExecution.SALES_MODULE_ASSIGNMENT_PROFILES[String(job.moduleKey || '').toLowerCase()]) {
        await applyScheduledAssignmentForSales(job, record, rule, ruleSet.version, job.moduleKey);
      } else {
        await applyScheduledAssignmentForModule(job, record, rule, ruleSet.version);
      }

      job.status = 'completed';
      job.lastError = null;
      await job.save();
      completed += 1;
      processed += 1;

      if (job.executionMode === 'scheduled' && rule.triggerConfig?.scheduleType === 'recurring') {
        const nextRunAt = resolveNextRecurringRunAt(rule, now);
        const dedupeKey = buildJobDedupeKey({
          organizationId: job.organizationId,
          recordId: job.recordId,
          ruleId: job.ruleId,
          executionMode: 'scheduled',
          version: ruleSet.version,
          runAt: nextRunAt
        });
        try {
          await AssignmentScheduleJob.create({
            organizationId: job.organizationId,
            appKey: job.appKey,
            moduleKey: job.moduleKey,
            recordId: job.recordId,
            ruleId: job.ruleId,
            executionMode: 'scheduled',
            runAt: nextRunAt,
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            dedupeKey,
            snapshotVersion: ruleSet.version,
            details: {
              recheckConditionsAtExecution: rule.triggerConfig?.recheckConditionsAtExecution !== false
            }
          });
        } catch (error) {
          if (error?.code !== 11000) {
            throw error;
          }
        }
      }
    } catch (error) {
      job.status = Number(job.attempts || 0) >= Number(job.maxAttempts || 3) ? 'failed' : 'pending';
      job.lastError = error.message;
      await job.save();
      failed += 1;
      processed += 1;
    }
  }

  return { processed, completed, failed, skipped, skipReasons };
}

module.exports = {
  enqueueAssignmentJobsForCase,
  enqueueAssignmentJobsForSalesRecord,
  processDueAssignmentJobs
};
