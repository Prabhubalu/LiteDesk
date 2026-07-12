'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  extractCustomFields,
  buildUpdateWithCustomFields
} = require('../customFieldsExtractor');

const TestSchema = new mongoose.Schema({
  name: String,
  organizationId: mongoose.Schema.Types.ObjectId,
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} }
});
const TestModel = mongoose.models.CustomFieldsExtractorTest
  || mongoose.model('CustomFieldsExtractorTest', TestSchema);

test('buildUpdateWithCustomFields expands customFields object to dots', () => {
  const $set = buildUpdateWithCustomFields(
    {
      name: 'Ada',
      customFields: { niche: 'x' },
      lastActivity: new Date('2026-01-01'),
      fancyField: 'y'
    },
    TestModel
  );
  assert.equal($set.name, 'Ada');
  assert.equal($set['customFields.niche'], 'x');
  assert.equal($set['customFields.fancyField'], 'y');
  assert.equal(Object.prototype.hasOwnProperty.call($set, 'customFields'), false);
  assert.equal(Object.prototype.hasOwnProperty.call($set, 'customFields.lastActivity'), false);
});

test('extractCustomFields ignores computed lastActivity', () => {
  const { standardPayload, customFieldsSet } = extractCustomFields(
    { name: 'Ada', lastActivity: new Date(), customFields: { a: 1 } },
    TestModel
  );
  assert.equal(standardPayload.name, 'Ada');
  assert.equal(customFieldsSet.a, 1);
  assert.equal(customFieldsSet.lastActivity, undefined);
});
