const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isCacheFresh,
  buildDealContextText,
  buildPeopleContextText,
} = require('../aiRecordSummaryService');

describe('aiRecordSummaryService', () => {
  it('treats matching updatedAt as fresh cache', () => {
    const stamp = new Date('2026-07-16T10:00:00.000Z');
    assert.equal(isCacheFresh(stamp, stamp), true);
    assert.equal(isCacheFresh(stamp, new Date('2026-07-16T11:00:00.000Z')), false);
    assert.equal(isCacheFresh(null, stamp), false);
  });

  it('builds deal context with stage and amount', () => {
    const text = buildDealContextText({
      name: 'Acme expansion',
      stage: 'Negotiation',
      status: 'open',
      amount: 12000,
      currency: 'USD',
      probability: 40,
      description: 'Renewal plus seats',
      stageHistory: [{ stage: 'Negotiation', changedAt: '2026-07-01T00:00:00.000Z' }],
    });
    assert.match(text, /Acme expansion/);
    assert.match(text, /Negotiation/);
    assert.match(text, /12000/);
  });

  it('builds people context and redacts email', () => {
    const text = buildPeopleContextText({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      tags: ['vip'],
      participations: { SALES: { role: 'Lead', lead_status: 'New' } },
      activityLogs: [{ user: 'Rep', action: 'note_added', message: 'Called', timestamp: '2026-07-02T00:00:00.000Z' }],
    });
    assert.match(text, /Ada Lovelace/);
    assert.match(text, /\[EMAIL\]/);
    assert.doesNotMatch(text, /ada@example\.com/);
    assert.match(text, /Called/);
  });
});
