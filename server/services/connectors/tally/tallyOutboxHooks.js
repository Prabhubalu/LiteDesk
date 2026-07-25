'use strict';

const { CONNECTOR_KEYS, CONNECTOR_ENTITY_TYPES } = require('../connectorConstants');

/**
 * Thin outbox enqueue hooks for Tally connector.
 * Callers should wrap in try/catch — failures must not break core flows.
 */

async function enqueue({
  organizationId,
  entityType,
  arivuId,
  operation,
  payload = {},
  companyGuid = null,
  idempotencyKey = null,
  metadata = {},
}) {
  const connectorOutboxService = require('../connectorOutboxService');
  return connectorOutboxService.enqueueOutbox({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    arivuId: String(arivuId),
    operation,
    payload,
    companyGuid,
    idempotencyKey,
    metadata: { ...metadata, source: 'tallyOutboxHooks' },
  });
}

async function enqueueAfterInvoicePost({
  organizationId,
  invoice,
  companyGuid = null,
} = {}) {
  if (!organizationId || !invoice?._id) return null;
  return enqueue({
    organizationId,
    entityType: CONNECTOR_ENTITY_TYPES.INVOICE,
    arivuId: invoice._id,
    operation: 'push',
    companyGuid,
    payload: {
      invoiceId: invoice.invoiceId || null,
      invoiceNumber: invoice.invoiceNumber || null,
      invoiceType: invoice.invoiceType || null,
      grandTotal: invoice.grandTotal,
      partyGstin: invoice.partyGstin || null,
      irn: invoice.irn || null,
    },
    idempotencyKey: `tally:hook:invoice:${invoice._id}:post`,
    metadata: { hook: 'enqueueAfterInvoicePost' },
  });
}

async function enqueueAfterPayment({
  organizationId,
  payment,
  companyGuid = null,
} = {}) {
  if (!organizationId || !payment?._id) return null;
  return enqueue({
    organizationId,
    entityType: CONNECTOR_ENTITY_TYPES.PAYMENT,
    arivuId: payment._id,
    operation: 'push',
    companyGuid,
    payload: {
      paymentId: payment.paymentId || null,
      paymentNumber: payment.paymentNumber || null,
      amount: payment.amount,
    },
    idempotencyKey: `tally:hook:payment:${payment._id}:record`,
    metadata: { hook: 'enqueueAfterPayment' },
  });
}

async function enqueueAfterInventoryPost({
  organizationId,
  transaction,
  companyGuid = null,
} = {}) {
  if (!organizationId || !transaction) return null;
  const arivuId =
    transaction._id ||
    transaction.inventoryTransactionId ||
    null;
  if (!arivuId) return null;

  return enqueue({
    organizationId,
    entityType: CONNECTOR_ENTITY_TYPES.STOCK,
    arivuId,
    operation: 'push',
    companyGuid,
    payload: {
      inventoryTransactionId: transaction.inventoryTransactionId || null,
      transactionType: transaction.transactionType || null,
    },
    idempotencyKey: `tally:hook:inventory:${arivuId}:post`,
    metadata: { hook: 'enqueueAfterInventoryPost' },
  });
}

async function enqueueAfterDnConfirm({
  organizationId,
  deliveryNote,
  companyGuid = null,
} = {}) {
  if (!organizationId || !deliveryNote?._id) return null;
  return enqueue({
    organizationId,
    entityType: 'delivery_note',
    arivuId: deliveryNote._id,
    operation: 'push',
    companyGuid,
    payload: {
      deliveryNoteId: deliveryNote.deliveryNoteId || null,
      deliveryNoteNumber: deliveryNote.deliveryNoteNumber || null,
      status: deliveryNote.status || null,
      salesOrderId: deliveryNote.salesOrderId || null,
    },
    idempotencyKey: `tally:hook:dn:${deliveryNote._id}:confirm`,
    metadata: { hook: 'enqueueAfterDnConfirm' },
  });
}

module.exports = {
  enqueueAfterInvoicePost,
  enqueueAfterPayment,
  enqueueAfterInventoryPost,
  enqueueAfterDnConfirm,
};
