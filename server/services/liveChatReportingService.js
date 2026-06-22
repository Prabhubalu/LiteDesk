const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const LiveChatQueue = require('../models/LiveChatQueue');
const LiveChatAgentPresence = require('../models/LiveChatAgentPresence');
const User = require('../models/User');
const { buildChatSessionScopeFilter } = require('../utils/liveChatSessionQueryUtils');

function parseDateRange(fromRaw, toRaw) {
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;
  if (from && Number.isNaN(from.getTime())) {
    const err = new Error('Invalid from date');
    err.statusCode = 400;
    throw err;
  }
  if (to && Number.isNaN(to.getTime())) {
    const err = new Error('Invalid to date');
    err.statusCode = 400;
    throw err;
  }
  if (from && to && from > to) {
    const err = new Error('from must be earlier than to');
    err.statusCode = 400;
    throw err;
  }
  return { from, to };
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function buildEndedAtFilter(from, to) {
  if (!from && !to) return {};
  const filter = {};
  if (from) filter.$gte = from;
  if (to) filter.$lte = to;
  return filter;
}

function durationSeconds(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 1000);
}

function averageSeconds(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}

function averageNumber(values, { decimals = 1 } = {}) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return null;
  const factor = 10 ** decimals;
  return Math.round((nums.reduce((sum, v) => sum + v, 0) / nums.length) * factor) / factor;
}

function summarizeCsat(sessions) {
  const rated = sessions.filter(
    (session) => session?.ratedByVisitor && Number.isFinite(Number(session?.csatScore)),
  );
  const scores = rated.map((session) => Number(session.csatScore));
  const distribution = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: scores.filter((value) => value === score).length,
  }));

  return {
    ratedCount: scores.length,
    avgScore: averageNumber(scores),
    distribution,
  };
}

function summarizeTransfers(sessions) {
  let totalTransfers = 0;
  let sessionsWithTransfers = 0;
  for (const session of sessions) {
    const count = Number(session?.transferCount) || 0;
    if (count > 0) {
      sessionsWithTransfers += 1;
      totalTransfers += count;
    }
  }
  const closedCount = sessions.length;
  return {
    totalTransfers,
    sessionsWithTransfers,
    transferRate: closedCount > 0
      ? Math.round((sessionsWithTransfers / closedCount) * 1000) / 10
      : null,
  };
}

async function loadQueueNameMap(organizationId, queueIds) {
  const ids = [...new Set(queueIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const rows = await LiveChatQueue.find({ organizationId, _id: { $in: ids } })
    .select('_id name queueKey')
    .lean();
  return new Map(rows.map((row) => [String(row._id), row.name || row.queueKey || String(row._id)]));
}

async function loadUserNameMap(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const rows = await User.find({ _id: { $in: ids } })
    .select('_id firstName lastName email username')
    .lean();
  return new Map(
    rows.map((row) => {
      const name =
        [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
        row.username ||
        row.email ||
        String(row._id);
      return [String(row._id), name];
    }),
  );
}

async function computeFirstResponseTimes(sessionIds) {
  if (!sessionIds.length) return new Map();

  const [inboundRows, outboundRows] = await Promise.all([
    ChatMessage.aggregate([
      { $match: { sessionId: { $in: sessionIds }, direction: 'inbound' } },
      { $group: { _id: '$sessionId', firstAt: { $min: '$createdAt' } } },
    ]),
    ChatMessage.aggregate([
      { $match: { sessionId: { $in: sessionIds }, direction: 'outbound' } },
      { $group: { _id: '$sessionId', firstAt: { $min: '$createdAt' } } },
    ]),
  ]);

  const inboundMap = new Map(inboundRows.map((row) => [String(row._id), row.firstAt]));
  const outboundMap = new Map(outboundRows.map((row) => [String(row._id), row.firstAt]));

  const result = new Map();
  for (const sessionId of sessionIds) {
    const key = String(sessionId);
    const frt = durationSeconds(inboundMap.get(key), outboundMap.get(key));
    if (frt != null) result.set(key, frt);
  }
  return result;
}

function countLinkedRecords(sessions) {
  let casesCreated = 0;
  let casesLinked = 0;
  let peopleCreated = 0;
  let peopleLinked = 0;

  for (const session of sessions) {
    const links = Array.isArray(session.linkedRecords) ? session.linkedRecords : [];
    for (const link of links) {
      const moduleKey = String(link?.moduleKey || '').trim().toLowerCase();
      const linkType = String(link?.linkType || 'linked').trim().toLowerCase();
      if (moduleKey === 'cases' || moduleKey === 'helpdesk_cases') {
        if (linkType === 'created') casesCreated += 1;
        else casesLinked += 1;
      } else if (moduleKey === 'people') {
        if (linkType === 'created') peopleCreated += 1;
        else peopleLinked += 1;
      }
    }
  }

  return { casesCreated, casesLinked, peopleCreated, peopleLinked };
}

async function getReportOverview(organizationId, { from: fromRaw, to: toRaw } = {}) {
  let from = null;
  let to = null;
  if (fromRaw || toRaw) {
    ({ from, to } = parseDateRange(fromRaw, toRaw));
  } else {
    ({ from, to } = defaultRange());
  }

  const scope = buildChatSessionScopeFilter(organizationId);
  const endedAtFilter = buildEndedAtFilter(from, to);
  const closedInRangeFilter = {
    ...scope,
    status: 'closed',
    ...(Object.keys(endedAtFilter).length ? { endedAt: endedAtFilter } : {}),
  };

  const [
    activeNow,
    waitingNow,
    assignedNow,
    closedInRange,
    outcomeRows,
    queueRows,
    onlineAgents,
    closedSessions,
  ] = await Promise.all([
    ChatSession.countDocuments({ ...scope, status: 'open' }),
    ChatSession.countDocuments({ ...scope, status: 'open', lifecycleStatus: 'waiting' }),
    ChatSession.countDocuments({
      ...scope,
      status: 'open',
      assignedAgentId: { $ne: null },
    }),
    ChatSession.countDocuments(closedInRangeFilter),
    ChatSession.aggregate([
      { $match: closedInRangeFilter },
      { $group: { _id: '$outcome', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ChatSession.aggregate([
      {
        $match: {
          ...scope,
          status: 'open',
          lifecycleStatus: { $in: ['waiting', 'assigned'] },
        },
      },
      { $group: { _id: '$queueId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    LiveChatAgentPresence.countDocuments({
      organizationId,
      status: { $in: ['online', 'busy'] },
    }),
    ChatSession.find(closedInRangeFilter)
      .select('outcome linkedRecords createdAt endedAt assignedAgentId csatScore ratedByVisitor transferCount')
      .lean(),
  ]);

  const queueNameMap = await loadQueueNameMap(
    organizationId,
    queueRows.map((row) => row._id),
  );

  const outcomes = outcomeRows.map((row) => ({
    outcome: row._id || 'unknown',
    count: row.count,
  }));

  const missedCount = outcomes.find((row) => row.outcome === 'missed')?.count || 0;
  const escalatedCount = outcomes.find((row) => row.outcome === 'escalated')?.count || 0;
  const abandonedCount = outcomes.find((row) => row.outcome === 'abandoned')?.count || 0;

  const handleTimes = closedSessions
    .map((session) => durationSeconds(session.createdAt, session.endedAt))
    .filter((v) => v != null);

  const business = countLinkedRecords(closedSessions);
  const csat = summarizeCsat(closedSessions);
  const transfers = summarizeTransfers(closedSessions);
  const agentsWithClosedSessions = new Set(
    closedSessions
      .map((session) => session?.assignedAgentId)
      .filter(Boolean)
      .map(String),
  ).size;

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    operational: {
      activeNow,
      waitingNow,
      assignedNow,
      onlineAgents,
      closedInRange,
      missedCount,
      avgHandleTimeSeconds: averageSeconds(handleTimes),
      agentsWithClosedSessions,
      avgSessionsPerAgent: agentsWithClosedSessions > 0
        ? averageNumber([closedSessions.length / agentsWithClosedSessions], { decimals: 1 })
        : null,
    },
    quality: {
      escalatedCount,
      abandonedCount,
      outcomes,
      csat,
      transfers,
    },
    queueLoad: queueRows.map((row) => ({
      queueId: row._id ? String(row._id) : null,
      queueName: row._id ? queueNameMap.get(String(row._id)) || 'Unknown queue' : 'Unqueued',
      waitingCount: row.count,
    })),
    business,
  };
}

async function getAgentMetrics(organizationId, { from: fromRaw, to: toRaw } = {}) {
  let from = null;
  let to = null;
  if (fromRaw || toRaw) {
    ({ from, to } = parseDateRange(fromRaw, toRaw));
  } else {
    ({ from, to } = defaultRange());
  }

  const scope = buildChatSessionScopeFilter(organizationId);
  const endedAtFilter = buildEndedAtFilter(from, to);
  const closedInRangeFilter = {
    ...scope,
    status: 'closed',
    assignedAgentId: { $ne: null },
    ...(Object.keys(endedAtFilter).length ? { endedAt: endedAtFilter } : {}),
  };

  const sessions = await ChatSession.find(closedInRangeFilter)
    .select('_id assignedAgentId createdAt endedAt transferCount')
    .lean();

  const sessionIds = sessions.map((row) => row._id);
  const frtMap = await computeFirstResponseTimes(sessionIds);

  const byAgent = new Map();
  for (const session of sessions) {
    const agentId = String(session.assignedAgentId);
    if (!byAgent.has(agentId)) {
      byAgent.set(agentId, {
        agentId,
        sessionsHandled: 0,
        frtSeconds: [],
        ahtSeconds: [],
        sessionsWithTransfers: 0,
        totalTransfers: 0,
      });
    }
    const bucket = byAgent.get(agentId);
    bucket.sessionsHandled += 1;
    const transferCount = Number(session.transferCount) || 0;
    if (transferCount > 0) {
      bucket.sessionsWithTransfers += 1;
      bucket.totalTransfers += transferCount;
    }
    const frt = frtMap.get(String(session._id));
    if (frt != null) bucket.frtSeconds.push(frt);
    const aht = durationSeconds(session.createdAt, session.endedAt);
    if (aht != null) bucket.ahtSeconds.push(aht);
  }

  const userNameMap = await loadUserNameMap([...byAgent.keys()]);
  const agents = [...byAgent.values()]
    .map((row) => ({
      agentId: row.agentId,
      agentName: userNameMap.get(row.agentId) || row.agentId,
      sessionsHandled: row.sessionsHandled,
      avgFirstResponseSeconds: averageSeconds(row.frtSeconds),
      avgHandleTimeSeconds: averageSeconds(row.ahtSeconds),
      sessionsWithTransfers: row.sessionsWithTransfers,
      totalTransfers: row.totalTransfers,
    }))
    .sort((a, b) => b.sessionsHandled - a.sessionsHandled);

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    agents,
  };
}

module.exports = {
  getReportOverview,
  getAgentMetrics,
  parseDateRange,
};
