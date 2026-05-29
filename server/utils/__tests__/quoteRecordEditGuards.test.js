const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isQuoteRecordReadOnly,
  assertQuoteRecordEditable
} = require('../../constants/quoteLifecycle');

test('isQuoteRecordReadOnly', () => {
  assert.equal(isQuoteRecordReadOnly('Expired'), true);
  assert.equal(isQuoteRecordReadOnly('Converted'), true);
  assert.equal(isQuoteRecordReadOnly('Draft'), false);
  assert.equal(isQuoteRecordReadOnly('Sent'), false);
});

test('assertQuoteRecordEditable throws on terminal statuses', () => {
  assert.throws(() => assertQuoteRecordEditable({ status: 'Expired' }), (e) => e.code === 'QUOTE_RECORD_LOCKED');
});

test('assertQuoteRecordEditable allows draft', () => {
  assert.doesNotThrow(() => assertQuoteRecordEditable({ status: 'Draft' }));
});
