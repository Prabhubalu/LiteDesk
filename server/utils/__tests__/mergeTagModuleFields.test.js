'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getSchemaMergeTagFields,
  mergeFieldsForMergeTags
} = require('../mergeTagModuleFields');

describe('mergeTagModuleFields', () => {
  it('includes quote document fields excluded from form configuration', () => {
    const fields = getSchemaMergeTagFields('quotes').map((field) => field.key);
    assert.ok(fields.includes('quoteNumber'));
    assert.ok(fields.includes('grandTotal'));
    assert.ok(fields.includes('subtotal'));
    assert.ok(!fields.includes('publicShareToken'));
  });

  it('merges configured labels with supplemental schema fields', () => {
    const merged = mergeFieldsForMergeTags(
      [{ key: 'quoteTitle', label: 'Quote Title' }],
      'quotes'
    );
    const byKey = new Map(merged.map((field) => [field.key, field]));
    assert.equal(byKey.get('quoteTitle')?.label, 'Quote Title');
    assert.equal(byKey.get('quoteNumber')?.label, 'Quote Number');
    assert.equal(byKey.get('grandTotal')?.label, 'Grand Total');
  });
});
