/**
 * Customer acceptance on public quote portal (full + partial).
 */

const { assertCanTransitionQuoteStatus } = require('../constants/quoteLifecycle');
const { computeAcceptedSectionIds } = require('./quoteConversionService');

function isSelectableLine(line) {
  if (!line || line.hiddenLine === true) return false;
  const type = String(line.lineType || 'standard');
  return type === 'standard' || type === 'bundle_parent';
}

function getSelectableLines(lines) {
  return (lines || []).filter(isSelectableLine);
}

function getBundleChildLines(lines, parentMongoId) {
  const pid = parentMongoId?.toString?.() || String(parentMongoId || '');
  return (lines || []).filter(
    (l) =>
      l &&
      l.hiddenLine !== true &&
      String(l.lineType || '') === 'bundle_component' &&
      String(l.parentBundleLineId || '') === pid
  );
}

function linesForSelection(lines, selectedQuoteLineIds) {
  const idSet = new Set((selectedQuoteLineIds || []).map((id) => String(id)));
  const included = [];
  for (const line of lines || []) {
    if (!line || line.hiddenLine === true) continue;
    if (idSet.has(String(line.quoteLineId))) {
      included.push(line);
      if (line.lineType === 'bundle_parent' && line._id) {
        included.push(...getBundleChildLines(lines, line._id));
      }
    } else if (line.lineType === 'bundle_component') {
      continue;
    }
  }
  return included;
}

function sumAcceptedTotals(acceptedLines) {
  let acceptedSubtotal = 0;
  let acceptedTaxTotal = 0;
  let acceptedGrandTotal = 0;
  for (const l of acceptedLines) {
    acceptedSubtotal += Number(l.lineSubtotal) || 0;
    acceptedTaxTotal += Number(l.lineTaxTotal) || 0;
    acceptedGrandTotal += Number(l.lineTotal) || 0;
  }
  return {
    acceptedSubtotal: Math.round(acceptedSubtotal * 100) / 100,
    acceptedTaxTotal: Math.round(acceptedTaxTotal * 100) / 100,
    acceptedGrandTotal: Math.round(acceptedGrandTotal * 100) / 100
  };
}

/**
 * @param {Array} lines - QuoteLine docs
 * @param {string[]|null} requestedLineIds - quoteLineId values; null/omit = all selectable
 * @param {Array} [sections] - QuoteSection docs for acceptedSectionIds
 */
function resolveCustomerAcceptance(lines, requestedLineIds = null, sections = []) {
  const selectable = getSelectableLines(lines);
  if (!selectable.length) {
    const err = new Error('This quote has no lines available for acceptance.');
    err.code = 'NO_SELECTABLE_LINES';
    throw err;
  }

  const selectableIds = selectable.map((l) => String(l.quoteLineId));
  let selectedIds;
  if (requestedLineIds == null) {
    selectedIds = [...selectableIds];
  } else if (!Array.isArray(requestedLineIds)) {
    const err = new Error('lineIds must be an array of line identifiers.');
    err.code = 'VALIDATION';
    throw err;
  } else {
    selectedIds = [...new Set(requestedLineIds.map((id) => String(id).trim()).filter(Boolean))];
    const invalid = selectedIds.filter((id) => !selectableIds.includes(id));
    if (invalid.length) {
      const err = new Error('One or more selected lines are not valid for acceptance.');
      err.code = 'INVALID_LINE_SELECTION';
      err.details = { invalidLineIds: invalid };
      throw err;
    }
  }

  if (!selectedIds.length) {
    const err = new Error('Select at least one line to accept.');
    err.code = 'EMPTY_LINE_SELECTION';
    throw err;
  }

  const acceptedLines = linesForSelection(lines, selectedIds);
  const totals = sumAcceptedTotals(acceptedLines);
  const isFull = selectedIds.length === selectableIds.length;
  const acceptedSectionIds = computeAcceptedSectionIds(sections, lines, selectedIds);

  return {
    selectableIds,
    selectedIds,
    acceptedLines,
    acceptedSectionIds,
    isFull,
    toStatus: isFull ? 'Accepted' : 'Partially Accepted',
    responseType: isFull ? 'full' : 'partial',
    ...totals
  };
}

/**
 * Apply customer acceptance to quote document (caller saves).
 */
function applyCustomerAcceptanceToQuote(
  quote,
  resolution,
  { comment = null, signerName = null, signatureText = null, agreedToTerms = false } = {}
) {
  const fromStatus = String(quote.status || '');
  assertCanTransitionQuoteStatus(fromStatus, resolution.toStatus);

  const now = new Date();
  const termsAccepted = agreedToTerms === true;
  const sig = signatureText ? String(signatureText).trim().slice(0, 200) : null;
  const printedName = signerName ? String(signerName).trim().slice(0, 200) : sig;

  quote.status = resolution.toStatus;
  quote.customerResponse = {
    responseType: resolution.responseType,
    acceptedLineIds: resolution.selectedIds,
    acceptedSectionIds: resolution.acceptedSectionIds || [],
    acceptedSubtotal: resolution.acceptedSubtotal,
    acceptedTaxTotal: resolution.acceptedTaxTotal,
    acceptedGrandTotal: resolution.acceptedGrandTotal,
    comment: comment ? String(comment).trim().slice(0, 2000) : null,
    signerName: printedName || null,
    signatureText: sig || null,
    signatureSignedAt: sig ? now : null,
    agreedToTerms: termsAccepted ? true : null,
    agreedToTermsAt: termsAccepted ? now : null,
    respondedAt: now
  };
}

function applyCustomerRejectionToQuote(quote, { comment = null, signerName = null } = {}) {
  const fromStatus = String(quote.status || '');
  assertCanTransitionQuoteStatus(fromStatus, 'Rejected');

  quote.status = 'Rejected';
  quote.customerResponse = {
    responseType: 'rejected',
    acceptedLineIds: [],
    acceptedSectionIds: [],
    acceptedSubtotal: 0,
    acceptedTaxTotal: 0,
    acceptedGrandTotal: 0,
    comment: comment ? String(comment).trim().slice(0, 2000) : null,
    signerName: signerName ? String(signerName).trim().slice(0, 200) : null,
    respondedAt: new Date()
  };
}

module.exports = {
  isSelectableLine,
  getSelectableLines,
  linesForSelection,
  resolveCustomerAcceptance,
  applyCustomerAcceptanceToQuote,
  applyCustomerRejectionToQuote
};
