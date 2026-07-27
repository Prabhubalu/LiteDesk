'use strict';

/**
 * Commercial document mappers: Sales Order, Purchase Order, Delivery Note, Receipt Note.
 */

function formatTallyDate(value) {
  if (!value) return null;
  if (/^\d{8}$/.test(String(value))) return String(value);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function mapInventoryLines(lines = [], opts = {}) {
  return lines.map((line) => ({
    stockItemName: line.itemNameSnapshot || line.skuSnapshot || line.name || null,
    sku: line.skuSnapshot || null,
    quantity: Number(line.quantity ?? line.quantityReceived ?? line.quantityOrdered) || 0,
    rate: Number(line.unitPriceSnapshot ?? line.unitPrice) || 0,
    amount:
      Number(line.lineTotal) ||
      (Number(line.quantity ?? line.quantityReceived) || 0) * (Number(line.unitPriceSnapshot ?? line.unitPrice) || 0),
    unit: line.unitOfMeasure || null,
    godownName: opts.godownName || null,
    hsnSac: line.taxSnapshot?.hsnSac || null,
    arivuLineId: line._id ? String(line._id) : null,
  }));
}

function salesOrderToTally(order = {}, lines = [], opts = {}) {
  const reference = order.salesOrderNumber || order.orderNumber || null;
  const inventoryEntries = mapInventoryLines(lines, opts);
  const subtotal = Number(order.subtotal) || inventoryEntries.reduce((s, l) => s + (l.amount || 0), 0);
  return {
    voucherType: 'Sales Order',
    date: formatTallyDate(order.orderDate || order.createdAt),
    voucherNumber: reference,
    reference,
    partyLedgerName: opts.partyLedgerName || null,
    narration: order.notes || order.orderTitle || null,
    inventoryEntries,
    ledgerEntries: [
      {
        ledgerName: opts.partyLedgerName || 'Party',
        isPartyLedger: true,
        amount: -(Number(order.grandTotal) || subtotal),
      },
      {
        ledgerName: opts.salesLedgerName || 'Sales',
        isPartyLedger: false,
        amount: subtotal,
      },
    ],
    arivuId: order._id ? String(order._id) : null,
  };
}

function purchaseOrderToTally(order = {}, lines = [], opts = {}) {
  const reference = order.poNumber || order.purchaseOrderNumber || null;
  const inventoryEntries = mapInventoryLines(lines, opts);
  const subtotal = Number(order.subtotal) || inventoryEntries.reduce((s, l) => s + (l.amount || 0), 0);
  return {
    voucherType: 'Purchase Order',
    date: formatTallyDate(order.orderDate || order.poDate || order.createdAt),
    voucherNumber: reference,
    reference,
    partyLedgerName: opts.partyLedgerName || null,
    narration: order.notes || null,
    inventoryEntries,
    ledgerEntries: [
      {
        ledgerName: opts.purchaseLedgerName || 'Purchase',
        isPartyLedger: false,
        amount: subtotal,
      },
      {
        ledgerName: opts.partyLedgerName || 'Party',
        isPartyLedger: true,
        amount: -(Number(order.grandTotal) || subtotal),
      },
    ],
    arivuId: order._id ? String(order._id) : null,
  };
}

function deliveryNoteToTally(note = {}, lines = [], opts = {}) {
  const reference = note.deliveryNoteNumber || null;
  const inventoryEntries = mapInventoryLines(lines, {
    ...opts,
    godownName: opts.godownName || note.fromLocationName || null,
  });
  return {
    voucherType: 'Delivery Note',
    date: formatTallyDate(note.deliveryDate || note.dispatchedAt || note.createdAt),
    voucherNumber: reference,
    reference,
    partyLedgerName: opts.partyLedgerName || null,
    narration: note.notes || null,
    inventoryEntries,
    ledgerEntries: [],
    arivuId: note._id ? String(note._id) : null,
  };
}

function receiptNoteToTally(note = {}, lines = [], opts = {}) {
  const reference = note.receiptNoteNumber || null;
  const inventoryEntries = mapInventoryLines(lines, {
    ...opts,
    godownName: opts.godownName || note.receiptLocationName || null,
  });
  return {
    voucherType: 'Receipt Note',
    date: formatTallyDate(note.receiptDate || note.createdAt),
    voucherNumber: reference,
    reference,
    partyLedgerName: opts.partyLedgerName || null,
    narration: note.notes || note.vendorDeliveryChallanNo || null,
    inventoryEntries,
    ledgerEntries: [],
    arivuId: note._id ? String(note._id) : null,
  };
}

module.exports = {
  formatTallyDate,
  salesOrderToTally,
  purchaseOrderToTally,
  deliveryNoteToTally,
  receiptNoteToTally,
};
