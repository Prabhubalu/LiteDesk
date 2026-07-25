'use strict';

const ConnectorExternalObject = require('../../models/ConnectorExternalObject');

async function upsertLink({
  organizationId,
  connectorKey,
  entityType,
  externalId,
  arivuId,
  arivuModule = null,
  companyGuid = null,
  lastDirection = null,
  payloadHash = null,
  metadata = {},
}) {
  if (!organizationId || !connectorKey || !entityType || !externalId || !arivuId) {
    throw new Error('upsertLink requires organizationId, connectorKey, entityType, externalId, arivuId');
  }

  const key = String(connectorKey).toLowerCase();
  return ConnectorExternalObject.findOneAndUpdate(
    {
      organizationId,
      connectorKey: key,
      entityType: String(entityType),
      externalId: String(externalId),
    },
    {
      $set: {
        arivuId: String(arivuId),
        arivuModule,
        companyGuid,
        lastDirection,
        payloadHash,
        metadata,
        lastSyncedAt: new Date(),
      },
      $setOnInsert: {
        organizationId,
        connectorKey: key,
        entityType: String(entityType),
        externalId: String(externalId),
      },
    },
    { upsert: true, new: true }
  );
}

async function findByExternal({ organizationId, connectorKey, entityType, externalId }) {
  return ConnectorExternalObject.findOne({
    organizationId,
    connectorKey: String(connectorKey).toLowerCase(),
    entityType: String(entityType),
    externalId: String(externalId),
  });
}

async function findByArivu({ organizationId, connectorKey, entityType, arivuId }) {
  return ConnectorExternalObject.findOne({
    organizationId,
    connectorKey: String(connectorKey).toLowerCase(),
    entityType: String(entityType),
    arivuId: String(arivuId),
  });
}

module.exports = {
  upsertLink,
  findByExternal,
  findByArivu,
};
