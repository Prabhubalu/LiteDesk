/**
 * Sales Orders module activity UI labels.
 */

const SALES_ORDER_ACTIVITY_MESSAGES = {
  sales_order_created: 'Created this sales order',
  sales_order_converted_from_quote: 'Converted from quote',
  sales_order_status_changed: 'Changed sales order status',
  sales_order_line_added: 'Added a line',
  sales_order_line_updated: 'Updated a line',
  sales_order_line_deleted: 'Removed a line',
  sales_order_section_created: 'Added a section',
  sales_order_section_updated: 'Updated a section',
  sales_order_section_deleted: 'Removed a section',
  sales_order_fulfillment_posted: 'Posted fulfillment',
  fulfillment_reversed: 'Reversed fulfillment',
  shipment_reversed: 'Reversed shipment',
  delivery_reversed: 'Reversed delivery',
  sales_order_line_section_moved: 'Moved line to another section',
  sales_order_split: 'Split sales order',
  sales_order_merged: 'Merged sales orders',
  sales_order_invoiced: 'Sales order invoiced',
  sales_order_invoice_voided: 'Invoice voided on sales order'
};

export function getSalesOrderActivityMessage(event) {
  if (!event) return null;
  const action = String(event?.action || event?.payload?.action || '').trim();
  const msg = String(event?.message ?? event?.payload?.message ?? '').trim();
  if (msg && !SALES_ORDER_ACTIVITY_MESSAGES[action]) return msg;
  if (SALES_ORDER_ACTIVITY_MESSAGES[action]) return SALES_ORDER_ACTIVITY_MESSAGES[action];
  if (action === 'sales_order_status_changed') {
    const d = event?.details || event?.payload?.details || {};
    const from = d.fromStatus ?? d.from;
    const to = d.toStatus ?? d.to;
    if (from && to) return `Status changed: ${from} → ${to}`;
  }
  if (action === 'sales_order_invoiced') {
    const d = event?.details || event?.payload?.details || {};
    const invoiceNumber = d.invoiceNumber;
    const salesOrderNumber = d.salesOrderNumber;
    const qty = d.allocatedQty ?? d.quantityAllocated;
    const amount = d.allocatedAmount;
    if (invoiceNumber && salesOrderNumber) {
      return `Invoiced ${invoiceNumber} on ${salesOrderNumber}${qty != null ? ` · qty ${qty}` : ''}${amount != null ? ` · ${amount}` : ''}`;
    }
  }
  return null;
}
