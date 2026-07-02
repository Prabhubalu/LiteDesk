'use strict';

const People = require('../../models/People');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { normalizeEmail } = require('./marketingEmailUtils');
const {
  isLegacyAst,
  normalizeV2Ast,
  getPrimaryEntity,
  detectNodeType
} = require('./marketingAudienceAstUtils');
const {
  compileGroupNode,
  compileLegacyAst,
  queryMatchingRecordIds
} = require('./marketingAudienceFieldCompiler');
const {
  mapTargetIdsToPrimary,
  buildModuleBaseQuery,
  readParentIdsFromChildRecords,
  toObjectId
} = require('./marketingAudienceLinkResolver');
const {
  evaluateNumericAggregateRule,
  NUMERIC_AGGREGATE_FUNCTIONS
} = require('./marketingAudienceAggregateEvaluator');
const { PRIMARY_TO_PEOPLE_RELATIONSHIP_KEYS } = require('./marketingAudienceForeignKeys');
const { RECIPIENT_RESOLVE_MAX, ID_BATCH_SIZE, getRecipientResolveLimit } = require('./marketingAudienceConstants');

function intersectIdSets(sets) {
  if (!sets.length) return [];
  let result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i += 1) {
    const next = new Set(sets[i]);
    result = new Set([...result].filter((id) => next.has(id)));
    if (result.size === 0) break;
  }
  return [...result];
}

function unionIdSets(sets) {
  const result = new Set();
  for (const set of sets) {
    for (const id of set || []) result.add(String(id));
  }
  return [...result];
}

function buildLegacyPeopleQuery(organizationId, filterQuery, context = {}) {
  const base = {
    organizationId: toObjectId(organizationId),
    deletedAt: null,
    email: { $nin: [null, ''], $exists: true }
  };
  const compiled = compileLegacyAst(filterQuery, 'people', context);
  if (!compiled) return base;
  return { ...base, $and: [compiled] };
}

async function evaluateLegacyPeopleIds(organizationId, filterQuery, context = {}) {
  const query = buildLegacyPeopleQuery(organizationId, filterQuery, context);
  const limit = getRecipientResolveLimit(context);
  let cursor = People.find(query).select('_id');
  if (limit) cursor = cursor.limit(limit);
  const rows = await runWithOrganizationTenantContext(organizationId, async () => cursor.lean());
  return rows.map((row) => String(row._id));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function queryAllPrimaryIds(organizationId, primaryModuleKey, context = {}) {
  const base = buildModuleBaseQuery(organizationId, primaryModuleKey);
  return queryMatchingRecordIds(
    organizationId,
    primaryModuleKey,
    base,
    getRecipientResolveLimit(context)
  );
}

async function evaluateFieldRuleOnModule(organizationId, moduleKey, rule, context) {
  const normalizedRule =
    rule?.type === 'field' ? rule : { type: 'field', fieldKey: rule.fieldKey, operator: rule.operator, value: rule.value };
  const clause = compileGroupNode({ logic: 'AND', children: [normalizedRule] }, moduleKey, context);
  if (!clause) return [];
  return queryMatchingRecordIds(
    organizationId,
    moduleKey,
    clause,
    getRecipientResolveLimit(context)
  );
}

async function evaluateRelationshipRule(organizationId, primaryModuleKey, node, context) {
  const relationshipPath = Array.isArray(node.relationshipPath) ? node.relationshipPath : [];
  const targetModuleKey = String(node.targetModuleKey || '').toLowerCase();
  if (!relationshipPath.length || !targetModuleKey) return [];

  const conditionRoot = {
    logic: node.logic || 'AND',
    type: 'group',
    children: node.children || []
  };
  const clause = compileGroupNode(conditionRoot, targetModuleKey, context);

  const targetIds = await queryMatchingRecordIds(
    organizationId,
    targetModuleKey,
    clause || null,
    getRecipientResolveLimit(context)
  );
  if (targetIds.length === 0) return [];

  return mapTargetIdsToPrimary(organizationId, primaryModuleKey, relationshipPath, targetIds);
}

async function evaluateAggregateRule(organizationId, primaryModuleKey, node, context) {
  const fn = String(node.function || 'exists').toLowerCase();
  const relationshipPath = Array.isArray(node.relationshipPath) ? node.relationshipPath : [];
  const targetModuleKey = String(node.targetModuleKey || '').toLowerCase();

  const positiveMatch = await evaluateRelationshipRule(
    organizationId,
    primaryModuleKey,
    {
      type: 'relationship',
      relationshipPath,
      targetModuleKey,
      logic: node.filter?.logic || 'AND',
      children: node.filter?.children || []
    },
    context
  );

  if (fn === 'exists') return positiveMatch;
  if (fn === 'not_exists') {
    const allPrimary = await queryAllPrimaryIds(organizationId, primaryModuleKey, context);
    const blocked = new Set(positiveMatch);
    return allPrimary.filter((id) => !blocked.has(String(id)));
  }

  if (NUMERIC_AGGREGATE_FUNCTIONS.has(fn)) {
    const allPrimary = await queryAllPrimaryIds(organizationId, primaryModuleKey, context);
    return evaluateNumericAggregateRule(
      organizationId,
      primaryModuleKey,
      node,
      allPrimary,
      context
    );
  }

  return positiveMatch;
}

async function evaluateNode(organizationId, primaryModuleKey, node, context) {
  const nodeType = detectNodeType(node);

  if (nodeType === 'field') {
    const moduleKey = String(node.moduleKey || primaryModuleKey).toLowerCase();
    if (moduleKey !== primaryModuleKey) return [];
    return evaluateFieldRuleOnModule(organizationId, primaryModuleKey, node, context);
  }

  if (nodeType === 'relationship') {
    return evaluateRelationshipRule(organizationId, primaryModuleKey, node, context);
  }

  if (nodeType === 'aggregate') {
    return evaluateAggregateRule(organizationId, primaryModuleKey, node, context);
  }

  if (nodeType === 'group' || Array.isArray(node.children)) {
    const logic = String(node.logic || 'AND').toUpperCase();
    const childSets = [];
    for (const child of node.children || []) {
      const ids = await evaluateNode(organizationId, primaryModuleKey, child, context);
      childSets.push(ids);
      if (logic === 'AND' && ids.length === 0) return [];
    }
    return logic === 'OR' ? unionIdSets(childSets) : intersectIdSets(childSets);
  }

  return [];
}

async function resolvePrimaryEntityIds(organizationId, filterQuery, context = {}) {
  return runWithOrganizationTenantContext(organizationId, async () => {
    if (isLegacyAst(filterQuery)) {
      return evaluateLegacyPeopleIds(organizationId, filterQuery, context);
    }

    const ast = normalizeV2Ast(filterQuery);
    if (!ast?.children?.length) return [];

    const primary = getPrimaryEntity(ast);
    const primaryModuleKey = primary.moduleKey;

    const ids = await evaluateNode(
      organizationId,
      primaryModuleKey,
      { logic: ast.logic, type: 'group', children: ast.children },
      context
    );

    if (primaryModuleKey === 'people') {
      return [...new Set(ids.map(String))];
    }

    return resolvePrimaryToPeople(organizationId, primaryModuleKey, ids, context);
  });
}

async function resolvePrimaryToPeople(organizationId, primaryModuleKey, primaryIds, context = {}) {
  const moduleKey = String(primaryModuleKey || '').toLowerCase();
  const uniqueIds = [...new Set(primaryIds.map(String))];
  if (uniqueIds.length === 0) return [];

  const resolveLimit = getRecipientResolveLimit(context);

  if (moduleKey === 'people') return uniqueIds;

  if (moduleKey === 'organizations') {
    const peopleFromFk = await queryMatchingRecordIds(
      organizationId,
      'people',
      { organization: { $in: uniqueIds.map(toObjectId) } },
      resolveLimit
    );
    const fromRel = await mapTargetIdsToPrimary(
      organizationId,
      'people',
      ['people_organizations'],
      uniqueIds
    );
    return [...new Set([...peopleFromFk, ...fromRel])];
  }

  if (moduleKey === 'deals' || moduleKey === 'cases' || moduleKey === 'quotes') {
    const viaFk = await readParentIdsFromChildRecords(moduleKey, uniqueIds, 'people');
    const relKey = PRIMARY_TO_PEOPLE_RELATIONSHIP_KEYS[moduleKey];
    const viaRel = relKey
      ? await mapTargetIdsToPrimary(organizationId, 'people', [relKey], uniqueIds)
      : [];
    return [...new Set([...viaFk, ...viaRel].map(String))];
  }

  if (moduleKey === 'invoices' || moduleKey === 'sales_orders') {
    return [...new Set((await readParentIdsFromChildRecords(moduleKey, uniqueIds, 'people')).map(String))];
  }

  return [];
}

async function resolveAllMatchingPeople(organizationId, filterQuery, context = {}) {
  const peopleIds = await resolvePrimaryEntityIds(organizationId, filterQuery, context);
  if (peopleIds.length === 0) return [];

  const resolveLimit = getRecipientResolveLimit(context);
  let query = People.find({
    organizationId: toObjectId(organizationId),
    deletedAt: null,
    _id: { $in: peopleIds.map(toObjectId) }
  }).select('_id first_name last_name email organization');
  if (resolveLimit) query = query.limit(resolveLimit);

  return runWithOrganizationTenantContext(organizationId, async () => query.lean());
}

async function resolvePeopleWithEmail(organizationId, filterQuery, context = {}) {
  const rows = await resolveAllMatchingPeople(organizationId, filterQuery, context);

  return rows
    .map((person) => {
      const email = normalizeEmail(person.email);
      if (!email) return null;
      const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || undefined;
      return {
        email,
        name,
        recipientId: String(person._id),
        mergeData: { personId: String(person._id) },
        _id: person._id,
        first_name: person.first_name,
        last_name: person.last_name,
        organization: person.organization
      };
    })
    .filter(Boolean);
}

/**
 * Stream people matching a segment filter for campaign send (no preview cap).
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {object|null} filterQuery
 * @param {(people: object[]) => Promise<void>|void} onBatch
 * @param {object} [context]
 */
async function streamPeopleForSend(organizationId, filterQuery, onBatch, context = {}) {
  const sendContext = { ...context, purpose: 'send' };
  const batchSize = Math.max(100, ID_BATCH_SIZE);

  if (isLegacyAst(filterQuery)) {
    const query = buildLegacyPeopleQuery(organizationId, filterQuery, sendContext);
    const cursor = People.find(query).select('_id first_name last_name email').cursor();
    /** @type {object[]} */
    let batch = [];

    for await (const person of cursor) {
      batch.push(person);
      if (batch.length >= batchSize) {
        await onBatch(batch);
        batch = [];
      }
    }
    if (batch.length > 0) {
      await onBatch(batch);
    }
    return;
  }

  const peopleIds = await resolvePrimaryEntityIds(organizationId, filterQuery, sendContext);
  for (const idBatch of chunkArray(peopleIds, batchSize)) {
    const objectIds = idBatch.map(toObjectId).filter(Boolean);
    if (objectIds.length === 0) continue;

    const rows = await runWithOrganizationTenantContext(organizationId, async () =>
      People.find({
        organizationId: toObjectId(organizationId),
        deletedAt: null,
        _id: { $in: objectIds }
      })
        .select('_id first_name last_name email')
        .lean()
    );
    if (rows.length > 0) {
      await onBatch(rows);
    }
  }
}

function mapPersonToSendRecipient(person) {
  const email = normalizeEmail(person?.email);
  if (!email) return null;
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || undefined;
  const personId = person._id ? String(person._id) : null;
  return {
    email,
    name,
    recipientId: personId || email,
    mergeData: personId ? { personId } : undefined,
    personId: person._id || null
  };
}

async function countMatchingPeople(organizationId, filterQuery, context = {}) {
  if (isLegacyAst(filterQuery)) {
    const query = buildLegacyPeopleQuery(organizationId, filterQuery, context);
    return runWithOrganizationTenantContext(organizationId, async () => People.countDocuments(query));
  }

  const people = await resolveAllMatchingPeople(organizationId, filterQuery, context);
  return people.length;
}

async function queryMatchingPeople(organizationId, filterQuery, options = {}) {
  const page = Math.max(1, parseInt(String(options.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(options.limit || '50'), 10) || 50));
  const all = await resolvePeopleWithEmail(organizationId, filterQuery, options);
  const total = all.length;
  const skip = (page - 1) * limit;

  return {
    items: all.slice(skip, skip + limit),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

module.exports = {
  buildLegacyPeopleQuery,
  resolvePrimaryEntityIds,
  resolveAllMatchingPeople,
  resolvePeopleWithEmail,
  streamPeopleForSend,
  mapPersonToSendRecipient,
  countMatchingPeople,
  queryMatchingPeople,
  evaluateNode
};
