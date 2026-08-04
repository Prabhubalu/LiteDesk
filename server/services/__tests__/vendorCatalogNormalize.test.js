/**
 * Vendor catalog service — pure validation / mapping unit tests (no DB).
 */
const assert = require('assert');

function normalizeStatus(raw, fallback = 'Active') {
  const s = String(raw || fallback).trim();
  if (s.toLowerCase() === 'inactive') return 'Inactive';
  return 'Active';
}

function normalizeEntryInput(row) {
  if (!row || typeof row !== 'object') return null;
  const variantId = row.variantId || row.variant_id || row._id;
  if (!variantId) return null;
  return {
    variantId: String(variantId),
    vendorItemCode:
      row.vendorItemCode != null && String(row.vendorItemCode).trim() !== ''
        ? String(row.vendorItemCode).trim()
        : null,
    vendorItemName:
      row.vendorItemName != null && String(row.vendorItemName).trim() !== ''
        ? String(row.vendorItemName).trim()
        : null,
    purchasePrice: Math.max(0, Number(row.purchasePrice) || 0),
    currency:
      row.currency != null && String(row.currency).trim()
        ? String(row.currency).trim().toUpperCase()
        : null,
    status: normalizeStatus(row.status, 'Active')
  };
}

describe('vendorCatalog normalization', () => {
  it('normalizes Active/Inactive status', () => {
    assert.equal(normalizeStatus('active'), 'Active');
    assert.equal(normalizeStatus('INACTIVE'), 'Inactive');
    assert.equal(normalizeStatus(null), 'Active');
  });

  it('requires variantId', () => {
    assert.equal(normalizeEntryInput({}), null);
    assert.equal(normalizeEntryInput({ purchasePrice: 10 }), null);
  });

  it('accepts variant aliases and currency uppercasing', () => {
    const row = normalizeEntryInput({
      variant_id: 'abc',
      purchasePrice: -5,
      currency: 'inr',
      vendorItemCode: '  SKU-1  ',
      status: 'inactive'
    });
    assert.equal(row.variantId, 'abc');
    assert.equal(row.purchasePrice, 0);
    assert.equal(row.currency, 'INR');
    assert.equal(row.vendorItemCode, 'SKU-1');
    assert.equal(row.status, 'Inactive');
  });
});
