'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeLine, normalizeQuoteRecord } = require('../engines/dataProviderEngine');

describe('dataProviderEngine field normalization', () => {
  it('maps quote line snapshot fields to template merge paths', () => {
    const line = normalizeLine({
      descriptionSnapshot: 'Widget',
      quantity: 2,
      unitPriceSnapshot: 45.5,
      lineTotal: 91
    });

    assert.equal(line.description, 'Widget');
    assert.equal(line.unitPrice, 45.5);
    assert.equal(line.lineTotal, 91);
  });

  it('fills quote totals and customer name for merge tags', () => {
    const quote = normalizeQuoteRecord({
      _id: 'q1',
      quoteNumber: 'QT-1',
      organizationRefId: { name: 'Northwind Traders' }
    });

    assert.equal(quote.quoteNumber, 'QT-1');
    assert.equal(quote.grandTotal, 0);
    assert.equal(quote.customerName, 'Northwind Traders');
  });
});
