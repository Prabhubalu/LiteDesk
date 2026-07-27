'use strict';

const TallySyncRunLog = require('../../../models/TallySyncRunLog');

async function startRunLog({
  organizationId,
  companyGuid = null,
  companyName = null,
  moduleKey = null,
  tallyModuleKey = null,
  tallyModuleName = null,
  arivuModuleName = null,
  jobId = null,
  metadata = {},
} = {}) {
  return TallySyncRunLog.create({
    organizationId,
    companyGuid,
    companyName,
    moduleKey,
    tallyModuleKey,
    tallyModuleName,
    arivuModuleName,
    jobId,
    status: 'running',
    startedAt: new Date(),
    arivu: { created: 0, updated: 0, skipped: 0 },
    tally: { created: 0, updated: 0, skipped: 0 },
    records: [],
    metadata,
  });
}

function bump(counts, action) {
  const next = { created: 0, updated: 0, skipped: 0, ...(counts || {}) };
  if (action === 'created') next.created += 1;
  else if (action === 'updated') next.updated += 1;
  else if (action === 'skipped') next.skipped += 1;
  return next;
}

async function appendRecord(logId, record) {
  if (!logId || !record) return null;
  const side = record.side === 'tally' ? 'tally' : 'arivu';
  const action = ['created', 'updated', 'skipped'].includes(record.action)
    ? record.action
    : 'skipped';
  return TallySyncRunLog.findByIdAndUpdate(
    logId,
    {
      $push: {
        records: {
          side,
          action,
          moduleKey: record.moduleKey || null,
          tallyModuleKey: record.tallyModuleKey || null,
          recordId: record.recordId ? String(record.recordId) : null,
          recordName: record.recordName || null,
          externalId: record.externalId || null,
          reason: record.reason || null,
          routeHint: record.routeHint || null,
        },
      },
      $inc: {
        [`${side}.${action}`]: 1,
      },
    },
    { new: true }
  );
}

async function finishRunLog(logId, { status = 'completed', error = null } = {}) {
  if (!logId) return null;
  return TallySyncRunLog.findByIdAndUpdate(
    logId,
    {
      $set: {
        status,
        error: error || null,
        finishedAt: new Date(),
      },
    },
    { new: true }
  ).lean();
}

async function listRunLogs({
  organizationId,
  companyGuid = null,
  moduleKey = null,
  limit = 50,
  skip = 0,
} = {}) {
  const filter = { organizationId };
  if (companyGuid) filter.companyGuid = companyGuid;
  if (moduleKey) filter.tallyModuleKey = moduleKey;
  const [rows, total] = await Promise.all([
    TallySyncRunLog.find(filter)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(Math.min(Math.max(limit, 1), 200))
      .lean(),
    TallySyncRunLog.countDocuments(filter),
  ]);
  return { rows, total };
}

async function getRunLogRecords({
  organizationId,
  logId,
  action = null,
  side = null,
} = {}) {
  const log = await TallySyncRunLog.findOne({ _id: logId, organizationId }).lean();
  if (!log) {
    const err = new Error('Sync log not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  let records = log.records || [];
  if (action) records = records.filter((r) => r.action === action);
  if (side) records = records.filter((r) => r.side === side);
  return { log, records };
}

function recordsToCsv(records = []) {
  const header = [
    'side',
    'action',
    'moduleKey',
    'tallyModuleKey',
    'recordId',
    'recordName',
    'externalId',
    'reason',
  ];
  const lines = [header.join(',')];
  for (const r of records) {
    lines.push(
      header
        .map((k) => {
          const v = String(r[k] ?? '').replace(/"/g, '""');
          return `"${v}"`;
        })
        .join(',')
    );
  }
  return lines.join('\n');
}

module.exports = {
  startRunLog,
  appendRecord,
  finishRunLog,
  listRunLogs,
  getRunLogRecords,
  recordsToCsv,
  bump,
};
