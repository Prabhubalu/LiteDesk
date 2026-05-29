const RecordActivity = require('../models/RecordActivity');

async function writeQuoteActivity({
  organizationId,
  quoteId,
  userId,
  action,
  message = '',
  details = {}
}) {
  // Never allow audit logging to break core transactions.
  try {
    if (!organizationId || !quoteId) return;
    const mergedDetails = { ...(details || {}) };
    if (!userId && !mergedDetails.actorLabel) {
      mergedDetails.actorLabel = 'customer';
    }
    await RecordActivity.create({
      organizationId,
      moduleKey: 'quotes',
      recordId: quoteId,
      type: 'activity',
      action: action || 'updated',
      message: message || '',
      details: mergedDetails,
      author: userId || null
    });
  } catch (e) {
    // Swallow logging errors to keep quote writes safe.
    // (Still visible in server logs for investigation.)
    console.warn('[QuoteActivity] failed to write activity:', e?.message || e);
  }
}

module.exports = {
  writeQuoteActivity
};

