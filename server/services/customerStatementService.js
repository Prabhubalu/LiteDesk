/**
 * Customer Statement — AR activity report per account + currency.
 */

const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const CustomerCreditApplication = require('../models/CustomerCreditApplication');
const { roundMoney } = require('../constants/paymentLifecycle');

const POSTED_INVOICE_STATUSES = ['Posted', 'Partially Paid', 'Paid', 'Written Off', 'Void'];

function parseDate(value, fallback = null) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function lineSortKey(line) {
  return `${new Date(line.date || 0).getTime()}-${line.type}-${line.reference || ''}`;
}

function computeRunningBalances(lines) {
  let running = 0;
  return lines.map((line) => {
    const debit = roundMoney(line.debit);
    const credit = roundMoney(line.credit);
    running = roundMoney(running + debit - credit);
    return { ...line, debit, credit, runningBalance: running };
  });
}

function buildStatementSummary(lines) {
  const withBalances = computeRunningBalances(lines);
  const totalDebits = roundMoney(withBalances.reduce((s, l) => s + l.debit, 0));
  const totalCredits = roundMoney(withBalances.reduce((s, l) => s + l.credit, 0));
  const closingBalance =
    withBalances.length > 0
      ? withBalances[withBalances.length - 1].runningBalance
      : 0;

  return {
    lines: withBalances,
    totalDebits,
    totalCredits,
    closingBalance
  };
}

async function fetchCustomerStatement({
  organizationId,
  organizationRefId,
  currency = 'USD',
  fromDate = null,
  toDate = null
}) {
  if (!organizationId || !organizationRefId) {
    const err = new Error('organizationId and organizationRefId are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const currencyCode = String(currency || 'USD').trim();
  const from = parseDate(fromDate, new Date(0));
  const to = parseDate(toDate, new Date());

  const invoiceFilter = {
    organizationId,
    organizationRefId,
    currency: currencyCode,
    deletedAt: null,
    status: { $in: POSTED_INVOICE_STATUSES.filter((s) => s !== 'Void') }
  };

  const invoices = await Invoice.find(invoiceFilter).lean();
  const invoiceMongoIds = invoices.map((row) => row._id);

  const lines = [];

  for (const invoice of invoices) {
    if (String(invoice.invoiceType || 'standard') === 'credit_note') continue;

    const postedAt = invoice.postedAt || invoice.invoiceDate || invoice.createdAt;
    const postedDate = new Date(postedAt);
    if (postedDate < from || postedDate > to) continue;

    lines.push({
      date: postedDate,
      type: 'invoice',
      reference: invoice.invoiceNumber,
      description: invoice.invoiceTitle || 'Invoice',
      publicId: invoice.invoiceId,
      debit: roundMoney(invoice.grandTotal),
      credit: 0,
      meta: { invoiceMongoId: invoice._id }
    });
  }

  const creditNotes = await Invoice.find({
    organizationId,
    organizationRefId,
    currency: currencyCode,
    invoiceType: 'credit_note',
    deletedAt: null,
    status: { $in: ['Posted', 'Paid'] }
  }).lean();

  for (const note of creditNotes) {
    const postedAt = note.postedAt || note.invoiceDate || note.createdAt;
    const postedDate = new Date(postedAt);
    if (postedDate < from || postedDate > to) continue;

    lines.push({
      date: postedDate,
      type: 'credit_note',
      reference: note.invoiceNumber,
      description: note.invoiceTitle || 'Credit note',
      publicId: note.invoiceId,
      debit: 0,
      credit: roundMoney(Math.abs(note.grandTotal)),
      meta: { sourceInvoiceId: note.sourceInvoiceId || null }
    });
  }

  const allocations = await PaymentAllocation.find({
    organizationId,
    invoiceMongoId: { $in: invoiceMongoIds },
    status: 'active'
  }).lean();

  const paymentIds = [...new Set(allocations.map((row) => row.paymentMongoId))];
  const payments = paymentIds.length
    ? await Payment.find({ organizationId, _id: { $in: paymentIds } }).lean()
    : [];
  const paymentById = new Map(payments.map((row) => [String(row._id), row]));

  for (const row of allocations) {
    const appliedDate = new Date(row.appliedAt || row.createdAt);
    if (appliedDate < from || appliedDate > to) continue;

    const payment = paymentById.get(String(row.paymentMongoId));
    const invoice = invoices.find((inv) => String(inv._id) === String(row.invoiceMongoId));

    lines.push({
      date: appliedDate,
      type: 'payment_allocation',
      reference: payment?.paymentNumber || row.paymentId,
      description: `Payment applied${invoice?.invoiceNumber ? ` — ${invoice.invoiceNumber}` : ''}`,
      publicId: row.paymentAllocationId,
      debit: 0,
      credit: roundMoney(row.amountApplied),
      meta: {
        paymentId: row.paymentId,
        invoiceId: row.invoiceId,
        invoiceNumber: invoice?.invoiceNumber || null
      }
    });
  }

  const creditApplications = await CustomerCreditApplication.find({
    organizationId,
    invoiceMongoId: { $in: invoiceMongoIds },
    status: 'active'
  }).lean();

  for (const row of creditApplications) {
    const appliedDate = new Date(row.appliedAt || row.createdAt);
    if (appliedDate < from || appliedDate > to) continue;

    const invoice = invoices.find((inv) => String(inv._id) === String(row.invoiceMongoId));

    lines.push({
      date: appliedDate,
      type: 'customer_credit_application',
      reference: row.customerCreditApplicationId,
      description: `Customer credit applied${invoice?.invoiceNumber ? ` — ${invoice.invoiceNumber}` : ''}`,
      publicId: row.customerCreditApplicationId,
      debit: 0,
      credit: roundMoney(row.amountApplied),
      meta: {
        customerCreditBalanceId: row.customerCreditBalanceId,
        invoiceId: row.invoiceId
      }
    });
  }

  lines.sort((a, b) => lineSortKey(a).localeCompare(lineSortKey(b)));

  const summary = buildStatementSummary(lines);

  return {
    organizationRefId,
    currency: currencyCode,
    fromDate: from,
    toDate: to,
    generatedAt: new Date(),
    ...summary
  };
}

function renderStatementCsv(statement) {
  const header = ['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Running Balance'];
  const rows = (statement.lines || []).map((line) => [
    line.date ? new Date(line.date).toISOString().slice(0, 10) : '',
    line.type,
    line.reference || '',
    (line.description || '').replace(/"/g, '""'),
    line.debit.toFixed(2),
    line.credit.toFixed(2),
    line.runningBalance.toFixed(2)
  ]);

  const escape = (cell) => {
    const s = String(cell ?? '');
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

function renderStatementPdf(statement, { accountName = 'Customer' } = {}) {
  const PDFDocument = require('pdfkit');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text('Customer Statement', { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Account: ${accountName}`);
    doc.text(`Currency: ${statement.currency || 'USD'}`);
    doc.text(
      `Period: ${new Date(statement.fromDate).toLocaleDateString()} — ${new Date(statement.toDate).toLocaleDateString()}`
    );
    doc.text(`Generated: ${new Date(statement.generatedAt || Date.now()).toLocaleString()}`);
    doc.moveDown(1);

    const colDate = 50;
    const colType = 110;
    const colRef = 200;
    const colDebit = 380;
    const colCredit = 440;
    const colBal = 500;

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Date', colDate, doc.y, { width: 55 });
    doc.text('Type', colType, doc.y - doc.currentLineHeight(), { width: 85 });
    doc.text('Reference', colRef, doc.y - doc.currentLineHeight(), { width: 170 });
    doc.text('Debit', colDebit, doc.y - doc.currentLineHeight(), { width: 50, align: 'right' });
    doc.text('Credit', colCredit, doc.y - doc.currentLineHeight(), { width: 50, align: 'right' });
    doc.text('Balance', colBal, doc.y - doc.currentLineHeight(), { width: 50, align: 'right' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(8);
    for (const line of statement.lines || []) {
      if (doc.y > 750) {
        doc.addPage();
      }
      const y = doc.y;
      doc.text(line.date ? new Date(line.date).toLocaleDateString() : '', colDate, y, { width: 55 });
      doc.text(String(line.type || '').replace(/_/g, ' '), colType, y, { width: 85 });
      doc.text(String(line.reference || ''), colRef, y, { width: 170 });
      doc.text(line.debit ? line.debit.toFixed(2) : '', colDebit, y, { width: 50, align: 'right' });
      doc.text(line.credit ? line.credit.toFixed(2) : '', colCredit, y, { width: 50, align: 'right' });
      doc.text(line.runningBalance.toFixed(2), colBal, y, { width: 50, align: 'right' });
      doc.moveDown(0.9);
    }

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Closing balance: ${roundMoney(statement.closingBalance).toFixed(2)}`, { align: 'right' });

    doc.end();
  });
}

async function writeCustomerStatementActivity({
  organizationId,
  organizationRefId,
  userId,
  format,
  statement
}) {
  const RecordActivity = require('../models/RecordActivity');
  try {
    await RecordActivity.create({
      organizationId,
      moduleKey: 'payments',
      recordId: String(organizationRefId),
      type: 'activity',
      action: 'customer_statement_generated',
      message: `Customer statement generated (${format})`,
      details: {
        format,
        organizationRefId: String(organizationRefId),
        currency: statement.currency,
        fromDate: statement.fromDate,
        toDate: statement.toDate,
        closingBalance: statement.closingBalance,
        lineCount: (statement.lines || []).length
      },
      author: userId || null
    });
  } catch (e) {
    console.warn('[CustomerStatement] activity write failed:', e?.message || e);
  }
}

module.exports = {
  computeRunningBalances,
  buildStatementSummary,
  fetchCustomerStatement,
  renderStatementCsv,
  renderStatementPdf,
  writeCustomerStatementActivity
};
