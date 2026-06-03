const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertCanInvoiceSalesOrder,
  resolveInvoiceLineSelections
} = require('../../services/invoiceConversionService');
const { DEFAULT_BILL_ON } = require('../../services/salesOrderInvoiceAllocationService');

test('assertCanInvoiceSalesOrder blocks Cancelled', () => {
  assert.throws(() => assertCanInvoiceSalesOrder({ status: 'Cancelled' }), (err) => {
    return err.code === 'SO_NOT_INVOICEABLE';
  });
});

test('resolveInvoiceLineSelections defaults to remaining billable qty', () => {
  const soLines = [
    {
      salesOrderLineId: 'line-1',
      quantity: 10,
      quantityFulfilled: 6,
      quantityCancelled: 0,
      quantityInvoiced: 2,
      hiddenLine: false,
      lineType: 'standard'
    },
    {
      salesOrderLineId: 'line-2',
      quantity: 5,
      quantityFulfilled: 0,
      quantityCancelled: 0,
      quantityInvoiced: 0,
      hiddenLine: false,
      lineType: 'standard'
    }
  ];

  const selections = resolveInvoiceLineSelections({
    soLines,
    requestedLines: null,
    billOn: DEFAULT_BILL_ON,
    overrideBillOnFulfill: false
  });

  assert.equal(selections.length, 1);
  assert.equal(selections[0].line.salesOrderLineId, 'line-1');
  assert.equal(selections[0].quantity, 4);
});

test('resolveInvoiceLineSelections rejects qty above remaining', () => {
  const soLines = [
    {
      salesOrderLineId: 'line-1',
      quantity: 10,
      quantityFulfilled: 6,
      quantityCancelled: 0,
      quantityInvoiced: 2,
      hiddenLine: false,
      lineType: 'standard'
    }
  ];

  assert.throws(
    () =>
      resolveInvoiceLineSelections({
        soLines,
        requestedLines: [{ salesOrderLineId: 'line-1', quantity: 10 }],
        billOn: DEFAULT_BILL_ON,
        overrideBillOnFulfill: false
      }),
    (err) => err.code === 'EXCEEDS_BILLABLE_QTY'
  );
});
