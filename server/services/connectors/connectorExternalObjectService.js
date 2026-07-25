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
      companyGuid: companyGuid || null,
    },
    {
      $set: {
        arivuId: String(arivuId),
        arivuModule,
        companyGuid: companyGuid || null,
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
        companyGuid: companyGuid || null,
      },
    },
    { upsert: true, new: true }
  );
}

async function findByExternal({
  organizationId,
  connectorKey,
  entityType,
  externalId,
  companyGuid = undefined,
}) {
  const q = {
    organizationId,
    connectorKey: String(connectorKey).toLowerCase(),
    entityType: String(entityType),
    externalId: String(externalId),
  };
  if (companyGuid !== undefined) q.companyGuid = companyGuid || null;
  return ConnectorExternalObject.findOne(q);
}

async function findByArivu({
  organizationId,
  connectorKey,
  entityType,
  arivuId,
  companyGuid = undefined,
}) {
  const q = {
    organizationId,
    connectorKey: String(connectorKey).toLowerCase(),
    entityType: String(entityType),
    arivuId: String(arivuId),
  };
  if (companyGuid !== undefined) q.companyGuid = companyGuid || null;
  return ConnectorExternalObject.findOne(q);
}

async function findAllByArivu({ organizationId, connectorKey, entityType, arivuId }) {
  return ConnectorExternalObject.find({
    organizationId,
    connectorKey: String(connectorKey).toLowerCase(),
    entityType: String(entityType),
    arivuId: String(arivuId),
    'metadata.ignored': { $ne: true },
  }).lean();
}

module.exports = {
  upsertLink,
  findByExternal,
  findByArivu,
  findAllByArivu,
};
