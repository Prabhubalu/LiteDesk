const INVOICE_ACTIVITY_MESSAGES = {
  invoice_created: 'Created this invoice',
  invoice_created_from_sales_order: 'Created from sales order',
  invoice_updated: 'Updated invoice',
  invoice_submitted_for_approval: 'Submitted for approval',
  invoice_approved: 'Approved invoice',
  invoice_rejected: 'Rejected invoice',
  invoice_posted: 'Posted invoice',
  invoice_voided: 'Voided invoice',
  invoice_line_added: 'Added a line',
  invoice_line_updated: 'Updated a line',
  invoice_line_deleted: 'Removed a line',
  invoice_section_created: 'Added a section',
  invoice_section_updated: 'Updated a section',
  invoice_section_deleted: 'Removed a section',
  credit_note_created: 'Created credit note',
  credit_note_posted: 'Posted credit note',
  invoice_credited: 'Invoice credited',
  invoice_allocation_reversed: 'Allocation reversed',
  invoice_pdf_generated: 'Invoice PDF generated',
  invoice_emailed: 'Invoice emailed',
  credit_note_pdf_generated: 'Credit note PDF generated',
  credit_note_emailed: 'Credit note emailed',
  invoice_created_from_sales_orders: 'Created from multiple sales orders',
  payment_applied: 'Payment applied',
  payment_reversed: 'Payment reversed',
  payment_refunded: 'Payment refunded',
  customer_credit_applied: 'Customer credit applied',
  customer_credit_reversed: 'Customer credit reversed'
};

export function getInvoiceActivityMessage(event) {
  if (!event) return null;
  const action = String(event?.action || event?.payload?.action || '').trim();
  const msg = String(event?.message ?? event?.payload?.message ?? '').trim();
  if (msg && !INVOICE_ACTIVITY_MESSAGES[action]) return msg;
  if (INVOICE_ACTIVITY_MESSAGES[action]) return INVOICE_ACTIVITY_MESSAGES[action];
  if (action === 'invoice_posted') {
    const d = event?.details || event?.payload?.details || {};
    if (d.invoiceNumber) return `Posted invoice ${d.invoiceNumber}`;
  }
  if (action === 'credit_note_posted') {
    const d = event?.details || event?.payload?.details || {};
    if (d.creditNoteNumber) return `Posted credit note ${d.creditNoteNumber}`;
  }
  if (action === 'invoice_credited') {
    const d = event?.details || event?.payload?.details || {};
    if (d.creditNoteNumber) return `Credit note ${d.creditNoteNumber} applied`;
  }
  return null;
}
