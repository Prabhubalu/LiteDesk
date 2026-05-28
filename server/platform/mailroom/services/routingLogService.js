'use strict';

const MailroomRoutingLog = require('../../../models/MailroomRoutingLog');

async function recordRoutingOutcome({
  organizationId,
  rawPayloadId = null,
  messageId = null,
  conversationId = null,
  caseId = null,
  channel = '',
  connectorType = '',
  caseResult = null,
  durationMs = 0,
  metadata = {}
}) {
  if (!organizationId || !caseResult) return null;

  return MailroomRoutingLog.create({
    organizationId,
    rawPayloadId,
    messageId,
    conversationId,
    caseId: caseResult.caseId || caseId || null,
    channel,
    connectorType,
    adapterAction: caseResult.action || '',
    adapterReason: caseResult.reason || '',
    executed: caseResult.executed === true,
    durationMs: Number(durationMs) || 0,
    planTrace: Array.isArray(caseResult.plan?.trace) ? caseResult.plan.trace.slice(0, 50) : [],
    metadata
  });
}

async function listRoutingLogs(organizationId, { limit = 25, caseId = null } = {}) {
  const query = { organizationId };
  if (caseId) query.caseId = caseId;

  return MailroomRoutingLog.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 25, 1), 100))
    .lean();
}

module.exports = {
  recordRoutingOutcome,
  listRoutingLogs
};
