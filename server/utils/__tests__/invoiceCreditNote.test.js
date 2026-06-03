const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeLineRemainingToCredit,
  resolveCreditLineSelections,
  scaleLineAmount
} = require('../../services/invoiceCreditNoteService');

test('computeLineRemainingToCredit subtracts quantityCredited', () => {
  assert.equal(
    computeLineRemainingToCredit({ quantity: 10, quantityCredited: 3 }),
    7
  );
});

test('resolveCreditLineSelections full mode credits all remaining lines', () => {
  const sourceLines = [
    {
      invoiceLineId: 'inv-line-1',
      quantity: 10,
      quantityCredited: 2,
      hiddenLine: false,
      lineType: 'standard'
    },
    {
      invoiceLineId: 'inv-line-2',
      quantity: 5,
      quantityCredited: 5,
      hiddenLine: false,
      lineType: 'standard'
    }
  ];

  const selections = resolveCreditLineSelections({
    sourceLines,
    requestedLines: null,
    creditMode: 'full'
  });

  assert.equal(selections.length, 1);
  assert.equal(selections[0].line.invoiceLineId, 'inv-line-1');
  assert.equal(selections[0].quantity, 8);
});

test('resolveCreditLineSelections partial line selection', () => {
  const sourceLines = [
    {
      invoiceLineId: 'inv-line-1',
      quantity: 10,
      quantityCredited: 0,
      hiddenLine: false,
      lineType: 'standard'
    },
    {
      invoiceLineId: 'inv-line-2',
      quantity: 4,
      quantityCredited: 0,
      hiddenLine: false,
      lineType: 'standard'
    }
  ];

  const selections = resolveCreditLineSelections({
    sourceLines,
    requestedLines: [{ invoiceLineId: 'inv-line-2', quantity: 2 }],
    creditMode: 'partial'
  });

  assert.equal(selections.length, 1);
  assert.equal(selections[0].quantity, 2);
});

test('resolveCreditLineSelections rejects qty above remaining creditable', () => {
  const sourceLines = [
    {
      invoiceLineId: 'inv-line-1',
      quantity: 10,
      quantityCredited: 8,
      hiddenLine: false,
      lineType: 'standard'
    }
  ];

  assert.throws(
    () =>
      resolveCreditLineSelections({
        sourceLines,
        requestedLines: [{ invoiceLineId: 'inv-line-1', quantity: 5 }],
        creditMode: 'partial'
      }),
    (err) => err.code === 'EXCEEDS_CREDITABLE_QTY'
  );
});

test('scaleLineAmount proportionally scales credit amounts', () => {
  assert.equal(scaleLineAmount(100, 10, 2.5), 25);
});
