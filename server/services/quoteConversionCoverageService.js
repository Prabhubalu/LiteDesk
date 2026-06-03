/**
 * Quote → Sales Order conversion coverage (accepted lines mapped to SO lines).
 */

const {
  assertCanTransitionQuoteStatus,
  canTransitionQuoteStatus
} = require('../constants/quoteLifecycle');

/**
 * @param {object} quote
 * @returns {string[]}
 */
function getAcceptedLineIdsFromQuote(quote) {
  const cr = quote?.customerResponse || {};
  if (Array.isArray(cr.acceptedLineIds) && cr.acceptedLineIds.length) {
    return [...new Set(cr.acceptedLineIds.map((id) => String(id).trim()).filter(Boolean))];
  }
  return [];
}

/**
 * @param {string[]} acceptedLineIds
 * @param {string[]} convertedLineIds
 * @returns {'none'|'partial'|'full'}
 */
function computeConversionCoverage(acceptedLineIds, convertedLineIds) {
  const accepted = new Set((acceptedLineIds || []).map(String));
  const converted = new Set((convertedLineIds || []).map(String));

  if (!accepted.size) return 'none';

  let mapped = 0;
  for (const id of accepted) {
    if (converted.has(id)) mapped += 1;
  }

  if (mapped === 0) return 'none';
  if (mapped >= accepted.size) return 'full';
  return 'partial';
}

/**
 * @param {'none'|'partial'|'full'} coverage
 * @returns {'Partially Converted'|'Converted'|null}
 */
function targetQuoteStatusForCoverage(coverage) {
  if (coverage === 'full') return 'Converted';
  if (coverage === 'partial') return 'Partially Converted';
  return null;
}

/**
 * @param {object} params
 * @param {object} params.quote
 * @param {string[]} params.convertedLineIds - union of mapped sourceQuoteLineId values
 */
function resolveQuoteConversionCoverage({ quote, convertedLineIds }) {
  const acceptedLineIds = getAcceptedLineIdsFromQuote(quote);
  const coverage = computeConversionCoverage(acceptedLineIds, convertedLineIds);
  const targetStatus = targetQuoteStatusForCoverage(coverage);

  const convertedSet = new Set((convertedLineIds || []).map(String));
  const unmappedLineIds = acceptedLineIds.filter((id) => !convertedSet.has(String(id)));

  return {
    acceptedLineIds,
    convertedLineIds: [...convertedSet],
    unmappedLineIds,
    coverage,
    targetStatus,
    mappedCount: acceptedLineIds.length - unmappedLineIds.length,
    acceptedCount: acceptedLineIds.length
  };
}

/**
 * Pick quote status after an SO convert operation.
 * @param {string} fromStatus
 * @param {ReturnType<typeof resolveQuoteConversionCoverage>} resolution
 */
function resolveQuoteStatusAfterConversion(fromStatus, resolution) {
  const { coverage, targetStatus } = resolution;
  if (!targetStatus) return null;

  if (coverage === 'full') {
    if (canTransitionQuoteStatus(fromStatus, 'Converted')) return 'Converted';
    if (fromStatus === 'Partially Converted') return 'Converted';
    return 'Converted';
  }

  if (coverage === 'partial') {
    if (fromStatus === 'Partially Converted') return 'Partially Converted';
    if (canTransitionQuoteStatus(fromStatus, 'Partially Converted')) return 'Partially Converted';
    return 'Partially Converted';
  }

  return null;
}

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 */
function assertQuoteConversionStatusTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return;
  if (fromStatus === 'Partially Converted' && toStatus === 'Converted') {
    assertCanTransitionQuoteStatus('Partially Converted', 'Converted');
    return;
  }
  assertCanTransitionQuoteStatus(fromStatus, toStatus);
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.quoteId
 * @returns {Promise<string[]>}
 */
async function getConvertedLineIdsForQuote({ organizationId, quoteId }) {
  const SalesOrderLine = require('../models/SalesOrderLine');
  const rows = await SalesOrderLine.find({
    organizationId,
    sourceQuoteId: quoteId,
    sourceQuoteLineId: { $exists: true, $nin: [null, ''] }
  })
    .select('sourceQuoteLineId')
    .lean();

  return [...new Set(rows.map((row) => String(row.sourceQuoteLineId)).filter(Boolean))];
}

module.exports = {
  getAcceptedLineIdsFromQuote,
  getConvertedLineIdsForQuote,
  computeConversionCoverage,
  targetQuoteStatusForCoverage,
  resolveQuoteConversionCoverage,
  resolveQuoteStatusAfterConversion,
  assertQuoteConversionStatusTransition
};
