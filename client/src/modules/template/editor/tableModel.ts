import type { Component, Editor } from 'grapesjs';
import { chipHtmlToMergeTokens, mergeTokensToChipHtml } from '@/utils/builderMergeTagHtml';
import { findLineItemInnerTableComponent, findLineItemRoot, isLineItemInnerTable } from './lineItemModel';

export type TableSection = 'thead' | 'tbody' | 'tfoot';

export interface TableCellTarget {
  tableId: string;
  cellId: string;
  logicalRow: number;
  logicalCol: number;
  colSpan: number;
  rowIndex: number;
}

export interface TableRowRef {
  component: Component;
  section: TableSection;
  sectionIndex: number;
  rowIndex: number;
}

export interface TableCellRef {
  component: Component;
  row: TableRowRef;
  logicalRow: number;
  logicalCol: number;
  colSpan: number;
  rowSpan: number;
  isHeader: boolean;
}

export interface TableGrid {
  table: Component;
  rows: TableRowRef[];
  cells: Array<Array<TableCellRef | null>>;
  colCount: number;
}

const CELL_TAGS = new Set(['td', 'th']);
const ROW_TAG = 'tr';
const SECTION_TAGS = new Set(['thead', 'tbody', 'tfoot']);

function cellHasVisibleContent(text: string): boolean {
  return Boolean(
    String(text ?? '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n/g, '')
      .trim()
  );
}

export function isTableComponent(component: Component | null | undefined): boolean {
  if (!component) return false;
  if (String(component.get('tagName') || '').toLowerCase() !== 'table') return false;
  const attrs = component.getAttributes?.() || {};
  if (attrs['data-line-item-table'] === 'true') return false;
  return true;
}

export function isResizableTableComponent(component: Component | null | undefined): boolean {
  if (!component) return false;
  if (String(component.get('tagName') || '').toLowerCase() !== 'table') return false;
  return isTableComponent(component) || isLineItemInnerTable(component);
}

export function isTableCellComponent(component: Component | null | undefined): boolean {
  if (!component) return false;
  const type = String(component.get('type') || '').toLowerCase();
  if (type === 'cell' || type === 'arivu-cell') return true;
  const tag = String(component.get('tagName') || '').toLowerCase();
  return CELL_TAGS.has(tag);
}

export function isTableRowComponent(component: Component | null | undefined): boolean {
  if (!component) return false;
  const type = String(component.get('type') || '').toLowerCase();
  if (type === 'row') return true;
  return String(component.get('tagName') || '').toLowerCase() === ROW_TAG;
}

export function resolveTableCellComponent(component: Component | null | undefined): Component | null {
  let current = component;
  while (current) {
    if (isTableCellComponent(current)) return current;
    current = current.parent?.() || null;
  }
  return null;
}

export function findTableRoot(component: Component | null | undefined): Component | null {
  const lineItemRoot = findLineItemRoot(component);
  if (lineItemRoot) {
    return findLineItemInnerTableComponent(lineItemRoot);
  }

  let current = component;
  while (current) {
    if (isTableComponent(current)) return current;
    current = current.parent?.() || null;
  }
  return null;
}

export function findResizableTableRoot(component: Component | null | undefined): Component | null {
  return findTableRoot(component);
}

function parseSpan(value: unknown, fallback = 1): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sectionTag(component: Component): TableSection {
  const tag = String(component.get('tagName') || 'tbody').toLowerCase();
  if (tag === 'thead' || tag === 'tfoot') return tag;
  return 'tbody';
}

function collectRows(table: Component): TableRowRef[] {
  const rows: TableRowRef[] = [];
  let logicalRow = 0;

  for (const section of table.components()) {
    if (isTableRowComponent(section)) {
      const sectionIndex = rows.filter((row) => row.section === 'tbody').length;
      rows.push({
        component: section,
        section: 'tbody',
        sectionIndex,
        rowIndex: logicalRow
      });
      logicalRow += 1;
      continue;
    }

    const tag = String(section.get('tagName') || '').toLowerCase();
    if (!SECTION_TAGS.has(tag)) {
      continue;
    }

    const sectionName = sectionTag(section);
    let sectionIndex = 0;
    for (const row of section.components()) {
      if (!isTableRowComponent(row)) continue;
      rows.push({
        component: row,
        section: sectionName,
        sectionIndex,
        rowIndex: logicalRow
      });
      sectionIndex += 1;
      logicalRow += 1;
    }
  }

  return rows;
}

type GrapesElementView = { model?: Component };

export function resolveComponentFromElement(target: EventTarget | null): Component | null {
  let node = target as (HTMLElement & { __gjsv?: GrapesElementView }) | null;
  while (node) {
    const model = node.__gjsv?.model;
    if (model) return model;
    node = node.parentElement;
  }
  return null;
}

export function resolveTableCellFromElement(
  target: EventTarget | null,
  editor: Editor | null
): Component | null {
  const el = target instanceof Element ? target.closest('td, th') : null;
  if (!el) return resolveTableCellComponent(resolveComponentFromElement(target));

  const direct = resolveComponentFromElement(el);
  if (direct && isTableCellComponent(direct) && direct.view?.el === el) {
    return direct;
  }

  const tableEl = el.closest('table');
  const tableComponent = tableEl ? resolveComponentFromElement(tableEl) : null;
  if (tableComponent && isResizableTableComponent(tableComponent)) {
    for (const rowRef of collectRows(tableComponent)) {
      for (const cell of listRowCells(rowRef.component)) {
        if (cell.view?.el === el) return cell;
      }
    }
  }

  if (editor && direct) {
    const cellId = direct.getId?.();
    if (cellId != null) {
      const wrapper = editor.getWrapper?.();
      const found = wrapper ? findComponentInTree(wrapper, String(cellId)) : null;
      if (found && isTableCellComponent(found)) return found;
    }
  }

  return resolveTableCellComponent(direct ?? resolveComponentFromElement(target));
}

function findComponentInTree(root: Component, componentId: string): Component | null {
  if (String(root.getId()) === componentId) return root;
  for (const child of root.components()) {
    const found = findComponentInTree(child, componentId);
    if (found) return found;
  }
  return null;
}

export function findComponentById(editor: Editor, componentId: string): Component | null {
  const wrapper = editor.getWrapper?.();
  if (!wrapper) return null;
  return findComponentInTree(wrapper, componentId);
}

export function snapshotTableCellTarget(cell: Component): TableCellTarget | null {
  const ctx = getTableCellContext(cell);
  const table = findTableRoot(cell);
  if (!ctx || !table) return null;
  return {
    tableId: String(table.getId()),
    cellId: String(cell.getId()),
    logicalRow: ctx.logicalRow,
    logicalCol: ctx.logicalCol,
    colSpan: ctx.colSpan,
    rowIndex: ctx.row.rowIndex
  };
}

export function resolveTableCellTarget(
  editor: Editor,
  target: TableCellTarget
): { table: Component; cell: Component; ctx: TableCellRef } | null {
  const wrapper = editor.getWrapper?.();
  if (!wrapper) return null;

  const table = findComponentInTree(wrapper, target.tableId);
  if (!table || !isResizableTableComponent(table)) return null;

  const byId = findComponentInTree(table, target.cellId);
  if (byId && isTableCellComponent(byId)) {
    const ctx = getTableCellContext(byId);
    if (ctx) return { table, cell: byId, ctx };
  }

  const grid = buildTableGrid(table);
  const ctx = getAnchorCell(grid, target.logicalRow, target.logicalCol);
  if (!ctx) return null;
  return { table, cell: ctx.component, ctx };
}

export function buildTableGrid(table: Component): TableGrid {
  const rows = collectRows(table);
  const occupancy: Array<Array<TableCellRef | null>> = [];
  let colCount = 0;

  for (const rowRef of rows) {
    const r = rowRef.rowIndex;
    occupancy[r] = occupancy[r] || [];

    for (const cell of rowRef.component.components()) {
      if (!isTableCellComponent(cell)) continue;

      let c = 0;
      while (occupancy[r][c]) c += 1;

      const colSpan = parseSpan(cell.getAttributes?.().colspan);
      const rowSpan = parseSpan(cell.getAttributes?.().rowspan);
      const isHeader =
        String(cell.get('tagName') || '').toLowerCase() === 'th' || rowRef.section === 'thead';
      const cellRef: TableCellRef = {
        component: cell,
        row: rowRef,
        logicalRow: r,
        logicalCol: c,
        colSpan,
        rowSpan,
        isHeader
      };

      for (let dr = 0; dr < rowSpan; dr += 1) {
        for (let dc = 0; dc < colSpan; dc += 1) {
          const targetRow = r + dr;
          occupancy[targetRow] = occupancy[targetRow] || [];
          occupancy[targetRow][c + dc] = cellRef;
        }
      }

      colCount = Math.max(colCount, c + colSpan);
    }
  }

  return { table, rows, cells: occupancy, colCount: Math.max(colCount, 1) };
}

export function getTableCellContext(component: Component | null | undefined): TableCellRef | null {
  const table = findTableRoot(component);
  if (!table || !component || !isTableCellComponent(component)) return null;
  return findCellInGrid(buildTableGrid(table), component);
}

export function getCellAt(grid: TableGrid, row: number, col: number): TableCellRef | null {
  return grid.cells[row]?.[col] || null;
}

export function getAnchorCell(grid: TableGrid, row: number, col: number): TableCellRef | null {
  const cell = getCellAt(grid, row, col);
  if (!cell) return null;
  return getCellAt(grid, cell.logicalRow, cell.logicalCol);
}

export function findCellInGrid(grid: TableGrid, component: Component): TableCellRef | null {
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell?.component === component) return cell;
    }
  }
  return null;
}

export function findFirstTableCell(table: Component | null | undefined): Component | null {
  if (!table || !isResizableTableComponent(table)) return null;

  const grid = buildTableGrid(table);
  for (const row of grid.cells) {
    for (const cellRef of row) {
      if (cellRef?.component) return cellRef.component;
    }
  }
  return null;
}

export function isTableStructureComponent(component: Component | null | undefined): boolean {
  if (!component) return false;
  const tag = String(component.get('tagName') || '').toLowerCase();
  return tag === 'table' || tag === 'thead' || tag === 'tbody' || tag === 'tfoot' || tag === 'tr';
}

export function resolveMergeTargetTableCell(
  editor: Editor,
  lastSelectedCell: Component | null = null
): Component | null {
  const selected = editor.getSelected();
  const direct = resolveTableCellComponent(selected);
  if (direct) return direct;

  const table = findTableRoot(selected) ?? findTableRoot(lastSelectedCell);
  if (table) {
    if (lastSelectedCell && isTableCellComponent(lastSelectedCell) && lastSelectedCell.parent?.()) {
      const lastTable = findTableRoot(lastSelectedCell);
      if (lastTable === table) return lastSelectedCell;
    }
    return findFirstTableCell(table);
  }

  return null;
}

export function isSelectionInTableContext(component: Component | null | undefined): boolean {
  if (!component) return false;
  if (isTableCellComponent(component) || isTableStructureComponent(component)) return true;
  return Boolean(findResizableTableRoot(component));
}

export function listRowCells(row: Component): Component[] {
  return row.components().filter((child: Component) => isTableCellComponent(child));
}

export function buildRowDefinition(colCount: number, isHeader: boolean): Record<string, unknown> {
  return {
    tagName: 'tr',
    components: Array.from({ length: colCount }, () => createTableCellDefinition(isHeader))
  };
}

export function createTableCellDefinition(isHeader: boolean): Record<string, unknown> {
  return {
    type: 'arivu-cell',
    tagName: isHeader ? 'th' : 'td',
    style: {
      border: '1px solid #e5e5e5',
      padding: '8px',
      ...(isHeader ? { 'text-align': 'left' } : {})
    },
    content: '&nbsp;'
  };
}

export function defaultCellMarkup(isHeader: boolean): string {
  const tag = isHeader ? 'th' : 'td';
  const align = isHeader ? 'text-align:left;' : '';
  return `<${tag} style="border:1px solid #e5e5e5;padding:8px;${align}">&nbsp;</${tag}>`;
}

export function readCellText(cell: Component): string {
  const fromModel = cell.get('content');
  const hasChildren = cell.components().length > 0;

  if (typeof fromModel === 'string') {
    const normalized = chipHtmlToMergeTokens(fromModel);
    if (!cellHasVisibleContent(normalized)) {
      if (!hasChildren) return '';
    } else {
      return normalized;
    }
  }

  const parts = cell.components().map((child: Component) => {
    const childContent = child.get('content');
    if (typeof childContent === 'string' && childContent.trim()) {
      return chipHtmlToMergeTokens(childContent);
    }
    const text = child.view?.el?.textContent;
    return text ? chipHtmlToMergeTokens(text) : '';
  });
  const fromChildren = parts.filter(Boolean).join(' ').trim();
  if (fromChildren) return fromChildren;

  const el = cell.view?.el;
  if (el) {
    return chipHtmlToMergeTokens(el.innerHTML);
  }

  return '';
}

function clearTableCellChildren(cell: Component): void {
  const collection = cell.components();
  if (typeof collection.reset === 'function') {
    collection.reset();
    return;
  }
  while (collection.length > 0) {
    collection.at(0)?.remove();
  }
}

export function lineItemRowKind(row: Component): string {
  const attrs = row.getAttributes?.() || {};
  const explicit = attrs['data-line-item-row'];
  if (explicit) return String(explicit);
  if (listRowCells(row).some((cell) => String(cell.get('tagName') || '').toLowerCase() === 'th')) {
    return 'header';
  }
  return 'static';
}

export interface PreservedLineItemRow {
  rowIndex: number;
  kind: string;
  cells: string[];
}

export function captureLineItemRowCellContent(table: Component | null): PreservedLineItemRow[] {
  if (!table) return [];

  const grid = buildTableGrid(table);
  return grid.rows.map((rowRef) => ({
    rowIndex: rowRef.rowIndex,
    kind: lineItemRowKind(rowRef.component),
    cells: listRowCells(rowRef.component).map((cell) => readCellText(cell))
  }));
}

export function restoreLineItemRowCellContent(
  table: Component | null,
  preserved: PreservedLineItemRow[]
): void {
  if (!table || preserved.length === 0) return;

  const grid = buildTableGrid(table);
  for (const rowRef of grid.rows) {
    const kind = lineItemRowKind(rowRef.component);
    const saved = preserved.find(
      (row) => row.rowIndex === rowRef.rowIndex && row.kind === kind
    );
    if (!saved) continue;

    const cells = listRowCells(rowRef.component);
    if (cells.length !== saved.cells.length) continue;

    cells.forEach((cell, index) => {
      writeCellText(cell, saved.cells[index] ?? '');
    });
  }
}

export function syncTableCellsForSerialize(editor: Editor): void {
  const wrapper = editor.getWrapper?.();
  if (!wrapper) return;

  const visit = (component: Component) => {
    if (isTableCellComponent(component)) {
      writeCellText(component, readCellText(component));
    }
    component.components().forEach(visit);
  };
  visit(wrapper);
}

export function writeCellText(cell: Component, html: string): void {
  const tokens = chipHtmlToMergeTokens(html);
  clearTableCellChildren(cell);
  cell.set('content', cellHasVisibleContent(tokens) ? tokens : '&nbsp;');
  paintTableCellContent(cell);
}

export function paintTableCellContent(cell: Component): void {
  const el = cell.view?.el as HTMLElement | undefined;
  if (!el || el.classList.contains('arivu-sheet-cell-editing')) return;

  const raw = readCellText(cell);

  if (!cellHasVisibleContent(raw)) {
    if (el.innerHTML !== '&nbsp;') el.innerHTML = '&nbsp;';
    return;
  }

  const painted = mergeTokensToChipHtml(raw);
  if (el.innerHTML !== painted) {
    el.innerHTML = painted;
  }
}

export function repaintTableCells(table: Component): void {
  const grid = buildTableGrid(table);
  const painted = new Set<Component>();

  for (const row of grid.cells) {
    for (const cellRef of row) {
      if (!cellRef || painted.has(cellRef.component)) continue;
      painted.add(cellRef.component);
      paintTableCellContent(cellRef.component);
    }
  }
}
