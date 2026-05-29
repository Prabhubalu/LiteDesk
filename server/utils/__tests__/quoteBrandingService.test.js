const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeBrandColor } = require('../../services/quoteOrgSettingsService');

test('sanitizeBrandColor accepts 6-digit hex', () => {
  assert.equal(sanitizeBrandColor('#7f56d9'), '#7f56d9');
  assert.equal(sanitizeBrandColor('7f56d9'), '#7f56d9');
});

test('sanitizeBrandColor rejects invalid', () => {
  assert.equal(sanitizeBrandColor('red'), '');
  assert.equal(sanitizeBrandColor('#fff'), '');
});
