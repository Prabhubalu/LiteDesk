/**
 * INV1 — Sales order fulfillment → inventory transaction + reservation consume.
 */

const {
  roundQty,
  INVENTORY_FULFILLMENT_DEDUCT_TYPES
} = require('../constants/inventoryLifecycle');
const { getDefaultLocation } = require('./inventoryLocationService');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { resolveInventoryDeductionLines } = require('./inventoryLineEligibilityService');
const {
  consumeReservation,
  restoreReservationConsumption
} = require('./inventoryReservationService');
const { isInventoryEnabled } = require('./inventoryCapabilityService');
const { assertNoDeliveryNoteIssueForSoLine } = require('./inventoryStockIssueGuardService');
const { resolveInventoryLocationUuid } = require('./inventoryLocationService');

const DEDUCT_TYPES = new Set(INVENTORY_FULFILLMENT_DEDUCT_TYPES);

function shouldApplyInventoryForFulfillmentType(fulfillmentType) {
  return DEDUCT_TYPES.has(String(fulfillmentType || '').trim().toLowerCase());
}

async function applyFulfillment({
  organizationId,
  salesOrderFulfillmentId,
  salesOrderId,
  order,
  fulfillmentType,
  eventLines = [],
  inventoryLocationId = null,
  userId = null,
  isReversal = false
}) {
  if (!(await isInventoryEnabled(organizationId))) {
    return { applied: false, transactions: [], inventoryDisabled: true };
  }

  if (!shouldApplyInventoryForFulfillmentType(fulfillmentType) && !isReversal) {
    return { applied: false, transactions: [] };
  }

  const location = inventoryLocationId
    ? { inventoryLocationId: await resolveInventoryLocationUuid({ organizationId, locationRef: inventoryLocationId }) }
    : await getDefaultLocation(organizationId, userId);

  const inventoryLocation = location.inventoryLocationId;
  const expandedLines = [];

  for (const eventLine of eventLines) {
    if (!isReversal) {
      await assertNoDeliveryNoteIssueForSoLine({
        organizationId,
        salesOrderLineId: eventLine.salesOrderLineId
      });
    }
    const rows = await resolveInventoryDeductionLines({
      organizationId,
      salesOrderId,
      order,
      salesOrderLineId: eventLine.salesOrderLineId,
      quantityDelta: eventLine.quantityDelta
    });
    for (const row of rows) {
      expandedLines.push({
        ...row,
        lotId: eventLine.lotId || eventLine.inventoryLotId || null,
        serialNumbers: eventLine.serialNumbers || []
      });
    }
  }

  if (!expandedLines.length) {
    return { applied: false, transactions: [] };
  }

  const transactions = [];
  const entryType = isReversal ? 'fulfillment_restore' : 'fulfillment_deduct';

  for (const line of expandedLines) {
    const absQty = roundQty(line.quantityDelta);
    const quantityDelta = isReversal ? absQty : -absQty;

    const result = await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: isReversal ? 'return' : 'shipment',
      inventoryLocationId: inventoryLocation,
      lines: [
        {
          variantId: line.variantId,
          quantityDelta,
          entryType,
          lineId: String(line.salesOrderLineId),
          lotId: line.lotId || null,
          serialNumbers: line.serialNumbers || []
        }
      ],
      sourceContext: 'fulfillment',
      sourceRef: {
        moduleKey: 'sales_order_fulfillments',
        recordId: String(salesOrderFulfillmentId),
        lineId: String(line.salesOrderLineId)
      },
      idempotent: true
    });

    transactions.push(result);

    const ledgerEntryId = result.ledgerEntries?.[0]?.inventoryLedgerEntryId || null;

    if (isReversal) {
      await restoreReservationConsumption({
        organizationId,
        salesOrderLineId: line.salesOrderLineId,
        variantId: line.variantId,
        inventoryLocationId: inventoryLocation,
        quantity: absQty,
        userId
      });
    } else if (!result.duplicate) {
      await consumeReservation({
        organizationId,
        salesOrderLineId: line.salesOrderLineId,
        variantId: line.variantId,
        inventoryLocationId: inventoryLocation,
        quantity: absQty,
        userId,
        ledgerEntryId
      });
    }
  }

  return { applied: true, transactions };
}

module.exports = {
  shouldApplyInventoryForFulfillmentType,
  applyFulfillment
};
