/**
 * Q8 — Quote conversion contract (stub; no Sales Order / Invoice writes).
 */

const { isQuoteValidityExpired } = require('./quoteExpiryService');

const CONVERT_ELIGIBLE_STATUSES = ['Accepted', 'Partially Accepted', 'Partially Converted'];

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
  if (status === 'Partially Accepted' || status === 'Partially Converted') return 'partial';
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
 *   expiredOverrideAvailable?: boolean,
 *   usedExpiredOverride?: boolean
 * }}
 */
function getQuoteConversionEligibility(quote, { overrideExpired = false } = {}) {
  const status = String(quote?.status || '').trim();
  const suggestedConversionType = resolveConversionTypeForQuote(quote);

  if (status === 'Converted' || quote?.converted === true) {
    return { allowed: false, reason: 'already_converted', suggestedConversionType: null };
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
      expiredOverrideAvailable: true
    };
  }

  if (statusExpired && overrideExpired) {
    if (!acceptedEligible && !hasCustomerAcceptance(quote)) {
      return { allowed: false, reason: 'accept_first', suggestedConversionType: null };
    }
    return {
      allowed: true,
      reason: null,
      suggestedConversionType,
      usedExpiredOverride: true
    };
  }

  if (!acceptedEligible) {
    return { allowed: false, reason: 'accept_first', suggestedConversionType: null };
  }

  return {
    allowed: true,
    reason: null,
    suggestedConversionType,
    usedExpiredOverride: validityExpired && overrideExpired
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
 * Derive stable section IDs fully covered by selected line IDs.
 * @param {Array} sections
 * @param {Array} lines
 * @param {string[]} selectedLineIds
 * @returns {string[]}
 */
function computeAcceptedSectionIds(sections, lines, selectedLineIds) {
  const selected = new Set((selectedLineIds || []).map((id) => String(id)));
  const sectionList = Array.isArray(sections) ? sections : [];
  const lineList = Array.isArray(lines) ? lines : [];
  const accepted = [];

  for (const section of sectionList) {
    const sid = String(section?._id || '');
    const publicId = String(section?.quoteSectionId || sid);
    if (!sid) continue;

    const sectionLines = lineList.filter(
      (l) =>
        l &&
        l.hiddenLine !== true &&
        String(l.quoteSectionId || '') === sid &&
        (String(l.lineType || 'standard') === 'standard' || String(l.lineType || '') === 'bundle_parent')
    );
    if (!sectionLines.length) continue;
    if (sectionLines.every((l) => selected.has(String(l.quoteLineId)))) {
      accepted.push(publicId);
    }
  }

  return accepted;
}

/**
 * Snapshot stored on conversion link for downstream modules.
 * @param {object} quote
 * @param {object} [body]
 * @param {{ sections?: Array, lines?: Array }} [ctx]
 */
function buildConversionSectionBreakdown(sections, lines, acceptedLineIds = []) {
  const acceptedSet = new Set((acceptedLineIds || []).map((id) => String(id)));
  const sectionList = Array.isArray(sections) ? sections : [];
  const lineList = Array.isArray(lines) ? lines : [];

  return sectionList
    .filter((s) => s && s.hiddenSection !== true)
    .sort((a, b) => (Number(a.sectionOrder) || 0) - (Number(b.sectionOrder) || 0))
    .map((section) => {
      const sid = String(section._id || '');
      const sectionLines = lineList.filter(
        (l) =>
          l &&
          l.hiddenLine !== true &&
          String(l.quoteSectionId || '') === sid &&
          (String(l.lineType || 'standard') === 'standard' || String(l.lineType || '') === 'bundle_parent')
      );
      const acceptedLines = sectionLines.filter((l) => acceptedSet.has(String(l.quoteLineId)));
      return {
        quoteSectionId: section.quoteSectionId || sid,
        sectionTitle: section.sectionTitle || null,
        sectionType: section.sectionType || 'standard',
        sectionTotal: Number(section.sectionTotal) || 0,
        lineCount: sectionLines.length,
        acceptedLineCount: acceptedLines.length,
        accepted: sectionLines.length > 0 && acceptedLines.length === sectionLines.length
      };
    });
}

/**
 * Snapshot stored on conversion link for downstream modules.
 * @param {object} quote
 */
function buildConversionMetadata(quote, body = {}, ctx = {}) {
  const cr = quote?.customerResponse || {};
  const acceptedLineIds = Array.isArray(cr.acceptedLineIds) ? cr.acceptedLineIds : [];
  const acceptedSectionIds = Array.isArray(cr.acceptedSectionIds)
    ? cr.acceptedSectionIds
    : computeAcceptedSectionIds(ctx.sections, ctx.lines, acceptedLineIds);

  return {
    quoteStatus: quote?.status || null,
    quoteGrandTotal: Number(quote?.grandTotal) || 0,
    quoteCurrency: quote?.currency || null,
    acceptedLineIds,
    acceptedSectionIds,
    sectionBreakdown: buildConversionSectionBreakdown(ctx.sections, ctx.lines, acceptedLineIds),
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
  return eligibility;
}

module.exports = {
  CONVERT_ELIGIBLE_STATUSES,
  userCanOverrideExpiredQuotes,
  hasCustomerAcceptance,
  resolveConversionTypeForQuote,
  getQuoteConversionEligibility,
  assertCanConvertQuote,
  computeAcceptedSectionIds,
  buildConversionSectionBreakdown,
  buildConversionMetadata,
  assertConvertStatusTransition
};
