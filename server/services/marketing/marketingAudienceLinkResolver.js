'use strict';

const mongoose = require('mongoose');
const RelationshipInstance = require('../../models/RelationshipInstance');
const { getModelForModuleKey } = require('../../utils/assignmentRecordLoader');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { getRelationshipEdgeMetadata } = require('./marketingAudienceMetadataService');
const { ID_BATCH_SIZE } = require('./marketingAudienceConstants');
const {
  inferForwardForeignKeyField,
  inferForeignKeyFromChildToParent
} = require('./marketingAudienceForeignKeys');

function toObjectId(value) {
  if (value == null) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(String(value));
  return null;
}

function toObjectIdSet(values) {
  const set = new Set();
  for (const value of values || []) {
    const id = toObjectId(value);
    if (id) set.add(String(id));
  }
  return set;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildModuleBaseQuery(organizationId, moduleKey) {
  const normMod = String(moduleKey || '').toLowerCase();
  const query = {};
  if (normMod === 'organizations' || normMod === 'organization') {
    query.isTenant = false;
    return query;
  }
  query.organizationId = toObjectId(organizationId);
  const Model = getModelForModuleKey(normMod);
  if (Model?.schema?.paths?.deletedAt) {
    query.deletedAt = null;
  }
  return query;
}

async function queryRelationshipInstances(organizationId, relationshipKey, sourceModuleKey, sourceIds) {
  const orgId = toObjectId(organizationId);
  const ids = [...toObjectIdSet(sourceIds)].map((id) => toObjectId(id));
  if (ids.length === 0) return [];

  const results = new Set();
  for (const batch of chunkArray(ids, ID_BATCH_SIZE)) {
    const rows = await RelationshipInstance.find({
      organizationId: orgId,
      relationshipKey: String(relationshipKey || '').toLowerCase(),
      'source.moduleKey': String(sourceModuleKey || '').toLowerCase(),
      'source.recordId': { $in: batch }
    })
      .select('target.recordId')
      .lean();

    for (const row of rows) {
      if (row?.target?.recordId) results.add(String(row.target.recordId));
    }
  }
  return [...results];
}

async function queryReverseRelationshipInstances(
  organizationId,
  relationshipKey,
  targetModuleKey,
  targetIds
) {
  const orgId = toObjectId(organizationId);
  const ids = [...toObjectIdSet(targetIds)].map((id) => toObjectId(id));
  if (ids.length === 0) return [];

  const results = new Set();
  for (const batch of chunkArray(ids, ID_BATCH_SIZE)) {
    const rows = await RelationshipInstance.find({
      organizationId: orgId,
      relationshipKey: String(relationshipKey || '').toLowerCase(),
      'target.moduleKey': String(targetModuleKey || '').toLowerCase(),
      'target.recordId': { $in: batch }
    })
      .select('source.recordId')
      .lean();

    for (const row of rows) {
      if (row?.source?.recordId) results.add(String(row.source.recordId));
    }
  }
  return [...results];
}

async function readForeignKeyValues(Model, recordIds, fieldName) {
  const ids = [...toObjectIdSet(recordIds)].map((id) => toObjectId(id));
  if (!Model || ids.length === 0 || !fieldName) return [];

  const values = new Set();
  for (const batch of chunkArray(ids, ID_BATCH_SIZE)) {
    const rows = await Model.find({ _id: { $in: batch } })
      .select(fieldName)
      .lean();
    for (const row of rows) {
      const val = row?.[fieldName];
      if (val) values.add(String(val));
    }
  }
  return [...values];
}

async function readParentIdsFromChildRecords(childModuleKey, childRecordIds, parentModuleKey, edge = null) {
  const fkField = inferForeignKeyFromChildToParent(childModuleKey, parentModuleKey, edge);
  if (!fkField) return [];

  const Model = getModelForModuleKey(childModuleKey);
  return readForeignKeyValues(Model, childRecordIds, fkField);
}

async function queryReverseForeignKey(organizationId, moduleKey, foreignKeyField, parentIds) {
  const Model = getModelForModuleKey(moduleKey);
  if (!Model || !foreignKeyField) return [];

  const base = buildModuleBaseQuery(organizationId, moduleKey);
  const parentObjectIds = [...toObjectIdSet(parentIds)].map((id) => toObjectId(id));
  if (parentObjectIds.length === 0) return [];

  const results = new Set();
  for (const batch of chunkArray(parentObjectIds, ID_BATCH_SIZE)) {
    const rows = await Model.find({
      ...base,
      [foreignKeyField]: { $in: batch }
    })
      .select('_id')
      .lean();
    for (const row of rows) {
      if (row?._id) results.add(String(row._id));
    }
  }
  return [...results];
}

async function queryDealContactPeopleFromDealIds(organizationId, dealIds) {
  const orgId = toObjectId(organizationId);
  const ids = [...toObjectIdSet(dealIds)].map((id) => toObjectId(id));
  if (ids.length === 0) return [];

  const peopleIds = new Set();
  for (const batch of chunkArray(ids, ID_BATCH_SIZE)) {
    const rows = await RelationshipInstance.find({
      organizationId: orgId,
      relationshipKey: 'deal_contacts',
      'source.moduleKey': 'deals',
      'source.recordId': { $in: batch },
      'target.moduleKey': 'people'
    })
      .select('target.recordId')
      .lean();

    for (const row of rows) {
      if (row?.target?.recordId) peopleIds.add(String(row.target.recordId));
    }
  }
  return [...peopleIds];
}

async function readPeopleIdsFromDealRecords(organizationId, dealIds) {
  const peopleIds = new Set();

  for (const id of await readParentIdsFromChildRecords('deals', dealIds, 'people')) {
    peopleIds.add(id);
  }

  const Deal = getModelForModuleKey('deals');
  const ids = [...toObjectIdSet(dealIds)].map((id) => toObjectId(id));
  if (Deal && ids.length > 0) {
    for (const batch of chunkArray(ids, ID_BATCH_SIZE)) {
      const rows = await Deal.find({ _id: { $in: batch } })
        .select('contactId dealPeople.personId dealPeople.isActive')
        .lean();
      for (const row of rows) {
        if (row?.contactId) peopleIds.add(String(row.contactId));
        for (const entry of row?.dealPeople || []) {
          if (entry?.isActive === false) continue;
          if (entry?.personId) peopleIds.add(String(entry.personId));
        }
      }
    }
  }

  for (const id of await queryReverseRelationshipInstances(
    organizationId,
    'people_deals',
    'deals',
    dealIds
  )) {
    peopleIds.add(id);
  }

  for (const id of await queryDealContactPeopleFromDealIds(organizationId, dealIds)) {
    peopleIds.add(id);
  }

  return [...peopleIds];
}

async function queryDealIdsFromPeopleRecords(organizationId, peopleIds) {
  const dealIds = new Set();
  const peopleSet = [...toObjectIdSet(peopleIds)];
  if (peopleSet.length === 0) return [];

  for (const id of await queryReverseForeignKey(organizationId, 'deals', 'contactId', peopleSet)) {
    dealIds.add(id);
  }

  for (const id of await queryRelationshipInstances(
    organizationId,
    'people_deals',
    'people',
    peopleSet
  )) {
    dealIds.add(id);
  }

  const Deal = getModelForModuleKey('deals');
  const base = buildModuleBaseQuery(organizationId, 'deals');
  const objectIds = peopleSet.map((id) => toObjectId(id));
  if (Deal) {
    for (const batch of chunkArray(objectIds, ID_BATCH_SIZE)) {
      const rows = await Deal.find({
        ...base,
        $or: [
          { contactId: { $in: batch } },
          {
            dealPeople: {
              $elemMatch: {
                personId: { $in: batch },
                isActive: { $ne: false }
              }
            }
          }
        ]
      })
        .select('_id')
        .lean();
      for (const row of rows) {
        if (row?._id) dealIds.add(String(row._id));
      }
    }
  }

  const orgId = toObjectId(organizationId);
  for (const batch of chunkArray(objectIds, ID_BATCH_SIZE)) {
    const rows = await RelationshipInstance.find({
      organizationId: orgId,
      relationshipKey: 'deal_contacts',
      'source.moduleKey': 'deals',
      'target.moduleKey': 'people',
      'target.recordId': { $in: batch }
    })
      .select('source.recordId')
      .lean();
    for (const row of rows) {
      if (row?.source?.recordId) dealIds.add(String(row.source.recordId));
    }
  }

  return [...dealIds];
}

/**
 * Traverse one relationship hop from a set of source record IDs.
 * @returns {Promise<string[]>} target record IDs
 */
async function traverseRelationshipHop(organizationId, fromModuleKey, relationshipKey, sourceIds) {
  const edge = await getRelationshipEdgeMetadata(organizationId, fromModuleKey, relationshipKey);
  if (!edge) return [];

  const sourceSet = toObjectIdSet(sourceIds);
  if (sourceSet.size === 0) return [];

  const targetIds = new Set();

  if (edge.toModuleKey === 'deals' && fromModuleKey === 'people') {
    const dealIds = await queryDealIdsFromPeopleRecords(organizationId, [...sourceSet]);
    return dealIds;
  }

  if (edge.direction === 'forward') {
    const forwardField = inferForwardForeignKeyField(edge);
    if (forwardField) {
      const Model = getModelForModuleKey(fromModuleKey);
      const fkValues = await readForeignKeyValues(Model, [...sourceSet], forwardField);
      for (const id of fkValues) targetIds.add(id);
    }

    const instanceTargets = await queryRelationshipInstances(
      organizationId,
      relationshipKey,
      fromModuleKey,
      [...sourceSet]
    );
    for (const id of instanceTargets) targetIds.add(id);

    const targetToSourceFk = inferForeignKeyFromChildToParent(edge.toModuleKey, fromModuleKey, edge);
    if (targetToSourceFk) {
      const fkLinked = await queryReverseForeignKey(
        organizationId,
        edge.toModuleKey,
        targetToSourceFk,
        [...sourceSet]
      );
      for (const id of fkLinked) targetIds.add(id);
    }

    return [...targetIds];
  }

  const childModule = edge.reverseSourceModuleKey || edge.toModuleKey;
  const reverseField = inferForeignKeyFromChildToParent(childModule, fromModuleKey, edge);
  if (reverseField) {
    const reverseIds = await queryReverseForeignKey(
      organizationId,
      childModule,
      reverseField,
      [...sourceSet]
    );
    for (const id of reverseIds) targetIds.add(id);
  }

  const reverseInstanceSources = await queryReverseRelationshipInstances(
    organizationId,
    relationshipKey,
    fromModuleKey,
    [...sourceSet]
  );
  for (const id of reverseInstanceSources) targetIds.add(id);

  return [...targetIds];
}

/**
 * Walk a full relationship path from source IDs.
 */
async function traverseRelationshipPath(organizationId, startModuleKey, relationshipPath, startIds) {
  let currentModule = String(startModuleKey || '').toLowerCase();
  let currentIds = [...toObjectIdSet(startIds)];

  for (const relationshipKey of relationshipPath || []) {
    if (currentIds.length === 0) return { moduleKey: currentModule, recordIds: [] };
    const nextIds = await traverseRelationshipHop(
      organizationId,
      currentModule,
      relationshipKey,
      currentIds
    );
    const edge = await getRelationshipEdgeMetadata(organizationId, currentModule, relationshipKey);
    currentModule = edge?.toModuleKey || currentModule;
    currentIds = nextIds;
  }

  return { moduleKey: currentModule, recordIds: currentIds };
}

/**
 * Map each primary record ID to target record IDs after traversing relationshipPath.
 * @returns {Promise<{ targetModuleKey: string, primaryToTargetIds: Map<string, string[]> }>}
 */
async function expandPrimaryToTargetIds(
  organizationId,
  primaryModuleKey,
  relationshipPath,
  primaryIds
) {
  const primaryToCurrent = new Map();
  for (const id of primaryIds || []) {
    primaryToCurrent.set(String(id), [String(id)]);
  }

  let currentModule = String(primaryModuleKey || '').toLowerCase();

  for (const relationshipKey of relationshipPath || []) {
    const nextMap = new Map();
    for (const [primaryId, sourceIds] of primaryToCurrent) {
      if (!sourceIds.length) {
        nextMap.set(primaryId, []);
        continue;
      }
      const targetIds = await traverseRelationshipHop(
        organizationId,
        currentModule,
        relationshipKey,
        sourceIds
      );
      nextMap.set(primaryId, targetIds.map(String));
    }

    const edge = await getRelationshipEdgeMetadata(organizationId, currentModule, relationshipKey);
    currentModule = edge?.toModuleKey || currentModule;
    primaryToCurrent.clear();
    for (const [key, value] of nextMap) {
      primaryToCurrent.set(key, value);
    }
  }

  return { targetModuleKey: currentModule, primaryToTargetIds: primaryToCurrent };
}

async function buildModuleChain(organizationId, primaryModuleKey, relationshipPath) {
  const chain = [String(primaryModuleKey || '').toLowerCase()];
  let current = chain[0];

  for (const relationshipKey of relationshipPath || []) {
    const edge = await getRelationshipEdgeMetadata(organizationId, current, relationshipKey);
    if (!edge) return null;
    chain.push(edge.toModuleKey);
    current = edge.toModuleKey;
  }

  return chain;
}

/**
 * Map record IDs on toModule back one hop to fromModule using relationshipKey.
 */
async function mapBackwardOneHop(
  organizationId,
  relationshipKey,
  fromModuleKey,
  toModuleKey,
  toRecordIds
) {
  const edge = await getRelationshipEdgeMetadata(organizationId, fromModuleKey, relationshipKey);
  if (!edge || edge.toModuleKey !== String(toModuleKey || '').toLowerCase()) return [];

  const matches = new Set();
  const toIds = [...toObjectIdSet(toRecordIds)];
  if (toIds.length === 0) return [];

  if (toModuleKey === 'deals' && fromModuleKey === 'people') {
    return readPeopleIdsFromDealRecords(organizationId, toIds);
  }

  if (edge.direction === 'forward') {
    const forwardField = inferForwardForeignKeyField(edge);
    if (forwardField) {
      const Model = getModelForModuleKey(fromModuleKey);
      const base = buildModuleBaseQuery(organizationId, fromModuleKey);
      for (const batch of chunkArray(toIds.map(toObjectId), ID_BATCH_SIZE)) {
        const rows = await Model.find({ ...base, [forwardField]: { $in: batch } })
          .select('_id')
          .lean();
        for (const row of rows) {
          if (row?._id) matches.add(String(row._id));
        }
      }
    }

    const reverseSources = await queryReverseRelationshipInstances(
      organizationId,
      relationshipKey,
      toModuleKey,
      toIds
    );
    for (const id of reverseSources) matches.add(id);

    const targetToSourceFk = inferForeignKeyFromChildToParent(toModuleKey, fromModuleKey, edge);
    if (targetToSourceFk) {
      const parentIds = await readParentIdsFromChildRecords(
        toModuleKey,
        toIds,
        fromModuleKey,
        edge
      );
      for (const id of parentIds) matches.add(id);
    }

    return [...matches];
  }

  const childModule = edge.reverseSourceModuleKey || toModuleKey;
  const reverseField = inferForeignKeyFromChildToParent(childModule, fromModuleKey, edge);
  if (reverseField) {
    const parentIds = await readParentIdsFromChildRecords(childModule, toIds, fromModuleKey, edge);
    for (const id of parentIds) matches.add(id);
  }

  const reverseSources = await queryReverseRelationshipInstances(
    organizationId,
    relationshipKey,
    fromModuleKey,
    toIds
  );
  for (const id of reverseSources) matches.add(id);

  return [...matches];
}

/**
 * From matching target-module IDs, map backward along relationshipPath to primary-module IDs.
 */
async function mapTargetIdsToPrimary(organizationId, primaryModuleKey, relationshipPath, targetRecordIds) {
  const chain = await buildModuleChain(organizationId, primaryModuleKey, relationshipPath);
  if (!chain) return [];

  let currentIds = [...toObjectIdSet(targetRecordIds)];
  for (let i = relationshipPath.length; i >= 1; i -= 1) {
    const fromModule = chain[i - 1];
    const toModule = chain[i];
    const relKey = relationshipPath[i - 1];
    currentIds = await mapBackwardOneHop(
      organizationId,
      relKey,
      fromModule,
      toModule,
      currentIds
    );
    if (currentIds.length === 0) return [];
  }

  return currentIds;
}

module.exports = {
  traverseRelationshipHop,
  traverseRelationshipPath,
  expandPrimaryToTargetIds,
  buildModuleChain,
  mapBackwardOneHop,
  mapTargetIdsToPrimary,
  queryReverseForeignKey,
  readParentIdsFromChildRecords,
  readPeopleIdsFromDealRecords,
  queryDealIdsFromPeopleRecords,
  buildModuleBaseQuery,
  toObjectId,
  toObjectIdSet
};
