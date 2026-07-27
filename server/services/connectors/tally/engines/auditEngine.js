'use strict';

/**
 * ATIP Audit Engine — searchable sync/operation audit with correlation IDs.
 */

const crypto = require('crypto');
const ConnectorSyncEvent = require('../../../../models/ConnectorSyncEvent');
const { CONNECTOR_KEYS } = require('../../connectorConstants');

function newCorrelationId() {
  return crypto.randomBytes(12).toString('hex');
}

async function recordEvent({
  organizationId,
  message,
  level = 'info',
  code = null,
  payload = {},
  runId = null,
  jobId = null,
  correlationId = null,
  moduleKey = null,
  recordId = null,
  operation = null,
  beforeValue = null,
  afterValue = null,
  source = null,
  destination = null,
  durationMs = null,
  worker = null,
  problemCode = null,
  causeCode = null,
  resolutionCode = null,
  userId = null,
}) {
  if (!organizationId || !message) throw new Error('organizationId and message required');

  return ConnectorSyncEvent.create({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY || 'tally',
    level,
    code,
    message,
    payload,
    runId,
    jobId,
    correlationId: correlationId || newCorrelationId(),
    moduleKey,
    recordId,
    operation,
    beforeValue,
    afterValue,
    source,
    destination,
    durationMs,
    worker,
    problemCode,
    causeCode,
    resolutionCode,
    userId,
  });
}

async function searchEvents({
  organizationId,
  q = null,
  level = null,
  moduleKey = null,
  correlationId = null,
  code = null,
  from = null,
  to = null,
  limit = 50,
  skip = 0,
}) {
  const filter = {
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY || 'tally',
  };
  if (level) filter.level = level;
  if (moduleKey) filter.moduleKey = moduleKey;
  if (correlationId) filter.correlationId = correlationId;
  if (code) filter.code = code;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (q) {
    filter.$or = [
      { message: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } },
      { problemCode: { $regex: q, $options: 'i' } },
      { recordId: { $regex: q, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    ConnectorSyncEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Math.min(limit, 200)).lean(),
    ConnectorSyncEvent.countDocuments(filter),
  ]);

  return { items, total, limit, skip };
}

module.exports = {
  newCorrelationId,
  recordEvent,
  searchEvents,
};
