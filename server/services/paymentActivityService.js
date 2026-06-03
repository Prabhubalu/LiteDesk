const RecordActivity = require('../models/RecordActivity');

async function writePaymentActivity({
  organizationId,
  paymentId,
  userId,
  action,
  message = '',
  details = {}
}) {
  try {
    if (!organizationId || !paymentId) return;
    await RecordActivity.create({
      organizationId,
      moduleKey: 'payments',
      recordId: paymentId,
      type: 'activity',
      action: action || 'updated',
      message: message || '',
      details: details || {},
      author: userId || null
    });
  } catch (e) {
    console.warn('[PaymentActivity] failed to write activity:', e?.message || e);
  }
}

module.exports = {
  writePaymentActivity
};
