const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getValidityExpiryInstant,
  isQuoteValidityExpired,
  canAutoExpireQuoteStatus,
  daysUntilQuoteValidityEnds
} = require('../../services/quoteExpiryService');

test('getValidityExpiryInstant: day after validUntil UTC midnight', () => {
  const end = getValidityExpiryInstant('2026-05-28T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-05-29T00:00:00.000Z');
});

test('isQuoteValidityExpired: still valid on validUntil day', () => {
  const quote = { validUntil: new Date('2026-05-28T12:00:00.000Z') };
  const now = new Date('2026-05-28T23:00:00.000Z');
  assert.equal(isQuoteValidityExpired(quote, now), false);
});

test('isQuoteValidityExpired: expired after validUntil day', () => {
  const quote = { validUntil: new Date('2026-05-28T00:00:00.000Z') };
  const now = new Date('2026-05-29T00:00:01.000Z');
  assert.equal(isQuoteValidityExpired(quote, now), true);
});

test('canAutoExpireQuoteStatus', () => {
  assert.equal(canAutoExpireQuoteStatus('Sent'), true);
  assert.equal(canAutoExpireQuoteStatus('Approved'), false);
});

test('daysUntilQuoteValidityEnds', () => {
  const quote = { validUntil: new Date('2026-05-30T00:00:00.000Z') };
  const now = new Date('2026-05-28T12:00:00.000Z');
  const days = daysUntilQuoteValidityEnds(quote, now);
  assert.ok(days >= 2);
});
