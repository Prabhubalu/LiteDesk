'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const metadataService = require('../marketingAudienceMetadataService');
const RelationshipInstance = require('../../../models/RelationshipInstance');
const { getModelForModuleKey } = require('../../../utils/assignmentRecordLoader');

const orgId = new mongoose.Types.ObjectId();

function patchMethod(target, key, replacement, t) {
  const original = target[key];
  target[key] = replacement;
  t.after(() => {
    target[key] = original;
  });
}

function stubEdge(relationshipKey, fromModuleKey, toModuleKey, direction = 'forward', extra = {}) {
  return {
    relationshipKey,
    fromModuleKey,
    toModuleKey,
    direction,
    linkKinds: ['relationship_instance', 'foreign_key'],
    ...extra
  };
}

function reloadLinkResolver() {
  delete require.cache[require.resolve('../marketingAudienceLinkResolver')];
  return require('../marketingAudienceLinkResolver');
}

async function runBackwardMappingTest(t, {
  relationshipKey,
  fromModule,
  toModule,
  childField,
  direction = 'forward',
  reverseSourceModuleKey = null
}) {
  const parentId = new mongoose.Types.ObjectId();
  const childId = new mongoose.Types.ObjectId();

  patchMethod(
    metadataService,
    'getRelationshipEdgeMetadata',
    async () =>
      stubEdge(relationshipKey, fromModule, toModule, direction, {
        ...(reverseSourceModuleKey ? { reverseSourceModuleKey } : {})
      }),
    t
  );

  patchMethod(
    RelationshipInstance,
    'find',
    () => ({
      select: () => ({
        lean: async () => []
      })
    }),
    t
  );

  const linkResolver = reloadLinkResolver();
  const ChildModel = getModelForModuleKey(toModule);
  const originalFind = ChildModel.find.bind(ChildModel);
  ChildModel.find = (query) => {
    if (query?._id?.$in) {
      return {
        select: () => ({
          lean: async () => [{ _id: childId, [childField]: parentId }]
        })
      };
    }
    return originalFind(query);
  };
  t.after(() => {
    ChildModel.find = originalFind;
  });

  const peopleIds = await linkResolver.mapTargetIdsToPrimary(
    orgId,
    fromModule,
    [relationshipKey],
    [String(childId)]
  );

  assert.deepEqual(peopleIds, [String(parentId)]);
}

test('mapTargetIdsToPrimary resolves people from deals via contactId FK', async (t) => {
  await runBackwardMappingTest(t, {
    relationshipKey: 'people_deals',
    fromModule: 'people',
    toModule: 'deals',
    childField: 'contactId'
  });
});

test('mapTargetIdsToPrimary resolves people from quotes via contactId FK', async (t) => {
  await runBackwardMappingTest(t, {
    relationshipKey: 'quote_people',
    fromModule: 'people',
    toModule: 'quotes',
    childField: 'contactId'
  });
});

test('mapTargetIdsToPrimary resolves people from cases via reverse case_people edge', async (t) => {
  await runBackwardMappingTest(t, {
    relationshipKey: 'case_people',
    fromModule: 'people',
    toModule: 'cases',
    childField: 'contactId',
    direction: 'reverse',
    reverseSourceModuleKey: 'cases'
  });
});

test('mapTargetIdsToPrimary resolves organizations from deals via accountId FK', async (t) => {
  const orgIdLocal = new mongoose.Types.ObjectId();
  const dealId = new mongoose.Types.ObjectId();
  const accountId = new mongoose.Types.ObjectId();

  patchMethod(
    metadataService,
    'getRelationshipEdgeMetadata',
    async () => stubEdge('deal_organizations', 'organizations', 'deals'),
    t
  );
  patchMethod(
    RelationshipInstance,
    'find',
    () => ({
      select: () => ({
        lean: async () => []
      })
    }),
    t
  );

  const linkResolver = reloadLinkResolver();
  const Deal = getModelForModuleKey('deals');
  const originalFind = Deal.find.bind(Deal);
  Deal.find = (query) => {
    if (query?._id?.$in) {
      return {
        select: () => ({
          lean: async () => [{ _id: dealId, accountId }]
        })
      };
    }
    return originalFind(query);
  };
  t.after(() => {
    Deal.find = originalFind;
  });

  const orgIds = await linkResolver.mapTargetIdsToPrimary(
    orgIdLocal,
    'organizations',
    ['deal_organizations'],
    [String(dealId)]
  );

  assert.deepEqual(orgIds, [String(accountId)]);
});

test('getModelForModuleKey resolves quotes invoices and sales_orders', () => {
  assert.ok(getModelForModuleKey('quotes'));
  assert.ok(getModelForModuleKey('invoices'));
  assert.ok(getModelForModuleKey('sales_orders'));
});
