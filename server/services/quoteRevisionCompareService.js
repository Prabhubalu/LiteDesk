const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteSection = require('../models/QuoteSection');
const QuoteApproval = require('../models/QuoteApproval');

const APPROVED_BASELINE_STATUSES = new Set([
  'Approved',
  'Sent',
  'Viewed',
  'Accepted',
  'Partially Accepted',
  'Partially Converted',
  'Converted'
]);

const RISK_THRESHOLDS = {
  highTotalDelta: 10000,
  mediumTotalDelta: 2500,
  highDiscountDelta: 2500,
  mediumDiscountDelta: 500,
  highDiscountRate: 0.2,
  mediumDiscountRate: 0.1,
  highValueLine: 5000
};

const HEADER_FIELDS = [
  { field: 'quoteTitle', label: 'Quote title', impactArea: 'customer', customerVisible: true },
  { field: 'assignedTo', label: 'Assigned To', impactArea: 'metadata', customerVisible: false },
  { field: 'customerId', label: 'Customer', impactArea: 'customer', customerVisible: true },
  { field: 'organizationRefId', label: 'Organization', impactArea: 'customer', customerVisible: true },
  { field: 'contactId', label: 'Contact', impactArea: 'customer', customerVisible: true },
  { field: 'quoteDate', label: 'Quote date', impactArea: 'timing', customerVisible: true, type: 'date' },
  { field: 'validUntil', label: 'Valid until', impactArea: 'timing', customerVisible: true, type: 'date' },
  { field: 'currency', label: 'Currency', impactArea: 'pricing', customerVisible: true },
  { field: 'exchangeRateSnapshot', label: 'Exchange rate', impactArea: 'pricing', customerVisible: false, type: 'number' },
  { field: 'subtotal', label: 'Subtotal', impactArea: 'pricing', customerVisible: true, type: 'money' },
  { field: 'lineDiscountTotal', label: 'Line discount total', impactArea: 'discount', customerVisible: true, type: 'money' },
  { field: 'globalDiscountTotal', label: 'Global discount total', impactArea: 'discount', customerVisible: true, type: 'money' },
  { field: 'taxTotal', label: 'Tax total', impactArea: 'pricing', customerVisible: true, type: 'money' },
  { field: 'adjustmentTotal', label: 'Adjustment total', impactArea: 'pricing', customerVisible: true, type: 'money' },
  { field: 'grandTotal', label: 'Grand total', impactArea: 'pricing', customerVisible: true, type: 'money' },
  { field: 'globalDiscountType', label: 'Global discount type', impactArea: 'discount', customerVisible: true },
  { field: 'globalDiscountValue', label: 'Global discount value', impactArea: 'discount', customerVisible: true, type: 'number' },
  { field: 'globalDiscountAmount', label: 'Global discount amount', impactArea: 'discount', customerVisible: true, type: 'money' },
  { field: 'approvalRequired', label: 'Approval required', impactArea: 'approval', customerVisible: false },
  { field: 'approvalStatus', label: 'Approval status', impactArea: 'approval', customerVisible: false }
];

const LINE_FIELDS = [
  { field: 'skuSnapshot', label: 'SKU', impactArea: 'scope', customerVisible: true },
  { field: 'itemNameSnapshot', label: 'Item', impactArea: 'scope', customerVisible: true },
  { field: 'descriptionSnapshot', label: 'Description', impactArea: 'scope', customerVisible: true },
  { field: 'quoteSectionId', label: 'Section', impactArea: 'structure', customerVisible: true },
  { field: 'lineOrder', label: 'Line order', impactArea: 'structure', customerVisible: true, type: 'number' },
  { field: 'lineType', label: 'Line type', impactArea: 'structure', customerVisible: false },
  { field: 'optionalLine', label: 'Optional', impactArea: 'scope', customerVisible: true },
  { field: 'hiddenLine', label: 'Hidden', impactArea: 'scope', customerVisible: true },
  { field: 'quantity', label: 'Quantity', impactArea: 'pricing', customerVisible: true, type: 'number' },
  { field: 'unitOfMeasure', label: 'Unit', impactArea: 'scope', customerVisible: true },
  { field: 'unitPriceSnapshot', label: 'Unit price', impactArea: 'pricing', customerVisible: true, type: 'money' },
  { field: 'listPriceSnapshot', label: 'List price', impactArea: 'pricing', customerVisible: false, type: 'money' },
  { field: 'discountType', label: 'Discount type', impactArea: 'discount', customerVisible: true },
  { field: 'discountValue', label: 'Discount value', impactArea: 'discount', customerVisible: true, type: 'number' },
  { field: 'discountAmount', label: 'Discount amount', impactArea: 'discount', customerVisible: true, type: 'money' },
  { field: 'lineSubtotal', label: 'Line subtotal', impactArea: 'pricing', customerVisible: true, type: 'money' },
  { field: 'lineTaxTotal', label: 'Line tax', impactArea: 'pricing', customerVisible: true, type: 'money' },
  { field: 'lineTotal', label: 'Line total', impactArea: 'pricing', customerVisible: true, type: 'money' },
  { field: 'currencySnapshot', label: 'Currency', impactArea: 'pricing', customerVisible: true }
];

function stringifyId(value) {
  if (value == null) return null;
  if (typeof value === 'object' && value._id) return stringifyId(value._id);
  return value.toString ? value.toString() : String(value);
}

function normalizeValue(value, type) {
  if (value == null || value === '') return null;
  if (type === 'date') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (type === 'number' || type === 'money') {
    const n = Number(value);
    return Number.isFinite(n) ? Number(n.toFixed(4)) : null;
  }
  if (typeof value === 'object') return stringifyId(value);
  return value;
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function compareScalar({ fromRecord, toRecord, def, entityType, entityId }) {
  const fromValue = normalizeValue(fromRecord?.[def.field], def.type);
  const toValue = normalizeValue(toRecord?.[def.field], def.type);
  if (fromValue === toValue) return null;
  const delta = def.type === 'number' || def.type === 'money'
    ? Number((numberValue(toValue) - numberValue(fromValue)).toFixed(4))
    : null;
  return {
    entityType,
    entityId,
    field: def.field,
    label: def.label,
    fromValue,
    toValue,
    changeType: 'changed',
    impactArea: def.impactArea || 'metadata',
    customerVisible: def.customerVisible === true,
    delta,
    severity: deriveFieldSeverity(def.field, delta)
  };
}

function deriveFieldSeverity(field, delta) {
  const abs = Math.abs(numberValue(delta));
  if (field === 'grandTotal' && abs >= RISK_THRESHOLDS.highTotalDelta) return 'high';
  if (field === 'grandTotal' && abs >= RISK_THRESHOLDS.mediumTotalDelta) return 'medium';
  if (String(field).toLowerCase().includes('discount') && abs >= RISK_THRESHOLDS.highDiscountDelta) return 'high';
  if (String(field).toLowerCase().includes('discount') && abs >= RISK_THRESHOLDS.mediumDiscountDelta) return 'medium';
  if (['unitPriceSnapshot', 'lineTotal'].includes(field) && delta < 0) return 'medium';
  return 'low';
}

function sectionKey(section) {
  return [
    section.quoteSectionId,
    String(section.sectionTitle || '').trim().toLowerCase(),
    String(section.sectionType || '').trim().toLowerCase()
  ].filter(Boolean).join('|');
}

function lineKey(line, sectionLookup) {
  const section = sectionLookup.get(stringifyId(line.quoteSectionId)) || '';
  return [
    stringifyId(line.variantId),
    String(line.skuSnapshot || '').trim().toLowerCase(),
    String(line.itemNameSnapshot || '').trim().toLowerCase(),
    String(line.lineType || '').trim().toLowerCase(),
    section
  ].filter(Boolean).join('|');
}

function indexByKey(rows, keyFn) {
  const map = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    const bucket = map.get(key) || [];
    bucket.push(row);
    map.set(key, bucket);
  }
  return map;
}

function takeMatch(map, key) {
  const bucket = map.get(key);
  if (!bucket || !bucket.length) return null;
  return bucket.shift();
}

function diffHeaders(fromQuote, toQuote) {
  return HEADER_FIELDS
    .map((def) => compareScalar({ fromRecord: fromQuote, toRecord: toQuote, def, entityType: 'header', entityId: 'header' }))
    .filter(Boolean);
}

function diffSections(fromSections, toSections) {
  const toByKey = indexByKey(toSections, sectionKey);
  const diffs = [];
  const matchedTo = new Set();

  for (const fromSection of fromSections) {
    const toSection = takeMatch(toByKey, sectionKey(fromSection));
    if (!toSection) {
      diffs.push(sectionPresenceDiff(fromSection, null, 'removed'));
      continue;
    }
    matchedTo.add(stringifyId(toSection._id));
    const fieldDiffs = sectionFieldDiffs(fromSection, toSection);
    if (fieldDiffs.length) {
      diffs.push({
        entityType: 'section',
        sectionId: stringifyId(toSection._id),
        quoteSectionId: toSection.quoteSectionId,
        label: toSection.sectionTitle || fromSection.sectionTitle || 'Section',
        changeType: 'changed',
        impactArea: fieldDiffs.some((d) => d.impactArea === 'pricing' || d.impactArea === 'discount') ? 'pricing' : 'structure',
        customerVisible: fieldDiffs.some((d) => d.customerVisible),
        severity: highestSeverity(fieldDiffs),
        fieldDiffs
      });
    }
  }

  for (const toSection of toSections) {
    if (matchedTo.has(stringifyId(toSection._id))) continue;
    const remaining = [...toByKey.values()].flat();
    if (!remaining.some((row) => stringifyId(row._id) === stringifyId(toSection._id))) continue;
    diffs.push(sectionPresenceDiff(null, toSection, 'added'));
  }

  return diffs;
}

function sectionPresenceDiff(fromSection, toSection, changeType) {
  const section = toSection || fromSection;
  return {
    entityType: 'section',
    sectionId: stringifyId(section?._id),
    quoteSectionId: section?.quoteSectionId || null,
    label: section?.sectionTitle || 'Section',
    changeType,
    impactArea: 'scope',
    customerVisible: true,
    severity: 'medium',
    fromValue: fromSection ? serializeSectionSummary(fromSection) : null,
    toValue: toSection ? serializeSectionSummary(toSection) : null,
    fieldDiffs: []
  };
}

function sectionFieldDiffs(fromSection, toSection) {
  const defs = [
    { field: 'sectionTitle', label: 'Section title', impactArea: 'scope', customerVisible: true },
    { field: 'sectionDescription', label: 'Section description', impactArea: 'scope', customerVisible: true },
    { field: 'sectionType', label: 'Section type', impactArea: 'scope', customerVisible: true },
    { field: 'includeInQuoteTotal', label: 'Included in total', impactArea: 'pricing', customerVisible: true },
    { field: 'sectionOrder', label: 'Section order', impactArea: 'structure', customerVisible: true, type: 'number' },
    { field: 'sectionDiscountAmount', label: 'Section discount', impactArea: 'discount', customerVisible: true, type: 'money' },
    { field: 'sectionTotal', label: 'Section total', impactArea: 'pricing', customerVisible: true, type: 'money' }
  ];
  return defs
    .map((def) => compareScalar({ fromRecord: fromSection, toRecord: toSection, def, entityType: 'section', entityId: stringifyId(toSection._id) }))
    .filter(Boolean);
}

function serializeSectionSummary(section) {
  return {
    sectionTitle: section?.sectionTitle || null,
    sectionType: section?.sectionType || null,
    sectionTotal: numberValue(section?.sectionTotal)
  };
}

function diffLines(fromLines, toLines, fromSectionLookup, toSectionLookup) {
  const toByStable = indexByKey(toLines, (line) => line.quoteLineId);
  const toByComposite = indexByKey(toLines, (line) => lineKey(line, toSectionLookup));
  const matchedTo = new Set();
  const diffs = [];

  for (const fromLine of fromLines) {
    let toLine = takeMatch(toByStable, fromLine.quoteLineId);
    if (!toLine) toLine = takeMatch(toByComposite, lineKey(fromLine, fromSectionLookup));
    if (!toLine || matchedTo.has(stringifyId(toLine._id))) {
      diffs.push(linePresenceDiff(fromLine, null, 'removed', fromSectionLookup, toSectionLookup));
      continue;
    }
    matchedTo.add(stringifyId(toLine._id));
    const fieldDiffs = LINE_FIELDS
      .map((def) => compareScalar({ fromRecord: fromLine, toRecord: toLine, def, entityType: 'line', entityId: toLine.quoteLineId }))
      .filter(Boolean);
    if (fieldDiffs.length) {
      diffs.push({
        entityType: 'line',
        lineId: stringifyId(toLine._id),
        quoteLineId: toLine.quoteLineId,
        label: toLine.itemNameSnapshot || toLine.skuSnapshot || fromLine.itemNameSnapshot || 'Line',
        sectionId: stringifyId(toLine.quoteSectionId),
        lineType: toLine.lineType || fromLine.lineType || 'standard',
        changeType: 'changed',
        impactArea: lineImpactArea(fieldDiffs),
        customerVisible: fieldDiffs.some((d) => d.customerVisible),
        severity: highestSeverity(fieldDiffs),
        quantityDelta: numberValue(toLine.quantity) - numberValue(fromLine.quantity),
        unitPriceDelta: numberValue(toLine.unitPriceSnapshot) - numberValue(fromLine.unitPriceSnapshot),
        discountDelta: numberValue(toLine.discountAmount) - numberValue(fromLine.discountAmount),
        taxDelta: numberValue(toLine.lineTaxTotal) - numberValue(fromLine.lineTaxTotal),
        totalDelta: numberValue(toLine.lineTotal) - numberValue(fromLine.lineTotal),
        fieldDiffs
      });
    }
  }

  for (const toLine of toLines) {
    if (matchedTo.has(stringifyId(toLine._id))) continue;
    diffs.push(linePresenceDiff(null, toLine, 'added', fromSectionLookup, toSectionLookup));
  }

  return diffs;
}

function linePresenceDiff(fromLine, toLine, changeType, fromSectionLookup, toSectionLookup) {
  const line = toLine || fromLine;
  return {
    entityType: 'line',
    lineId: stringifyId(line?._id),
    quoteLineId: line?.quoteLineId || null,
    label: line?.itemNameSnapshot || line?.skuSnapshot || 'Line',
    sectionId: stringifyId(line?.quoteSectionId),
    sectionLabel: (toLine ? toSectionLookup : fromSectionLookup).get(stringifyId(line?.quoteSectionId)) || null,
    lineType: line?.lineType || 'standard',
    changeType,
    impactArea: 'scope',
    customerVisible: line?.hiddenLine !== true,
    severity: Math.abs(numberValue(line?.lineTotal)) >= RISK_THRESHOLDS.highValueLine ? 'high' : 'medium',
    quantityDelta: changeType === 'added' ? numberValue(line?.quantity) : -numberValue(line?.quantity),
    unitPriceDelta: changeType === 'added' ? numberValue(line?.unitPriceSnapshot) : -numberValue(line?.unitPriceSnapshot),
    discountDelta: changeType === 'added' ? numberValue(line?.discountAmount) : -numberValue(line?.discountAmount),
    taxDelta: changeType === 'added' ? numberValue(line?.lineTaxTotal) : -numberValue(line?.lineTaxTotal),
    totalDelta: changeType === 'added' ? numberValue(line?.lineTotal) : -numberValue(line?.lineTotal),
    fromValue: fromLine ? serializeLineSummary(fromLine) : null,
    toValue: toLine ? serializeLineSummary(toLine) : null,
    fieldDiffs: []
  };
}

function serializeLineSummary(line) {
  return {
    itemNameSnapshot: line?.itemNameSnapshot || null,
    skuSnapshot: line?.skuSnapshot || null,
    quantity: numberValue(line?.quantity),
    unitPriceSnapshot: numberValue(line?.unitPriceSnapshot),
    discountAmount: numberValue(line?.discountAmount),
    lineTotal: numberValue(line?.lineTotal)
  };
}

function lineImpactArea(fieldDiffs) {
  const areas = new Set(fieldDiffs.map((d) => d.impactArea));
  if (areas.has('pricing') || areas.has('discount')) return areas.has('discount') ? 'discount' : 'pricing';
  if (areas.has('scope')) return 'scope';
  if (areas.has('structure')) return 'structure';
  return 'metadata';
}

function highestSeverity(items) {
  const order = { low: 0, medium: 1, high: 2 };
  return items.reduce((max, item) => (order[item.severity] > order[max] ? item.severity : max), 'low');
}

function buildSectionLookup(sections) {
  const map = new Map();
  for (const section of sections || []) {
    map.set(stringifyId(section._id), section.sectionTitle || section.quoteSectionId || 'Section');
  }
  return map;
}

function summarize(headerDiffs, sectionDiffs, lineDiffs, fromQuote, toQuote) {
  const totalDelta = numberValue(toQuote.grandTotal) - numberValue(fromQuote.grandTotal);
  const discountDelta =
    numberValue(toQuote.lineDiscountTotal) +
    numberValue(toQuote.globalDiscountTotal) -
    numberValue(fromQuote.lineDiscountTotal) -
    numberValue(fromQuote.globalDiscountTotal);
  const allDiffs = [...headerDiffs, ...sectionDiffs, ...lineDiffs];
  const impactAreas = [...new Set(allDiffs.map((d) => d.impactArea).filter(Boolean))];
  const riskIndicators = deriveRiskIndicators({ totalDelta, discountDelta, headerDiffs, sectionDiffs, lineDiffs, fromQuote, toQuote });
  const riskLevel = riskIndicators.some((r) => r.severity === 'high')
    ? 'high'
    : riskIndicators.some((r) => r.severity === 'medium')
      ? 'medium'
      : 'low';

  const changeCounts = {
    header: headerDiffs.length,
    sectionsAdded: sectionDiffs.filter((d) => d.changeType === 'added').length,
    sectionsRemoved: sectionDiffs.filter((d) => d.changeType === 'removed').length,
    sectionsChanged: sectionDiffs.filter((d) => d.changeType === 'changed').length,
    linesAdded: lineDiffs.filter((d) => d.changeType === 'added').length,
    linesRemoved: lineDiffs.filter((d) => d.changeType === 'removed').length,
    linesChanged: lineDiffs.filter((d) => d.changeType === 'changed').length
  };

  return {
    executiveSummary: buildExecutiveSummary({ changeCounts, totalDelta, discountDelta, riskIndicators, currency: toQuote.currency || fromQuote.currency }),
    changeCounts,
    totalDelta: Number(totalDelta.toFixed(2)),
    discountDelta: Number(discountDelta.toFixed(2)),
    riskLevel,
    riskIndicators,
    impactAreas
  };
}

function deriveRiskIndicators({ totalDelta, discountDelta, headerDiffs, lineDiffs }) {
  const indicators = [];
  if (totalDelta <= -RISK_THRESHOLDS.highTotalDelta) {
    indicators.push({ key: 'large_total_decrease', label: 'Large total decrease', severity: 'high', impactArea: 'pricing' });
  } else if (Math.abs(totalDelta) >= RISK_THRESHOLDS.mediumTotalDelta) {
    indicators.push({ key: 'total_changed', label: 'Material total change', severity: 'medium', impactArea: 'pricing' });
  }
  if (discountDelta >= RISK_THRESHOLDS.highDiscountDelta) {
    indicators.push({ key: 'discount_increased_high', label: 'Discount increased materially', severity: 'high', impactArea: 'discount' });
  } else if (discountDelta >= RISK_THRESHOLDS.mediumDiscountDelta) {
    indicators.push({ key: 'discount_increased', label: 'Discount increased', severity: 'medium', impactArea: 'discount' });
  }
  if (lineDiffs.some((d) => d.changeType === 'removed' && Math.abs(numberValue(d.totalDelta)) >= RISK_THRESHOLDS.highValueLine)) {
    indicators.push({ key: 'high_value_line_removed', label: 'High-value line removed', severity: 'high', impactArea: 'scope' });
  }
  if (lineDiffs.some((d) => d.changeType === 'added' && numberValue(d.toValue?.lineTotal ?? d.totalDelta) === 0)) {
    indicators.push({ key: 'zero_value_line_added', label: 'Zero-value line added', severity: 'medium', impactArea: 'pricing' });
  }
  if (lineDiffs.some((d) => d.unitPriceDelta < 0)) {
    indicators.push({ key: 'unit_price_decreased', label: 'Unit price decreased on one or more lines', severity: 'medium', impactArea: 'pricing' });
  }
  if (headerDiffs.some((d) => ['validUntil', 'quoteDate'].includes(d.field))) {
    indicators.push({ key: 'timing_changed', label: 'Quote timing changed', severity: 'medium', impactArea: 'timing' });
  }
  return indicators;
}

function buildExecutiveSummary({ changeCounts, totalDelta, discountDelta, riskIndicators, currency }) {
  const rows = [];
  if (totalDelta !== 0) rows.push(`Grand total ${totalDelta > 0 ? 'increased' : 'decreased'} by ${formatMoney(Math.abs(totalDelta), currency)}.`);
  if (discountDelta !== 0) rows.push(`Discount ${discountDelta > 0 ? 'increased' : 'decreased'} by ${formatMoney(Math.abs(discountDelta), currency)}.`);
  const lineChanges = [];
  if (changeCounts.linesAdded) lineChanges.push(`${changeCounts.linesAdded} added`);
  if (changeCounts.linesRemoved) lineChanges.push(`${changeCounts.linesRemoved} removed`);
  if (changeCounts.linesChanged) lineChanges.push(`${changeCounts.linesChanged} changed`);
  if (lineChanges.length) rows.push(`Lines changed: ${lineChanges.join(', ')}.`);
  const sectionChanges = [];
  if (changeCounts.sectionsAdded) sectionChanges.push(`${changeCounts.sectionsAdded} added`);
  if (changeCounts.sectionsRemoved) sectionChanges.push(`${changeCounts.sectionsRemoved} removed`);
  if (changeCounts.sectionsChanged) sectionChanges.push(`${changeCounts.sectionsChanged} changed`);
  if (sectionChanges.length) rows.push(`Sections changed: ${sectionChanges.join(', ')}.`);
  if (riskIndicators.length) rows.push(`${riskIndicators.length} commercial risk indicator${riskIndicators.length === 1 ? '' : 's'} detected.`);
  if (!rows.length) rows.push('No material changes detected between these revisions.');
  return rows.slice(0, 5);
}

function formatMoney(value, currency) {
  const n = Number(value) || 0;
  const suffix = currency ? ` ${currency}` : '';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

async function resolveCompareTargets({ organizationId, quoteId, fromRevision, toRevision }) {
  const current = await Quote.findOne({ _id: quoteId, organizationId }).lean();
  if (!current) {
    const err = new Error('Quote not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const family = await Quote.find({ organizationId, quoteNumber: current.quoteNumber })
    .sort({ revisionNumber: 1, createdAt: 1 })
    .lean();
  const to = toRevision
    ? family.find((q) => Number(q.revisionNumber) === Number(toRevision))
    : current;
  if (!to) {
    const err = new Error('Target revision not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  let from = fromRevision
    ? family.find((q) => Number(q.revisionNumber) === Number(fromRevision))
    : null;
  if (!from) {
    from = await resolveDefaultBaseline({ organizationId, family, to });
  }
  if (!from) {
    return { current, family, from: null, to };
  }
  if (String(from.quoteNumber) !== String(to.quoteNumber)) {
    const err = new Error('Cannot compare revisions from different quotes');
    err.code = 'VALIDATION';
    throw err;
  }
  return { current, family, from, to };
}

async function resolveDefaultBaseline({ organizationId, family, to }) {
  const prior = family.filter((q) => Number(q.revisionNumber) < Number(to.revisionNumber));
  if (!prior.length) return null;
  const approvedByStatus = [...prior].reverse().find((q) => APPROVED_BASELINE_STATUSES.has(String(q.status || '')));
  if (approvedByStatus) return approvedByStatus;
  const approvals = await QuoteApproval.find({
    organizationId,
    quoteId: { $in: prior.map((q) => q._id) },
    action: 'approve'
  }).lean();
  if (approvals.length) {
    const approvedRevisions = new Set(approvals.map((row) => Number(row.revisionNumber)));
    const approved = [...prior].reverse().find((q) => approvedRevisions.has(Number(q.revisionNumber)));
    if (approved) return approved;
  }
  return prior[prior.length - 1];
}

function applyFilters(diffs, filters = {}) {
  return diffs.filter((diff) => {
    if (filters.impactArea && diff.impactArea !== filters.impactArea) return false;
    if (filters.customerVisible != null && String(diff.customerVisible) !== String(filters.customerVisible)) return false;
    if (filters.changeType && diff.changeType !== filters.changeType) return false;
    if (filters.riskLevel && diff.severity !== filters.riskLevel) return false;
    if (filters.sectionId && String(diff.sectionId || diff.quoteSectionId || '') !== String(filters.sectionId)) return false;
    if (filters.lineType && String(diff.lineType || '') !== String(filters.lineType)) return false;
    return true;
  });
}

function extractFilters(query = {}) {
  return {
    impactArea: query.impactArea || null,
    customerVisible: query.customerVisible == null || query.customerVisible === '' ? null : String(query.customerVisible) === 'true',
    changeType: query.changeType || null,
    riskLevel: query.riskLevel || null,
    sectionId: query.sectionId || null,
    lineType: query.lineType || null
  };
}

async function compareQuoteRevisions({ organizationId, quoteId, fromRevision = null, toRevision = null, filters = {} }) {
  const { from, to } = await resolveCompareTargets({ organizationId, quoteId, fromRevision, toRevision });
  if (!from) {
    return {
      quoteNumber: to.quoteNumber,
      from: null,
      to: revisionSummary(to),
      summary: {
        executiveSummary: ['No prior revision to compare.'],
        changeCounts: { header: 0, sectionsAdded: 0, sectionsRemoved: 0, sectionsChanged: 0, linesAdded: 0, linesRemoved: 0, linesChanged: 0 },
        totalDelta: 0,
        discountDelta: 0,
        riskLevel: 'low',
        riskIndicators: [],
        impactAreas: []
      },
      filters: { available: ['impactArea', 'customerVisible', 'changeType', 'riskLevel', 'sectionId', 'lineType'], applied: filters },
      headerDiffs: [],
      sectionDiffs: [],
      lineDiffs: [],
      approvalHistory: []
    };
  }

  const [fromSections, toSections, fromLines, toLines, approvalHistory] = await Promise.all([
    QuoteSection.find({ organizationId, quoteId: from._id }).sort({ sectionOrder: 1 }).lean(),
    QuoteSection.find({ organizationId, quoteId: to._id }).sort({ sectionOrder: 1 }).lean(),
    QuoteLine.find({ organizationId, quoteId: from._id }).sort({ lineOrder: 1, createdAt: 1 }).lean(),
    QuoteLine.find({ organizationId, quoteId: to._id }).sort({ lineOrder: 1, createdAt: 1 }).lean(),
    QuoteApproval.find({ organizationId, quoteId: { $in: [from._id, to._id] } })
      .populate('actorUserId', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .lean()
  ]);

  const fromSectionLookup = buildSectionLookup(fromSections);
  const toSectionLookup = buildSectionLookup(toSections);
  const headerDiffs = diffHeaders(from, to);
  const sectionDiffs = diffSections(fromSections, toSections);
  const lineDiffs = diffLines(fromLines, toLines, fromSectionLookup, toSectionLookup);
  const summary = summarize(headerDiffs, sectionDiffs, lineDiffs, from, to);

  return {
    quoteNumber: to.quoteNumber,
    from: revisionSummary(from),
    to: revisionSummary(to),
    summary,
    filters: {
      available: ['impactArea', 'customerVisible', 'changeType', 'riskLevel', 'sectionId', 'lineType'],
      applied: filters
    },
    headerDiffs: applyFilters(headerDiffs, filters),
    sectionDiffs: applyFilters(sectionDiffs, filters),
    lineDiffs: applyFilters(lineDiffs, filters),
    approvalHistory: approvalHistory.map(serializeApproval)
  };
}

function revisionSummary(quote) {
  if (!quote) return null;
  return {
    quoteId: stringifyId(quote._id),
    quoteNumber: quote.quoteNumber,
    revisionNumber: Number(quote.revisionNumber) || 1,
    activeRevision: quote.activeRevision === true,
    status: quote.status,
    quoteTitle: quote.quoteTitle || null,
    currency: quote.currency || 'USD',
    grandTotal: numberValue(quote.grandTotal),
    createdAt: quote.createdAt || null,
    updatedAt: quote.updatedAt || null
  };
}

function serializeApproval(row) {
  const actor = row.actorUserId && typeof row.actorUserId === 'object'
    ? {
        id: stringifyId(row.actorUserId._id),
        name: [row.actorUserId.firstName, row.actorUserId.lastName].filter(Boolean).join(' ').trim() || row.actorUserId.email || 'User',
        email: row.actorUserId.email || null
      }
    : { id: stringifyId(row.actorUserId), name: 'User', email: null };
  return {
    type: 'quote_approval',
    action: row.action,
    revisionNumber: Number(row.revisionNumber) || 1,
    fromStatus: row.fromStatus || null,
    toStatus: row.toStatus || null,
    actor,
    comment: row.comment || null,
    metadata: row.metadata || {},
    createdAt: row.createdAt
  };
}

module.exports = {
  compareQuoteRevisions,
  extractFilters,
  resolveCompareTargets,
  RISK_THRESHOLDS
};
