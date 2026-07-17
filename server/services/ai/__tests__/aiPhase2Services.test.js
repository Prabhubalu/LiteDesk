'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildCoverageGaps } = require('../aiCommercialService');
const { parsePatchesJson } = require('../aiExtractService');
const { flattenRecordContext } = require('../aiWorkGraphService');

describe('Phase 2 AI services (offline)', () => {
  it('buildCoverageGaps flags missing catalog variants', () => {
    const gaps = buildCoverageGaps({
      lines: [
        { lineOrder: 1, variantId: null, itemNameSnapshot: 'Custom' },
        { lineOrder: 2, variantId: 'v1', itemNameSnapshot: 'SKU' },
      ],
    });
    assert.ok(gaps.some((g) => g.code === 'MISSING_CATALOG_VARIANT'));
    assert.ok(!gaps.some((g) => g.code === 'NO_LINES'));
  });

  it('parsePatchesJson extracts patches from fenced JSON', () => {
    const patches = parsePatchesJson('Here you go:\n{"patches":[{"fieldKey":"phone","value":"555","confidence":0.9}]}');
    assert.equal(patches.length, 1);
    assert.equal(patches[0].fieldKey, 'phone');
  });

  it('flattenRecordContext builds citations with org filter inputs', () => {
    const { text, citations } = flattenRecordContext({
      moduleKey: 'deals',
      recordId: 'd1',
      primary: { name: 'Acme Deal' },
      relatedGroups: [
        {
          moduleKey: 'people',
          records: [{ _id: 'p1', name: 'Ada' }],
        },
      ],
    });
    assert.match(text, /Acme Deal/);
    assert.equal(citations.length, 1);
    assert.equal(citations[0].sourceId, 'p1');
  });
});
