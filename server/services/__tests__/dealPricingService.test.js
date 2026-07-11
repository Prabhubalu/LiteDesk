/**
 * DealPricingService unit tests — amountMode transitions, line totals, AUTO sync.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeGrandTotalFromLines,
  toCalcLine
} = require('../dealPricingService');
const { computeLineTotals } = require('../quoteTotalsService');
const {
  DEAL_AMOUNT_MODE,
  normalizeDealAmountMode,
  DEFAULT_DEAL_AMOUNT_MODE
} = require('../../constants/dealAmountMode');
const { normalizeDealLineType, DEAL_LINE_TYPES } = require('../../constants/dealLineTypes');
const { CURRENT_DEAL_PRICING_VERSION } = require('../../constants/dealPricingVersion');

describe('dealAmountMode', () => {
  it('defaults to MANUAL', () => {
    assert.equal(DEFAULT_DEAL_AMOUNT_MODE, DEAL_AMOUNT_MODE.MANUAL);
  });

  it('normalizes AUTO/MANUAL case-insensitively', () => {
    assert.equal(normalizeDealAmountMode('auto'), DEAL_AMOUNT_MODE.AUTO);
    assert.equal(normalizeDealAmountMode('Manual'), DEAL_AMOUNT_MODE.MANUAL);
    assert.equal(normalizeDealAmountMode('nope'), null);
  });
});

describe('dealLineTypes', () => {
  it('supports non-product lines', () => {
    assert.ok(DEAL_LINE_TYPES.includes('service'));
    assert.ok(DEAL_LINE_TYPES.includes('fee'));
    assert.ok(DEAL_LINE_TYPES.includes('misc'));
    assert.equal(normalizeDealLineType('FEE'), 'fee');
    assert.equal(normalizeDealLineType('x'), null);
  });
});

describe('pricingVersion', () => {
  it('starts at 1', () => {
    assert.equal(CURRENT_DEAL_PRICING_VERSION, 1);
  });
});

describe('DealLine totals via shared computeLineTotals', () => {
  it('computes qty × expectedUnitPrice − discount', () => {
    const line = {
      quantity: 3,
      expectedUnitPrice: 100,
      discountType: 'percent',
      discountValue: 10,
      discountAmount: 0
    };
    const computed = computeLineTotals(toCalcLine(line));
    assert.equal(computed.lineSubtotal, 270);
    assert.equal(computed.lineTotal, 270);
  });

  it('grand total sums active lines only', () => {
    const totals = computeGrandTotalFromLines([
      { lineSubtotal: 100, lineTaxTotal: 10, deletedAt: null },
      { lineSubtotal: 50, lineTaxTotal: 0, deletedAt: null },
      { lineSubtotal: 999, lineTaxTotal: 0, deletedAt: new Date() }
    ]);
    assert.equal(totals.subtotal, 150);
    assert.equal(totals.taxTotal, 10);
    assert.equal(totals.grandTotal, 160);
    assert.equal(totals.lineCount, 2);
  });
});
