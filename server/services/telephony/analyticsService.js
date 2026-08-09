'use strict';

const TelephonyCall = require('../../models/TelephonyCall');
const TelephonyAnalyticsDaily = require('../../models/TelephonyAnalyticsDaily');
const TelephonyAnalyticsHourly = require('../../models/TelephonyAnalyticsHourly');

function dateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

function hourKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 13) + ':00';
}

function computeMetrics(calls) {
  let connected = 0;
  let missed = 0;
  let totalTalk = 0;
  let talkCount = 0;
  let totalWait = 0;
  let waitCount = 0;

  for (const c of calls) {
    if (c.status === 'completed' || c.status === 'in-progress') connected += 1;
    if (c.status === 'missed' || c.status === 'no-answer') missed += 1;
    if (Number.isFinite(c.durationSeconds)) {
      totalTalk += c.durationSeconds;
      talkCount += 1;
    }
    if (c.answeredAt && c.startedAt) {
      totalWait += Math.max(0, (new Date(c.answeredAt) - new Date(c.startedAt)) / 1000);
      waitCount += 1;
    }
  }

  return {
    calls: calls.length,
    connected,
    missed,
    aht: talkCount ? Math.round(totalTalk / talkCount) : 0,
    awt: waitCount ? Math.round(totalWait / waitCount) : 0,
    totalTalkSeconds: totalTalk,
  };
}

async function rollupDaily(organizationId, date = new Date()) {
  const key = dateKey(date);
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(`${key}T23:59:59.999Z`);
  const calls = await TelephonyCall.find({
    organizationId,
    createdAt: { $gte: start, $lte: end },
  }).lean();
  const metrics = computeMetrics(calls);
  await TelephonyAnalyticsDaily.findOneAndUpdate(
    { organizationId, date: key },
    { $set: { metrics } },
    { upsert: true, new: true }
  );
  return { date: key, metrics };
}

async function rollupHourly(organizationId, date = new Date()) {
  const key = hourKey(date);
  const start = new Date(key);
  const end = new Date(start.getTime() + 60 * 60 * 1000 - 1);
  const calls = await TelephonyCall.find({
    organizationId,
    createdAt: { $gte: start, $lte: end },
  }).lean();
  const metrics = computeMetrics(calls);
  await TelephonyAnalyticsHourly.findOneAndUpdate(
    { organizationId, hour: key },
    { $set: { metrics } },
    { upsert: true, new: true }
  );
  return { hour: key, metrics };
}

async function rollupFromJob({ organizationId, bucket = 'daily', at = null } = {}) {
  const when = at ? new Date(at) : new Date();
  if (bucket === 'hourly') return rollupHourly(organizationId, when);
  return rollupDaily(organizationId, when);
}

async function getDashboardMetrics(organizationId, { days = 7 } = {}) {
  const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
  const calls = await TelephonyCall.find({
    organizationId,
    createdAt: { $gte: since },
  }).lean();
  const metrics = computeMetrics(calls);
  const daily = await TelephonyAnalyticsDaily.find({
    organizationId,
    date: { $gte: dateKey(since) },
  })
    .sort({ date: 1 })
    .lean();
  return { metrics, daily };
}

async function getReports(organizationId, { from = null, to = null } = {}) {
  const filter = { organizationId };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const calls = await TelephonyCall.find(filter).lean();
  const byAgent = {};
  for (const c of calls) {
    const key = c.agentUserId ? String(c.agentUserId) : 'unassigned';
    if (!byAgent[key]) byAgent[key] = [];
    byAgent[key].push(c);
  }
  const agentReports = Object.entries(byAgent).map(([agentUserId, rows]) => ({
    agentUserId,
    ...computeMetrics(rows),
  }));
  return {
    overall: computeMetrics(calls),
    agents: agentReports,
  };
}

module.exports = {
  rollupDaily,
  rollupHourly,
  rollupFromJob,
  getDashboardMetrics,
  getReports,
  computeMetrics,
};
