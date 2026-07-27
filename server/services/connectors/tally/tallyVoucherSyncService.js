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
const creditNoteVoucherMapper = require('./mappers/creditNoteVoucherMapper');
const debitNoteVoucherMapper = require('./mappers/debitNoteVoucherMapper');
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
  arivuRecord = null,
}) {
  const { prepareOutboundPayload, normalizeOutboxOperation } = require('./engines/ruleOverlayService');
  const prepared = await prepareOutboundPayload({
    organizationId,
    companyGuid,
    entityType,
    arivuRecord,
    tallyPayload: payload,
  });
  const finalPayload = {
    ...prepared.payload,
    _atip: {
      ruleCount: prepared.ruleCount || 0,
      taxRuleCount: prepared.taxRuleCount || 0,
      source: prepared.source,
    },
  };
  const normalizedOp = normalizeOutboxOperation(operation);

  if (dryRun) {
    return {
      dryRun: true,
      entityType,
      arivuId,
      operation: normalizedOp,
      payload: finalPayload,
    };
  }

  const outbox = await connectorOutboxService.enqueueOutbox({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    arivuId,
    operation: normalizedOp,
    companyGuid,
    payload: finalPayload,
    idempotencyKey,
    metadata: { source: 'tallyVoucherSyncService', atip: finalPayload._atip },
  });

  return {
    dryRun: false,
    entityType,
    arivuId,
    operation: normalizedOp,
    outboxId: String(outbox._id),
    payload: finalPayload,
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

async function pushCreditNote({
  organizationId,
  invoiceId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
  partyLedgerName = null,
} = {}) {
  if (!organizationId || !invoiceId) throw new Error('organizationId and invoiceId required');
  const invoice = await Invoice.findOne({ _id: invoiceId, organizationId }).lean();
  if (!invoice) throw new Error('Invoice not found');
  const lines = await InvoiceLine.find({ organizationId, invoiceId }).lean();
  let resolvedParty = partyLedgerName;
  if (!resolvedParty && invoice.organizationRefId) {
    const party = await Organization.findById(invoice.organizationRefId).select('name').lean();
    resolvedParty = party?.name || null;
  }
  const payload = creditNoteVoucherMapper.toTally(invoice, lines, { partyLedgerName: resolvedParty });
  const operation = cancel ? 'cancel' : 'push';
  const result = await enqueueVoucher({
    organizationId,
    entityType: 'credit_note',
    arivuId: String(invoice._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    idempotencyKey: `tally:credit_note:${invoice._id}:${operation}:${payload.reference || ''}`,
  });
  if (!dryRun) await markSyncPending(Invoice, invoice);
  return result;
}

async function pushDebitNote({
  organizationId,
  invoiceId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
  partyLedgerName = null,
} = {}) {
  if (!organizationId || !invoiceId) throw new Error('organizationId and invoiceId required');
  const invoice = await Invoice.findOne({ _id: invoiceId, organizationId }).lean();
  if (!invoice) throw new Error('Invoice not found');
  const lines = await InvoiceLine.find({ organizationId, invoiceId }).lean();
  let resolvedParty = partyLedgerName;
  if (!resolvedParty && invoice.organizationRefId) {
    const party = await Organization.findById(invoice.organizationRefId).select('name').lean();
    resolvedParty = party?.name || null;
  }
  const payload = debitNoteVoucherMapper.toTally(invoice, lines, { partyLedgerName: resolvedParty });
  const operation = cancel ? 'cancel' : 'push';
  const result = await enqueueVoucher({
    organizationId,
    entityType: 'debit_note',
    arivuId: String(invoice._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    idempotencyKey: `tally:debit_note:${invoice._id}:${operation}:${payload.reference || ''}`,
  });
  if (!dryRun) await markSyncPending(Invoice, invoice);
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

async function pushSalesOrder({
  organizationId,
  salesOrderId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !salesOrderId) throw new Error('organizationId and salesOrderId required');
  const SalesOrder = require('../../../models/SalesOrder');
  const SalesOrderLine = require('../../../models/SalesOrderLine');
  const { salesOrderToTally } = require('./mappers/commercialDocMapper');

  const order = await SalesOrder.findOne({ _id: salesOrderId, organizationId, deletedAt: null }).lean();
  if (!order) throw new Error('SalesOrder not found');
  const lines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
    .sort({ lineOrder: 1 })
    .lean();
  const partyLedgerName = await resolvePartyLedgerName(order.organizationRefId || order.customerId);
  const payload = salesOrderToTally(order, lines, { partyLedgerName });
  const operation = cancel ? 'cancel' : 'upsert';
  const result = await enqueueVoucher({
    organizationId,
    entityType: 'sales_order',
    arivuId: String(order._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    arivuRecord: order,
    idempotencyKey: `tally:sales_order:${order._id}:${operation}:${payload.reference || ''}`,
  });
  if (!dryRun) await markSyncPending(SalesOrder, order);
  return result;
}

async function pushPurchaseOrder({
  organizationId,
  purchaseOrderId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !purchaseOrderId) {
    throw new Error('organizationId and purchaseOrderId required');
  }
  const { PurchaseOrder, PurchaseOrderLine } = require('../../../models/PurchaseOrder');
  const { purchaseOrderToTally } = require('./mappers/commercialDocMapper');

  const order = await PurchaseOrder.findOne({
    _id: purchaseOrderId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!order) throw new Error('PurchaseOrder not found');
  const lines = await PurchaseOrderLine.find({ organizationId, purchaseOrderId: order._id })
    .sort({ lineOrder: 1 })
    .lean();
  const partyLedgerName = await resolvePartyLedgerName(order.vendorId);
  const payload = purchaseOrderToTally(order, lines, { partyLedgerName });
  const operation = cancel ? 'cancel' : 'upsert';
  const result = await enqueueVoucher({
    organizationId,
    entityType: 'purchase_order',
    arivuId: String(order._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    arivuRecord: order,
    idempotencyKey: `tally:purchase_order:${order._id}:${operation}:${payload.reference || ''}`,
  });
  if (!dryRun) await markSyncPending(PurchaseOrder, order);
  return result;
}

async function pushDeliveryNote({
  organizationId,
  deliveryNoteId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !deliveryNoteId) {
    throw new Error('organizationId and deliveryNoteId required');
  }
  const fulfillmentDocs = require('../../fulfillmentDocsService');
  const { DeliveryNote, DeliveryNoteLine } = fulfillmentDocs;
  const { deliveryNoteToTally } = require('./mappers/commercialDocMapper');

  const note = await DeliveryNote.findOne({ _id: deliveryNoteId, organizationId, deletedAt: null }).lean();
  if (!note) throw new Error('DeliveryNote not found');
  const lines = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: note._id }).lean();
  const partyLedgerName = await resolvePartyLedgerName(note.organizationRefId || note.customerId);
  const payload = deliveryNoteToTally(note, lines, { partyLedgerName });
  const operation = cancel ? 'cancel' : 'upsert';
  return enqueueVoucher({
    organizationId,
    entityType: 'delivery_note',
    arivuId: String(note._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    arivuRecord: note,
    idempotencyKey: `tally:delivery_note:${note._id}:${operation}:${payload.reference || ''}`,
  });
}

async function pushReceiptNote({
  organizationId,
  receiptNoteId,
  companyGuid = null,
  dryRun = false,
  cancel = false,
} = {}) {
  if (!organizationId || !receiptNoteId) {
    throw new Error('organizationId and receiptNoteId required');
  }
  const { ReceiptNote, ReceiptNoteLine } = require('../../../models/ReceiptNote');
  const { receiptNoteToTally } = require('./mappers/commercialDocMapper');
  const note = await ReceiptNote.findOne({
    _id: receiptNoteId,
    organizationId,
    deletedAt: null,
  }).lean();
  if (!note) throw new Error('ReceiptNote not found');
  const lines = await ReceiptNoteLine.find({ organizationId, receiptNoteId: note._id }).lean();
  const partyLedgerName = await resolvePartyLedgerName(note.vendorId);
  const payload = receiptNoteToTally(note, lines, { partyLedgerName });
  const operation = cancel ? 'cancel' : 'upsert';
  const result = await enqueueVoucher({
    organizationId,
    entityType: 'receipt_note',
    arivuId: String(note._id),
    operation,
    payload: cancel ? { ...payload, cancelOnly: true } : payload,
    companyGuid,
    dryRun,
    arivuRecord: note,
    idempotencyKey: `tally:receipt_note:${note._id}:${operation}:${payload.reference || ''}`,
  });
  if (!dryRun) await markSyncPending(ReceiptNote, note);
  return result;
}

module.exports = {
  pushInvoice,
  pushPurchaseBill,
  pushPayment,
  pushVendorPayment,
  pushJournal,
  pushContra,
  pushCreditNote,
  pushDebitNote,
  pushSalesOrder,
  pushPurchaseOrder,
  pushDeliveryNote,
  pushReceiptNote,
  linkVoucherExternal,
  enqueueVoucher,
};
