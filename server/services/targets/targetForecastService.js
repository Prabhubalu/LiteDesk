'use strict';

const Deal = require('../../models/Deal');
const Target = require('../../models/Target');

async function sumOpenPipeline(organizationId, ownerId) {
  const match = {
    organizationId,
    stage: { $nin: ['Won', 'Lost'] }
  };
  if (ownerId) match.ownerId = ownerId;

  const rows = await Deal.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: { $multiply: ['$amount', { $divide: [{ $ifNull: ['$probability', 0] }, 100] }] } }
      }
    }
  ]);
  return rows[0]?.total || 0;
}

async function recomputeTargetForecast(targetDoc) {
  const target = targetDoc?.save ? targetDoc : await Target.findById(targetDoc?._id || targetDoc);
  if (!target) return null;

  const rules = target.forecastRules || {};
  if (!rules.enabled) {
    target.forecastValue = target.achievedValue || 0;
    target.achievementProbability = null;
    target.riskLevel = null;
    await target.save();
    return target;
  }

  let forecast = target.achievedValue || 0;
  if (rules.includePipeline && target.sourceModules?.some((m) => m.appKey === 'SALES' && m.moduleKey === 'deals')) {
    const pipeline = await sumOpenPipeline(target.organizationId, target.ownerId);
    forecast += pipeline * (rules.historicalWeight ?? 0.3);
  }

  const goal = target.targetValue || 1;
  const probability = Math.min(1, Math.max(0, forecast / goal));
  target.forecastValue = forecast;
  target.achievementProbability = Math.round(probability * 100) / 100;
  target.riskLevel = probability < 0.5 ? 'high' : probability < 0.8 ? 'medium' : 'low';
  await target.save();
  return target;
}

module.exports = {
  recomputeTargetForecast,
  sumOpenPipeline
};
