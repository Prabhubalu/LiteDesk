const quoteTotalsService = require('./quoteTotalsService');

function groupLinesBySectionId(lines) {
  const map = new Map();
  for (const line of lines || []) {
    if (!line) continue;
    const key = line.salesOrderSectionId ? String(line.salesOrderSectionId) : '__none__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(line);
  }
  return map;
}

function isSectionIncludedInOrderTotal(section) {
  return quoteTotalsService.isSectionIncludedInQuoteTotal({
    ...section,
    includeInQuoteTotal: section?.includeInOrderTotal
  });
}

function computeOrderTotalsFromLines(lines, orderDiscount = {}) {
  const totals = quoteTotalsService.computeQuoteTotalsFromLines(lines, orderDiscount);
  return { ...totals };
}

function computeOrderTotalsWithSections(sections, lines, orderDiscount = {}) {
  const normalizedSections = (sections || []).map((section) => ({
    ...section,
    includeInQuoteTotal: section?.includeInOrderTotal
  }));

  const normalizedLines = (lines || []).map((line) => ({
    ...line,
    quoteSectionId: line.salesOrderSectionId || line.quoteSectionId
  }));

  const result = quoteTotalsService.computeQuoteTotalsWithSections(
    normalizedSections,
    normalizedLines,
    orderDiscount
  );

  const orderTotals = { ...result.quoteTotals };
  if (result.quoteTotals.sectionDiscountTotal == null) {
    let sectionDiscountTotal = 0;
    for (const row of result.sectionResults || []) {
      sectionDiscountTotal += Number(row.sectionDiscountTotal) || 0;
    }
    orderTotals.sectionDiscountTotal = sectionDiscountTotal;
  } else {
    orderTotals.sectionDiscountTotal = result.quoteTotals.sectionDiscountTotal || 0;
  }

  const sectionResults = (result.sectionResults || []).map((row) => ({
    sectionId: row.sectionId,
    salesOrderSectionId: row.quoteSectionId || row.salesOrderSectionId,
    sectionSubtotal: row.sectionSubtotal,
    sectionLineDiscountTotal: row.sectionLineDiscountTotal,
    sectionDiscountTotal: row.sectionDiscountTotal,
    sectionTaxTotal: row.sectionTaxTotal,
    sectionTotal: row.sectionTotal,
    sectionNet: row.sectionNet
  }));

  return { orderTotals, sectionResults };
}

module.exports = {
  computeLineTotals: quoteTotalsService.computeLineTotals,
  computeDiscountAmount: quoteTotalsService.computeDiscountAmount,
  filterIncludedLines: quoteTotalsService.filterIncludedLines,
  computeSectionTotals: quoteTotalsService.computeSectionTotals,
  groupLinesBySectionId,
  isSectionIncludedInOrderTotal,
  computeOrderTotalsFromLines,
  computeOrderTotalsWithSections
};
