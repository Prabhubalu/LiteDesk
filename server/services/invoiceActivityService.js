const RecordActivity = require('../models/RecordActivity');

async function writeInvoiceActivity({
  organizationId,
  invoiceId,
  userId,
  action,
  message = '',
  details = {}
}) {
  try {
    if (!organizationId || !invoiceId) return;
    await RecordActivity.create({
      organizationId,
      moduleKey: 'invoices',
      recordId: invoiceId,
      type: 'activity',
      action: action || 'updated',
      message: message || '',
      details: details || {},
      author: userId || null
    });
  } catch (e) {
    console.warn('[InvoiceActivity] failed to write activity:', e?.message || e);
  }
}

module.exports = {
  writeInvoiceActivity
};
