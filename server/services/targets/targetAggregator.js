'use strict';

const Target = require('../../models/Target');
const TargetAssignment = require('../../models/TargetAssignment');
const TargetContributionLedger = require('../../models/TargetContributionLedger');
const { recomputeTargetStatus } = require('./targetStatusService');
const { recomputeTargetForecast } = require('./targetForecastService');
const { emitTargetAutomationEvents } = require('./targetAutomationEmitter');

async function sumLedgerForTarget(targetId) {
  const rows = await TargetContributionLedger.aggregate([
    { $match: { targetId } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return rows[0]?.total || 0;
}

async function applyContributionToTarget(targetId, deltaAmount, attributedUserId) {
  const target = await Target.findById(targetId);
  if (!target) return null;

  const previousAchieved = target.achievedValue || 0;
  const total = await sumLedgerForTarget(targetId);
  target.achievedValue = Math.max(0, total);
  target.lastRecalculatedAt = new Date();
  await target.save();

  if (attributedUserId) {
    await TargetAssignment.updateOne(
      { targetId, userId: attributedUserId },
      { $inc: { achievedValue: deltaAmount } }
    );
  }

  await recomputeTargetForecast(target);
  const statusResult = await recomputeTargetStatus(target);
  await emitTargetAutomationEvents(target, {
    previousAchieved,
    statusResult
  });

  return target;
}

async function recalculateTargetFromLedger(targetId) {
  const target = await Target.findById(targetId);
  if (!target) return null;
  const total = await sumLedgerForTarget(targetId);
  target.achievedValue = Math.max(0, total);
  target.lastRecalculatedAt = new Date();
  await target.save();
  await recomputeTargetForecast(target);
  await recomputeTargetStatus(target);
  return target;
}

module.exports = {
  sumLedgerForTarget,
  applyContributionToTarget,
  recalculateTargetFromLedger
};
