'use strict';

const ConnectorConflict = require('../../models/ConnectorConflict');
const { CONFLICT_STATUSES, CONFLICT_RESOLUTIONS } = require('./connectorConstants');

async function createConflict({
  organizationId,
  connectorKey,
  entityType,
  arivuId = null,
  externalId = null,
  companyGuid = null,
  reason = null,
  leftSnapshot = null,
  rightSnapshot = null,
  metadata = {},
}) {
  if (!organizationId || !connectorKey || !entityType) {
    throw new Error('createConflict requires organizationId, connectorKey, entityType');
  }

  return ConnectorConflict.create({
    organizationId,
    connectorKey: String(connectorKey).toLowerCase(),
    entityType: String(entityType),
    companyGuid,
    arivuId: arivuId != null ? String(arivuId) : null,
    externalId: externalId != null ? String(externalId) : null,
    status: CONFLICT_STATUSES.OPEN,
    reason,
    leftSnapshot,
    rightSnapshot,
    metadata,
  });
}

async function resolveConflict(conflictId, {
  resolution,
  resolvedBy = null,
  status = null,
} = {}) {
  if (!conflictId) throw new Error('resolveConflict requires conflictId');
  if (!resolution || !Object.values(CONFLICT_RESOLUTIONS).includes(resolution)) {
    throw new Error(`Invalid resolution: ${resolution}`);
  }

  const nextStatus = status
    || (resolution === CONFLICT_RESOLUTIONS.IGNORE
      ? CONFLICT_STATUSES.IGNORED
      : CONFLICT_STATUSES.RESOLVED);

  return ConnectorConflict.findByIdAndUpdate(
    conflictId,
    {
      $set: {
        resolution,
        status: nextStatus,
        resolvedBy,
        resolvedAt: new Date(),
      },
    },
    { new: true }
  );
}

module.exports = {
  createConflict,
  resolveConflict,
};
