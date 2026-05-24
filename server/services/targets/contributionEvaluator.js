'use strict';

const crypto = require('crypto');
const Target = require('../../models/Target');
const TargetAssignment = require('../../models/TargetAssignment');
const TargetContributionLedger = require('../../models/TargetContributionLedger');
const Deal = require('../../models/Deal');
const { entityTypeFromEvent, moduleKeyFromEntity } = require('./contributionRuleRegistry');
const { applyContributionToTarget } = require('./targetAggregator');

function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function isDealWonState(state) {
  if (!state) return false;
  const status = String(state.status || state.derivedStatus || '').trim().toLowerCase();
  if (status === 'won') return true;
  const stage = String(state.stage || '').trim();
  return stage === 'Won' || stage === 'Closed Won';
}

function isDealLostState(state) {
  if (!state) return false;
  const status = String(state.status || state.derivedStatus || '').trim().toLowerCase();
  if (status === 'lost') return true;
  const stage = String(state.stage || '').trim();
  return stage === 'Lost' || stage === 'Closed Lost';
}

function evaluateFilter(filter, state) {
  if (!filter?.field) return true;
  const actual = getNested(state, filter.field) ?? state[filter.field];
  const expected = filter.value;
  const op = filter.operator || 'equals';
  if (op === 'equals') return String(actual) === String(expected);
  if (op === 'not_equals') return String(actual) !== String(expected);
  if (op === 'in') return Array.isArray(expected) && expected.map(String).includes(String(actual));
  if (op === 'gte') return Number(actual) >= Number(expected);
  if (op === 'lte') return Number(actual) <= Number(expected);
  return false;
}

function filtersMatch(rule, state) {
  const filters = rule.filters || [];
  if (filters.length === 0) return true;
  return filters.every((f) => {
    if (rule.moduleKey === 'deals' && f.field === 'stage' && f.operator === 'equals' && f.value === 'Won') {
      return isDealWonState(state);
    }
    if (rule.moduleKey === 'deals' && f.field === 'status' && f.operator === 'equals' && String(f.value).toLowerCase() === 'won') {
      return isDealWonState(state);
    }
    if (rule.moduleKey === 'tasks' && f.field === 'status' && f.operator === 'equals' && f.value === 'Completed') {
      return evaluateFilter({ field: 'status', operator: 'equals', value: 'completed' }, state);
    }
    return evaluateFilter(f, state);
  });
}

function buildIdempotencyKey(targetId, recordId, ruleId, direction, version) {
  return crypto
    .createHash('sha256')
    .update(`${targetId}:${recordId}:${ruleId}:${direction}:${version}`)
    .digest('hex');
}

async function loadRecordState(event) {
  const entityType = entityTypeFromEvent(event);
  const entityId = event.entityId;
  if (!entityId) return null;

  if (entityType === 'deal') {
    const doc = await Deal.findById(entityId).lean();
    if (!doc) return null;
    return {
      stage: doc.stage,
      status: doc.status,
      derivedStatus: doc.derivedStatus,
      amount: doc.amount,
      ownerId: doc.ownerId,
      pipeline: doc.pipeline,
      organizationId: doc.organizationId
    };
  }

  if (entityType === 'case') {
    const Case = require('../../models/Case');
    const doc = await Case.findById(entityId).lean();
    if (!doc) return null;
    return {
      status: doc.status,
      caseOwnerId: doc.caseOwnerId,
      priority: doc.priority,
      organizationId: doc.organizationId
    };
  }

  if (entityType === 'task') {
    const Task = require('../../models/Task');
    const doc = await Task.findById(entityId).lean();
    if (!doc) return null;
    return {
      status: doc.status,
      assignedTo: doc.assignedTo,
      organizationId: doc.organizationId
    };
  }

  return event.currentState || null;
}

function resolveMetricAmount(rule, state) {
  if (rule.metricKind === 'count') return 1 * (rule.weight || 1);
  const field = rule.metricField || 'amount';
  const raw = getNested(state, field) ?? state[field];
  const n = Number(raw);
  return (Number.isFinite(n) ? n : 0) * (rule.weight || 1);
}

function shouldCredit(event, rule, previousState, currentState) {
  if (rule.moduleKey === 'deals' && event.eventType === 'deal.deal.won' && isDealWonState(currentState)) {
    return { direction: 'credit', amount: resolveMetricAmount(rule, currentState) };
  }
  if (rule.moduleKey === 'deals' && event.eventType === 'deal.deal.lost' && isDealLostState(currentState)) {
    return { direction: 'debit', amount: resolveMetricAmount(rule, previousState || currentState) };
  }

  const prevMatch = filtersMatch(rule, previousState || {});
  const currMatch = filtersMatch(rule, currentState || {});

  if (rule.moduleKey === 'deals' && event.eventType === 'deal.updated') {
    if (isDealWonState(previousState) && isDealWonState(currentState)) {
      const prevAmt = resolveMetricAmount(rule, previousState);
      const currAmt = resolveMetricAmount(rule, currentState);
      const delta = currAmt - prevAmt;
      if (delta === 0) return null;
      return { direction: delta > 0 ? 'credit' : 'debit', amount: Math.abs(delta) };
    }
  }

  if (currMatch && !prevMatch) return { direction: 'credit', amount: resolveMetricAmount(rule, currentState) };
  if (prevMatch && !currMatch) {
    if (rule.moduleKey === 'deals') {
      if (isDealWonState(currentState)) return null;
      if (!isDealLostState(currentState)) return null;
    }
    return { direction: 'debit', amount: resolveMetricAmount(rule, previousState) };
  }
  if (currMatch && prevMatch && event.eventType?.includes('updated')) {
    const prevAmt = resolveMetricAmount(rule, previousState);
    const currAmt = resolveMetricAmount(rule, currentState);
    const delta = currAmt - prevAmt;
    if (delta === 0) return null;
    return { direction: delta > 0 ? 'credit' : 'debit', amount: Math.abs(delta) };
  }
  return null;
}

function resolveAttribution(rule, state) {
  const attr = rule.attribution || { type: 'owner' };
  if (attr.type === 'field' && attr.field) return state[attr.field] || null;
  if (attr.type === 'owner') {
    return state.ownerId || state.caseOwnerId || state.assignedTo || null;
  }
  return null;
}

async function findCandidateTargets(event) {
  const orgId = event.organizationId;
  if (!orgId) return [];

  const entityType = entityTypeFromEvent(event);
  const moduleKey = moduleKeyFromEntity(entityType);
  const appKey = (event.appKey || 'SALES').toUpperCase();
  const at = event.occurredAt
    ? new Date(event.occurredAt)
    : event.timestamp
      ? new Date(event.timestamp)
      : new Date();
  const periodDayStart = new Date(at);
  periodDayStart.setUTCHours(0, 0, 0, 0);

  return Target.find({
    organizationId: orgId,
    lifecycleStatus: { $in: ['active', 'locked'] },
    periodStart: { $lte: at },
    periodEnd: { $gte: periodDayStart },
    sourceModules: {
      $elemMatch: { appKey, moduleKey }
    }
  }).lean();
}

async function targetAcceptsAttribution(target, attributedUserId) {
  if (!attributedUserId) return false;
  const uid = String(attributedUserId);
  if (target.ownerId && String(target.ownerId) === uid) return true;
  const assignment = await TargetAssignment.findOne({
    targetId: target._id,
    userId: attributedUserId
  })
    .select('_id')
    .lean();
  return Boolean(assignment);
}

async function mergeRecordState(event) {
  const loaded = await loadRecordState(event);
  if (loaded) {
    return {
      previousState: event.previousState || null,
      // Prefer persisted record over partial domain-event snapshots (stage-only payloads).
      currentState: { ...(event.currentState || {}), ...loaded }
    };
  }
  return {
    previousState: event.previousState || null,
    currentState: event.currentState || null
  };
}

async function processDomainEventForTargets(event) {
  if (!event?.organizationId || !event?.entityId) return { processed: 0 };

  const { previousState, currentState } = await mergeRecordState(event);
  if (!currentState) return { processed: 0 };

  const targets = await findCandidateTargets(event);
  let processed = 0;

  for (const target of targets) {
    const rules = (target.contributionRules || []).filter((r) => r.enabled !== false);
    for (const rule of rules) {
      const entityType = entityTypeFromEvent(event);
      const moduleKey = moduleKeyFromEntity(entityType);
      const eventAppKey = (
        event.appKey ||
        (entityType === 'case' ? 'HELPDESK' : entityType === 'task' ? 'PLATFORM' : 'SALES')
      ).toUpperCase();
      if (rule.appKey !== eventAppKey) continue;
      if (rule.moduleKey !== moduleKey) continue;

      const decision = shouldCredit(event, rule, previousState, currentState);
      if (!decision || decision.amount === 0) continue;

      const attributedUserId = resolveAttribution(rule, currentState);
      if (!(await targetAcceptsAttribution(target, attributedUserId))) continue;

      const version = target.currentVersionNumber || 1;
      const idempotencyKey = buildIdempotencyKey(
        target._id.toString(),
        String(event.entityId),
        rule.id,
        decision.direction,
        version
      );

      const existing = await TargetContributionLedger.findOne({
        targetId: target._id,
        idempotencyKey
      }).lean();
      if (existing) continue;

      const signedAmount = decision.direction === 'debit' ? -decision.amount : decision.amount;

      await TargetContributionLedger.create({
        organizationId: target.organizationId,
        targetId: target._id,
        ruleId: rule.id,
        idempotencyKey,
        direction: decision.direction,
        amount: signedAmount,
        sourceAppKey: rule.appKey,
        sourceModuleKey: rule.moduleKey,
        sourceRecordId: String(event.entityId),
        sourceEventType: event.eventType,
        attributedUserId,
        occurredAt: event.occurredAt
          ? new Date(event.occurredAt)
          : event.timestamp
            ? new Date(event.timestamp)
            : new Date(),
        metadata: { eventId: event.eventId }
      });

      await applyContributionToTarget(target._id, signedAmount, attributedUserId);
      processed += 1;
    }
  }

  return { processed };
}

async function purgeInvalidDealDebitsForTarget(targetId) {
  const debits = await TargetContributionLedger.find({
    targetId,
    direction: 'debit',
    sourceModuleKey: 'deals'
  })
    .select('_id sourceRecordId')
    .lean();

  let removed = 0;
  for (const row of debits) {
    if (!row.sourceRecordId) continue;
    const deal = await Deal.findById(row.sourceRecordId)
      .select('stage status derivedStatus')
      .lean();
    if (deal && isDealWonState(deal)) {
      await TargetContributionLedger.deleteOne({ _id: row._id });
      removed += 1;
    }
  }
  return removed;
}

async function backfillDealContributionsForTarget(target) {
  const rules = (target.contributionRules || []).filter(
    (r) => r.enabled !== false && r.moduleKey === 'deals' && r.appKey === 'SALES'
  );
  if (!rules.length) return 0;

  const userIds = new Set();
  if (target.ownerId) userIds.add(String(target.ownerId));
  const assigns = await TargetAssignment.find({ targetId: target._id }).select('userId').lean();
  for (const row of assigns) {
    if (row.userId) userIds.add(String(row.userId));
  }
  if (!userIds.size) return 0;

  const periodStart = new Date(target.periodStart);
  const periodEnd = new Date(target.periodEnd);
  periodEnd.setUTCHours(23, 59, 59, 999);

  const deals = await Deal.find({
    organizationId: target.organizationId,
    ownerId: { $in: [...userIds] },
    $or: [
      { status: { $regex: /^won$/i } },
      { derivedStatus: { $regex: /^won$/i } },
      { stage: { $in: ['Closed Won', 'Won'] } }
    ],
    updatedAt: { $gte: periodStart, $lte: periodEnd }
  })
    .select('_id ownerId stage status derivedStatus amount updatedAt actualCloseDate')
    .lean();

  const version = target.currentVersionNumber || 1;
  let created = 0;

  for (const deal of deals) {
    const dealState = {
      stage: deal.stage,
      status: deal.status,
      derivedStatus: deal.derivedStatus,
      amount: deal.amount,
      ownerId: deal.ownerId
    };

    for (const rule of rules) {
      const attributedUserId = resolveAttribution(rule, dealState);
      if (!(await targetAcceptsAttribution(target, attributedUserId))) continue;

      const idempotencyKey = buildIdempotencyKey(
        target._id.toString(),
        String(deal._id),
        rule.id,
        'credit',
        version
      );
      const existing = await TargetContributionLedger.findOne({
        targetId: target._id,
        idempotencyKey
      }).lean();
      if (existing) continue;

      const amount = resolveMetricAmount(rule, dealState);
      if (!amount) continue;

      await TargetContributionLedger.create({
        organizationId: target.organizationId,
        targetId: target._id,
        ruleId: rule.id,
        idempotencyKey,
        direction: 'credit',
        amount,
        sourceAppKey: rule.appKey,
        sourceModuleKey: rule.moduleKey,
        sourceRecordId: String(deal._id),
        sourceEventType: 'target.backfill',
        attributedUserId,
        occurredAt: deal.actualCloseDate || deal.updatedAt || new Date(),
        metadata: { backfill: true }
      });
      created += 1;
    }
  }

  return created;
}

module.exports = {
  evaluateFilter,
  processDomainEventForTargets,
  shouldCredit,
  loadRecordState,
  targetAcceptsAttribution,
  mergeRecordState,
  isDealWonState,
  isDealLostState,
  backfillDealContributionsForTarget,
  purgeInvalidDealDebitsForTarget
};
