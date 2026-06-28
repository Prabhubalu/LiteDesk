'use strict';

const Target = require('../../models/Target');
const TargetAssignment = require('../../models/TargetAssignment');

/**
 * Leaderboard from active targets (phase 5 foundation).
 */
async function getLeaderboard(organizationId, { limit = 10 } = {}) {
  const assignments = await TargetAssignment.find({ organizationId })
    .sort({ achievedValue: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName email avatar')
    .lean();

  return assignments.map((row, index) => ({
    rank: index + 1,
    userId: row.userId?._id || row.userId,
    user: row.userId,
    achievedValue: row.achievedValue || 0,
    targetId: row.targetId
  }));
}

async function getStreakSummary(userId, organizationId) {
  const count = await Target.countDocuments({
    organizationId,
    assignedTo: userId,
    status: { $in: ['achieved', 'overachieved'] }
  });
  return { achievedTargets: count, streakDays: 0 };
}

module.exports = {
  getLeaderboard,
  getStreakSummary
};
