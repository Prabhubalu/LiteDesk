'use strict';

/**
 * Tally voucher push (Arivu → Tally).
 *
 * Alter / Delete policy (GTM cancel-only):
 * Never hard-delete synced vouchers via the connector. When an Arivu document is
 * voided/cancelled, emit a Tally Cancel (Alt+X semantics) operation only — do not
 * send Delete. This avoids Edit Log noise and orphan books entries.
 *
 * Voucher NUMBER / REFERENCE default: Arivu document number (invoiceNumber,
 * purchaseBillNumber, paymentNumber, vendorPaymentNumber) is written to Tally
 * REFERENCE (and used as voucherNumber when Tally numbering allows).
 */

const Invoice = require('../../../models/Invoice');
const InvoiceLine = require('../../../models/InvoiceLine');
const Payment = require('../../../models/Payment');
const Organization = require('../../../models/Organization');
const { PurchaseBill, PurchaseBillLine } = require('../../../models/PurchaseBill');
const { VendorPayment } = require('../../../models/VendorPayment');
const { CONNECTOR_KEYS, CONNECTOR_ENTITY_TYPES, CONNECTOR_DIRECTIONS } = require('../connectorConstants');
const connectorOutboxService = require('../connectorOutboxService');
const connectorExternalObjectService = require('../connectorExternalObjectService');
const salesVoucherMapper = require('./mappers/salesVoucherMapper');
const purchaseVoucherMapper = require('./mappers/purchaseVoucherMapper');
const receiptVoucherMapper = require('./mappers/receiptVoucherMapper');
const paymentVoucherMapper = require('./mappers/paymentVoucherMapper');
const { mapJournalToTallyPayload } = require('./mappers/journalVoucherMapper');
const { mapContraToTallyPayload } = require('./mappers/contraVoucherMapper');
const JournalEntry = require('../../../models/JournalEntry');
const ContraEntry = require('../../../models/ContraEntry');

async function markSyncPending(Model, doc) {
  if (!doc || !Model) return;
  const id = doc._id;
  await Model.updateOne(
    { _id: id },
    { $set: { syncStatus: 'pending', lastSyncAt: new Date() } }
  );
}

async function enqueueVoucher({
  organizationId,
  entityType,
  arivuId,
  operation,
  payload,
  companyGuid = null,
  dryRun = false,
  idempotencyKey = null,
}) {
  if (dryRun) {
    return { dryRun: true, entityType, arivuId, operation, payload };
  }

  const outbox = await connectorOutboxService.enqueueOutbox({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    arivuId,
    operation,
    companyGuid,
    payload,
    idempotencyKey,
    metadata: { source: 'tallyVoucherSyncService' },
  });

  return {
    dryRun: false,
    entityType,
    arivuId,
    operation,
    outboxId: String(outbox._id),
    payload,
  };
}

async function resolvePartyLedgerName(partyId) {
  if (!partyId) return null;
  const org = await Organization.findById(partyId).select('name').lean();
  return org?.name || null;
}

async function pushInvoice({
  organizationId,
  invoiceId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !invoiceId) throw new Error('organizationId and invoiceId required');

  const invoice = await Invoice.findOne({
    _id: invoiceId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!invoice) throw new Error('Invoice not found');

  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
    .sort({ lineOrder: 1 })
    .lean();

  const partyLedgerName = await resolvePartyLedgerName(invoice.organizationRefId);
  const payload = salesVoucherMapper.toTally(invoice, lines, { partyLedgerName });

  const operation = cancel ? 'cancel' : 'push';
  const result = await enqueueVoucher({
    organizationId,
    entityType: CONNECTOR_ENTITY_TYPES.INVOICE,
    arivuId: String(invoice._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    idempotencyKey: `tally:invoice:${invoice._id}:${operation}:${payload.reference || ''}`,
  });

  if (!dryRun) await markSyncPending(Invoice, invoice);
  return result;
}

async function pushPurchaseBill({
  organizationId,
  purchaseBillId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !purchaseBillId) {
    throw new Error('organizationId and purchaseBillId required');
  }

  const bill = await PurchaseBill.findOne({
    _id: purchaseBillId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!bill) throw new Error('PurchaseBill not found');

  const lines = await PurchaseBillLine.find({
    organizationId,
    purchaseBillId: bill._id,
  })
    .sort({ lineOrder: 1 })
    .lean();

  const partyLedgerName = await resolvePartyLedgerName(bill.vendorId);
  const payload = purchaseVoucherMapper.toTally(bill, lines, { partyLedgerName });
  const operation = cancel ? 'cancel' : 'push';

  const result = await enqueueVoucher({
    organizationId,
    entityType: 'purchase_bill',
    arivuId: String(bill._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    idempotencyKey: `tally:purchase_bill:${bill._id}:${operation}:${payload.reference || ''}`,
  });

  if (!dryRun) await markSyncPending(PurchaseBill, bill);
  return result;
}

async function pushPayment({
  organizationId,
  paymentId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !paymentId) throw new Error('organizationId and paymentId required');

  const payment = await Payment.findOne({
    _id: paymentId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!payment) throw new Error('Payment not found');

  const partyLedgerName = await resolvePartyLedgerName(payment.organizationRefId);
  const payload = receiptVoucherMapper.toTally(payment, { partyLedgerName });
  const operation = cancel ? 'cancel' : 'push';

  const result = await enqueueVoucher({
    organizationId,
    entityType: CONNECTOR_ENTITY_TYPES.PAYMENT,
    arivuId: String(payment._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    idempotencyKey: `tally:payment:${payment._id}:${operation}:${payload.reference || ''}`,
  });

  if (!dryRun) await markSyncPending(Payment, payment);
  return result;
}

async function pushVendorPayment({
  organizationId,
  vendorPaymentId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !vendorPaymentId) {
    throw new Error('organizationId and vendorPaymentId required');
  }

  const vendorPayment = await VendorPayment.findOne({
    _id: vendorPaymentId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!vendorPayment) throw new Error('VendorPayment not found');

  const partyLedgerName = await resolvePartyLedgerName(vendorPayment.vendorId);
  const payload = paymentVoucherMapper.toTally(vendorPayment, { partyLedgerName });
  const operation = cancel ? 'cancel' : 'push';

  const result = await enqueueVoucher({
    organizationId,
    entityType: 'vendor_payment',
    arivuId: String(vendorPayment._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    idempotencyKey: `tally:vendor_payment:${vendorPayment._id}:${operation}:${payload.reference || ''}`,
  });

  if (!dryRun) await markSyncPending(VendorPayment, vendorPayment);
  return result;
}

async function pushJournal({
  organizationId,
  journalEntryId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !journalEntryId) {
    throw new Error('organizationId and journalEntryId required');
  }
  const journal = await JournalEntry.findOne({
    _id: journalEntryId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!journal) throw new Error('JournalEntry not found');

  const payload = mapJournalToTallyPayload(journal);
  const operation = cancel ? 'cancel' : 'push';
  const result = await enqueueVoucher({
    organizationId,
    entityType: 'journal_voucher',
    arivuId: String(journal._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    idempotencyKey: `tally:journal:${journal._id}:${operation}:${payload.reference || ''}`,
  });
  if (!dryRun) await markSyncPending(JournalEntry, journal);
  return result;
}

async function pushContra({
  organizationId,
  contraEntryId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !contraEntryId) {
    throw new Error('organizationId and contraEntryId required');
  }
  const contra = await ContraEntry.findOne({
    _id: contraEntryId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!contra) throw new Error('ContraEntry not found');

  const payload = mapContraToTallyPayload(contra);
  const operation = cancel ? 'cancel' : 'push';
  const result = await enqueueVoucher({
    organizationId,
    entityType: 'contra_voucher',
    arivuId: String(contra._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    idempotencyKey: `tally:contra:${contra._id}:${operation}:${payload.reference || ''}`,
  });
  if (!dryRun) await markSyncPending(ContraEntry, contra);
  return result;
}

/**
 * After agent ack: store Tally MASTERID on Arivu sync triad.
 */
async function linkVoucherExternal({
  organizationId,
  entityType,
  arivuId,
  externalId,
  companyGuid = null,
  Model = null,
}) {
  await connectorExternalObjectService.upsertLink({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    externalId: String(externalId),
    arivuId: String(arivuId),
    companyGuid,
    lastDirection: CONNECTOR_DIRECTIONS.OUTBOUND,
  });

  if (Model) {
    await Model.updateOne(
      { _id: arivuId, organizationId },
      {
        $set: {
          externalReferenceId: String(externalId),
          syncStatus: 'synced',
          lastSyncAt: new Date(),
        },
      }
    );
  }
}

module.exports = {
  pushInvoice,
  pushPurchaseBill,
  pushPayment,
  pushVendorPayment,
  pushJournal,
  pushContra,
  linkVoucherExternal,
  enqueueVoucher,
};
