/**
 * Prevent dual stock-out when both Delivery Note and SO fulfillment deduct the same SO line.
 */

const mongoose = require('mongoose');
const InventoryLedgerEntry = require('../models/InventoryLedgerEntry');
const SalesOrderLine = require('../models/SalesOrderLine');

function dualIssueError(message) {
  const err = new Error(message);
  err.code = 'DUAL_STOCK_ISSUE';
  return err;
}

function looksLikeObjectId(value) {
  const s = String(value || '');
  return mongoose.Types.ObjectId.isValid(s) && String(new mongoose.Types.ObjectId(s)) === s;
}

/**
 * Resolve SalesOrderLine document _id from public UUID or Mongo ObjectId.
 * DeliveryNoteLine.salesOrderLineId stores Mongo ObjectId; SO fulfillment uses public UUID.
 */
async function resolveSalesOrderLineObjectId(organizationId, salesOrderLineRef) {
  if (!salesOrderLineRef) return null;
  const ref = String(salesOrderLineRef);
  if (looksLikeObjectId(ref)) {
    const byId = await SalesOrderLine.findOne({ organizationId, _id: ref }).select('_id').lean();
    if (byId) return byId._id;
  }
  const byPublic = await SalesOrderLine.findOne({ organizationId, salesOrderLineId: ref })
    .select('_id')
    .lean();
  return byPublic?._id || null;
}

/**
 * Block SO fulfillment deduct if a dispatched Delivery Note already issued this SO line.
 * @param {{ organizationId: *, salesOrderLineId: string|import('mongoose').Types.ObjectId }} args
 *   Accepts SO line public UUID or Mongo ObjectId.
 */
async function assertNoDeliveryNoteIssueForSoLine({ organizationId, salesOrderLineId }) {
  const lineObjectId = await resolveSalesOrderLineObjectId(organizationId, salesOrderLineId);
  if (!lineObjectId) return;

  const { DeliveryNoteLine } = require('../models/DeliveryNote');
  const dnLines = await DeliveryNoteLine.find({
    organizationId,
    salesOrderLineId: lineObjectId
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
 * sourceRef.lineId is stored as String(public salesOrderLineId UUID OR ObjectId).
 */
async function assertNoFulfillmentIssueForSoLine({ organizationId, salesOrderLineId }) {
  const ref = salesOrderLineId != null ? String(salesOrderLineId) : '';
  if (!ref) return;

  const orLineIds = [ref];
  if (looksLikeObjectId(ref)) {
    const soLine = await SalesOrderLine.findOne({ organizationId, _id: ref })
      .select('salesOrderLineId')
      .lean();
    if (soLine?.salesOrderLineId) orLineIds.push(String(soLine.salesOrderLineId));
  } else {
    const soLine = await SalesOrderLine.findOne({ organizationId, salesOrderLineId: ref })
      .select('_id')
      .lean();
    if (soLine?._id) orLineIds.push(String(soLine._id));
  }

  const existing = await InventoryLedgerEntry.findOne({
    organizationId,
    status: 'posted',
    entryType: 'fulfillment_deduct',
    'sourceRef.moduleKey': 'sales_order_fulfillments',
    'sourceRef.lineId': { $in: orLineIds }
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
  assertNoFulfillmentIssueForSoLine,
  resolveSalesOrderLineObjectId
};
