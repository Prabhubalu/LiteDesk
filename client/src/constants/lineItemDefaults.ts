import { createNodeId } from '@/utils/templateBuilderTree';
import { CONTENT_COMPONENT_TYPES } from '@/constants/contentComponentRegistry';
import type { ContentComponentNode } from '@/constants/contentComponentRegistry';
import type { TableGridCell, TableGridBindings } from '@/utils/builderTableGridModel';
import { createEmptyCell, equalColumnPercents, updateColumnWidthPercent } from '@/utils/builderTableGridModel';

export interface LineItemColumn {
  key: string;
  header: string;
  path: string;
  align: 'left' | 'center' | 'right';
  format?: 'text' | 'currency' | 'date';
  visible?: boolean;
}

export interface LineItemBindings {
  collection: string;
  moduleScope: string;
  showSections: boolean;
  showSectionTotals: boolean;
  showDocumentTotals: boolean;
  columns: LineItemColumn[];
  tableWidthPercent: number;
  widthUnit: 'percent' | 'px';
  columnWidthPercents: number[];
  columnWidths: number[];
}

export const DEFAULT_LINE_ITEM_COLUMNS: LineItemColumn[] = [
  { key: 'sku', header: 'SKU', path: 'skuSnapshot', align: 'left', format: 'text' },
  { key: 'name', header: 'Item', path: 'name', align: 'left', format: 'text' },
  { key: 'quantity', header: 'Qty', path: 'quantity', align: 'right', format: 'text' },
  { key: 'unitPrice', header: 'Unit Price', path: 'unitPrice', align: 'right', format: 'currency' },
  { key: 'lineTotal', header: 'Total', path: 'lineTotal', align: 'right', format: 'currency' }
];

const DEFAULT_COLUMN_WIDTHS = [92, 220, 48, 74, 86];

const PREVIEW_LINE_ROW_ONE: Record<string, string> = {
  sku: 'SKU-001',
  name: 'Professional services',
  quantity: '10',
  unitPrice: '100.00',
  lineTotal: '1,000.00'
};

const PREVIEW_LINE_ROW_TWO: Record<string, string> = {
  sku: 'SKU-002',
  name: 'Support package',
  quantity: '1',
  unitPrice: '250.00',
  lineTotal: '250.00'
};

export function normalizeLineItemColumnList(raw?: LineItemColumn[]): LineItemColumn[] {
  const byKey = new Map(DEFAULT_LINE_ITEM_COLUMNS.map((column) => [
    column.key,
    { ...column, visible: true }
  ]));
  if (Array.isArray(raw)) {
    for (const column of raw) {
      const key = String(column?.key || '').trim();
      if (!byKey.has(key)) continue;
      byKey.set(key, {
        ...byKey.get(key)!,
        ...column,
        key,
        visible: column.visible !== false
      });
    }
  }
  return [...byKey.values()];
}

export function visibleLineItemColumns(raw?: LineItemColumn[]): LineItemColumn[] {
  return normalizeLineItemColumnList(raw).filter((column) => column.visible !== false);
}

export function resolveLineItemLayoutColumns(raw?: LineItemColumn[]) {
  const columns = normalizeLineItemColumnList(raw);
  const visibleColumns = visibleLineItemColumns(columns);
  const defaultKeys = DEFAULT_LINE_ITEM_COLUMNS.map((column) => column.key);
  const columnWidths = visibleColumns.map((column) => {
    const index = defaultKeys.indexOf(column.key);
    return DEFAULT_COLUMN_WIDTHS[index] ?? 120;
  });
  return {
    columns,
    visibleColumns,
    columnWidths,
    columnWidthPercents: equalColumnPercents(Math.max(1, visibleColumns.length))
  };
}

function previewLineRow(values: Record<string, string>, columns: LineItemColumn[]): TableGridCell[] {
  return columns.map((column) => ({
    text: values[column.key] || '',
    align: column.align,
    colSpan: 1,
    rowSpan: 1,
    skip: false,
    format: column.format || 'text'
  }));
}

export function createLineItemBindings(moduleScope = ''): LineItemBindings {
  const columns = normalizeLineItemColumnList();
  const layout = resolveLineItemLayoutColumns(columns);
  return {
    collection: 'lines',
    moduleScope: String(moduleScope || '').trim().toLowerCase(),
    showSections: true,
    showSectionTotals: true,
    showDocumentTotals: true,
    columns: layout.columns,
    tableWidthPercent: 100,
    widthUnit: 'percent',
    columnWidthPercents: layout.columnWidthPercents,
    columnWidths: layout.columnWidths
  };
}

export function createLineItemNode(moduleScope = ''): ContentComponentNode {
  return {
    id: createNodeId('line-item'),
    type: CONTENT_COMPONENT_TYPES.LINE_ITEM,
    name: 'Line items',
    bindings: createLineItemBindings(moduleScope),
    style: {},
    children: []
  };
}

function mergedLabelCell(text: string, colSpan: number, align: 'left' | 'right' = 'left'): TableGridCell {
  return { text, align, colSpan, rowSpan: 1, skip: false, format: 'text' };
}

function totalRow(label: string, value: string, colCount: number): TableGridCell[] {
  const labelSpan = Math.max(1, colCount - 1);
  const row: TableGridCell[] = [
    mergedLabelCell(label, labelSpan, 'right'),
    ...Array.from({ length: labelSpan - 1 }, () => ({ ...createEmptyCell(), skip: true })),
    { text: value, align: 'right', colSpan: 1, rowSpan: 1, skip: false, format: 'currency' }
  ];
  return row.slice(0, colCount);
}

/** Builder preview grid mirroring the server LineItem layout. */
export function buildLineItemPreviewGrid(bindings: Partial<LineItemBindings> = {}): TableGridBindings['grid'] {
  const visibleColumns = visibleLineItemColumns(bindings.columns);
  const colCount = visibleColumns.length;
  const showSections = bindings.showSections !== false;
  const showSectionTotals = bindings.showSectionTotals !== false;
  const showDocumentTotals = bindings.showDocumentTotals !== false;
  const moduleScope = String(bindings.moduleScope || 'quotes').toLowerCase();
  const grandLabel = moduleScope === 'invoices' ? 'Amount Due' : 'Grand Total';

  if (colCount <= 0) return [];

  const grid: TableGridCell[][] = [
    visibleColumns.map((column) => ({
      text: column.header,
      align: column.align,
      colSpan: 1,
      rowSpan: 1,
      skip: false,
      format: 'text' as const
    }))
  ];

  if (showSections) {
    grid.push([
      mergedLabelCell('Products', colCount),
      ...Array.from({ length: colCount - 1 }, () => ({ ...createEmptyCell(), skip: true }))
    ]);
  }

  grid.push(previewLineRow(PREVIEW_LINE_ROW_ONE, visibleColumns));

  if (showSections && showSectionTotals) {
    grid.push(totalRow('Section total', '1,000.00', colCount));
    grid.push([
      mergedLabelCell('Services', colCount),
      ...Array.from({ length: colCount - 1 }, () => ({ ...createEmptyCell(), skip: true }))
    ]);
  }

  grid.push(previewLineRow(PREVIEW_LINE_ROW_TWO, visibleColumns));

  if (showSections && showSectionTotals) {
    grid.push(totalRow('Section total', '250.00', colCount));
  }

  if (showDocumentTotals) {
    grid.push(totalRow('Subtotal', '1,250.00', colCount));
    grid.push(totalRow('Tax', '250.00', colCount));
    grid.push(totalRow(grandLabel, '1,250.00', colCount));
  }

  return grid;
}

export function buildLineItemPreviewTableBindings(
  bindings: Partial<LineItemBindings> = {}
): TableGridBindings {
  const layout = resolveLineItemLayoutColumns(bindings.columns);
  const visibleColumns = layout.visibleColumns;
  const storedWidths = Array.isArray(bindings.columnWidths) ? bindings.columnWidths : [];
  const storedPercents = Array.isArray(bindings.columnWidthPercents) ? bindings.columnWidthPercents : [];
  return {
    grid: buildLineItemPreviewGrid({ ...bindings, columns: layout.columns }),
    columnWidths: storedWidths.length === visibleColumns.length
      ? storedWidths
      : layout.columnWidths,
    columnWidthPercents: storedPercents.length === visibleColumns.length
      ? storedPercents
      : layout.columnWidthPercents,
    tableWidthPercent: bindings.tableWidthPercent ?? 100,
    widthUnit: bindings.widthUnit ?? 'percent',
    collection: bindings.collection || 'lines',
    repeatRowIndex: null
  };
}

export function lineItemNodeToPreviewTableNode(node: ContentComponentNode): ContentComponentNode {
  const bindings = (node.bindings || {}) as Partial<LineItemBindings>;
  return {
    ...node,
    type: CONTENT_COMPONENT_TYPES.TABLE,
    bindings: buildLineItemPreviewTableBindings(bindings)
  };
}

export function mergeLineItemTableWidthPatch(
  lineItemBindings: Partial<LineItemBindings>,
  tableBindingsPatch: Partial<TableGridBindings>
): Partial<LineItemBindings> {
  const layout = resolveLineItemLayoutColumns(lineItemBindings.columns);
  const visibleCount = layout.visibleColumns.length;
  const columnWidths = Array.isArray(tableBindingsPatch.columnWidths)
    && tableBindingsPatch.columnWidths.length === visibleCount
    ? tableBindingsPatch.columnWidths
    : lineItemBindings.columnWidths ?? layout.columnWidths;
  const columnWidthPercents = Array.isArray(tableBindingsPatch.columnWidthPercents)
    && tableBindingsPatch.columnWidthPercents.length === visibleCount
    ? tableBindingsPatch.columnWidthPercents
    : lineItemBindings.columnWidthPercents ?? layout.columnWidthPercents;

  return {
    ...lineItemBindings,
    columns: layout.columns,
    columnWidths,
    columnWidthPercents,
    tableWidthPercent: tableBindingsPatch.tableWidthPercent
      ?? lineItemBindings.tableWidthPercent
      ?? 100,
    widthUnit: 'percent'
  };
}

export function updateLineItemColumnWidthPercent(
  bindings: Partial<LineItemBindings>,
  col: number,
  nextPercent: number
): Partial<LineItemBindings> {
  const tableBindings = buildLineItemPreviewTableBindings(bindings);
  const next = updateColumnWidthPercent(tableBindings, col, nextPercent);
  return mergeLineItemTableWidthPatch(bindings, next);
}
