'use strict';

const ConnectorOutbox = require('../../models/ConnectorOutbox');
const { OUTBOX_STATUSES } = require('./connectorConstants');

async function enqueueOutbox({
  organizationId,
  connectorKey,
  entityType,
  arivuId,
  operation,
  payload = {},
  companyGuid = null,
  idempotencyKey = null,
  metadata = {},
}) {
  if (!organizationId || !connectorKey || !entityType || !arivuId || !operation) {
    throw new Error('enqueueOutbox requires organizationId, connectorKey, entityType, arivuId, operation');
  }

  if (idempotencyKey) {
    const existing = await ConnectorOutbox.findOne({
      organizationId,
      connectorKey: String(connectorKey).toLowerCase(),
      idempotencyKey: String(idempotencyKey),
    });
    if (existing) return existing;
  }

  return ConnectorOutbox.create({
    organizationId,
    connectorKey: String(connectorKey).toLowerCase(),
    entityType: String(entityType),
    arivuId: String(arivuId),
    companyGuid: companyGuid || null,
    operation,
    payload,
    status: OUTBOX_STATUSES.PENDING,
    idempotencyKey: idempotencyKey || null,
    metadata,
  });
}

async function markProcessed(outboxId, { error = null } = {}) {
  const setFields = error
    ? {
      status: OUTBOX_STATUSES.FAILED,
      lastError: String(error),
    }
    : {
      status: OUTBOX_STATUSES.PROCESSED,
      processedAt: new Date(),
      lastError: null,
    };

  return ConnectorOutbox.findByIdAndUpdate(
    outboxId,
    { $set: setFields, $inc: { attempts: 1 } },
    { new: true }
  );
}

module.exports = {
  enqueueOutbox,
  markProcessed,
};
