const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sortInvoicesForAutoApply,
  buildAutoApplyPlan
} = require('../../services/paymentAllocationPolicyService');

test('sortInvoicesForAutoApply orders oldest dueDate first', () => {
  const sorted = sortInvoicesForAutoApply([
    { invoiceNumber: 'INV-002', dueDate: new Date('2026-03-01'), invoiceDate: new Date('2026-01-01') },
    { invoiceNumber: 'INV-001', dueDate: new Date('2026-02-01'), invoiceDate: new Date('2026-01-01') },
    { invoiceNumber: 'INV-003', dueDate: new Date('2026-04-01'), invoiceDate: new Date('2026-01-01') }
  ]);

  assert.deepEqual(
    sorted.map((row) => row.invoiceNumber),
    ['INV-001', 'INV-002', 'INV-003']
  );
});

test('sortInvoicesForAutoApply puts null dueDate last', () => {
  const sorted = sortInvoicesForAutoApply([
    { invoiceNumber: 'INV-B', dueDate: null, invoiceDate: new Date('2026-01-01') },
    { invoiceNumber: 'INV-A', dueDate: new Date('2026-02-01'), invoiceDate: new Date('2026-01-01') }
  ]);

  assert.equal(sorted[0].invoiceNumber, 'INV-A');
  assert.equal(sorted[1].invoiceNumber, 'INV-B');
});

test('buildAutoApplyPlan applies oldest due first until payment exhausted', () => {
  const plan = buildAutoApplyPlan({
    paymentAmount: 150,
    paymentCurrency: 'USD',
    invoices: [
      { invoiceId: 'inv-2', dueDate: new Date('2026-03-01'), amountDue: 100, currency: 'USD' },
      { invoiceId: 'inv-1', dueDate: new Date('2026-02-01'), amountDue: 80, currency: 'USD' },
      { invoiceId: 'inv-3', dueDate: new Date('2026-04-01'), amountDue: 50, currency: 'USD' }
    ]
  });

  assert.equal(plan.length, 2);
  assert.equal(plan[0].invoiceId, 'inv-1');
  assert.equal(plan[0].amountApplied, 80);
  assert.equal(plan[1].invoiceId, 'inv-2');
  assert.equal(plan[1].amountApplied, 70);
});

test('buildAutoApplyPlan skips cross-currency invoices', () => {
  const plan = buildAutoApplyPlan({
    paymentAmount: 100,
    paymentCurrency: 'USD',
    invoices: [{ invoiceId: 'inv-eur', dueDate: new Date('2026-02-01'), amountDue: 100, currency: 'EUR' }]
  });

  assert.equal(plan.length, 0);
});
