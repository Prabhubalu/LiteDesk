'use strict';

const SlaPolicy = require('../../models/SlaPolicy');
const SlaInstance = require('../../models/SlaInstance');
const SlaExecutionLog = require('../../models/SlaExecutionLog');
const { evaluateConditionGroup } = require('../../utils/slaConditionEvaluator');
const { DEFAULT_EXECUTION_MODE } = require('../../constants/slaPolicy');
const { getAdapter } = require('./slaModuleRegistry');
const { addBusinessMinutes } = require('../businessHoursEngine');
const { resolveSlaScheduleForOrganization } = require('../helpdeskBusinessHoursService');

function normalizeEvent(event = {}) {
  return {
    type: event.type || 'record_created',
    field: event.field || null,
    fromValue: event.fromValue,
    toValue: event.toValue,
    eventName: event.eventName || null,
    occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date()
  };
}

function triggerMatches(trigger, recordData, event) {
  const type = trigger?.type || 'record_created';
  if (type === 'record_created') return event.type === 'record_created';
  if (type === 'custom_event') {
    return event.type === 'custom_event' && String(event.eventName) === String(trigger.eventName);
  }
  if (type === 'field_change') {
    if (event.type !== 'field_change' || !trigger.field) return false;
    if (event.field !== trigger.field) return false;
    if (trigger.toValue != null && event.toValue !== trigger.toValue) return false;
    if (trigger.fromValue != null && event.fromValue !== trigger.fromValue) return false;
    return true;
  }
  if (type === 'date_field_reached') {
    if (!trigger.dateField) return false;
    const value = recordData[trigger.dateField];
    if (!value) return false;
    const target = new Date(value);
    return !Number.isNaN(target.getTime()) && target <= new Date();
  }
  return false;
}

function resolveTargetsForRecord(policy, recordData, adapter) {
  const dimension =
    policy?.advanced?.targetDimensionFieldKey
    || adapter?.priorityDimension
    || 'priority';
  const dimensionValue = recordData[dimension] || null;
  const targets = Array.isArray(policy.targets) ? policy.targets : [];
  const byMilestone = new Map();

  for (const target of targets) {
    if (target.priorityKey && dimensionValue) {
      if (Array.isArray(dimensionValue)) {
        if (!dimensionValue.includes(target.priorityKey)) continue;
      } else if (target.priorityKey !== dimensionValue) {
        continue;
      }
    }
    const minutes = Number(target.durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    const existing = byMilestone.get(target.milestoneKey);
    if (!existing || (target.priorityKey === dimensionValue && !existing.matchedPriority)) {
      byMilestone.set(target.milestoneKey, {
        milestoneKey: target.milestoneKey,
        durationMinutes: minutes,
        calendarOverride: target.calendarOverride || null,
        matchedPriority: Array.isArray(dimensionValue)
          ? dimensionValue.includes(target.priorityKey)
          : target.priorityKey === dimensionValue
      });
    }
  }

  return Array.from(byMilestone.values());
}

async function loadActivePolicies(organizationId, moduleKey) {
  return SlaPolicy.find({
    organizationId,
    'scope.moduleKey': String(moduleKey).toLowerCase(),
    active: true,
    deletedAt: null
  })
    .sort({ precedence: -1, updatedAt: -1 })
    .lean();
}

function selectPolicies(policies, executionMode = DEFAULT_EXECUTION_MODE) {
  const mode = executionMode || DEFAULT_EXECUTION_MODE;
  if (mode === 'all_matches') return policies;
  if (mode === 'highest_priority' && policies.length > 0) return [policies[0]];
  return policies.length > 0 ? [policies[0]] : [];
}

async function appendLog({
  organizationId,
  instanceId,
  policyKey,
  moduleKey,
  recordId,
  eventType,
  payload,
  actorId
}) {
  await SlaExecutionLog.create({
    organizationId,
    instanceId,
    policyKey,
    moduleKey,
    recordId,
    eventType,
    payload: payload || {},
    actorId: actorId || null,
    occurredAt: new Date()
  });
}

async function resolveSchedule(organizationId, policy) {
  const useCalendar = policy?.calendar?.mode === 'calendar24x7';
  if (useCalendar) {
    return { useCalendarTime: true, schedule: null, meta: { source: 'policy', mode: 'calendar24x7' } };
  }
  return resolveSlaScheduleForOrganization(organizationId);
}

function computeTargetAt(startedAt, durationMinutes, scheduleResolution) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const { useCalendarTime, schedule } = scheduleResolution;
  if (useCalendarTime || !schedule) {
    return new Date(start.getTime() + durationMinutes * 60000);
  }
  return addBusinessMinutes(start, durationMinutes, schedule);
}

async function createInstance({
  organizationId,
  policy,
  record,
  moduleKey,
  milestoneTarget,
  scheduleResolution,
  cycleNo = 1
}) {
  const startedAt = new Date();
  const targetAt = computeTargetAt(startedAt, milestoneTarget.durationMinutes, scheduleResolution);
  const adapter = getAdapter(moduleKey);
  const recordData = adapter ? adapter.normalizeRecord(record) : record;

  const instance = await SlaInstance.create({
    organizationId,
    policyId: policy._id,
    policyKey: policy.policyKey,
    policySnapshot: {
      name: policy.name,
      milestoneKey: milestoneTarget.milestoneKey,
      durationMinutes: milestoneTarget.durationMinutes,
      moduleKey,
      context: recordData,
      computedAt: startedAt
    },
    moduleKey,
    recordId: record._id,
    milestoneKey: milestoneTarget.milestoneKey,
    cycleNo,
    status: 'running',
    startedAt,
    targetAt
  });

  await appendLog({
    organizationId,
    instanceId: instance._id,
    policyKey: policy.policyKey,
    moduleKey,
    recordId: record._id,
    eventType: 'applied',
    payload: { milestoneKey: milestoneTarget.milestoneKey, targetAt }
  });

  return instance;
}

async function evaluateAndApply({
  organizationId,
  moduleKey,
  record,
  event = {},
  actorId = null
}) {
  const adapter = getAdapter(moduleKey);
  if (!adapter) {
    return { matched: 0, instances: [], reason: 'no_adapter' };
  }

  const recordData = adapter.normalizeRecord(record);
  const cycleNo = Number(record?.currentSlaCycle?.cycleNo) || 1;
  const policies = await loadActivePolicies(organizationId, moduleKey);
  const normalizedEvent = normalizeEvent(event);
  const matchedPolicies = [];

  for (const policy of policies) {
    if (!evaluateConditionGroup(policy.entryCriteria, recordData)) continue;
    if (!triggerMatches(policy.trigger, recordData, normalizedEvent)) continue;
    matchedPolicies.push(policy);
  }

  const mode = matchedPolicies[0]?.executionMode || DEFAULT_EXECUTION_MODE;
  let selected = selectPolicies(matchedPolicies, mode);

  if (selected.length === 0) {
    const defaultPolicy = await SlaPolicy.findOne({
      organizationId,
      'scope.moduleKey': String(moduleKey).toLowerCase(),
      isDefault: true,
      active: true,
      deletedAt: null
    }).lean();
    if (defaultPolicy) {
      selected = [defaultPolicy];
    }
  }

  if (selected.length === 0) {
    return { matched: 0, instances: [], reason: 'no_matching_policy' };
  }

  const scheduleResolution = await resolveSchedule(organizationId, selected[0]);
  const instances = [];

  for (const policy of selected) {
    const targets = resolveTargetsForRecord(policy, recordData, adapter);
    for (const milestoneTarget of targets) {
      const instance = await createInstance({
        organizationId,
        policy,
        record,
        moduleKey,
        milestoneTarget,
        scheduleResolution,
        cycleNo
      });
      instances.push(instance);
      await appendLog({
        organizationId,
        instanceId: instance._id,
        policyKey: policy.policyKey,
        moduleKey,
        recordId: record._id,
        eventType: 'triggered',
        payload: { event: normalizedEvent },
        actorId
      });
    }
  }

  return { matched: selected.length, instances };
}

async function evaluateLifecycleUpdate({
  organizationId,
  moduleKey,
  record,
  changes = {}
}) {
  const adapter = getAdapter(moduleKey);
  if (!adapter) return { updated: 0 };

  const recordData = adapter.normalizeRecord(record);
  const instances = await SlaInstance.find({
    organizationId,
    moduleKey,
    recordId: record._id,
    status: { $in: ['running', 'paused'] }
  });

  let updated = 0;
  const now = new Date();

  for (const instance of instances) {
    const policy = await SlaPolicy.findById(instance.policyId).lean();
    if (!policy) continue;

    let dirty = false;

    const shouldPause = (policy.pauseConditions || []).some((g) => evaluateConditionGroup(g, recordData))
      || adapter.shouldPause?.(record);
    const shouldResume = (policy.resumeConditions || []).some((g) => evaluateConditionGroup(g, recordData));
    const success = evaluateConditionGroup(policy.successCriteria, recordData)
      || adapter.isTerminalSuccess?.(record);

    if (success && instance.status !== 'met') {
      instance.status = 'met';
      instance.metAt = now;
      instance.stoppedAt = now;
      dirty = true;
      await appendLog({
        organizationId,
        instanceId: instance._id,
        policyKey: instance.policyKey,
        moduleKey,
        recordId: record._id,
        eventType: 'met',
        payload: { changes }
      });
    } else if (shouldPause && instance.status === 'running') {
      instance.status = 'paused';
      instance.pausedAt = now;
      dirty = true;
      await appendLog({
        organizationId,
        instanceId: instance._id,
        policyKey: instance.policyKey,
        moduleKey,
        recordId: record._id,
        eventType: 'paused',
        payload: { changes }
      });
    } else if (shouldResume && instance.status === 'paused') {
      const segments = Array.isArray(instance.pauseSegments) ? [...instance.pauseSegments] : [];
      if (instance.pausedAt) segments.push({ from: instance.pausedAt, to: now });
      instance.pauseSegments = segments;
      instance.pausedAt = null;
      instance.status = 'running';
      dirty = true;
      await appendLog({
        organizationId,
        instanceId: instance._id,
        policyKey: instance.policyKey,
        moduleKey,
        recordId: record._id,
        eventType: 'resumed',
        payload: { changes }
      });
    }

    if (dirty) {
      await instance.save();
      updated += 1;
    }
  }

  return { updated };
}

async function simulatePolicyMatch({ organizationId, moduleKey, sampleRecord, event = {} }) {
  const adapter = getAdapter(moduleKey);
  if (!adapter) return { matches: [], reason: 'no_adapter' };

  const recordData = adapter.normalizeRecord(sampleRecord);
  const policies = await loadActivePolicies(organizationId, moduleKey);
  const normalizedEvent = normalizeEvent(event);
  const matches = [];

  for (const policy of policies) {
    const entryOk = evaluateConditionGroup(policy.entryCriteria, recordData);
    const triggerOk = triggerMatches(policy.trigger, recordData, normalizedEvent);
    if (entryOk && triggerOk) {
      matches.push({
        policyKey: policy.policyKey,
        name: policy.name,
        targets: resolveTargetsForRecord(policy, recordData, adapter)
      });
    }
  }

  if (matches.length === 0) {
    const defaultPolicy = await SlaPolicy.findOne({
      organizationId,
      'scope.moduleKey': String(moduleKey).toLowerCase(),
      isDefault: true,
      active: true,
      deletedAt: null
    }).lean();
    if (defaultPolicy) {
      const entryOk = evaluateConditionGroup(defaultPolicy.entryCriteria, recordData);
      const triggerOk = triggerMatches(defaultPolicy.trigger, recordData, normalizedEvent);
      if (entryOk && triggerOk) {
        matches.push({
          policyKey: defaultPolicy.policyKey,
          name: defaultPolicy.name,
          isDefaultFallback: true,
          targets: resolveTargetsForRecord(defaultPolicy, recordData, adapter)
        });
      }
    }
  }

  return { matches, recordData };
}

module.exports = {
  loadActivePolicies,
  evaluateAndApply,
  evaluateLifecycleUpdate,
  simulatePolicyMatch,
  triggerMatches,
  resolveTargetsForRecord,
  appendLog
};
