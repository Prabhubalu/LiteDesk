'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeMarketingFieldDataType,
  isMarketingFilterableField,
  resolveMarketingFilterType
} = require('../marketingAudienceMetadataService');

test('normalizeMarketingFieldDataType maps CRM field types', () => {
  assert.equal(normalizeMarketingFieldDataType('Lookup (Relationship)'), 'reference');
  assert.equal(normalizeMarketingFieldDataType('Checkbox'), 'boolean');
  assert.equal(normalizeMarketingFieldDataType('Integer'), 'number');
  assert.equal(normalizeMarketingFieldDataType('Radio Button'), 'picklist');
});

test('resolveMarketingFilterType maps user lookup fields', () => {
  assert.equal(
    resolveMarketingFilterType({
      key: 'assignedTo',
      dataType: 'Lookup (Relationship)',
      lookupSettings: { targetModule: 'users' }
    }),
    'user'
  );
});

test('isMarketingFilterableField excludes nested and system keys', () => {
  assert.equal(
    isMarketingFilterableField({ key: 'organization', dataType: 'Lookup (Relationship)' }),
    true
  );
  assert.equal(
    isMarketingFilterableField({ key: 'portalAccess.enabled', dataType: 'Checkbox' }),
    false
  );
  assert.equal(
    isMarketingFilterableField({ key: 'descriptionVersions', dataType: 'Text' }),
    false
  );
});
