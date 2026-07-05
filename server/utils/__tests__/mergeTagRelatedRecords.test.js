'use strict';

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { resolveMergeTagModuleAlias } = require('../mergeTagModuleAliases');
const relationshipResolver = require('../../services/relationshipResolver');
const { loadMergeTagRelatedRecords } = require('../../services/contentPlatform/engines/mergeTagRelatedRecords');

describe('mergeTagModuleAliases', () => {
  it('maps module keys to runtime merge scope aliases', () => {
    assert.equal(resolveMergeTagModuleAlias('deals'), 'Deal');
    assert.equal(resolveMergeTagModuleAlias('cases'), 'Case');
    assert.equal(resolveMergeTagModuleAlias('organizations'), 'Organization');
    assert.equal(resolveMergeTagModuleAlias('quotes'), 'Quote');
  });
});

describe('loadMergeTagRelatedRecords', () => {
  it('loads lookup fields under canonical merge aliases', async (t) => {
    const Deal = require('../../models/Deal');
    const dealFind = mock.method(Deal, 'findOne', () => ({
      lean: async () => ({
        _id: 'deal-1',
        name: 'Enterprise rollout',
        amount: 120000,
        stage: 'Proposal'
      })
    }));
    const relatedRecords = mock.method(relationshipResolver, 'getRelatedRecords', async () => []);
    t.after(() => {
      dealFind.mock.restore();
      relatedRecords.mock.restore();
    });

    const scope = await loadMergeTagRelatedRecords({
      organizationId: new mongoose.Types.ObjectId(),
      moduleKey: 'quotes',
      record: {
        _id: new mongoose.Types.ObjectId(),
        dealId: new mongoose.Types.ObjectId()
      },
      preview: false
    });

    assert.equal(scope.Deal.name, 'Enterprise rollout');
    assert.equal(scope.Deals, undefined);
    assert.equal(relatedRecords.mock.callCount(), 1);
  });

  it('loads lookup fields during preview mode', async (t) => {
    const Deal = require('../../models/Deal');
    const dealFind = mock.method(Deal, 'findOne', () => ({
      lean: async () => ({
        _id: 'deal-2',
        name: 'Preview deal',
        amount: 5000
      })
    }));
    const relatedRecords = mock.method(relationshipResolver, 'getRelatedRecords', async () => []);
    t.after(() => {
      dealFind.mock.restore();
      relatedRecords.mock.restore();
    });

    const scope = await loadMergeTagRelatedRecords({
      organizationId: new mongoose.Types.ObjectId(),
      moduleKey: 'quotes',
      record: {
        _id: new mongoose.Types.ObjectId(),
        dealId: new mongoose.Types.ObjectId()
      },
      preview: true
    });

    assert.equal(scope.Deal.name, 'Preview deal');
    assert.equal(relatedRecords.mock.callCount(), 1);
  });
});
