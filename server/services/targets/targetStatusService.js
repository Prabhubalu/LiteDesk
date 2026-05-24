'use strict';

const Target = require('../../models/Target');

function periodProgress(periodStart, periodEnd, now = new Date()) {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  if (end <= start) return 1;
  const t = Math.min(Math.max(now.getTime(), start), end);
  return (t - start) / (end - start);
}

async function recomputeTargetStatus(targetDoc) {
  const target = targetDoc?.save ? targetDoc : await Target.findById(targetDoc?._id || targetDoc);
  if (!target) return null;

  const achieved = target.achievedValue || 0;
  const goal = target.targetValue || 0;
  const progress = periodProgress(target.periodStart, target.periodEnd);
  const expectedPace = goal * progress;
  const previousStatus = target.status;

  let status = 'not_started';
  if (target.lifecycleStatus === 'draft') {
    status = 'not_started';
  } else if (achieved >= goal * 1.2 && goal > 0) {
    status = 'overachieved';
  } else if (achieved >= goal && goal > 0) {
    status = 'achieved';
  } else if (progress > 0 && achieved < expectedPace * 0.85) {
    status = 'at_risk';
  } else if (progress > 0) {
    status = 'on_track';
  }

  if (status !== target.status) {
    target.status = status;
    await target.save();
    if (status === 'achieved' || status === 'overachieved') {
      const { onTargetIncentiveEligible } = require('./targetIncentivesService');
      await onTargetIncentiveEligible(
        target,
        status === 'overachieved' ? 'overachievement' : 'achievement'
      );
    }
  }

  return { status, previousStatus, changed: status !== previousStatus };
}

module.exports = {
  periodProgress,
  recomputeTargetStatus
};
