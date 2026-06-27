const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computePortalCaseUnread,
  enrichPortalCaseSummary,
  isPortalCaseClosedStatus
} = require('../portalCaseAccessService');

test('computePortalCaseUnread respects waiting for customer', () => {
  const row = {
    status: 'Waiting for Customer',
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  };
  assert.equal(computePortalCaseUnread(row, 'user-1'), true);
});

test('computePortalCaseUnread uses read receipt timestamp', () => {
  const row = {
    status: 'In Progress',
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    portalReadReceipts: [{
      userId: 'user-1',
      readAt: new Date('2026-01-03T00:00:00.000Z')
    }]
  };
  assert.equal(computePortalCaseUnread(row, 'user-1'), false);
});

test('enrichPortalCaseSummary exposes csatSubmitted flag', () => {
  const summary = enrichPortalCaseSummary({
    _id: '1',
    caseId: 'CAS-1',
    title: 'Test',
    status: 'Closed',
    updatedAt: new Date(),
    portalCsat: {
      score: 5,
      submittedAt: new Date()
    }
  }, 'user-1');

  assert.equal(summary.csatSubmitted, true);
  assert.equal(summary.csatScore, 5);
  assert.equal(isPortalCaseClosedStatus('Resolved'), true);
});
