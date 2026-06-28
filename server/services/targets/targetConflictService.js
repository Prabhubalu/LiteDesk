'use strict';

const Target = require('../../models/Target');

async function detectConflicts(targetPayload, organizationId, excludeTargetId = null) {
  const { assignedTo, periodStart, periodEnd, sourceModules = [] } = targetPayload;
  if (!assignedTo || !periodStart || !periodEnd) return [];

  const query = {
    organizationId,
    assignedTo,
    lifecycleStatus: { $in: ['active', 'locked', 'draft'] },
    periodStart: { $lt: new Date(periodEnd) },
    periodEnd: { $gt: new Date(periodStart) }
  };
  if (excludeTargetId) query._id = { $ne: excludeTargetId };

  const existing = await Target.find(query).lean();
  const moduleKeys = new Set(sourceModules.map((m) => `${m.appKey}:${m.moduleKey}`));

  return existing
    .filter((t) => (t.sourceModules || []).some((m) => moduleKeys.has(`${m.appKey}:${m.moduleKey}`)))
    .map((t) => ({
      targetId: t._id.toString(),
      name: t.name,
      periodStart: t.periodStart,
      periodEnd: t.periodEnd
    }));
}

module.exports = {
  detectConflicts
};
