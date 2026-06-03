const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStatementSummary,
  computeRunningBalances,
  renderStatementCsv
} = require('../../services/customerStatementService');
const { roundMoney } = require('../../constants/paymentLifecycle');

test('computeRunningBalances tracks debits and credits', () => {
  const lines = computeRunningBalances([
    { date: '2026-01-01', type: 'invoice', debit: 1000, credit: 0 },
    { date: '2026-01-15', type: 'payment_allocation', debit: 0, credit: 400 },
    { date: '2026-02-01', type: 'customer_credit_application', debit: 0, credit: 100 }
  ]);

  assert.equal(lines[0].runningBalance, 1000);
  assert.equal(lines[1].runningBalance, 600);
  assert.equal(lines[2].runningBalance, 500);
});

test('buildStatementSummary closing balance', () => {
  const summary = buildStatementSummary([
    { date: '2026-01-01', type: 'invoice', debit: 500, credit: 0 },
    { date: '2026-01-10', type: 'payment_allocation', debit: 0, credit: 500 }
  ]);

  assert.equal(summary.closingBalance, 0);
  assert.equal(summary.totalDebits, 500);
  assert.equal(summary.totalCredits, 500);
});

test('renderStatementCsv includes header and rows', () => {
  const csv = renderStatementCsv({
    lines: [
      {
        date: new Date('2026-01-01'),
        type: 'invoice',
        reference: 'INV-0001',
        description: 'Test',
        debit: 100,
        credit: 0,
        runningBalance: 100
      }
    ]
  });

  assert.match(csv, /^Date,Type,Reference/);
  assert.match(csv, /INV-0001/);
  assert.match(csv, /100\.00/);
});

test('roundMoney used in statement math', () => {
  assert.equal(roundMoney(10.005), 10.01);
});
