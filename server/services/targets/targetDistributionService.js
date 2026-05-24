'use strict';

const TargetAssignment = require('../../models/TargetAssignment');
const { publishTargetVersion } = require('./targetVersionService');

async function syncAssignmentsFromDistribution(target, assignees = []) {
  await TargetAssignment.deleteMany({ targetId: target._id });

  if (!assignees.length) {
    if (target.ownerId) {
      await TargetAssignment.create({
        organizationId: target.organizationId,
        targetId: target._id,
        userId: target.ownerId,
        weight: 1,
        allocatedValue: target.targetValue
      });
    }
    return;
  }

  const totalWeight = assignees.reduce((s, a) => s + (a.weight || 1), 0) || 1;

  for (const row of assignees) {
    let allocated = target.targetValue;
    if (target.distributionType === 'weighted' || target.distributionType === 'equal') {
      allocated = (target.targetValue * (row.weight || 1)) / totalWeight;
    } else if (target.distributionType === 'manual' && row.allocatedValue != null) {
      allocated = row.allocatedValue;
    } else if (target.distributionType === 'capacity' && row.capacity != null) {
      allocated = row.capacity;
    }

    await TargetAssignment.create({
      organizationId: target.organizationId,
      targetId: target._id,
      userId: row.userId || null,
      teamId: row.teamId || null,
      weight: row.weight || 1,
      capacity: row.capacity ?? null,
      allocatedValue: allocated
    });
  }
}

async function applyDistributionChange(target, assignees, publishedBy) {
  await syncAssignmentsFromDistribution(target, assignees);
  return publishTargetVersion(target, 'distribution_change', publishedBy);
}

module.exports = {
  syncAssignmentsFromDistribution,
  applyDistributionChange
};
