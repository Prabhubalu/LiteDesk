import { createNodeId } from '@/utils/templateBuilderTree';

export type TableCellAlign = 'left' | 'center' | 'right';

export interface BuilderTableColumn {
  id: string;
  header: string;
  path?: string;
  previewText?: string;
  format?: string;
  width?: number;
  align?: TableCellAlign;
  colSpan?: number;
  headerSkip?: boolean;
}

export interface BuilderTableFooterCell {
  text?: string;
  path?: string;
  format?: string;
  align?: TableCellAlign;
  colSpan?: number;
  skip?: boolean;
}

export interface BuilderTableBindings {
  collection?: string;
  columns?: BuilderTableColumn[];
  showFooter?: boolean;
  footerRow?: BuilderTableFooterCell[];
}

export interface TableCellSelection {
  row: 'header' | 'body' | 'footer';
  startCol: number;
  endCol: number;
}

const DEFAULT_COLUMN_WIDTH = 120;
const MIN_COLUMN_WIDTH = 48;

export function normalizeTableColumns(raw: unknown): BuilderTableColumn[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((column, index) => normalizeColumn(column, index));
}

function normalizeColumn(column: unknown, index: number): BuilderTableColumn {
  const source = (column && typeof column === 'object' ? column : {}) as Record<string, unknown>;
  return {
    id: String(source.id || createNodeId('col')),
    header: String(source.header ?? `Column ${index + 1}`),
    path: source.path ? String(source.path) : '',
    previewText: source.previewText ? String(source.previewText) : '',
    format: source.format ? String(source.format) : 'text',
    width: normalizeWidth(source.width),
    align: normalizeAlign(source.align),
    colSpan: Math.max(1, Number(source.colSpan) || 1),
    headerSkip: source.headerSkip === true
  };
}

function normalizeWidth(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_COLUMN_WIDTH;
  return Math.max(MIN_COLUMN_WIDTH, Math.round(parsed));
}

export function computeTableWidth(columns: BuilderTableColumn[]): number {
  return columns.reduce((sum, column) => sum + (column.width || DEFAULT_COLUMN_WIDTH), 0);
}

export function formatBodyCellValue(column: BuilderTableColumn, collection: string): string {
  if (column.path) {
    const prefix = `${collection}.`;
    return column.path.startsWith(prefix) ? `{{${column.path}}}` : `{{${prefix}${column.path}}}`;
  }
  return column.previewText || '';
}

export function parseBodyCellValue(raw: string, collection: string): { path: string; previewText: string } {
  const text = String(raw || '').trim();
  const mergeMatch = text.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (mergeMatch) {
    let path = mergeMatch[1]?.trim() ?? '';
    const prefix = `${collection}.`;
    if (path.startsWith(prefix)) path = path.slice(prefix.length);
    return { path, previewText: '' };
  }
  return { path: '', previewText: text };
}

export function formatFooterCellValue(cell: BuilderTableFooterCell): string {
  if (cell.path) return `{{${String(cell.path)}}}`;
  return cell.text || '';
}

export function parseFooterCellValue(raw: string): { path: string; text: string } {
  const text = String(raw || '').trim();
  const mergeMatch = text.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (mergeMatch) {
    return { path: mergeMatch[1]?.trim() ?? '', text: '' };
  }
  return { path: '', text };
}

function normalizeAlign(value: unknown): TableCellAlign {
  if (value === 'center' || value === 'right') return value;
  return 'left';
}

export function normalizeFooterRow(raw: unknown, columnCount: number): BuilderTableFooterCell[] {
  if (!Array.isArray(raw)) {
    return Array.from({ length: columnCount }, () => ({ text: '', path: '', format: 'text', align: 'left' as const }));
  }
  return Array.from({ length: columnCount }, (_, index) => {
    const source = (raw[index] && typeof raw[index] === 'object' ? raw[index] : {}) as Record<string, unknown>;
    return {
      text: source.text ? String(source.text) : '',
      path: source.path ? String(source.path) : '',
      format: source.format ? String(source.format) : 'text',
      align: normalizeAlign(source.align),
      colSpan: Math.max(1, Number(source.colSpan) || 1),
      skip: source.skip === true
    };
  });
}

export function createDefaultColumn(index: number): BuilderTableColumn {
  return {
    id: createNodeId('col'),
    header: `Column ${index + 1}`,
    path: '',
    format: 'text',
    width: DEFAULT_COLUMN_WIDTH,
    align: 'left',
    colSpan: 1,
    headerSkip: false
  };
}

export function insertColumn(columns: BuilderTableColumn[], index: number): BuilderTableColumn[] {
  const next = [...columns];
  const safeIndex = Math.max(0, Math.min(index, next.length));
  next.splice(safeIndex, 0, createDefaultColumn(safeIndex));
  return clearHeaderMerges(next);
}

export function deleteColumn(columns: BuilderTableColumn[], index: number): BuilderTableColumn[] {
  if (columns.length <= 1) return columns;
  const next = columns.filter((_, i) => i !== index);
  return clearHeaderMerges(next);
}

export function updateColumnWidth(
  columns: BuilderTableColumn[],
  index: number,
  width: number
): BuilderTableColumn[] {
  return columns.map((column, i) =>
    i === index ? { ...column, width: Math.max(MIN_COLUMN_WIDTH, Math.round(width)) } : column
  );
}

export function updateColumn(
  columns: BuilderTableColumn[],
  index: number,
  patch: Partial<BuilderTableColumn>
): BuilderTableColumn[] {
  return columns.map((column, i) => (i === index ? { ...column, ...patch } : column));
}

export function clearHeaderMerges(columns: BuilderTableColumn[]): BuilderTableColumn[] {
  return columns.map((column) => ({
    ...column,
    colSpan: 1,
    headerSkip: false
  }));
}

export function mergeHeaderCells(
  columns: BuilderTableColumn[],
  startCol: number,
  endCol: number
): BuilderTableColumn[] {
  const start = Math.min(startCol, endCol);
  const end = Math.max(startCol, endCol);
  if (end <= start) return columns;

  return columns.map((column, index) => {
    if (index < start || index > end) {
      return { ...column, colSpan: 1, headerSkip: false };
    }
    if (index === start) {
      return { ...column, colSpan: end - start + 1, headerSkip: false };
    }
    return { ...column, colSpan: 1, headerSkip: true };
  });
}

export function mergeFooterCells(
  footerRow: BuilderTableFooterCell[],
  startCol: number,
  endCol: number
): BuilderTableFooterCell[] {
  const start = Math.min(startCol, endCol);
  const end = Math.max(startCol, endCol);
  if (end <= start) return footerRow;

  return footerRow.map((cell, index) => {
    if (index < start || index > end) {
      return { ...cell, colSpan: 1, skip: false };
    }
    if (index === start) {
      return { ...cell, colSpan: end - start + 1, skip: false };
    }
    return { ...cell, colSpan: 1, skip: true };
  });
}

export function clearFooterMerges(footerRow: BuilderTableFooterCell[]): BuilderTableFooterCell[] {
  return footerRow.map((cell) => ({ ...cell, colSpan: 1, skip: false }));
}

export function resizeFooterRow(footerRow: BuilderTableFooterCell[], columnCount: number): BuilderTableFooterCell[] {
  const next = [...footerRow];
  while (next.length < columnCount) {
    next.push({ text: '', path: '', format: 'text', align: 'left' });
  }
  return clearFooterMerges(next.slice(0, columnCount));
}

export function selectionRange(selection: TableCellSelection): { start: number; end: number } {
  return {
    start: Math.min(selection.startCol, selection.endCol),
    end: Math.max(selection.startCol, selection.endCol)
  };
}

export function columnStyle(column: BuilderTableColumn): Record<string, string> {
  const rules: Record<string, string> = {
    textAlign: column.align || 'left'
  };
  if (column.width) {
    rules.width = `${column.width}px`;
    rules.minWidth = `${column.width}px`;
  }
  return rules;
}

export function footerCellStyle(cell: BuilderTableFooterCell): Record<string, string> {
  return { textAlign: cell.align || 'left' };
}

export { DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH };
