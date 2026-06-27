'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatCurrencyAmount,
  normalizeCurrencyDisplayMode,
  resolveCurrencyDisplayMode
} = require('../currencyFormat');

describe('currencyFormat', () => {
  it('normalizes display mode', () => {
    assert.equal(normalizeCurrencyDisplayMode('symbol'), 'symbol');
    assert.equal(normalizeCurrencyDisplayMode('code'), 'code');
    assert.equal(normalizeCurrencyDisplayMode(''), 'code');
  });

  it('formats currency with code suffix by default', () => {
    assert.equal(formatCurrencyAmount(1234.5, 'USD', 'code'), '1,234.50 USD');
    assert.equal(formatCurrencyAmount(99, 'EUR', 'code'), '99.00 EUR');
  });

  it('formats currency with symbol when requested', () => {
    const formatted = formatCurrencyAmount(500, 'USD', 'symbol', 'en-US');
    assert.match(formatted, /\$500\.00/);
  });

  it('resolves display mode from scope parameters', () => {
    assert.equal(resolveCurrencyDisplayMode({ parameters: { currencyDisplay: 'symbol' } }), 'symbol');
    assert.equal(resolveCurrencyDisplayMode({ parameters: {} }), 'code');
  });
});
