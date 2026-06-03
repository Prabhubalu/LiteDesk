/**
 * INV0 — Inventory activity audit mirror.
 */

const RecordActivity = require('../models/RecordActivity');

async function writeInventoryActivity({
  organizationId,
  recordId,
  userId,
  action,
  message = '',
  details = {}
}) {
  try {
    if (!organizationId || !recordId) return;
    await RecordActivity.create({
      organizationId,
      moduleKey: 'inventory',
      recordId: String(recordId),
      type: 'activity',
      action: action || 'updated',
      message: message || '',
      details: details || {},
      author: userId || null
    });
  } catch (e) {
    console.warn('[InventoryActivity] failed to write activity:', e?.message || e);
  }
}

module.exports = {
  writeInventoryActivity
};
