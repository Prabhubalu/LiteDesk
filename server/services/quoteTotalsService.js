function computeDiscountAmount({ lineSubtotal, discountType, discountValue, discountAmount }) {
  const subtotal = Number(lineSubtotal) || 0;
  if (subtotal <= 0) return 0;

  const explicit = Number(discountAmount);
  // Zero is stored on many lines by default; only a positive explicit amount overrides type/value.
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.min(explicit, subtotal);
  }

  const t = String(discountType || '').trim().toLowerCase();
  if (t === 'percent' || t === 'percentage') {
    const pct = Number(discountValue) || 0;
    const amount = subtotal * (pct / 100);
    return Math.max(0, Math.min(amount, subtotal));
  }

  if (t === 'amount' || t === 'fixed') {
    const amt = Number(discountValue) || 0;
    return Math.max(0, Math.min(amt, subtotal));
  }

  return 0;
}

function computeLineTotals(line) {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPriceSnapshot) || 0;
  const gross = quantity * unitPrice;

  const discount = computeDiscountAmount({
    lineSubtotal: gross,
    discountType: line.discountType,
    discountValue: line.discountValue,
    discountAmount: line.discountAmount
  });

  const lineSubtotal = Math.max(0, gross - discount);

  // Prefer engine snapshot tax; fall back to stored lineTaxTotal; else 0
  let lineTaxTotal = 0;
  const snap = line.taxSnapshot;
  if (snap && Array.isArray(snap.taxes) && snap.taxes.length) {
    lineTaxTotal = snap.taxes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  } else if (Number.isFinite(Number(line.lineTaxTotal)) && Number(line.lineTaxTotal) > 0) {
    lineTaxTotal = Number(line.lineTaxTotal);
  }
  const lineTotal = lineSubtotal + lineTaxTotal;

  return { lineSubtotal, lineTaxTotal, lineTotal, lineDiscount: discount };
}

function filterIncludedLines(lines) {
  const all = Array.isArray(lines) ? lines : [];
  const visible = all.filter((l) => l && l.hiddenLine !== true);

  const bundleModeByParentId = new Map();
  for (const l of visible) {
    if (!l) continue;
    if (String(l.lineType || '') !== 'bundle_parent') continue;
    const mode = String(l.bundleSnapshot?.pricingMode || '').toLowerCase().trim() || 'fixed';
    bundleModeByParentId.set(String(l._id || l.id || l.quoteLineId), mode);
  }

  return visible.filter((l) => {
    if (!l) return false;
    const type = String(l.lineType || '');

    if (type === 'bundle_component') {
      const parentId = l.parentBundleLineId ? String(l.parentBundleLineId) : '';
      const mode = parentId ? bundleModeByParentId.get(parentId) : undefined;
      // Rollup: components contribute to totals. Fixed/discount: parent package price only.
      if (mode === 'fixed' || mode === 'discount') return false;
      return true;
    }

    if (type === 'bundle_parent') {
      const mode = String(l.bundleSnapshot?.pricingMode || '').toLowerCase().trim() || 'fixed';
      if (mode === 'rollup') return false;
      return true;
    }

    return true;
  });
}

function computeQuoteTotalsFromLines(lines, quoteDiscount = {}) {
  const included = filterIncludedLines(lines);

  let lineDiscountTotal = 0;
  for (const l of included) {
    const qty = Number(l.quantity) || 0;
    const unit = Number(l.unitPriceSnapshot) || 0;
    const gross = qty * unit;
    const net = Number(l.lineSubtotal) || 0;
    lineDiscountTotal += Math.max(0, gross - net);
  }

  const subtotal = included.reduce((sum, l) => sum + (Number(l.lineSubtotal) || 0), 0);
  const taxTotal = included.reduce((sum, l) => sum + (Number(l.lineTaxTotal) || 0), 0);

  const globalDiscountTotal = computeDiscountAmount({
    lineSubtotal: subtotal,
    discountType: quoteDiscount.globalDiscountType,
    discountValue: quoteDiscount.globalDiscountValue,
    discountAmount: quoteDiscount.globalDiscountAmount
  });

  const adjustmentTotal = Number(quoteDiscount.adjustmentTotal) || 0;
  const grandTotal = Math.max(0, subtotal - globalDiscountTotal + taxTotal + adjustmentTotal);

  return { subtotal, lineDiscountTotal, taxTotal, globalDiscountTotal, adjustmentTotal, grandTotal };
}

function isSectionIncludedInQuoteTotal(section) {
  if (!section || section.hiddenSection === true) return false;
  if (String(section.sectionType || '') === 'future') return false;
  if (String(section.sectionType || '') === 'optional' && section.includeInQuoteTotal !== true) return false;
  return true;
}

function groupLinesBySectionId(lines) {
  const map = new Map();
  for (const line of lines || []) {
    if (!line) continue;
    const key = line.quoteSectionId ? String(line.quoteSectionId) : '__none__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(line);
  }
  return map;
}

function computeSectionTotals(section, lines) {
  const included = filterIncludedLines(lines);

  let sectionLineDiscountTotal = 0;
  for (const l of included) {
    const qty = Number(l.quantity) || 0;
    const unit = Number(l.unitPriceSnapshot) || 0;
    const gross = qty * unit;
    const net = Number(l.lineSubtotal) || 0;
    sectionLineDiscountTotal += Math.max(0, gross - net);
  }

  const sectionSubtotal = included.reduce((sum, l) => sum + (Number(l.lineSubtotal) || 0), 0);
  const sectionTaxTotal = included.reduce((sum, l) => sum + (Number(l.lineTaxTotal) || 0), 0);

  const sectionDiscountTotal = computeDiscountAmount({
    lineSubtotal: sectionSubtotal,
    discountType: section?.sectionDiscountType,
    discountValue: section?.sectionDiscountValue,
    discountAmount: section?.sectionDiscountAmount
  });

  const sectionNet = Math.max(0, sectionSubtotal - sectionDiscountTotal);
  const sectionTotal = sectionNet + sectionTaxTotal;

  return {
    sectionSubtotal,
    sectionLineDiscountTotal,
    sectionDiscountTotal,
    sectionTaxTotal,
    sectionTotal,
    sectionNet
  };
}

/**
 * Quote totals when sections exist: section discounts apply before global discount.
 * Returns persisted section total fields plus quote-level totals.
 */
function computeQuoteTotalsWithSections(sections, lines, quoteDiscount = {}) {
  const linesBySection = groupLinesBySectionId(lines);
  const sectionResults = [];

  let subtotal = 0;
  let lineDiscountTotal = 0;
  let taxTotal = 0;

  for (const section of sections || []) {
    const sectionLines = linesBySection.get(String(section._id || section.id)) || [];
    const computed = computeSectionTotals(section, sectionLines);
    sectionResults.push({
      sectionId: section._id || section.id,
      quoteSectionId: section.quoteSectionId,
      ...computed
    });

    if (isSectionIncludedInQuoteTotal(section)) {
      subtotal += computed.sectionNet;
      lineDiscountTotal += computed.sectionLineDiscountTotal;
      taxTotal += computed.sectionTaxTotal;
    }
  }

  const orphanLines = linesBySection.get('__none__') || [];
  if (orphanLines.length) {
    const orphanTotals = computeQuoteTotalsFromLines(orphanLines, {});
    subtotal += orphanTotals.subtotal;
    lineDiscountTotal += orphanTotals.lineDiscountTotal;
    taxTotal += orphanTotals.taxTotal;
  }

  const globalDiscountTotal = computeDiscountAmount({
    lineSubtotal: subtotal,
    discountType: quoteDiscount.globalDiscountType,
    discountValue: quoteDiscount.globalDiscountValue,
    discountAmount: quoteDiscount.globalDiscountAmount
  });

  const adjustmentTotal = Number(quoteDiscount.adjustmentTotal) || 0;
  const grandTotal = Math.max(0, subtotal - globalDiscountTotal + taxTotal + adjustmentTotal);

  return {
    quoteTotals: {
      subtotal,
      lineDiscountTotal,
      taxTotal,
      globalDiscountTotal,
      adjustmentTotal,
      grandTotal
    },
    sectionResults
  };
}

module.exports = {
  computeDiscountAmount,
  computeLineTotals,
  computeQuoteTotalsFromLines,
  computeSectionTotals,
  computeQuoteTotalsWithSections,
  filterIncludedLines,
  groupLinesBySectionId,
  isSectionIncludedInQuoteTotal
};
