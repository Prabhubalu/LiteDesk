/**
 * Prevent dual stock-out when both Delivery Note and SO fulfillment deduct the same SO line.
 */

const InventoryLedgerEntry = require('../models/InventoryLedgerEntry');

function dualIssueError(message) {
  const err = new Error(message);
  err.code = 'DUAL_STOCK_ISSUE';
  return err;
}

/**
 * Block SO fulfillment deduct if a dispatched Delivery Note already issued this SO line.
 */
async function assertNoDeliveryNoteIssueForSoLine({ organizationId, salesOrderLineId }) {
  const { DeliveryNoteLine } = require('./fulfillmentDocsService');
  const dnLines = await DeliveryNoteLine.find({
    organizationId,
    salesOrderLineId
  })
    .select('_id deliveryNoteId')
    .lean();

  if (!dnLines.length) return;

  const dnIds = [...new Set(dnLines.map((l) => String(l.deliveryNoteId)))];
  const lineIds = dnLines.map((l) => String(l._id));

  const existing = await InventoryLedgerEntry.findOne({
    organizationId,
    status: 'posted',
    entryType: 'fulfillment_deduct',
    'sourceRef.moduleKey': 'delivery_notes',
    $or: [
      { 'sourceRef.recordId': { $in: dnIds } },
      { 'sourceRef.lineId': { $in: lineIds } }
    ]
  })
    .select('_id')
    .lean();

  if (existing) {
    throw dualIssueError(
      'Stock already issued via Delivery Note for this sales order line. Use Delivery Note as the canonical stock path.'
    );
  }
}

/**
 * Block Delivery Note deduct if SO fulfillment already issued this SO line.
 */
async function assertNoFulfillmentIssueForSoLine({ organizationId, salesOrderLineId }) {
  const existing = await InventoryLedgerEntry.findOne({
    organizationId,
    status: 'posted',
    entryType: 'fulfillment_deduct',
    'sourceRef.moduleKey': 'sales_order_fulfillments',
    'sourceRef.lineId': String(salesOrderLineId)
  })
    .select('_id')
    .lean();

  if (existing) {
    throw dualIssueError(
      'Stock already issued via Sales Order fulfillment for this line. Do not confirm a Delivery Note for the same quantity.'
    );
  }
}

module.exports = {
  assertNoDeliveryNoteIssueForSoLine,
  assertNoFulfillmentIssueForSoLine
};
