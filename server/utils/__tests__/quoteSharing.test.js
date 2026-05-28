const test = require('node:test');
const assert = require('node:assert/strict');

const { canTransitionQuoteStatus } = require('../../constants/quoteLifecycle');

test('quote sharing: Draft must transition to Sent through lifecycle', () => {
  // Sharing endpoint enforces transition validator.
  // Draft -> Sent is NOT allowed, so clients must approve first.
  assert.equal(canTransitionQuoteStatus('Draft', 'Sent'), false);
  assert.equal(canTransitionQuoteStatus('Approved', 'Sent'), true);
});

