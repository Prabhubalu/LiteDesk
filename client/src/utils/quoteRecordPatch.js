function applyQuoteTotalsToRecord(record, totals) {
  if (!record || !totals || typeof totals !== 'object') return;
  if (totals.subtotal != null) record.subtotal = totals.subtotal;
  if (totals.taxTotal != null) record.taxTotal = totals.taxTotal;
  if (totals.chargesTotal != null) record.chargesTotal = totals.chargesTotal;
  if (totals.grandTotal != null) record.grandTotal = totals.grandTotal;
  if (totals.lineDiscountTotal != null) record.lineDiscountTotal = totals.lineDiscountTotal;
  if (totals.globalDiscountTotal != null) record.globalDiscountTotal = totals.globalDiscountTotal;
  if (totals.adjustmentTotal != null) record.adjustmentTotal = totals.adjustmentTotal;
}

function normalizeQuoteSection(section) {
  if (!section || typeof section !== 'object') return null;
  return { ...section };
}

export function applyQuoteSectionsToRecord(record, sections) {
  if (!record || !Array.isArray(sections)) return false;
  record.sections = sections.map(normalizeQuoteSection).filter(Boolean);
  return true;
}

function mergeSectionsById(existing, incoming) {
  const byKey = new Map(
    (Array.isArray(existing) ? existing : []).map((s) => [String(s?.quoteSectionId || s?._id || ''), s])
  );
  for (const section of incoming || []) {
    const key = String(section?.quoteSectionId || section?._id || '');
    if (!key) continue;
    const prev = byKey.get(key);
    byKey.set(key, prev ? { ...prev, ...section } : { ...section });
  }
  return [...byKey.values()].sort(
    (a, b) => (Number(a?.sectionOrder) || 0) - (Number(b?.sectionOrder) || 0)
  );
}

export function applyQuoteLinesMutationToRecord(
  record,
  { lines, line, totals, sections } = {}
) {
  if (!record) return false;
  let changed = false;
  if (applyQuoteLinesUpdateToRecord(record, { lines, line, totals })) {
    changed = true;
  }
  if (Array.isArray(sections)) {
    record.sections = mergeSectionsById(record.sections, sections);
    changed = true;
  }
  return changed;
}

export function applyQuoteDiscountsToRecord(record, { quote, lines, totals, sections } = {}) {
  if (!record) return false;
  let changed = false;
  if (quote && typeof quote === 'object') {
    if (quote.globalDiscountType !== undefined) {
      record.globalDiscountType = quote.globalDiscountType;
      changed = true;
    }
    if (quote.globalDiscountValue !== undefined) {
      record.globalDiscountValue = quote.globalDiscountValue;
      changed = true;
    }
    if (quote.globalDiscountAmount !== undefined) {
      record.globalDiscountAmount = quote.globalDiscountAmount;
      changed = true;
    }
    if (quote.transactionTaxSnapshot !== undefined) {
      record.transactionTaxSnapshot = quote.transactionTaxSnapshot;
      changed = true;
    }
    if (quote.chargeDocumentSnapshot !== undefined) {
      record.chargeDocumentSnapshot = quote.chargeDocumentSnapshot;
      changed = true;
    }
    if (quote.chargesTotal !== undefined) {
      record.chargesTotal = quote.chargesTotal;
      changed = true;
    }
  }
  if (Array.isArray(lines)) {
    record.lines = lines.map(normalizeQuoteLine).filter(Boolean);
    changed = true;
  }
  if (totals) {
    applyQuoteTotalsToRecord(record, totals);
    changed = true;
  }
  if (applyQuoteSectionsToRecord(record, sections)) {
    changed = true;
  }
  return changed;
}

function normalizeQuoteLine(line) {
  if (!line || typeof line !== 'object') return null;
  return { ...line };
}

/**
 * Merge line updates by quoteLineId (patch qty, etc.).
 */
export function applyQuoteLinesUpdateToRecord(record, { lines, line, totals } = {}) {
  if (!record) return false;

  const incoming = [
    ...(line ? [line] : []),
    ...(Array.isArray(lines) ? lines : [])
  ]
    .map(normalizeQuoteLine)
    .filter(Boolean);

  if (!incoming.length && !totals) return false;

  if (incoming.length) {
    const byId = new Map(
      (Array.isArray(record.lines) ? record.lines : []).map((row) => [
        String(row?.quoteLineId || ''),
        row
      ])
    );

    for (const updated of incoming) {
      const id = String(updated.quoteLineId || '');
      if (!id) continue;
      const prev = byId.get(id);
      byId.set(id, prev ? { ...prev, ...updated } : updated);
    }

    record.lines = [...byId.values()].sort(
      (a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0)
    );
  }

  applyQuoteTotalsToRecord(record, totals);
  return true;
}

/**
 * Replace all lines + totals after recalculate.
 */
export function applyQuoteLinesRecalculateToRecord(record, { lines, totals, sections } = {}) {
  if (!record) return false;
  if (Array.isArray(lines)) {
    record.lines = lines.map(normalizeQuoteLine).filter(Boolean);
  }
  applyQuoteTotalsToRecord(record, totals);
  if (Array.isArray(sections)) {
    applyQuoteSectionsToRecord(record, sections);
  }
  return Boolean(Array.isArray(lines) || totals || Array.isArray(sections));
}

/**
 * Append quote lines from API response without refetching the record.
 */
export function applyQuoteLinesAddToRecord(record, { lines, totals, sections } = {}) {
  if (!record) return false;

  const incoming = (Array.isArray(lines) ? lines : [])
    .map(normalizeQuoteLine)
    .filter(Boolean);

  if (!incoming.length && !sections) return false;

  const current = Array.isArray(record.lines) ? [...record.lines] : [];
  const existingIds = new Set(
    current.map((line) => String(line?.quoteLineId || '')).filter(Boolean)
  );

  for (const line of incoming) {
    const id = String(line.quoteLineId || '');
    if (!id || existingIds.has(id)) continue;
    existingIds.add(id);
    current.push(line);
  }

  current.sort((a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0));
  record.lines = current;
  applyQuoteTotalsToRecord(record, totals);
  if (Array.isArray(sections)) {
    applyQuoteSectionsToRecord(record, sections);
  }
  return true;
}

/**
 * Apply quote line delete response to an in-memory record without refetching.
 */
export function applyQuoteLineDeleteToRecord(record, { deletedLine, totals, sections } = {}) {
  if (!record || !deletedLine) return false;

  const deletedLineId = String(deletedLine.quoteLineId || '').trim();
  const deletedMongoId = String(deletedLine._id || '').trim();
  const isBundleParent = String(deletedLine.lineType || '') === 'bundle_parent';

  if (!deletedLineId) return false;

  const currentLines = Array.isArray(record.lines) ? record.lines : [];
  record.lines = currentLines.filter((line) => {
    if (String(line?.quoteLineId || '') === deletedLineId) return false;
    if (
      isBundleParent &&
      deletedMongoId &&
      line?.parentBundleLineId &&
      String(line.parentBundleLineId) === deletedMongoId
    ) {
      return false;
    }
    return true;
  });

  applyQuoteTotalsToRecord(record, totals);
  if (Array.isArray(sections)) {
    applyQuoteSectionsToRecord(record, sections);
  }
  return true;
}

const QUOTE_HEADER_PATCH_KEYS = [
  'status',
  'approvalStatus',
  'approvalLocked',
  'approvalRequired',
  'publicShareToken',
  'converted',
  'conversionStatus',
  'sentToCustomer',
  'sentAt',
  'portalAccessEnabled',
  'customerShareMode',
  'draftSharedAt',
  'revisionNumber',
  'activeRevision'
];

/**
 * Merge quote header fields from a partial API response (no lines).
 */
export function applyQuoteHeaderPatchToRecord(record, quotePatch) {
  if (!record || !quotePatch || typeof quotePatch !== 'object') return false;
  let changed = false;
  for (const key of QUOTE_HEADER_PATCH_KEYS) {
    if (quotePatch[key] !== undefined && record[key] !== quotePatch[key]) {
      record[key] = quotePatch[key];
      changed = true;
    }
  }
  return changed;
}
