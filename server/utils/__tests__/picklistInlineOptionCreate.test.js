const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canAddPicklistOptionInline,
  canEnsurePicklistOptionOnImport,
  normalizeNewPicklistOptionValue,
  optionExists,
  buildPicklistOptionEntry,
  findPicklistOptionByImportValue,
} = require('../picklistInlineOptionCreate');

test('allows tenant-managed organization industry picklist', () => {
  assert.equal(
    canAddPicklistOptionInline('organizations', { key: 'industry', dataType: 'Picklist', owner: 'core' }),
    true
  );
});

test('blocks deal pipeline and stage picklists', () => {
  assert.equal(
    canAddPicklistOptionInline('deals', { key: 'pipeline', dataType: 'Picklist', owner: 'core' }),
    false
  );
  assert.equal(
    canAddPicklistOptionInline('deals', { key: 'stage', dataType: 'Picklist', owner: 'core' }),
    false
  );
});

test('allows org-owned custom picklists', () => {
  assert.equal(
    canAddPicklistOptionInline('deals', { key: 'customSegment', dataType: 'Picklist', owner: 'org' }),
    true
  );
});

test('normalizes task status values to slug', () => {
  assert.equal(normalizeNewPicklistOptionValue('Waiting On Client', 'status', 'tasks'), 'waiting_on_client');
});

test('buildPicklistOptionEntry dedupes by value', () => {
  const entry = buildPicklistOptionEntry('Healthcare', 'industry', 'organizations');
  assert.equal(entry.value, 'Healthcare');
  assert.equal(optionExists([entry], 'Healthcare'), true);
});

test('buildPicklistOptionEntry assigns next palette color from existing options', () => {
  const existing = [{ value: 'Tech', color: '#3B82F6' }];
  const entry = buildPicklistOptionEntry('Healthcare', 'industry', 'organizations', {
    existingOptions: existing,
  });
  assert.equal(entry.value, 'Healthcare');
  assert.notEqual(entry.color, '#3B82F6');
});

test('findPicklistOptionByImportValue matches labels and task slugs', () => {
  const options = [
    { value: 'waiting_on_client', label: 'Waiting On Client' },
    { value: 'Healthcare', label: 'Healthcare' },
  ];
  assert.equal(
    findPicklistOptionByImportValue(options, 'Waiting On Client', 'status', 'tasks'),
    'waiting_on_client'
  );
  assert.equal(
    findPicklistOptionByImportValue(options, 'healthcare', 'industry', 'organizations'),
    'Healthcare'
  );
});

test('canEnsurePicklistOptionOnImport allows people participation status picklists', () => {
  assert.equal(
    canEnsurePicklistOptionOnImport('people', {
      key: 'lead_status',
      dataType: 'Picklist',
      owner: 'platform',
    }),
    true
  );
  assert.equal(
    canEnsurePicklistOptionOnImport('people', {
      key: 'sales_type',
      dataType: 'Picklist',
      owner: 'platform',
    }),
    false
  );
});
