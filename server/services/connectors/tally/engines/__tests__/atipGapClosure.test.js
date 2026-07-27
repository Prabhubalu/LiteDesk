'use strict';

const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeOutboxOperation,
  normalizeTallyPayloadKey,
} = require('../ruleOverlayService');
const { salesOrderToTally, purchaseOrderToTally } = require('../../mappers/commercialDocMapper');
const {
  collectionExport,
  ARIVU_COLLECTIONS,
} = require(path.join(
  __dirname,
  '../../../../../../connectors/arivu-agent/src/arivuTdlXml.js'
));

describe('ATIP ruleOverlayService', () => {
  it('normalizes push → upsert', () => {
    assert.equal(normalizeOutboxOperation('push'), 'upsert');
    assert.equal(normalizeOutboxOperation('cancel'), 'update');
    assert.equal(normalizeOutboxOperation('delete'), 'delete');
  });

  it('maps Tally tags to payload keys', () => {
    assert.equal(normalizeTallyPayloadKey('PARTYLEDGERNAME'), 'partyLedgerName');
    assert.equal(normalizeTallyPayloadKey('GSTIN'), 'gstin');
  });
});

describe('commercialDocMapper', () => {
  it('maps sales order', () => {
    const payload = salesOrderToTally(
      { salesOrderNumber: 'SO-1', orderDate: '2024-06-01', subtotal: 100, grandTotal: 118 },
      [{ itemNameSnapshot: 'Widget', quantity: 2, unitPriceSnapshot: 50 }],
      { partyLedgerName: 'Acme' }
    );
    assert.equal(payload.voucherType, 'Sales Order');
    assert.equal(payload.reference, 'SO-1');
    assert.equal(payload.inventoryEntries.length, 1);
    assert.equal(payload.partyLedgerName, 'Acme');
  });

  it('maps purchase order', () => {
    const payload = purchaseOrderToTally(
      { poNumber: 'PO-9', orderDate: '2024-06-02', subtotal: 50 },
      [{ itemNameSnapshot: 'Bolt', quantity: 10, unitPrice: 5 }],
      { partyLedgerName: 'Vendor' }
    );
    assert.equal(payload.voucherType, 'Purchase Order');
    assert.equal(payload.reference, 'PO-9');
  });
});

describe('agent AlterID incremental export', () => {
  it('includes AlterID filter when sinceAlterId set', () => {
    const xml = collectionExport(ARIVU_COLLECTIONS.LEDGERS, { sinceAlterId: '1200' });
    assert.ok(xml.includes('AlterID'));
    assert.ok(xml.includes('ArivuAlterIdFilter'));
    assert.ok(xml.includes('$AlterID'));
    assert.ok(xml.includes('1200'));
  });

  it('omits filter when no watermark', () => {
    const xml = collectionExport(ARIVU_COLLECTIONS.LEDGERS, {});
    assert.ok(!xml.includes('ArivuAlterIdFilter'));
    assert.ok(xml.includes('AlterID'));
  });
});
