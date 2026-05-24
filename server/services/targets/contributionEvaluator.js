'use strict';

const crypto = require('crypto');
const Target = require('../../models/Target');
const TargetContributionLedger = require('../../models/TargetContributionLedger');
const Deal = require('../../models/Deal');
const { entityTypeFromEvent, moduleKeyFromEntity } = require('./contributionRuleRegistry');
const { applyContributionToTarget } = require('./targetAggregator');

function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
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
  return filters.every((f) => evaluateFilter(f, state));
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
  const prevMatch = filtersMatch(rule, previousState || {});
  const currMatch = filtersMatch(rule, currentState || {});
  if (currMatch && !prevMatch) return { direction: 'credit', amount: resolveMetricAmount(rule, currentState) };
  if (prevMatch && !currMatch) return { direction: 'debit', amount: resolveMetricAmount(rule, previousState) };
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

  return Target.find({
    organizationId: orgId,
    lifecycleStatus: { $in: ['active', 'locked'] },
    'sourceModules': {
      $elemMatch: { appKey, moduleKey }
    }
  }).lean();
}

async function processDomainEventForTargets(event) {
  if (!event?.organizationId || !event?.entityId) return { processed: 0 };

  const previousState = event.previousState || null;
  const currentState = event.currentState || (await loadRecordState(event));
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
        attributedUserId: resolveAttribution(rule, currentState),
        occurredAt: new Date(),
        metadata: { eventId: event.eventId }
      });

      await applyContributionToTarget(target._id, signedAmount, resolveAttribution(rule, currentState));
      processed += 1;
    }
  }

  return { processed };
}

module.exports = {
  evaluateFilter,
  processDomainEventForTargets,
  shouldCredit,
  loadRecordState
};
