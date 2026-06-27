import type { ContentComponentNode } from '@/constants/contentComponentRegistry';
import { createNodeId } from '@/utils/templateBuilderTree';
import {
  resolveContentAreaPx,
  resolvePageMarginsPx
} from '@/constants/contentPageSettings';
import { clampLayoutToContentArea, type BuilderBlockLayout } from '@/utils/builderLayout';

export type TableCellAlign = 'left' | 'center' | 'right';

export type TableCellFormat = 'text' | 'currency' | 'date';

export interface TableGridCell {
  text: string;
  align: TableCellAlign;
  format?: TableCellFormat;
  colSpan: number;
  rowSpan: number;
  skip: boolean;
}

export interface TableGridBindings {
  [key: string]: unknown;
  grid: TableGridCell[][];
  columnWidths: number[];
  columnWidthPercents: number[];
  tableWidthPercent: number;
  widthUnit: TableWidthUnit;
  collection: string;
  repeatRowIndex: number | null;
}

export type TableWidthUnit = 'percent' | 'px';

export interface TableCellAddress {
  row: number;
  col: number;
}

const DEFAULT_COL_WIDTH = 120;
const MIN_COL_WIDTH = 48;
const MIN_ROWS = 1;
const MIN_COLS = 1;
const MAX_ROWS = 50;
const MAX_COLS = 20;

const MIN_TABLE_WIDTH_PERCENT = 10;
const MAX_TABLE_WIDTH_PERCENT = 100;
const MIN_COL_PERCENT = 5;

export function equalColumnPercents(colCount: number): number[] {
  if (colCount <= 0) return [];
  const base = Math.floor((100 / colCount) * 100) / 100;
  const percents = Array.from({ length: colCount }, () => base);
  percents[colCount - 1] = Math.round((100 - base * (colCount - 1)) * 100) / 100;
  return percents;
}

export function normalizeColumnPercents(raw: unknown, colCount: number): number[] {
  const source = Array.isArray(raw) ? raw.map((value) => Number(value) || 0) : [];
  while (source.length < colCount) source.push(0);
  const trimmed = source.slice(0, colCount);
  const total = trimmed.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return equalColumnPercents(colCount);
  return trimmed.map((value) => Math.round((Math.max(0, value) / total) * 10000) / 100);
}

export function resolveTableWidthPx(bindings: TableGridBindings, contentWidthPx: number): number {
  if (bindings.widthUnit === 'px') {
    return computeGridTableWidth(bindings.columnWidths);
  }
  const percent = Math.max(
    MIN_TABLE_WIDTH_PERCENT,
    Math.min(MAX_TABLE_WIDTH_PERCENT, Number(bindings.tableWidthPercent) || MAX_TABLE_WIDTH_PERCENT)
  );
  return Math.round(Math.max(0, contentWidthPx) * percent / 100);
}

export function resolveColumnWidthsPx(bindings: TableGridBindings, contentWidthPx: number): number[] {
  const colCount = bindings.grid[0]?.length || 0;
  if (colCount <= 0) return [];
  if (bindings.widthUnit === 'px' && bindings.columnWidths.length === colCount) {
    return bindings.columnWidths.map((width) => Math.max(MIN_COL_WIDTH, Number(width) || DEFAULT_COL_WIDTH));
  }
  const tableWidth = resolveTableWidthPx(bindings, contentWidthPx);
  const percents = normalizeColumnPercents(bindings.columnWidthPercents, colCount);
  return percents.map((percent) => Math.max(MIN_COL_WIDTH, Math.round(tableWidth * percent / 100)));
}

export function updateColumnWidthPercent(
  bindings: TableGridBindings,
  col: number,
  nextPercent: number
): TableGridBindings {
  const colCount = bindings.grid[0]?.length || 0;
  const percents = normalizeColumnPercents(bindings.columnWidthPercents, colCount);
  const clamped = Math.max(MIN_COL_PERCENT, Math.min(100 - MIN_COL_PERCENT, Math.round(nextPercent)));
  const remaining = 100 - clamped;
  const otherIndexes = percents.map((_, index) => index).filter((index) => index !== col);
  const otherTotal = otherIndexes.reduce((sum, index) => sum + (percents[index] ?? 0), 0);
  const nextPercents = [...percents];
  nextPercents[col] = clamped;
  if (otherTotal > 0) {
    for (const index of otherIndexes) {
      const current = percents[index] ?? 0;
      nextPercents[index] = Math.round((current / otherTotal) * remaining * 100) / 100;
    }
  } else if (otherIndexes.length) {
    const share = Math.round((remaining / otherIndexes.length) * 100) / 100;
    for (const index of otherIndexes) nextPercents[index] = share;
  }
  const drift = 100 - nextPercents.reduce((sum, value) => sum + value, 0);
  const lastOtherIndex = otherIndexes[otherIndexes.length - 1];
  if (lastOtherIndex !== undefined) {
    nextPercents[lastOtherIndex] = (nextPercents[lastOtherIndex] ?? 0) + drift;
  }
  return { ...bindings, widthUnit: 'percent', columnWidthPercents: nextPercents };
}

export function createEmptyCell(): TableGridCell {
  return { text: '', align: 'left', colSpan: 1, rowSpan: 1, skip: false };
}

export function createEmptyGridBindings(rows: number, cols: number): TableGridBindings {
  const safeRows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, rows));
  const safeCols = Math.max(MIN_COLS, Math.min(MAX_COLS, cols));
  return {
    grid: Array.from({ length: safeRows }, () =>
      Array.from({ length: safeCols }, () => createEmptyCell())
    ),
    columnWidths: Array.from({ length: safeCols }, () => DEFAULT_COL_WIDTH),
    columnWidthPercents: equalColumnPercents(safeCols),
    tableWidthPercent: MAX_TABLE_WIDTH_PERCENT,
    widthUnit: 'percent',
    collection: '',
    repeatRowIndex: null
  };
}

export function createTableNode(rows: number, cols: number): ContentComponentNode {
  return {
    id: createNodeId('table'),
    type: 'Table',
    name: 'Table',
    bindings: createEmptyGridBindings(rows, cols),
    style: {},
    children: []
  };
}

function normalizeCell(raw: unknown): TableGridCell {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const formatRaw = source.format;
  const format = formatRaw === 'currency' || formatRaw === 'date' ? formatRaw : 'text';
  return {
    text: source.text != null ? String(source.text) : '',
    align: source.align === 'center' || source.align === 'right' ? source.align : 'left',
    format,
    colSpan: Math.max(1, Number(source.colSpan) || 1),
    rowSpan: Math.max(1, Number(source.rowSpan) || 1),
    skip: source.skip === true
  };
}

function migrateLegacyColumns(bindings: Record<string, unknown>): TableGridBindings | null {
  const columns = bindings.columns;
  if (!Array.isArray(columns) || !columns.length) return null;

  const colCount = columns.length;
  const headerRow = columns.map((col) => {
    const source = (col && typeof col === 'object' ? col : {}) as Record<string, unknown>;
    return normalizeCell({
      text: String(source.header ?? ''),
      align: source.align,
      colSpan: source.colSpan,
      headerSkip: source.headerSkip
    });
  });

  for (let i = 0; i < colCount; i += 1) {
    const source = columns[i] as Record<string, unknown>;
    const cell = headerRow[i];
    if (source.headerSkip && cell) headerRow[i] = { ...cell, skip: true };
  }

  const bodyRow = columns.map((col) => {
    const source = (col && typeof col === 'object' ? col : {}) as Record<string, unknown>;
    const path = source.path ? String(source.path) : '';
    const previewText = source.previewText ? String(source.previewText) : '';
    let text = previewText;
    if (path) {
      text = `{{${path.includes('.') ? path : `lines.${path}`}}}`;
    }
    return normalizeCell({ text, align: source.align, format: source.format });
  });

  const grid: TableGridCell[][] = [headerRow, bodyRow];
  const columnWidths = columns.map((col) => {
    const width = Number((col as Record<string, unknown>)?.width);
    return Number.isFinite(width) && width > 0 ? Math.max(MIN_COL_WIDTH, width) : DEFAULT_COL_WIDTH;
  });

  if (bindings.showFooter && Array.isArray(bindings.footerRow)) {
    const footerRow = Array.from({ length: colCount }, (_, index) => {
      const source = (bindings.footerRow as unknown[])[index] as Record<string, unknown> | undefined;
      if (!source) return createEmptyCell();
      const path = source.path ? String(source.path) : '';
      const text = path ? `{{${path}}}` : String(source.text ?? '');
      return normalizeCell({
        text,
        align: source.align,
        colSpan: source.colSpan,
        skip: source.skip
      });
    });
    grid.push(footerRow);
  }

  const hasLinePaths = columns.some((col) => {
    const source = (col && typeof col === 'object' ? col : {}) as Record<string, unknown>;
    return Boolean(source.path);
  });

  return {
    grid,
    columnWidths,
    columnWidthPercents: equalColumnPercents(colCount),
    tableWidthPercent: MAX_TABLE_WIDTH_PERCENT,
    widthUnit: 'percent',
    collection: bindings.collection ? String(bindings.collection) : '',
    repeatRowIndex: hasLinePaths ? 1 : null
  };
}

export function normalizeTableGridBindings(raw: unknown): TableGridBindings {
  const bindings = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (Array.isArray(bindings.grid) && bindings.grid.length) {
    const grid = bindings.grid.map((row) =>
      Array.isArray(row) ? row.map((cell) => normalizeCell(cell)) : []
    );
    const colCount = Math.max(...grid.map((row) => row.length), 1);
    const columnWidths = Array.isArray(bindings.columnWidths)
      ? bindings.columnWidths.map((w) => Math.max(MIN_COL_WIDTH, Number(w) || DEFAULT_COL_WIDTH))
      : Array.from({ length: colCount }, () => DEFAULT_COL_WIDTH);
    while (columnWidths.length < colCount) columnWidths.push(DEFAULT_COL_WIDTH);

    const columnWidthPercents = normalizeColumnPercents(bindings.columnWidthPercents, colCount);
    const tableWidthPercent = Math.max(
      MIN_TABLE_WIDTH_PERCENT,
      Math.min(MAX_TABLE_WIDTH_PERCENT, Number(bindings.tableWidthPercent) || MAX_TABLE_WIDTH_PERCENT)
    );

    return {
      grid,
      columnWidths: columnWidths.slice(0, colCount),
      columnWidthPercents,
      tableWidthPercent,
      widthUnit: 'percent',
      collection: bindings.collection ? String(bindings.collection) : '',
      repeatRowIndex: typeof bindings.repeatRowIndex === 'number' ? bindings.repeatRowIndex : null
    };
  }

  const migrated = migrateLegacyColumns(bindings);
  if (migrated) return migrated;

  return createEmptyGridBindings(3, 3);
}

export function computeGridTableWidth(columnWidths: number[]): number {
  return columnWidths.reduce((sum, width) => sum + (width || DEFAULT_COL_WIDTH), 0);
}

export function insertRow(grid: TableGridCell[][], index: number, colCount: number): TableGridCell[][] {
  const next = grid.map((row) => [...row]);
  const safeIndex = Math.max(0, Math.min(index, next.length));
  next.splice(safeIndex, 0, Array.from({ length: colCount }, () => createEmptyCell()));
  return next;
}

export function deleteRow(grid: TableGridCell[][], index: number): TableGridCell[][] {
  if (grid.length <= MIN_ROWS) return grid;
  return grid.filter((_, i) => i !== index);
}

export function insertColumn(bindings: TableGridBindings, index: number): TableGridBindings {
  const colCount = bindings.grid[0]?.length || 0;
  const safeIndex = Math.max(0, Math.min(index, colCount));
  const grid = bindings.grid.map((row) => {
    const nextRow = [...row];
    nextRow.splice(safeIndex, 0, createEmptyCell());
    return nextRow;
  });
  const columnWidths = [...bindings.columnWidths];
  columnWidths.splice(safeIndex, 0, DEFAULT_COL_WIDTH);
  const columnWidthPercents = [...normalizeColumnPercents(bindings.columnWidthPercents, colCount)];
  const insertedShare = Math.round((100 / (colCount + 1)) * 100) / 100;
  const scaled = columnWidthPercents.map((value) =>
    Math.round(value * (colCount / (colCount + 1)) * 100) / 100
  );
  scaled.splice(safeIndex, 0, insertedShare);
  let repeatRowIndex = bindings.repeatRowIndex;
  if (repeatRowIndex != null && repeatRowIndex < 0) repeatRowIndex = null;
  return {
    ...bindings,
    grid,
    columnWidths,
    columnWidthPercents: normalizeColumnPercents(scaled, colCount + 1),
    repeatRowIndex
  };
}

export function deleteColumn(bindings: TableGridBindings, index: number): TableGridBindings {
  const colCount = bindings.grid[0]?.length || 0;
  if (colCount <= MIN_COLS) return bindings;
  const grid = bindings.grid.map((row) => row.filter((_, i) => i !== index));
  const columnWidths = bindings.columnWidths.filter((_, i) => i !== index);
  const columnWidthPercents = normalizeColumnPercents(
    bindings.columnWidthPercents.filter((_, i) => i !== index),
    colCount - 1
  );
  return { ...bindings, grid, columnWidths, columnWidthPercents };
}

export function updateCell(
  bindings: TableGridBindings,
  row: number,
  col: number,
  patch: Partial<TableGridCell>
): TableGridBindings {
  const grid = bindings.grid.map((r, ri) =>
    r.map((cell, ci) => (ri === row && ci === col ? { ...cell, ...patch } : cell))
  );
  return { ...bindings, grid };
}

export function updateColumnWidth(
  bindings: TableGridBindings,
  col: number,
  width: number,
  contentWidthPx: number
): TableGridBindings {
  if (bindings.widthUnit === 'px') {
    const columnWidths = bindings.columnWidths.map((value, index) =>
      index === col ? Math.max(MIN_COL_WIDTH, Math.round(width)) : value
    );
    return { ...bindings, columnWidths };
  }
  const tableWidth = Math.max(MIN_COL_WIDTH, resolveTableWidthPx(bindings, contentWidthPx));
  const nextPercent = Math.max(MIN_COL_PERCENT, Math.min(95, Math.round((width / tableWidth) * 10000) / 100));
  return updateColumnWidthPercent(bindings, col, nextPercent);
}

export function setRepeatRowIndex(bindings: TableGridBindings, row: number | null): TableGridBindings {
  return {
    ...bindings,
    repeatRowIndex: row
  };
}

export function clearMerges(grid: TableGridCell[][]): TableGridCell[][] {
  return grid.map((row) =>
    row.map((cell) => ({ ...cell, colSpan: 1, rowSpan: 1, skip: false }))
  );
}

export function normalizeSelectionBounds(
  anchor: TableCellAddress,
  end: TableCellAddress
): { r0: number; r1: number; c0: number; c1: number } {
  return {
    r0: Math.min(anchor.row, end.row),
    r1: Math.max(anchor.row, end.row),
    c0: Math.min(anchor.col, end.col),
    c1: Math.max(anchor.col, end.col)
  };
}

export function isCellInSelectionBounds(
  row: number,
  col: number,
  anchor: TableCellAddress,
  end: TableCellAddress
): boolean {
  const { r0, r1, c0, c1 } = normalizeSelectionBounds(anchor, end);
  return row >= r0 && row <= r1 && col >= c0 && col <= c1;
}

export function canMergeSelection(
  anchor: TableCellAddress,
  end: TableCellAddress,
  grid?: TableGridCell[][]
): boolean {
  const { r0, r1, c0, c1 } = normalizeSelectionBounds(anchor, end);
  if (r0 === r1 && c0 === c1) return false;
  if (!grid?.length) return true;

  for (let ri = r0; ri <= r1; ri += 1) {
    for (let ci = c0; ci <= c1; ci += 1) {
      const cell = grid[ri]?.[ci];
      if (!cell || cell.skip) return false;
      const cellEndRow = ri + Math.max(1, cell.rowSpan) - 1;
      const cellEndCol = ci + Math.max(1, cell.colSpan) - 1;
      if (cellEndRow > r1 || cellEndCol > c1) return false;
    }
  }
  return true;
}

export function mergeCells(
  grid: TableGridCell[][],
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): TableGridCell[][] {
  const r0 = Math.min(startRow, endRow);
  const r1 = Math.max(startRow, endRow);
  const c0 = Math.min(startCol, endCol);
  const c1 = Math.max(startCol, endCol);
  if (r0 === r1 && c0 === c1) return grid;

  return grid.map((row, ri) =>
    row.map((cell, ci) => {
      if (ri < r0 || ri > r1 || ci < c0 || ci > c1) {
        return { ...cell, colSpan: 1, rowSpan: 1, skip: false };
      }
      if (ri === r0 && ci === c0) {
        return { ...cell, colSpan: c1 - c0 + 1, rowSpan: r1 - r0 + 1, skip: false };
      }
      return { ...cell, colSpan: 1, rowSpan: 1, skip: true };
    })
  );
}

export function unmergeCell(
  grid: TableGridCell[][],
  row: number,
  col: number
): TableGridCell[][] {
  const cell = grid[row]?.[col];
  if (!cell || (cell.colSpan <= 1 && cell.rowSpan <= 1)) return grid;
  const r1 = row + cell.rowSpan - 1;
  const c1 = col + cell.colSpan - 1;
  return grid.map((r, ri) =>
    r.map((c, ci) => {
      if (ri < row || ri > r1 || ci < col || ci > c1) return c;
      return { ...c, colSpan: 1, rowSpan: 1, skip: false };
    })
  );
}

export function cloneCell(cell: TableGridCell): TableGridCell {
  return { ...cell };
}

export function tableWidthPercentFromLayoutWidth(
  widthPx: number,
  contentWidthPx: number
): number {
  const ratio = widthPx / Math.max(1, contentWidthPx);
  return Math.max(
    MIN_TABLE_WIDTH_PERCENT,
    Math.min(MAX_TABLE_WIDTH_PERCENT, Math.round(ratio * 100))
  );
}

export function resolveSyncedTableLayout(
  node: ContentComponentNode,
  pageWidthPx: number,
  pageHeightPx: number
): BuilderBlockLayout {
  const bindings = normalizeTableGridBindings(node.bindings);
  const contentArea = resolveContentAreaPx(
    pageWidthPx,
    pageHeightPx,
    resolvePageMarginsPx()
  );
  const current = node.layout || {};
  const height = Math.max(32, Number(current.height) || 200);
  const zIndex = typeof current.zIndex === 'number' ? current.zIndex : undefined;
  const y = Math.max(contentArea.y, Number(current.y) || contentArea.y);

  if (bindings.widthUnit === 'percent') {
    const width = resolveTableWidthPx(bindings, contentArea.width);
    const fullWidth = (bindings.tableWidthPercent || MAX_TABLE_WIDTH_PERCENT) >= MAX_TABLE_WIDTH_PERCENT;
    const x = fullWidth
      ? contentArea.x
      : Math.max(contentArea.x, Number(current.x) || contentArea.x);

    return clampLayoutToContentArea({ x, y, width, height, zIndex }, contentArea);
  }

  const width = Math.max(
    computeGridTableWidth(bindings.columnWidths),
    Number(current.width) || 240
  );
  const x = Number(current.x) || contentArea.x;

  return clampLayoutToContentArea({ x, y, width, height, zIndex }, contentArea);
}

export function applySyncedTableLayouts(
  root: ContentComponentNode,
  pageWidthPx: number,
  pageHeightPx: number
): ContentComponentNode {
  const contentArea = resolveContentAreaPx(
    pageWidthPx,
    pageHeightPx,
    resolvePageMarginsPx()
  );

  function walk(node: ContentComponentNode): ContentComponentNode {
    let next: ContentComponentNode = node;

    if (node.type === 'Table') {
      const bindings = normalizeTableGridBindings(node.bindings);
      const syncedNode = { ...node, bindings };
      next = {
        ...syncedNode,
        layout: resolveSyncedTableLayout(syncedNode, pageWidthPx, pageHeightPx)
      };
    } else if (
      node.type !== 'Page'
      && node.layout
      && (typeof node.layout.x === 'number' || typeof node.layout.y === 'number')
    ) {
      const current = node.layout;
      next = {
        ...node,
        layout: clampLayoutToContentArea({
          x: Number(current.x) || contentArea.x,
          y: Number(current.y) || contentArea.y,
          width: Math.max(32, Number(current.width) || 240),
          height: Math.max(32, Number(current.height) || 80),
          zIndex: typeof current.zIndex === 'number' ? current.zIndex : undefined
        }, contentArea)
      };
    }

    if (Array.isArray(node.children) && node.children.length) {
      next = {
        ...next,
        children: node.children.map((child) => walk(child))
      };
    }
    return next;
  }
  return walk(root);
}

export { DEFAULT_COL_WIDTH, MIN_COL_WIDTH, MAX_ROWS, MAX_COLS, MIN_ROWS, MIN_COLS };
