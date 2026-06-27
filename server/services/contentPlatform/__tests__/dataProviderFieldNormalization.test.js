'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLine,
  normalizeQuoteRecord,
  plainTextFromRichDescription,
  resolveCatalogItemDescription
} = require('../engines/dataProviderEngine');

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

  it('prefers live catalog description over line snapshot', () => {
    const line = normalizeLine({
      descriptionSnapshot: 'Stale snapshot',
      liveItemDescription: 'Current catalog description',
      itemNameSnapshot: 'Phone'
    });

    assert.equal(line.description, 'Current catalog description');
  });

  it('falls back to snapshot when live catalog description is unavailable', () => {
    const line = normalizeLine({
      descriptionSnapshot: 'Snapshot only',
      itemNameSnapshot: 'Phone'
    });

    assert.equal(line.description, 'Snapshot only');
  });

  it('strips rich-text html from catalog descriptions', () => {
    const line = normalizeLine({
      descriptionSnapshot: '<p>Stale snapshot</p>',
      liveItemDescription: '<p>Current <strong>catalog</strong> description</p>',
      itemNameSnapshot: 'Phone'
    });

    assert.equal(line.description, 'Current catalog description');
  });

  it('resolves catalog description from descriptionVersions when description field is empty', () => {
    const description = resolveCatalogItemDescription({
      description: '',
      descriptionVersions: [
        { content: '<p>Older version</p>', createdAt: '2026-01-01T00:00:00.000Z' },
        { content: '<p>Latest version</p>', createdAt: '2026-06-01T00:00:00.000Z' }
      ]
    });

    assert.equal(description, 'Latest version');
    assert.equal(plainTextFromRichDescription('<p>Hello<br>world</p>'), 'Hello\nworld');
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
