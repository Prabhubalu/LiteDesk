'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const fieldCompiler = require('../marketingAudienceFieldCompiler');
const linkResolver = require('../marketingAudienceLinkResolver');
const metadataService = require('../marketingAudienceMetadataService');

const orgId = new mongoose.Types.ObjectId();

function patchMethod(target, key, replacement, t) {
  const original = target[key];
  target[key] = replacement;
  t.after(() => {
    target[key] = original;
  });
}

function reloadQueryCompiler() {
  delete require.cache[require.resolve('../marketingAudienceQueryCompiler')];
  return require('../marketingAudienceQueryCompiler');
}

test('evaluateNode applies not_exists aggregate by excluding matched primary IDs', async (t) => {
  const matchedPersonId = String(new mongoose.Types.ObjectId());
  const unmatchedPersonId = String(new mongoose.Types.ObjectId());

  patchMethod(
    linkResolver,
    'mapTargetIdsToPrimary',
    async () => [matchedPersonId],
    t
  );

  patchMethod(
    fieldCompiler,
    'queryMatchingRecordIds',
    async (_orgId, moduleKey) => {
      if (moduleKey === 'deals') return [String(new mongoose.Types.ObjectId())];
      if (moduleKey === 'people') return [matchedPersonId, unmatchedPersonId];
      return [];
    },
    t
  );

  patchMethod(
    metadataService,
    'getRelationshipEdgeMetadata',
    async () => ({
      relationshipKey: 'people_deals',
      fromModuleKey: 'people',
      toModuleKey: 'deals',
      direction: 'forward'
    }),
    t
  );

  const queryCompiler = reloadQueryCompiler();

  const ids = await queryCompiler.evaluateNode(orgId, 'people', {
    type: 'aggregate',
    function: 'not_exists',
    relationshipPath: ['people_deals'],
    targetModuleKey: 'deals',
    filter: {
      type: 'group',
      logic: 'AND',
      children: [{ type: 'field', fieldKey: 'stage', operator: 'is', value: 'Closed Won' }]
    }
  });

  assert.deepEqual(ids.sort(), [unmatchedPersonId]);
});

test('evaluateNode delegates count aggregate to numeric evaluator', async (t) => {
  const aggregateEvaluator = require('../marketingAudienceAggregateEvaluator');
  let called = false;

  patchMethod(
    aggregateEvaluator,
    'evaluateNumericAggregateRule',
    async (_orgId, _primaryModule, node, allPrimary) => {
      called = true;
      assert.equal(node.function, 'count');
      assert.equal(node.operator, 'gte');
      assert.equal(node.value, 2);
      assert.deepEqual(allPrimary, ['person-1', 'person-2']);
      return ['person-1'];
    },
    t
  );

  patchMethod(
    fieldCompiler,
    'queryMatchingRecordIds',
    async (_orgId, moduleKey) => {
      if (moduleKey === 'people') return ['person-1', 'person-2'];
      return [];
    },
    t
  );

  const queryCompiler = reloadQueryCompiler();

  const ids = await queryCompiler.evaluateNode(orgId, 'people', {
    type: 'aggregate',
    function: 'count',
    relationshipPath: ['people_deals'],
    targetModuleKey: 'deals',
    operator: 'gte',
    value: 2
  });

  assert.ok(called);
  assert.deepEqual(ids, ['person-1']);
});
