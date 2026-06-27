'use strict';

const {
  DEFAULT_COLUMN_WIDTHS,
  normalizeLineItemColumns,
  visibleLineItemColumns,
  resolveLineItemLayoutColumns
} = require('../../../constants/lineItemDefaults');
const { formatCurrencyAmount, resolveCurrencyDisplayMode } = require('../../../utils/currencyFormat');
const { resolveMergeTagsInString, resolveMergeExpression } = require('./mergeTagEngine');

function sectionTypeSuffix(section) {
  const type = String(section?.sectionType || 'standard');
  if (type === 'optional') return ' (Optional)';
  if (type === 'future') return ' (Future)';
  return '';
}

function createCell(text, {
  align = 'left',
  colSpan = 1,
  rowSpan = 1,
  skip = false,
  format = 'text',
  variant = null
} = {}) {
  return {
    text: text != null ? String(text) : '',
    align,
    colSpan,
    rowSpan,
    skip,
    format,
    ...(variant ? { variant } : {})
  };
}

function skipCells(count) {
  return Array.from({ length: count }, () => createCell('', { skip: true }));
}

function buildSectionBlocks(sections, lines, sectionIdField) {
  const visibleLines = (Array.isArray(lines) ? lines : []).filter((line) => line && line.hiddenLine !== true);
  const sortedSections = (Array.isArray(sections) ? sections : [])
    .filter((section) => section && section.hiddenSection !== true)
    .sort((a, b) => (Number(a.sectionOrder) || 0) - (Number(b.sectionOrder) || 0));

  if (!sortedSections.length) {
    return [{ section: null, lines: visibleLines }];
  }

  const assigned = new Set(sortedSections.map((section) => String(section._id || section.id || '')));
  const blocks = sortedSections.map((section) => ({
    section,
    lines: visibleLines.filter((line) => {
      const lineSectionId = line[sectionIdField] || line.quoteSectionId || line.invoiceSectionId || line.salesOrderSectionId;
      return String(lineSectionId || '') === String(section._id || section.id || '');
    })
  }));

  const orphans = visibleLines.filter((line) => {
    const lineSectionId = line[sectionIdField] || line.quoteSectionId || line.invoiceSectionId || line.salesOrderSectionId;
    return !lineSectionId || !assigned.has(String(lineSectionId));
  });

  if (orphans.length) {
    blocks.push({
      section: {
        sectionTitle: 'General',
        sectionType: 'standard',
        showSectionTotal: false
      },
      lines: orphans
    });
  }

  return blocks;
}

function resolveLineField(line, path, scope, options) {
  const fieldPath = String(path || '').trim();
  if (!fieldPath) return '';
  const result = resolveMergeExpression({ ...scope, ...line, item: line, line }, fieldPath);
  if (result.resolved) return result.value;
  if (options.lenient && fieldPath) return `{{${fieldPath}}}`;
  return '';
}

function formatMoneyValue(value, scope) {
  const currency = scope.parameters?.currency
    || scope.Quote?.currency
    || scope.Invoice?.currency
    || scope.Record?.currency
    || '';
  const locale = String(scope?.parameters?.locale || scope?.locale || 'en-US');
  return formatCurrencyAmount(
    value,
    currency,
    resolveCurrencyDisplayMode(scope),
    locale
  );
}

function resolveRecordTotals(scope, moduleScope) {
  const key = String(moduleScope || '').toLowerCase();
  const record = key === 'invoices'
    ? (scope.Invoice || scope.Record || scope.record || {})
    : (scope.Quote || scope.Record || scope.record || {});

  return {
    subtotal: Number(record.subtotal) || 0,
    lineDiscountTotal: Number(record.lineDiscountTotal) || 0,
    globalDiscountTotal: Number(record.globalDiscountTotal ?? record.discountTotal) || 0,
    taxTotal: Number(record.taxTotal) || 0,
    adjustmentTotal: Number(record.adjustmentTotal) || 0,
    grandTotal: Number(record.grandTotal ?? record.amountDue) || 0,
    currency: record.currency || scope.parameters?.currency || ''
  };
}

function buildTotalRow(label, value, colCount, { bold = false } = {}) {
  const labelSpan = Math.max(1, colCount - 1);
  return [
    createCell(label, {
      align: 'right',
      colSpan: labelSpan,
      variant: bold ? 'total' : 'subtotal'
    }),
    ...skipCells(labelSpan - 1),
    createCell(value, {
      align: 'right',
      format: 'currency',
      variant: bold ? 'total' : 'subtotal'
    })
  ];
}

function resolveLineItemTable(component, scope, options = {}) {
  const bindings = component.bindings || {};
  const layout = resolveLineItemLayoutColumns(bindings.columns);
  const columns = layout.visibleColumns.length ? layout.visibleColumns : visibleLineItemColumns();
  const colCount = columns.length;
  const showSections = bindings.showSections !== false;
  const showSectionTotals = bindings.showSectionTotals !== false;
  const showDocumentTotals = bindings.showDocumentTotals !== false;
  const moduleScope = String(bindings.moduleScope || scope.recordModuleKey || '').toLowerCase();
  const sectionIdField = moduleScope === 'invoices'
    ? 'invoiceSectionId'
    : moduleScope === 'sales_orders'
      ? 'salesOrderSectionId'
      : 'quoteSectionId';

  const lines = Array.isArray(scope.lines) ? scope.lines : [];
  const sections = Array.isArray(scope.sections) ? scope.sections : [];
  const gridRows = [];

  gridRows.push(columns.map((column) => createCell(column.header, {
    align: column.align,
    variant: 'header'
  })));

  const sectionBlocks = showSections
    ? buildSectionBlocks(sections, lines, sectionIdField)
    : [{ section: null, lines }];

  for (const block of sectionBlocks) {
    if (block.section?.sectionTitle) {
      gridRows.push([
        createCell(`${block.section.sectionTitle}${sectionTypeSuffix(block.section)}`, {
          colSpan: colCount,
          variant: 'sectionHeader'
        }),
        ...skipCells(colCount - 1)
      ]);
    }

    for (const line of block.lines) {
      const rowScope = { ...scope, ...line, item: line, line };
      gridRows.push(columns.map((column) => {
        let text = resolveLineField(line, column.path, rowScope, options);
        if (column.format === 'currency' && text !== '' && !String(text).includes('{{')) {
          const formatted = resolveMergeExpression(rowScope, `${column.path}|currency`);
          if (formatted.resolved) text = formatted.value;
        }
        return createCell(text, { align: column.align, format: column.format || 'text' });
      }));
    }

    if (block.section && showSectionTotals && block.section.showSectionTotal !== false) {
      const section = block.section;
      if (Number(section.sectionDiscountTotal) > 0) {
        gridRows.push(buildTotalRow(
          'Section subtotal',
          formatMoneyValue(section.sectionSubtotal, scope),
          colCount
        ));
        gridRows.push(buildTotalRow(
          'Section discount',
          `-${formatMoneyValue(section.sectionDiscountTotal, scope)}`,
          colCount
        ));
      }
      gridRows.push(buildTotalRow(
        'Section total',
        formatMoneyValue(section.sectionTotal ?? section.sectionSubtotal ?? 0, scope),
        colCount,
        { bold: true }
      ));
    }
  }

  if (showDocumentTotals) {
    const totals = resolveRecordTotals(scope, moduleScope);
    gridRows.push(buildTotalRow('Subtotal', formatMoneyValue(totals.subtotal, scope), colCount));
    if (totals.lineDiscountTotal > 0) {
      gridRows.push(buildTotalRow(
        'Line discounts',
        `-${formatMoneyValue(totals.lineDiscountTotal, scope)}`,
        colCount
      ));
    }
    if (totals.globalDiscountTotal > 0) {
      const discountLabel = moduleScope === 'invoices' ? 'Invoice discount' : 'Quote discount';
      gridRows.push(buildTotalRow(
        discountLabel,
        `-${formatMoneyValue(totals.globalDiscountTotal, scope)}`,
        colCount
      ));
    }
    gridRows.push(buildTotalRow('Tax', formatMoneyValue(totals.taxTotal, scope), colCount));
    if (totals.adjustmentTotal !== 0) {
      gridRows.push(buildTotalRow('Adjustment', formatMoneyValue(totals.adjustmentTotal, scope), colCount));
    }
    const grandLabel = moduleScope === 'invoices' ? 'Amount Due' : 'Grand Total';
    gridRows.push(buildTotalRow(
      grandLabel,
      formatMoneyValue(totals.grandTotal, scope),
      colCount,
      { bold: true }
    ));
  }

  component.resolvedTable = {
    gridRows,
    columnWidths: Array.isArray(bindings.columnWidths) && bindings.columnWidths.length === colCount
      ? bindings.columnWidths.map((width) => Math.max(48, Number(width) || 120))
      : layout.columnWidths,
    columnWidthPercents: Array.isArray(bindings.columnWidthPercents) && bindings.columnWidthPercents.length === colCount
      ? bindings.columnWidthPercents
      : layout.columnWidthPercents,
    headers: columns.map((column) => column.header),
    headerCells: [],
    rows: [],
    footerCells: []
  };

  return component;
}

module.exports = {
  resolveLineItemTable,
  buildSectionBlocks,
  sectionTypeSuffix
};
