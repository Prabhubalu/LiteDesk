'use strict';

const mongoose = require('mongoose');
const Target = require('../../models/Target');
const TargetAssignment = require('../../models/TargetAssignment');
const TargetContributionLedger = require('../../models/TargetContributionLedger');
const { recomputeTargetStatus } = require('./targetStatusService');
const { recomputeTargetForecast } = require('./targetForecastService');
const { emitTargetAutomationEvents } = require('./targetAutomationEmitter');

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  const s = String(id);
  if (mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);
  return id;
}

async function sumLedgerForTarget(targetId, extraFilter = {}) {
  const tid = toObjectId(targetId);
  const rows = await TargetContributionLedger.find({ targetId: tid, ...extraFilter })
    .select('amount')
    .lean();
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

async function sumLedgerByUser(targetId) {
  const tid = toObjectId(targetId);
  const rows = await TargetContributionLedger.find({
    targetId: tid,
    attributedUserId: { $ne: null }
  })
    .select('amount attributedUserId')
    .lean();

  const totalsByUser = new Map();
  for (const row of rows) {
    if (!row.attributedUserId) continue;
    const uid = String(row.attributedUserId);
    totalsByUser.set(uid, (totalsByUser.get(uid) || 0) + (Number(row.amount) || 0));
  }
  return totalsByUser;
}

async function applyContributionToTarget(targetId, deltaAmount, attributedUserId) {
  const target = await Target.findById(targetId);
  if (!target) return null;

  const previousAchieved = target.achievedValue || 0;
  const total = await sumLedgerForTarget(targetId);
  target.achievedValue = Math.max(0, total);
  target.lastRecalculatedAt = new Date();
  await target.save();

  await syncAssignmentAchievedFromLedger(targetId);

  await recomputeTargetForecast(target);
  const statusResult = await recomputeTargetStatus(target);
  await emitTargetAutomationEvents(target, {
    previousAchieved,
    statusResult
  });

  return target;
}

async function syncAssignmentAchievedFromLedger(targetId) {
  const totalsByUser = await sumLedgerByUser(targetId);

  const assignments = await TargetAssignment.find({ targetId: toObjectId(targetId) }).select('_id userId').lean();
  for (const row of assignments) {
    const uid = row.userId ? String(row.userId) : null;
    const total = uid && totalsByUser.has(uid) ? Math.max(0, totalsByUser.get(uid)) : 0;
    await TargetAssignment.updateOne({ _id: row._id }, { $set: { achievedValue: total } });
    if (uid) totalsByUser.delete(uid);
  }

  for (const [userId, total] of totalsByUser) {
    await TargetAssignment.updateOne(
      { targetId: toObjectId(targetId), userId },
      { $set: { achievedValue: Math.max(0, total) } },
      { upsert: false }
    );
  }
}

async function refreshTargetAchievedFromLedger(targetId) {
  const target = await Target.findById(targetId);
  if (!target) return null;

  const total = await sumLedgerForTarget(targetId);
  target.achievedValue = Math.max(0, total);
  target.lastRecalculatedAt = new Date();
  await target.save();
  await syncAssignmentAchievedFromLedger(targetId);
  await recomputeTargetForecast(target);
  await recomputeTargetStatus(target);
  return target;
}

async function recalculateTargetFromLedger(targetId) {
  const target = await Target.findById(targetId);
  if (!target) return null;
  if (['active', 'locked'].includes(target.lifecycleStatus)) {
    const {
      backfillDealContributionsForTarget,
      purgeInvalidDealDebitsForTarget
    } = require('./contributionEvaluator');
    await purgeInvalidDealDebitsForTarget(targetId);
    await backfillDealContributionsForTarget(target);
  }
  return refreshTargetAchievedFromLedger(targetId);
}

module.exports = {
  sumLedgerForTarget,
  applyContributionToTarget,
  recalculateTargetFromLedger,
  refreshTargetAchievedFromLedger,
  toObjectId
};
