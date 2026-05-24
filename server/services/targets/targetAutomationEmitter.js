'use strict';

const { emit } = require('../domainEvents');
const { createLogger } = require('../automationLogger');

const log = createLogger('targetAutomation');

const crossedThresholds = new Map();

function thresholdKey(targetId, percent) {
  return `${targetId}:${percent}`;
}

async function emitTargetAutomationEvents(target, context = {}) {
  const targetId = target._id?.toString() || String(target._id);
  const achieved = target.achievedValue || 0;
  const goal = target.targetValue || 0;
  const pct = goal > 0 ? (achieved / goal) * 100 : 0;

  const base = {
    entityType: 'target',
    entityId: targetId,
    organizationId: target.organizationId,
    appKey: 'PLATFORM',
    ownerId: target.ownerId,
    triggeredBy: 'system',
    previousState: { achievedValue: context.previousAchieved ?? 0, status: context.statusResult?.previousStatus },
    currentState: {
      achievedValue: achieved,
      targetValue: goal,
      percent: pct,
      status: target.status,
      lifecycleStatus: target.lifecycleStatus
    }
  };

  emit({
    ...base,
    eventType: 'target.progress.updated'
  });

  if (context.statusResult?.changed) {
    emit({
      ...base,
      eventType: 'target.status.changed'
    });
  }

  for (const th of target.thresholds || []) {
    const thPct = Number(th.percent);
    if (!Number.isFinite(thPct) || pct < thPct) continue;
    const key = thresholdKey(targetId, thPct);
    if (crossedThresholds.has(key)) continue;
    crossedThresholds.set(key, true);
    emit({
      ...base,
      eventType: 'target.threshold.crossed',
      currentState: {
        ...base.currentState,
        thresholdPercent: thPct,
        achievedPercent: pct
      }
    });
    log.info('target_threshold_crossed', { targetId, thresholdPercent: thPct });
  }
}

function emitTargetActivated(target, userId) {
  emit({
    entityType: 'target',
    entityId: target._id.toString(),
    eventType: 'target.lifecycle.activated',
    organizationId: target.organizationId,
    appKey: 'PLATFORM',
    ownerId: target.ownerId,
    triggeredBy: userId || 'system',
    previousState: { lifecycleStatus: 'draft' },
    currentState: { lifecycleStatus: 'active', targetValue: target.targetValue }
  });
}

module.exports = {
  emitTargetAutomationEvents,
  emitTargetActivated
};
