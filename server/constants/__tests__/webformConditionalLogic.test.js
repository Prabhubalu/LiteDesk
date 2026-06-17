'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  filterVisibleWebformFields,
  isWebformFieldVisible,
  stripHiddenWebformFieldValues
} = require('../webformConditionalLogic');

const fields = [
  { fieldId: 'country', label: 'Country', type: 'Picklist' },
  { fieldId: 'state', label: 'State', type: 'Text', visibility: { enabled: true, match: 'all', conditions: [{ fieldId: 'country', operator: 'equals', value: 'US' }] } }
];

describe('webformConditionalLogic', () => {
  it('hides fields when conditions fail', () => {
    assert.strictEqual(isWebformFieldVisible(fields[1], fields, { country: 'US' }), true);
    assert.strictEqual(isWebformFieldVisible(fields[1], fields, { country: 'CA' }), false);
  });

  it('strips hidden values before processing', () => {
    const values = { country: 'CA', state: 'Texas' };
    const next = stripHiddenWebformFieldValues(fields, values);
    assert.deepStrictEqual(next, { country: 'CA' });
  });

  it('filters visible fields', () => {
    const visible = filterVisibleWebformFields(fields, { country: 'CA' });
    assert.deepStrictEqual(visible.map((field) => field.fieldId), ['country']);
  });
});
