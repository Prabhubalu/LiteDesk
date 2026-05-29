/**
 * Auto-expire quotes when validUntil has passed (Sent / Viewed → Expired).
 */

const {
  assertCanTransitionQuoteStatus,
  canTransitionQuoteStatus
} = require('../constants/quoteLifecycle');
const { writeQuoteActivity } = require('./quoteActivityService');
const { emitQuoteEvents } = require('./domainEventHelpers');

const QUOTE_AUTO_EXPIRE_STATUSES = ['Sent', 'Viewed'];

/**
 * First instant after the validUntil calendar day (UTC).
 * @param {Date|string|null} validUntil
 * @returns {Date|null}
 */
function getValidityExpiryInstant(validUntil) {
  if (!validUntil) return null;
  const d = new Date(validUntil);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}

/**
 * @param {object} quote
 * @param {Date} [now]
 */
function isQuoteValidityExpired(quote, now = new Date()) {
  const expiryAt = getValidityExpiryInstant(quote?.validUntil);
  if (!expiryAt) return false;
  return now.getTime() >= expiryAt.getTime();
}

function canAutoExpireQuoteStatus(status) {
  return QUOTE_AUTO_EXPIRE_STATUSES.includes(String(status || '').trim());
}

/**
 * @param {import('mongoose').Document} quoteDoc
 * @param {{ userId?: string|null, trigger?: string }} [opts]
 * @returns {Promise<{ expired: boolean, fromStatus?: string, toStatus?: string }>}
 */
async function expireQuoteIfDue(quoteDoc, { userId = null, trigger = 'system' } = {}) {
  if (!quoteDoc) return { expired: false };

  const fromStatus = String(quoteDoc.status || '').trim();
  if (!canAutoExpireQuoteStatus(fromStatus)) return { expired: false };
  if (!isQuoteValidityExpired(quoteDoc)) return { expired: false };
  if (!canTransitionQuoteStatus(fromStatus, 'Expired')) return { expired: false };

  const previousSnapshot = quoteDoc.toObject ? quoteDoc.toObject() : { ...quoteDoc };

  assertCanTransitionQuoteStatus(fromStatus, 'Expired');
  quoteDoc.status = 'Expired';
  await quoteDoc.save();

  await writeQuoteActivity({
    organizationId: quoteDoc.organizationId,
    quoteId: quoteDoc._id,
    userId: userId || null,
    action: 'quote_status_changed',
    message: `Quote expired (valid until ${quoteDoc.validUntil ? new Date(quoteDoc.validUntil).toISOString().slice(0, 10) : '—'})`,
    details: {
      fromStatus,
      toStatus: 'Expired',
      trigger,
      validUntil: quoteDoc.validUntil || null,
      automated: !userId
    }
  });

  try {
    emitQuoteEvents({
      previous: previousSnapshot,
      current: quoteDoc.toObject ? quoteDoc.toObject() : quoteDoc,
      organizationId: quoteDoc.organizationId,
      triggeredBy: userId || null
    });
  } catch (emitErr) {
    console.warn('[quoteExpiry] emitQuoteEvents failed:', emitErr?.message || emitErr);
  }

  return { expired: true, fromStatus, toStatus: 'Expired' };
}

/**
 * @param {import('mongoose').Document} quoteDoc
 */
function assertQuoteOpenForCustomerAction(quoteDoc) {
  if (!quoteDoc) {
    const err = new Error('Quote not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const status = String(quoteDoc.status || '').trim();
  if (status === 'Expired') {
    const err = new Error('This quote has expired.');
    err.code = 'QUOTE_EXPIRED';
    throw err;
  }
  if (isQuoteValidityExpired(quoteDoc)) {
    const err = new Error('This quote has expired.');
    err.code = 'QUOTE_EXPIRED';
    throw err;
  }
}

/**
 * Days until validUntil end (negative if past). Null when no validUntil.
 */
function daysUntilQuoteValidityEnds(quote, now = new Date()) {
  const expiryAt = getValidityExpiryInstant(quote?.validUntil);
  if (!expiryAt) return null;
  const ms = expiryAt.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

module.exports = {
  QUOTE_AUTO_EXPIRE_STATUSES,
  getValidityExpiryInstant,
  isQuoteValidityExpired,
  canAutoExpireQuoteStatus,
  expireQuoteIfDue,
  assertQuoteOpenForCustomerAction,
  daysUntilQuoteValidityEnds
};
