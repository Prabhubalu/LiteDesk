'use strict';

const mongoose = require('mongoose');
const Deal = require('../../models/Deal');
const Target = require('../../models/Target');
const TargetAssignment = require('../../models/TargetAssignment');
const { resolveDealWonLost } = require('../domainEventHelpers');

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  const s = String(id);
  if (mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);
  return id;
}

function isClosedDealStatic(doc) {
  const status = String(doc.status || doc.derivedStatus || '').trim().toLowerCase();
  if (status === 'won' || status === 'lost') return true;
  const stage = String(doc.stage || '').trim();
  return ['Closed Won', 'Closed Lost', 'Won', 'Lost'].includes(stage);
}

async function isClosedDeal(doc, appKey = 'SALES') {
  if (isClosedDealStatic(doc)) return true;
  try {
    const wl = await resolveDealWonLost(doc, appKey);
    return wl === 'won' || wl === 'lost';
  } catch {
    return isClosedDealStatic(doc);
  }
}

function targetTracksDeals(target) {
  const matches = (row) =>
    String(row?.appKey || '').toUpperCase() === 'SALES' &&
    String(row?.moduleKey || '').toLowerCase() === 'deals';

  return (
    (target.sourceModules || []).some(matches) ||
    (target.contributionRules || []).some(matches)
  );
}

/**
 * Sum probability-weighted open pipeline for target owners.
 * Includes all open deals owned by the target team (not limited to expected close date window).
 */
async function sumOpenPipeline(organizationId, ownerIds) {
  const oid = toObjectId(organizationId);
  const ownerObjectIds = (ownerIds || []).map(toObjectId).filter(Boolean);

  const query = {
    organizationId: oid,
    deletedAt: null
  };

  if (!ownerObjectIds.length) return 0;
  query.assignedTo = ownerObjectIds.length === 1 ? ownerObjectIds[0] : { $in: ownerObjectIds };

  const deals = await Deal.find(query)
    .select('amount probability status derivedStatus stage pipeline')
    .lean();

  let total = 0;
  for (const deal of deals) {
    if (await isClosedDeal(deal)) continue;
    const amount = Number(deal.amount) || 0;
    const probability = Number(deal.probability);
    const prob = Number.isFinite(probability) ? probability : 0;
    total += amount * (prob / 100);
  }
  return total;
}

async function resolvePipelineOwnerIds(target) {
  const ids = new Set();
  if (target.assignedTo) ids.add(String(target.assignedTo));
  const rows = await TargetAssignment.find({ targetId: target._id }).select('userId').lean();
  for (const row of rows) {
    if (row.userId) ids.add(String(row.userId));
  }
  return [...ids];
}

async function recomputeTargetForecast(targetDoc) {
  const targetId = targetDoc?._id || targetDoc;
  const target = await Target.findById(targetId);
  if (!target) return null;

  const rules = target.forecastRules || {};
  const achieved = Math.max(0, Number(target.achievedValue) || 0);
  const tracksDeals = targetTracksDeals(target);
  const includePipeline = rules.includePipeline !== false && tracksDeals;

  let pipeline = 0;
  if (includePipeline) {
    const ownerIds = await resolvePipelineOwnerIds(target);
    pipeline = await sumOpenPipeline(target.organizationId, ownerIds);
  }

  const pipelineWeight = rules.historicalWeight != null ? rules.historicalWeight : 1;
  const pipelineContribution = includePipeline ? pipeline * pipelineWeight : 0;
  const forecast = achieved + pipelineContribution;

  target.forecastValue = Math.max(0, forecast);

  if (!rules.enabled) {
    target.achievementProbability = null;
    target.riskLevel = null;
    await target.save();
    return target;
  }

  const goal = Math.max(Number(target.targetValue) || 0, 1);
  const probability = Math.min(1, Math.max(0, forecast / goal));

  target.achievementProbability = Math.round(probability * 100) / 100;
  target.riskLevel = probability < 0.5 ? 'high' : probability < 0.8 ? 'medium' : 'low';
  await target.save();
  return target;
}

async function getForecastBreakdown(targetId) {
  const target = await Target.findById(targetId);
  if (!target) return null;

  const rules = target.forecastRules || {};
  const achieved = Math.max(0, Number(target.achievedValue) || 0);
  const tracksDeals = targetTracksDeals(target);
  const includePipeline = rules.includePipeline !== false && tracksDeals;

  let pipeline = 0;
  if (includePipeline) {
    const ownerIds = await resolvePipelineOwnerIds(target);
    pipeline = await sumOpenPipeline(target.organizationId, ownerIds);
  }

  const pipelineWeight = rules.historicalWeight != null ? rules.historicalWeight : 1;
  const pipelineContribution = includePipeline ? pipeline * pipelineWeight : 0;

  return {
    enabled: Boolean(rules.enabled),
    tracksDeals,
    includePipeline: rules.includePipeline !== false,
    achieved,
    pipeline,
    pipelineContribution,
    forecastValue: achieved + pipelineContribution
  };
}

async function refreshForecastForDealEvent(event) {
  if (!event?.organizationId) return;
  const entityType = String(event.entityType || '').toLowerCase();
  if (entityType !== 'deal') return;

  const targets = await Target.find({
    organizationId: event.organizationId,
    lifecycleStatus: { $in: ['active', 'locked'] }
  }).lean();

  for (const row of targets) {
    if (!targetTracksDeals(row)) continue;
    if (row.forecastRules?.includePipeline === false) continue;
    await recomputeTargetForecast(row._id);
  }
}

module.exports = {
  recomputeTargetForecast,
  sumOpenPipeline,
  isClosedDeal,
  targetTracksDeals,
  refreshForecastForDealEvent,
  getForecastBreakdown
};
