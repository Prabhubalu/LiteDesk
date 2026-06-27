'use strict';

const DEFAULT_LINE_ITEM_COLUMNS = Object.freeze([
  { key: 'sku', header: 'SKU', path: 'skuSnapshot', align: 'left' },
  { key: 'name', header: 'Item', path: 'name', align: 'left' },
  { key: 'quantity', header: 'Qty', path: 'quantity', align: 'right', format: 'text' },
  { key: 'unitPrice', header: 'Unit Price', path: 'unitPrice', align: 'right', format: 'currency' },
  { key: 'lineTotal', header: 'Total', path: 'lineTotal', align: 'right', format: 'currency' }
]);

const DEFAULT_COLUMN_WIDTHS = Object.freeze([72, 180, 48, 74, 86]);
const DEFAULT_COLUMN_WIDTH_PERCENTS = Object.freeze([14, 30, 12, 17, 27]);

function normalizeLineItemColumns(raw) {
  const byKey = new Map(DEFAULT_LINE_ITEM_COLUMNS.map((column) => [
    column.key,
    { ...column, visible: column.visible !== false }
  ]));
  if (Array.isArray(raw)) {
    for (const column of raw) {
      const key = String(column?.key || column?.path || '').trim();
      if (!byKey.has(key)) continue;
      byKey.set(key, {
        ...byKey.get(key),
        ...column,
        key,
        header: String(column?.header || byKey.get(key).header),
        path: String(column?.path || byKey.get(key).path),
        align: column?.align === 'center' || column?.align === 'right' ? column.align : 'left',
        format: column?.format === 'currency' || column?.format === 'date' ? column.format : 'text',
        visible: column.visible !== false
      });
    }
  }
  return [...byKey.values()];
}

function visibleLineItemColumns(raw) {
  return normalizeLineItemColumns(raw).filter((column) => column.visible !== false);
}

function resolveLineItemLayoutColumns(raw) {
  const columns = normalizeLineItemColumns(raw);
  const visibleColumns = visibleLineItemColumns(columns);
  const defaultKeys = DEFAULT_LINE_ITEM_COLUMNS.map((column) => column.key);
  const columnWidths = visibleColumns.map((column) => {
    const index = defaultKeys.indexOf(column.key);
    return DEFAULT_COLUMN_WIDTHS[index] ?? 120;
  });
  const count = Math.max(1, visibleColumns.length);
  const base = Math.floor((100 / count) * 100) / 100;
  const columnWidthPercents = Array.from({ length: count }, () => base);
  if (count > 0) {
    columnWidthPercents[count - 1] = Math.round((100 - base * (count - 1)) * 100) / 100;
  }
  return { columns, visibleColumns, columnWidths, columnWidthPercents };
}

function createLineItemBindings(options = {}) {
  const currencyDisplay = options.currencyDisplay === 'symbol' ? 'symbol' : 'code';
  return {
    collection: 'lines',
    moduleScope: options.moduleScope ? String(options.moduleScope) : '',
    showSections: options.showSections !== false,
    showSectionTotals: options.showSectionTotals !== false,
    showDocumentTotals: options.showDocumentTotals !== false,
    currencyDisplay: options.currencyDisplay === '' || options.currencyDisplay == null
      ? undefined
      : currencyDisplay,
    columns: normalizeLineItemColumns(options.columns),
    tableWidthPercent: 100,
    widthUnit: 'percent',
    columnWidthPercents: [...DEFAULT_COLUMN_WIDTH_PERCENTS],
    columnWidths: [...DEFAULT_COLUMN_WIDTHS]
  };
}

module.exports = {
  DEFAULT_LINE_ITEM_COLUMNS,
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_COLUMN_WIDTH_PERCENTS,
  normalizeLineItemColumns,
  visibleLineItemColumns,
  resolveLineItemLayoutColumns,
  createLineItemBindings
};
