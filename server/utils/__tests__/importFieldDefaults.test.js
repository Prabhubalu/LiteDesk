const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyImportFieldDefaults,
  sanitizeImportFieldDefaultValues,
} = require('../importFieldDefaults');

test('applyImportFieldDefaults overrides mapped CSV values', () => {
  const row = { Name: 'From CSV', Industry: 'Old' };
  const fieldMapping = { Name: 'name', Industry: 'industry' };
  const fieldDefaultValues = { Industry: 'Technology' };

  const result = applyImportFieldDefaults(row, fieldMapping, fieldDefaultValues);
  assert.equal(result.Name, 'From CSV');
  assert.equal(result.Industry, 'Technology');
});

test('applyImportFieldDefaults ignores unmapped columns and empty defaults', () => {
  const row = { Country: 'Canada' };
  const fieldMapping = { Country: 'country' };
  const fieldDefaultValues = { Country: '', Other: 'Ignored' };

  const result = applyImportFieldDefaults(row, fieldMapping, fieldDefaultValues);
  assert.equal(result.Country, 'Canada');
});

test('sanitizeImportFieldDefaultValues keeps only non-empty values', () => {
  const sanitized = sanitizeImportFieldDefaultValues({
    A: 'x',
    B: '',
    C: null,
    D: ['a', 'b'],
  });
  assert.deepEqual(sanitized, { A: 'x', D: ['a', 'b'] });
});
