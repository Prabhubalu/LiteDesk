function computeDiscountAmount({ lineSubtotal, discountType, discountValue, discountAmount }) {
  const subtotal = Number(lineSubtotal) || 0;
  if (subtotal <= 0) return 0;

  const explicit = Number(discountAmount);
  if (Number.isFinite(explicit) && explicit >= 0) {
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

  // MVP: no tax engine yet
  const lineTaxTotal = 0;
  const lineTotal = lineSubtotal + lineTaxTotal;

  return { lineSubtotal, lineTaxTotal, lineTotal };
}

function computeQuoteTotalsFromLines(lines) {
  const all = Array.isArray(lines) ? lines : [];
  const visible = all.filter((l) => l && l.hiddenLine !== true);

  // Bundles: prevent double-counting.
  // - fixed: totals come from bundle parent line only; ignore component lines
  // - rollup: totals come from component lines; ignore parent line
  const bundleModeByParentId = new Map();
  for (const l of visible) {
    if (!l) continue;
    if (String(l.lineType || '') !== 'bundle_parent') continue;
    const mode = String(l.bundleSnapshot?.pricingMode || '').toLowerCase().trim() || 'fixed';
    bundleModeByParentId.set(String(l._id || l.id || l.quoteLineId), mode);
  }

  const included = visible.filter((l) => {
    if (!l) return false;
    const type = String(l.lineType || '');

    if (type === 'bundle_component') {
      const parentId = l.parentBundleLineId ? String(l.parentBundleLineId) : '';
      const mode = parentId ? bundleModeByParentId.get(parentId) : undefined;
      if (mode === 'fixed') return false; // fixed bundles ignore component totals
      return true;
    }

    if (type === 'bundle_parent') {
      const mode = String(l.bundleSnapshot?.pricingMode || '').toLowerCase().trim() || 'fixed';
      if (mode === 'rollup') return false; // rollup bundles ignore parent totals
      return true;
    }

    return true;
  });

  const subtotal = included.reduce((sum, l) => sum + (Number(l.lineSubtotal) || 0), 0);
  const taxTotal = included.reduce((sum, l) => sum + (Number(l.lineTaxTotal) || 0), 0);
  const grandTotal = included.reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0);

  return { subtotal, taxTotal, grandTotal };
}

module.exports = {
  computeDiscountAmount,
  computeLineTotals,
  computeQuoteTotalsFromLines
};

