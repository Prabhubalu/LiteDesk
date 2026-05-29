const test = require('node:test');
const assert = require('node:assert/strict');

test('quoteActivityService exports writeQuoteActivity', () => {
  const svc = require('../../services/quoteActivityService');
  assert.equal(typeof svc.writeQuoteActivity, 'function');
});
