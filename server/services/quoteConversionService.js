/**
 * Q8 — Quote conversion contract (stub; no Sales Order / Invoice writes).
 */

const { assertCanTransitionQuoteStatus, assertValidStatus } = require('../constants/quoteLifecycle');
const { isQuoteValidityExpired } = require('./quoteExpiryService');

const CONVERT_ELIGIBLE_STATUSES = ['Accepted', 'Partially Accepted'];

/**
 * Owner/admin (or explicit role flag when added) may convert past validUntil / Expired status.
 * @param {import('express').Request} req
 */
function userCanOverrideExpiredQuotes(req) {
  if (req?.user?.isOwner) return true;
  const role = String(req?.user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  return req?.user?.permissions?.quotes?.overrideExpired === true;
}

/**
 * @param {object} quote
 */
function hasCustomerAcceptance(quote) {
  const rt = String(quote?.customerResponse?.responseType || '').toLowerCase();
  if (rt === 'full' || rt === 'partial' || rt === 'accept') return true;
  const ids = quote?.customerResponse?.acceptedLineIds;
  return Array.isArray(ids) && ids.length > 0;
}

/**
 * @param {object} quote
 * @returns {'full'|'partial'}
 */
function resolveConversionTypeForQuote(quote) {
  const status = String(quote?.status || '').trim();
  if (status === 'Partially Accepted') return 'partial';
  const responseType = String(quote?.customerResponse?.responseType || '').toLowerCase();
  if (responseType === 'partial') return 'partial';
  return 'full';
}

/**
 * @param {object} quote
 * @param {{ overrideExpired?: boolean }} [opts]
 * @returns {{
 *   allowed: boolean,
 *   reason: string|null,
 *   suggestedConversionType: 'full'|'partial'|null,
 *   isStub: true,
 *   expiredOverrideAvailable?: boolean,
 *   usedExpiredOverride?: boolean
 * }}
 */
function getQuoteConversionEligibility(quote, { overrideExpired = false } = {}) {
  const status = String(quote?.status || '').trim();
  const suggestedConversionType = resolveConversionTypeForQuote(quote);
  const stub = { isStub: true };

  if (quote?.converted === true || status === 'Converted') {
    return { allowed: false, reason: 'already_converted', suggestedConversionType: null, ...stub };
  }

  const validityExpired = isQuoteValidityExpired(quote);
  const statusExpired = status === 'Expired';
  const acceptedEligible = CONVERT_ELIGIBLE_STATUSES.includes(status);

  const blockedByExpiry =
    (statusExpired || (validityExpired && acceptedEligible)) && !overrideExpired;

  if (blockedByExpiry) {
    return {
      allowed: false,
      reason: 'expired',
      suggestedConversionType: null,
      expiredOverrideAvailable: true,
      ...stub
    };
  }

  if (statusExpired && overrideExpired) {
    if (!acceptedEligible && !hasCustomerAcceptance(quote)) {
      return { allowed: false, reason: 'accept_first', suggestedConversionType: null, ...stub };
    }
    return {
      allowed: true,
      reason: null,
      suggestedConversionType,
      usedExpiredOverride: true,
      ...stub
    };
  }

  if (!acceptedEligible) {
    return { allowed: false, reason: 'accept_first', suggestedConversionType: null, ...stub };
  }

  return {
    allowed: true,
    reason: null,
    suggestedConversionType,
    usedExpiredOverride: validityExpired && overrideExpired,
    ...stub
  };
}

/**
 * @param {object} quote
 * @param {{ overrideExpired?: boolean }} [opts]
 */
function assertCanConvertQuote(quote, opts = {}) {
  const eligibility = getQuoteConversionEligibility(quote, opts);
  if (eligibility.allowed) return eligibility;

  const messages = {
    already_converted: 'This quote revision is already converted.',
    expired: 'Expired quotes cannot be converted. Create a new revision first.',
    accept_first: 'Quote must be accepted before it can be converted.'
  };
  const err = new Error(messages[eligibility.reason] || 'Quote cannot be converted.');
  err.code =
    eligibility.reason === 'already_converted'
      ? 'ALREADY_CONVERTED'
      : eligibility.reason === 'expired'
        ? 'QUOTE_EXPIRED'
        : 'CONVERSION_NOT_ALLOWED';
  err.details = { reason: eligibility.reason, status: String(quote?.status || '') };
  throw err;
}

/**
 * Snapshot stored on conversion link for downstream modules.
 * @param {object} quote
 */
function buildConversionMetadata(quote, body = {}) {
  const cr = quote?.customerResponse || {};
  return {
    quoteStatus: quote?.status || null,
    quoteGrandTotal: Number(quote?.grandTotal) || 0,
    quoteCurrency: quote?.currency || null,
    acceptedLineIds: Array.isArray(cr.acceptedLineIds) ? cr.acceptedLineIds : [],
    acceptedGrandTotal: cr.acceptedGrandTotal ?? null,
    customerResponseType: cr.responseType || null,
    note: body?.note ? String(body.note).trim().slice(0, 500) : null
  };
}

/**
 * @param {object} quote
 * @param {string} fromStatus
 * @param {{ overrideExpired?: boolean }} [opts]
 */
function assertConvertStatusTransition(quote, fromStatus, opts = {}) {
  const overrideExpired = opts.overrideExpired === true;
  const eligibility = getQuoteConversionEligibility(quote, { overrideExpired });
  if (!eligibility.allowed) {
    assertCanConvertQuote(quote, { overrideExpired });
  }

  if (overrideExpired && fromStatus === 'Expired') {
    assertValidStatus('Converted');
    return eligibility;
  }

  assertCanTransitionQuoteStatus(fromStatus, 'Converted');
  return eligibility;
}

module.exports = {
  CONVERT_ELIGIBLE_STATUSES,
  userCanOverrideExpiredQuotes,
  hasCustomerAcceptance,
  resolveConversionTypeForQuote,
  getQuoteConversionEligibility,
  assertCanConvertQuote,
  buildConversionMetadata,
  assertConvertStatusTransition
};
