'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPublicCollectionTree,
  normalizeCollectionSlug,
} = require('../publicContentService');

describe('public help collections', () => {
  it('normalizes collection slug values', () => {
    assert.equal(normalizeCollectionSlug('/Getting-Started'), 'getting-started');
    assert.equal(normalizeCollectionSlug('  CRM  '), 'crm');
  });

  it('builds nested collection tree with counts and prunes empty branches', () => {
    const tree = buildPublicCollectionTree(
      [
        { _id: 'crm', name: 'CRM', slug: 'crm', description: 'CRM help', emoji: '', heroIconKey: 'lifebuoy', heroIconColor: '#2563eb', imageUrl: '', parentId: null, sortOrder: 0 },
        { _id: 'gs', name: 'Getting Started', slug: 'getting-started', description: 'Start here', emoji: '', parentId: 'crm', sortOrder: 0 },
        { _id: 'empty', name: 'Empty', slug: 'empty', description: '', emoji: '', parentId: 'crm', sortOrder: 1 },
      ],
      {
        crm: 0,
        gs: 4,
        empty: 0,
      },
    );

    assert.equal(tree.length, 1);
    assert.equal(tree[0].slug, 'crm');
    assert.equal(tree[0].description, 'CRM help');
    assert.equal(tree[0].children[0].description, 'Start here');
    assert.equal(tree[0].emoji, '');
    assert.equal(tree[0].heroIconKey, 'lifebuoy');
    assert.equal(tree[0].heroIconColor, '#2563eb');
    assert.equal(tree[0].imageUrl, '');
    assert.equal(tree[0].articleCount, 0);
    assert.equal(tree[0].sectionCount, 1);
    assert.equal(tree[0].children[0].slug, 'getting-started');
    assert.equal(tree[0].children[0].parentSlug, 'crm');
    assert.equal(tree[0].children[0].articleCount, 4);
    assert.equal(tree[0].children[0].sectionCount, 0);
  });

  it('includes root collections that have direct articles', () => {
    const tree = buildPublicCollectionTree(
      [
        { _id: 'root', name: 'General', slug: 'general', description: '', parentId: null, sortOrder: 0 },
      ],
      { root: 3 },
    );

    assert.equal(tree.length, 1);
    assert.equal(tree[0].articleCount, 3);
    assert.equal(tree[0].sectionCount, 0);
  });
});
