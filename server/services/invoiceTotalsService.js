const quoteTotalsService = require('./quoteTotalsService');

function groupLinesBySectionId(lines) {
  const map = new Map();
  for (const line of lines || []) {
    if (!line) continue;
    const key = line.invoiceSectionId ? String(line.invoiceSectionId) : '__none__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(line);
  }
  return map;
}

function isSectionIncludedInInvoiceTotal(section) {
  return quoteTotalsService.isSectionIncludedInQuoteTotal({
    ...section,
    includeInQuoteTotal: section?.includeInInvoiceTotal
  });
}

function computeInvoiceTotalsFromLines(lines, invoiceDiscount = {}) {
  const totals = quoteTotalsService.computeQuoteTotalsFromLines(lines, invoiceDiscount);
  return { ...totals };
}

function computeInvoiceTotalsWithSections(sections, lines, invoiceDiscount = {}) {
  const normalizedSections = (sections || []).map((section) => ({
    ...section,
    includeInQuoteTotal: section?.includeInInvoiceTotal
  }));

  const normalizedLines = (lines || []).map((line) => ({
    ...line,
    quoteSectionId: line.invoiceSectionId || line.quoteSectionId
  }));

  const result = quoteTotalsService.computeQuoteTotalsWithSections(
    normalizedSections,
    normalizedLines,
    invoiceDiscount
  );

  const invoiceTotals = { ...result.quoteTotals };
  if (result.quoteTotals.sectionDiscountTotal == null) {
    let sectionDiscountTotal = 0;
    for (const row of result.sectionResults || []) {
      sectionDiscountTotal += Number(row.sectionDiscountTotal) || 0;
    }
    invoiceTotals.sectionDiscountTotal = sectionDiscountTotal;
  } else {
    invoiceTotals.sectionDiscountTotal = result.quoteTotals.sectionDiscountTotal || 0;
  }

  const sectionResults = (result.sectionResults || []).map((row) => ({
    sectionId: row.sectionId,
    invoiceSectionId: row.quoteSectionId || row.invoiceSectionId,
    sectionSubtotal: row.sectionSubtotal,
    sectionLineDiscountTotal: row.sectionLineDiscountTotal,
    sectionDiscountTotal: row.sectionDiscountTotal,
    sectionTaxTotal: row.sectionTaxTotal,
    sectionTotal: row.sectionTotal,
    sectionNet: row.sectionNet
  }));

  return { invoiceTotals, sectionResults };
}

module.exports = {
  computeLineTotals: quoteTotalsService.computeLineTotals,
  computeDiscountAmount: quoteTotalsService.computeDiscountAmount,
  filterIncludedLines: quoteTotalsService.filterIncludedLines,
  computeSectionTotals: quoteTotalsService.computeSectionTotals,
  groupLinesBySectionId,
  isSectionIncludedInInvoiceTotal,
  computeInvoiceTotalsFromLines,
  computeInvoiceTotalsWithSections
};
