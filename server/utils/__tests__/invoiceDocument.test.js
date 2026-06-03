const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveInvoiceWatermark } = require('../../controllers/invoiceDocumentController');

test('resolveInvoiceWatermark returns null for Posted invoice', () => {
  assert.equal(resolveInvoiceWatermark({ status: 'Posted' }), null);
});

test('resolveInvoiceWatermark returns DRAFT for Draft invoice', () => {
  assert.equal(resolveInvoiceWatermark({ status: 'Draft' }), 'DRAFT');
});

test('resolveInvoiceWatermark returns VOID for Void invoice', () => {
  assert.equal(resolveInvoiceWatermark({ status: 'Void' }), 'VOID');
});
