'use strict';

const TargetVersion = require('../../models/TargetVersion');
const TargetAssignment = require('../../models/TargetAssignment');

async function publishTargetVersion(target, reason, publishedBy) {
  const assignments = await TargetAssignment.find({ targetId: target._id }).lean();
  const versionNumber = (target.currentVersionNumber || 0) + 1;

  const version = await TargetVersion.create({
    targetId: target._id,
    organizationId: target.organizationId,
    versionNumber,
    reason,
    snapshot: {
      name: target.name,
      targetTypeKey: target.targetTypeKey,
      metricKind: target.metricKind,
      sourceModules: target.sourceModules,
      contributionRules: target.contributionRules,
      targetValue: target.targetValue,
      distributionType: target.distributionType,
      periodStart: target.periodStart,
      periodEnd: target.periodEnd,
      thresholds: target.thresholds,
      forecastRules: target.forecastRules,
      assignments
    },
    publishedBy
  });

  target.currentVersionNumber = versionNumber;
  await target.save();
  return version;
}

async function listTargetVersions(targetId) {
  return TargetVersion.find({ targetId }).sort({ versionNumber: -1 }).lean();
}

module.exports = {
  publishTargetVersion,
  listTargetVersions
};
