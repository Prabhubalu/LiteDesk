const test = require('node:test');
const assert = require('node:assert/strict');

const {
  QUOTE_STATUSES,
  QUOTE_STATUS_DEFAULT,
  canTransitionQuoteStatus,
  assertCanTransitionQuoteStatus,
  isCommerciallyLockedStatus
} = require('../../constants/quoteLifecycle');

test('quote lifecycle has expected defaults', () => {
  assert.equal(QUOTE_STATUS_DEFAULT, 'Draft');
  assert.ok(QUOTE_STATUSES.includes('Draft'));
  assert.ok(QUOTE_STATUSES.includes('Converted'));
});

test('quote lifecycle transition matrix: allowed transitions pass', () => {
  const allowed = [
    ['Draft', 'Pending Approval'],
    ['Draft', 'Approved'],
    ['Draft', 'Cancelled'],
    ['Pending Approval', 'Approved'],
    ['Pending Approval', 'Rejected'],
    ['Approved', 'Sent'],
    ['Approved', 'Cancelled'],
    ['Sent', 'Viewed'],
    ['Sent', 'Accepted'],
    ['Sent', 'Rejected'],
    ['Sent', 'Expired'],
    ['Viewed', 'Accepted'],
    ['Viewed', 'Rejected'],
    ['Viewed', 'Expired'],
    ['Accepted', 'Converted'],
    ['Partially Accepted', 'Converted']
  ];

  for (const [from, to] of allowed) {
    assert.equal(canTransitionQuoteStatus(from, to), true, `${from} -> ${to} should be allowed`);
    assert.doesNotThrow(() => assertCanTransitionQuoteStatus(from, to));
  }
});

test('quote lifecycle transition matrix: invalid transitions fail', () => {
  const invalid = [
    ['Draft', 'Sent'],
    ['Pending Approval', 'Sent'],
    ['Sent', 'Draft'],
    ['Converted', 'Draft'],
    ['Expired', 'Converted'],
    ['Rejected', 'Approved']
  ];

  for (const [from, to] of invalid) {
    assert.equal(canTransitionQuoteStatus(from, to), false, `${from} -> ${to} should be blocked`);
    assert.throws(() => assertCanTransitionQuoteStatus(from, to));
  }
});

test('commercial lock activates at Sent and beyond', () => {
  assert.equal(isCommerciallyLockedStatus('Draft'), false);
  assert.equal(isCommerciallyLockedStatus('Approved'), false);
  assert.equal(isCommerciallyLockedStatus('Sent'), true);
  assert.equal(isCommerciallyLockedStatus('Viewed'), true);
  assert.equal(isCommerciallyLockedStatus('Accepted'), true);
  assert.equal(isCommerciallyLockedStatus('Converted'), true);
});

