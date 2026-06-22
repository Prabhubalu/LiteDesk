'use strict';

const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');

function emptyOperationalMetrics() {
  return {
    visitorMessageCount: 0,
    agentMessageCount: 0,
    attachmentCount: 0,
    agentCount: 0,
  };
}

function resolveAgentCount(metrics, sessionLean) {
  const fromMessages = Number(metrics?.agentCount) || 0;
  const fromInvolved = Array.isArray(sessionLean?.agentsInvolved)
    ? sessionLean.agentsInvolved.filter(Boolean).length
    : 0;
  return Math.max(fromMessages, fromInvolved);
}

async function aggregateOperationalMetricsBySessionIds(sessionIds) {
  const ids = (Array.isArray(sessionIds) ? sessionIds : [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return new Map();

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
  const rows = await ChatMessage.aggregate([
    { $match: { sessionId: { $in: objectIds } } },
    {
      $group: {
        _id: '$sessionId',
        visitorMessageCount: {
          $sum: { $cond: [{ $eq: ['$authorType', 'visitor'] }, 1, 0] },
        },
        agentMessageCount: {
          $sum: { $cond: [{ $eq: ['$authorType', 'agent'] }, 1, 0] },
        },
        attachmentCount: {
          $sum: { $size: { $ifNull: ['$attachments', []] } },
        },
        agentAuthorNames: {
          $addToSet: {
            $cond: [
              {
                $and: [
                  { $eq: ['$authorType', 'agent'] },
                  { $ne: [{ $trim: { input: { $ifNull: ['$authorName', ''] } } }, ''] },
                ],
              },
              { $trim: { input: '$authorName' } },
              '$$REMOVE',
            ],
          },
        },
      },
    },
    {
      $project: {
        visitorMessageCount: 1,
        agentMessageCount: 1,
        attachmentCount: 1,
        agentCount: { $size: '$agentAuthorNames' },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), {
    visitorMessageCount: Number(row.visitorMessageCount) || 0,
    agentMessageCount: Number(row.agentMessageCount) || 0,
    attachmentCount: Number(row.attachmentCount) || 0,
    agentCount: Number(row.agentCount) || 0,
  }]));
}

async function buildOperationalMetricsPatch(sessionId, sessionLean) {
  const metricsBySessionId = await aggregateOperationalMetricsBySessionIds([sessionId]);
  const metrics = metricsBySessionId.get(String(sessionId)) || emptyOperationalMetrics();
  return {
    visitorMessageCount: metrics.visitorMessageCount,
    agentMessageCount: metrics.agentMessageCount,
    attachmentCount: metrics.attachmentCount,
    agentCount: resolveAgentCount(metrics, sessionLean),
  };
}

function resolveOperationalMetricsForRow(row, metricsBySessionId) {
  const live = metricsBySessionId.get(String(row._id)) || emptyOperationalMetrics();
  const isClosed = String(row?.status || '') === 'closed';
  if (!isClosed) {
    return {
      ...live,
      agentCount: resolveAgentCount(live, row),
    };
  }

  const hasSnapshot = Number(row.visitorMessageCount) > 0
    || Number(row.agentMessageCount) > 0
    || Number(row.attachmentCount) > 0
    || Number(row.agentCount) > 0;

  if (!hasSnapshot) {
    return {
      ...live,
      agentCount: resolveAgentCount(live, row),
    };
  }

  return {
    visitorMessageCount: Number(row.visitorMessageCount) || 0,
    agentMessageCount: Number(row.agentMessageCount) || 0,
    attachmentCount: Number(row.attachmentCount) || 0,
    agentCount: Number(row.agentCount) || resolveAgentCount(live, row),
  };
}

module.exports = {
  emptyOperationalMetrics,
  aggregateOperationalMetricsBySessionIds,
  buildOperationalMetricsPatch,
  resolveOperationalMetricsForRow,
  resolveAgentCount,
};
