const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getQuoteConversionEligibility,
  resolveConversionTypeForQuote
} = require('../../services/quoteConversionService');

test('resolveConversionTypeForQuote: partial from status', () => {
  assert.equal(resolveConversionTypeForQuote({ status: 'Partially Accepted' }), 'partial');
});

test('resolveConversionTypeForQuote: full from accepted', () => {
  assert.equal(resolveConversionTypeForQuote({ status: 'Accepted' }), 'full');
});

test('getQuoteConversionEligibility: requires acceptance', () => {
  const e = getQuoteConversionEligibility({ status: 'Approved', converted: false });
  assert.equal(e.allowed, false);
  assert.equal(e.reason, 'accept_first');
});

test('getQuoteConversionEligibility: allows accepted', () => {
  const e = getQuoteConversionEligibility({ status: 'Accepted', converted: false });
  assert.equal(e.allowed, true);
  assert.equal(e.suggestedConversionType, 'full');
});

test('getQuoteConversionEligibility: blocks expired validUntil', () => {
  const e = getQuoteConversionEligibility({
    status: 'Accepted',
    converted: false,
    validUntil: '2020-01-01T00:00:00.000Z'
  });
  assert.equal(e.allowed, false);
  assert.equal(e.reason, 'expired');
  assert.equal(e.expiredOverrideAvailable, true);
});

test('getQuoteConversionEligibility: override allows accepted past validUntil', () => {
  const e = getQuoteConversionEligibility(
    {
      status: 'Accepted',
      converted: false,
      validUntil: '2020-01-01T00:00:00.000Z'
    },
    { overrideExpired: true }
  );
  assert.equal(e.allowed, true);
  assert.equal(e.usedExpiredOverride, true);
});

test('getQuoteConversionEligibility: expired status needs acceptance even with override', () => {
  const e = getQuoteConversionEligibility(
    { status: 'Expired', converted: false },
    { overrideExpired: true }
  );
  assert.equal(e.allowed, false);
  assert.equal(e.reason, 'accept_first');
});

test('getQuoteConversionEligibility: expired + customer acceptance + override', () => {
  const e = getQuoteConversionEligibility(
    {
      status: 'Expired',
      converted: false,
      customerResponse: { responseType: 'full' }
    },
    { overrideExpired: true }
  );
  assert.equal(e.allowed, true);
  assert.equal(e.usedExpiredOverride, true);
});
