'use strict';

const { emit } = require('../domainEvents');
const { createLogger } = require('../automationLogger');
const TargetPlatformSettings = require('../../models/TargetPlatformSettings');

const log = createLogger('targetIncentives');

async function isIncentivesEnabled(organizationId) {
  const settings = await TargetPlatformSettings.findOne({ organizationId }).lean();
  return Boolean(settings?.incentivesEnabled);
}

/**
 * Phase 5: emit incentive events; commission math stays out of process engine.
 */
async function onTargetIncentiveEligible(target, kind) {
  if (!(await isIncentivesEnabled(target.organizationId))) return;

  emit({
    entityType: 'target',
    entityId: target._id.toString(),
    eventType: kind === 'overachievement' ? 'target.incentive.overachieved' : 'target.incentive.achieved',
    organizationId: target.organizationId,
    appKey: 'PLATFORM',
    ownerId: target.ownerId,
    triggeredBy: 'system',
    currentState: {
      achievedValue: target.achievedValue,
      targetValue: target.targetValue,
      kind
    }
  });

  log.info('target_incentive_event', { targetId: target._id, kind });
}

module.exports = {
  isIncentivesEnabled,
  onTargetIncentiveEligible
};
