'use strict';

const { CONNECTOR_KEYS, CONNECTOR_ENTITY_TYPES } = require('../connectorConstants');
const { TALLY_DEFAULT_SETTINGS } = require('../../../constants/tallyAddonConstants');

/**
 * Thin outbox enqueue hooks for Tally connector.
 * Callers should wrap in try/catch — failures must not break core flows.
 */

async function getAutoOutboxFanOut(organizationId) {
  try {
    const tallyConnectionService = require('./tallyConnectionService');
    const connection = await tallyConnectionService.getConnection(organizationId);
    const settings = {
      ...TALLY_DEFAULT_SETTINGS,
      ...(connection?.metadata?.settings || {}),
    };
    return settings.autoOutboxFanOutToAllLinkedCompanies !== false;
  } catch {
    return TALLY_DEFAULT_SETTINGS.autoOutboxFanOutToAllLinkedCompanies !== false;
  }
}

async function resolveOutboxCompanyTargets({
  organizationId,
  entityType,
  arivuId,
  companyGuid = null,
}) {
  if (companyGuid) return [companyGuid];

  const fanOut = await getAutoOutboxFanOut(organizationId);
  if (!fanOut) return [];

  const connectorExternalObjectService = require('../connectorExternalObjectService');
  const links = await connectorExternalObjectService.findAllByArivu({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    arivuId: String(arivuId),
  });
  return [...new Set(links.map((l) => l.companyGuid).filter(Boolean))];
}

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

async function enqueueAfterItemVariantSave({
  organizationId,
  variant,
  companyGuid = null,
} = {}) {
  if (!organizationId || !variant?._id) return [];
  const results = [];
  const targets = await resolveOutboxCompanyTargets({
    organizationId,
    entityType: CONNECTOR_ENTITY_TYPES.ITEM,
    arivuId: variant._id,
    companyGuid,
  });

  // No invent: if unlinked and no companyGuid, skip (UI must select company / Sync items)
  if (!targets.length) return [];

  for (const guid of targets) {
    // eslint-disable-next-line no-await-in-loop
    const row = await enqueue({
      organizationId,
      entityType: CONNECTOR_ENTITY_TYPES.ITEM,
      arivuId: variant._id,
      operation: 'upsert',
      companyGuid: guid,
      payload: {
        variantId: String(variant._id),
        variant_code: variant.variant_code || null,
      },
      idempotencyKey: `tally:hook:item:${variant._id}:${guid}:${variant.updatedAt || Date.now()}`,
      metadata: { hook: 'enqueueAfterItemVariantSave' },
    });
    results.push(row);
  }
  return results;
}

async function enqueueAfterPartySave({
  organizationId,
  party,
  companyGuid = null,
} = {}) {
  if (!organizationId || !party?._id) return [];
  const results = [];
  const targets = await resolveOutboxCompanyTargets({
    organizationId,
    entityType: CONNECTOR_ENTITY_TYPES.PARTY,
    arivuId: party._id,
    companyGuid,
  });
  if (!targets.length) return [];

  for (const guid of targets) {
    // eslint-disable-next-line no-await-in-loop
    const row = await enqueue({
      organizationId,
      entityType: CONNECTOR_ENTITY_TYPES.PARTY,
      arivuId: party._id,
      operation: 'upsert',
      companyGuid: guid,
      payload: {
        partyId: String(party._id),
        name: party.name || null,
      },
      idempotencyKey: `tally:hook:party:${party._id}:${guid}:${party.updatedAt || Date.now()}`,
      metadata: { hook: 'enqueueAfterPartySave' },
    });
    results.push(row);
  }
  return results;
}

module.exports = {
  enqueueAfterInvoicePost,
  enqueueAfterPayment,
  enqueueAfterInventoryPost,
  enqueueAfterDnConfirm,
  enqueueAfterItemVariantSave,
  enqueueAfterPartySave,
  getAutoOutboxFanOut,
};
