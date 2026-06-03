const RecordActivity = require('../models/RecordActivity');

async function writeSalesOrderActivity({
  organizationId,
  salesOrderId,
  userId,
  action,
  message = '',
  details = {}
}) {
  try {
    if (!organizationId || !salesOrderId) return;
    await RecordActivity.create({
      organizationId,
      moduleKey: 'sales_orders',
      recordId: salesOrderId,
      type: 'activity',
      action: action || 'updated',
      message: message || '',
      details: details || {},
      author: userId || null
    });
  } catch (e) {
    console.warn('[SalesOrderActivity] failed to write activity:', e?.message || e);
  }
}

module.exports = {
  writeSalesOrderActivity
};
