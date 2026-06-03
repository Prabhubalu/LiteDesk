const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { openLineQuantity, assertCanSplitOrder } = require('../../services/salesOrderSplitService');
const { assertMergeCompatibleOrders } = require('../../services/salesOrderMergeService');
const {
  computeLineRemainingToInvoice,
  deriveInvoiceStatusFromLines,
  rollupInvoiceFieldsFromLines
} = require('../../services/salesOrderInvoiceAllocationService');

describe('openLineQuantity', () => {
  it('returns qty minus fulfilled and cancelled', () => {
    assert.equal(
      openLineQuantity({ quantity: 10, quantityFulfilled: 3, quantityCancelled: 2 }),
      5
    );
  });
});

describe('assertCanSplitOrder', () => {
  it('blocks cancelled orders', () => {
    assert.throws(
      () => assertCanSplitOrder({ status: 'Cancelled', lineageType: 'standalone' }),
      /Cannot split/
    );
  });

  it('blocks merged sources', () => {
    assert.throws(
      () => assertCanSplitOrder({ status: 'Confirmed', lineageType: 'merged_source' }),
      /Merged source/
    );
  });
});

describe('assertMergeCompatibleOrders', () => {
  it('requires same status', () => {
    assert.throws(
      () =>
        assertMergeCompatibleOrders([
          { status: 'Draft', lineageType: 'standalone', organizationRefId: null, contactId: null },
          { status: 'Confirmed', lineageType: 'standalone', organizationRefId: null, contactId: null }
        ]),
      /same status/
    );
  });

  it('requires matching customer refs', () => {
    assert.throws(
      () =>
        assertMergeCompatibleOrders([
          {
            status: 'Confirmed',
            lineageType: 'standalone',
            organizationRefId: 'a',
            contactId: null,
            salesOrderId: '1'
          },
          {
            status: 'Confirmed',
            lineageType: 'standalone',
            organizationRefId: 'b',
            contactId: null,
            salesOrderId: '2'
          }
        ]),
      /same customer/
    );
  });
});

describe('deriveInvoiceStatusFromLines', () => {
  it('returns not_invoiced when empty', () => {
    assert.equal(deriveInvoiceStatusFromLines([]), 'not_invoiced');
  });

  it('returns partially_invoiced', () => {
    const status = deriveInvoiceStatusFromLines([
      { quantity: 5, quantityFulfilled: 5, quantityInvoiced: 2, hiddenLine: false }
    ]);
    assert.equal(status, 'partially_invoiced');
  });

  it('returns fully_invoiced when fulfilled qty invoiced', () => {
    const status = deriveInvoiceStatusFromLines([
      { quantity: 5, quantityFulfilled: 5, quantityInvoiced: 5, hiddenLine: false }
    ]);
    assert.equal(status, 'fully_invoiced');
  });
});

describe('computeLineRemainingToInvoice', () => {
  it('defaults to bill on fulfill', () => {
    assert.equal(
      computeLineRemainingToInvoice({
        quantity: 10,
        quantityFulfilled: 4,
        quantityInvoiced: 1,
        quantityCancelled: 0
      }),
      3
    );
  });
});

describe('rollupInvoiceFieldsFromLines', () => {
  it('computes remaining billable amount', () => {
    const rollup = rollupInvoiceFieldsFromLines(
      [
        {
          quantity: 2,
          lineTotal: 100,
          quantityFulfilled: 2,
          quantityInvoiced: 1,
          hiddenLine: false
        }
      ],
      100
    );
    assert.equal(rollup.invoiceStatus, 'partially_invoiced');
    assert.equal(rollup.invoicedAmount, 50);
    assert.equal(rollup.remainingBillableAmount, 50);
  });
});
