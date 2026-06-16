'use strict';

const SlaPolicy = require('../../models/SlaPolicy');
const SlaInstance = require('../../models/SlaInstance');
const { applySlaTargetsToCycle, loadHelpdeskSlaConfig } = require('../helpdeskSlaService');
const { applyStatusToSlaCycle } = require('../caseLifecycleService');
const { evaluateAndApply, evaluateLifecycleUpdate } = require('./slaPolicyEngine');
const { migrateHelpdeskPoliciesToGeneric, ensureDefaultSlaPolicy } = require('./slaPolicyMigrationService');

const MODULE_KEY = 'cases';

async function countGenericPolicies(organizationId, moduleKey = MODULE_KEY) {
  return SlaPolicy.countDocuments({
    organizationId,
    'scope.moduleKey': String(moduleKey).toLowerCase(),
    active: true,
    deletedAt: null
  });
}

async function ensureGenericPolicies(organizationId) {
  await ensureDefaultSlaPolicy(organizationId);

  const count = await countGenericPolicies(organizationId);
  if (count > 0) return true;

  const legacy = await loadHelpdeskSlaConfig(organizationId);
  if (!Array.isArray(legacy.policies) || legacy.policies.length === 0) {
    return (await countGenericPolicies(organizationId)) > 0;
  }

  await migrateHelpdeskPoliciesToGeneric(organizationId);
  return (await countGenericPolicies(organizationId)) > 0;
}

async function usesGenericEngine(organizationId) {
  return ensureGenericPolicies(organizationId);
}

function buildSlaContextFromCase(caseRecord) {
  const row = caseRecord?.toObject?.() || caseRecord || {};
  return {
    caseType: row.caseType || 'Support Ticket',
    priority: row.priority || 'Medium',
    channel: row.channel || 'Internal'
  };
}

function milestoneToLegacyFields(milestoneKey) {
  if (milestoneKey === 'first_response') {
    return { targetField: 'responseTargetAt', metField: 'responseMetAt', minutesField: 'firstResponseMinutes' };
  }
  if (milestoneKey === 'resolution') {
    return { targetField: 'resolutionTargetAt', metField: null, minutesField: 'resolutionMinutes' };
  }
  return null;
}

function syncCycleFromInstances(cycle, instances = []) {
  const base = {
    ...(cycle?.toObject?.() || cycle || {}),
    policySnapshot: { ...(cycle?.policySnapshot || {}) },
    pauseSegments: Array.isArray(cycle?.pauseSegments) ? [...cycle.pauseSegments] : []
  };

  for (const instance of instances) {
    const mapping = milestoneToLegacyFields(instance.milestoneKey);
    if (!mapping) continue;
    if (instance.targetAt) base[mapping.targetField] = instance.targetAt;
    if (mapping.metField && instance.metAt) base[mapping.metField] = instance.metAt;
    if (instance.policySnapshot?.durationMinutes) {
      base.policySnapshot[mapping.minutesField] = instance.policySnapshot.durationMinutes;
    }
    if (instance.policyKey) base.policySnapshot.key = instance.policyKey;
    if (instance.policySnapshot?.name) base.policySnapshot.name = instance.policySnapshot.name;
  }

  const active = instances.filter((i) => ['running', 'paused', 'pending'].includes(i.status));
  if (active.some((i) => i.status === 'paused')) {
    base.status = 'paused';
    const paused = active.find((i) => i.status === 'paused' && i.pausedAt);
    if (paused?.pausedAt) base.pausedAt = paused.pausedAt;
  } else if (active.some((i) => i.status === 'running') && base.status !== 'stopped') {
    base.status = 'running';
    base.pausedAt = null;
  }

  if (instances.some((i) => i.status === 'breached')) {
    base.policySnapshot.breached = true;
  }

  return base;
}

async function loadActiveInstances(organizationId, recordId, cycleNo = null) {
  const filter = {
    organizationId,
    moduleKey: MODULE_KEY,
    recordId
  };
  if (cycleNo != null) filter.cycleNo = cycleNo;
  return SlaInstance.find({
    ...filter,
    status: { $nin: ['cancelled'] }
  })
    .sort({ milestoneKey: 1 })
    .lean();
}

async function cancelActiveInstances(organizationId, recordId, cycleNo = null) {
  const filter = {
    organizationId,
    moduleKey: MODULE_KEY,
    recordId,
    status: { $in: ['pending', 'running', 'paused'] }
  };
  if (cycleNo != null) filter.cycleNo = cycleNo;
  await SlaInstance.updateMany(filter, {
    $set: { status: 'cancelled', stoppedAt: new Date() }
  });
}

async function finalizeCaseSlaOnCreate({ organizationId, caseRecord, actorId = null }) {
  const cycle = caseRecord.currentSlaCycle?.toObject?.() || caseRecord.currentSlaCycle;
  const generic = await usesGenericEngine(organizationId);

  if (!generic) {
    return applySlaTargetsToCycle({
      organizationId,
      cycle,
      context: buildSlaContextFromCase(caseRecord),
      startedAt: cycle?.startedAt
    });
  }

  await evaluateAndApply({
    organizationId,
    moduleKey: MODULE_KEY,
    record: caseRecord,
    event: { type: 'record_created' },
    actorId
  });

  const instances = await loadActiveInstances(organizationId, caseRecord._id, cycle?.cycleNo || 1);
  return syncCycleFromInstances(cycle, instances);
}

async function applyCaseSlaLifecycle({
  organizationId,
  caseRecord,
  cycle,
  changes = {},
  event = null,
  actorId = null
}) {
  const generic = await usesGenericEngine(organizationId);
  let nextCycle = cycle?.toObject?.() || { ...cycle };

  if (generic) {
    const normalizedEvent = event || (changes.status
      ? { type: 'field_change', field: 'status', fromValue: changes.fromStatus, toValue: changes.status }
      : { type: 'field_change', field: Object.keys(changes)[0], toValue: changes[Object.keys(changes)[0]] });

    await evaluateLifecycleUpdate({
      organizationId,
      moduleKey: MODULE_KEY,
      record: caseRecord,
      changes
    });

    const instances = await loadActiveInstances(
      organizationId,
      caseRecord._id,
      nextCycle.cycleNo || 1
    );
    nextCycle = syncCycleFromInstances(nextCycle, instances);
  }

  if (changes.status) {
    nextCycle = applyStatusToSlaCycle(nextCycle, changes.status);
    if (generic) {
      const instances = await loadActiveInstances(
        organizationId,
        caseRecord._id,
        nextCycle.cycleNo || 1
      );
      nextCycle = syncCycleFromInstances(nextCycle, instances);
    }
  }

  return nextCycle;
}

async function recalculateCaseSlaTargets({ organizationId, caseRecord, cycle }) {
  const generic = await usesGenericEngine(organizationId);
  const baseCycle = cycle?.toObject?.() || { ...cycle };

  if (!generic) {
    return applySlaTargetsToCycle({
      organizationId,
      cycle: baseCycle,
      context: buildSlaContextFromCase(caseRecord),
      startedAt: baseCycle.startedAt
    });
  }

  await cancelActiveInstances(organizationId, caseRecord._id, baseCycle.cycleNo || 1);
  await evaluateAndApply({
    organizationId,
    moduleKey: MODULE_KEY,
    record: caseRecord,
    event: { type: 'record_created' }
  });

  const instances = await loadActiveInstances(organizationId, caseRecord._id, baseCycle.cycleNo || 1);
  return syncCycleFromInstances(baseCycle, instances);
}

async function reopenCaseSla({ organizationId, caseRecord, previousCycle, nextCycle, actorId = null }) {
  const generic = await usesGenericEngine(organizationId);
  const baseNext = nextCycle?.toObject?.() || { ...nextCycle };

  if (!generic) {
    return applySlaTargetsToCycle({
      organizationId,
      cycle: baseNext,
      context: buildSlaContextFromCase(caseRecord),
      startedAt: baseNext.startedAt
    });
  }

  await cancelActiveInstances(organizationId, caseRecord._id, previousCycle?.cycleNo || null);
  await evaluateAndApply({
    organizationId,
    moduleKey: MODULE_KEY,
    record: caseRecord,
    event: { type: 'record_created' },
    actorId
  });

  const instances = await loadActiveInstances(organizationId, caseRecord._id, baseNext.cycleNo || 1);
  return syncCycleFromInstances(baseNext, instances);
}

module.exports = {
  usesGenericEngine,
  ensureGenericPolicies,
  buildSlaContextFromCase,
  syncCycleFromInstances,
  finalizeCaseSlaOnCreate,
  applyCaseSlaLifecycle,
  recalculateCaseSlaTargets,
  reopenCaseSla,
  loadActiveInstances
};
