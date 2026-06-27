import type { Component } from 'grapesjs';
import { buildTableGrid, isResizableTableComponent } from './tableModel';
import { patchComponentAttributes, patchComponentStyle } from './selection';

const MIN_COL_PERCENT = 5;

const TABLE_STRUCTURE_STYLE = {
  'table-layout': 'fixed',
  'border-collapse': 'collapse'
} as const;

const VOID_COL_DEFAULTS = {
  tagName: 'col',
  void: true,
  selectable: false,
  hoverable: false,
  highlightable: false,
  removable: false,
  draggable: false,
  layerable: false
} as const;

function listComponents(parent: Component): Component[] {
  return [...parent.components()];
}

function equalPercents(colCount: number): number[] {
  const each = 100 / colCount;
  const values = Array.from({ length: colCount }, () => each);
  const sum = values.reduce((acc, value) => acc + value, 0);
  values[values.length - 1] += 100 - sum;
  return values;
}

function parsePercentList(raw: unknown, colCount: number): number[] {
  const source = String(raw ?? '')
    .split(',')
    .map((part) => parseFloat(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!source.length) {
    return equalPercents(colCount);
  }

  if (source.length >= colCount) {
    const slice = source.slice(0, colCount);
    const total = slice.reduce((sum, value) => sum + value, 0) || 1;
    if (Math.abs(total - 100) < 1) {
      return slice;
    }
    return weightsToPercents(slice);
  }

  const next = [...source];
  while (next.length < colCount) {
    next.push(100 / colCount);
  }
  return weightsToPercents(next);
}

export function weightsToPercents(weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const percents = weights.map((weight) => (weight / total) * 100);
  const sum = percents.reduce((acc, value) => acc + value, 0);
  percents[percents.length - 1] += 100 - sum;
  return percents;
}

export function percentsToStorage(percents: number[]): number[] {
  return percents.map((value) => Math.round(value * 1000) / 1000);
}

export function readTableColumnPercents(table: Component): number[] {
  const grid = buildTableGrid(table);
  const attrs = table.getAttributes?.() || {};
  return parsePercentList(attrs['data-col-widths'], grid.colCount);
}

/** @deprecated Use readTableColumnPercents — values are now percentages summing to ~100. */
export function readTableColumnWidths(table: Component): number[] {
  return readTableColumnPercents(table);
}

export function writeTableColumnWidths(table: Component, percents: number[]): void {
  commitTableColumnWidths(table, percents);
}

function findColgroupComponent(table: Component): Component | null {
  return (
    listComponents(table).find(
      (child) => String(child.get('tagName') || '').toLowerCase() === 'colgroup'
    ) ?? null
  );
}

function ensureColgroupComponent(table: Component, colCount: number): Component | null {
  let colgroup = findColgroupComponent(table);
  if (!colgroup) {
    const appended = table.append(
      {
        tagName: 'colgroup',
        selectable: false,
        hoverable: false,
        highlightable: false,
        removable: false,
        draggable: false,
        layerable: false,
        components: []
      },
      { at: 0 }
    );
    colgroup = (appended[0] as Component) ?? null;
  }
  if (!colgroup) return null;

  let cols = listComponents(colgroup);
  while (cols.length < colCount) {
    colgroup.append({ ...VOID_COL_DEFAULTS });
    cols = listComponents(colgroup);
  }
  while (cols.length > colCount) {
    cols[cols.length - 1]?.remove();
    cols = listComponents(colgroup);
  }

  return colgroup;
}

function clearGrapesCellWidths(table: Component): void {
  const visit = (component: Component) => {
    const tag = String(component.get('tagName') || '').toLowerCase();
    if (tag === 'th' || tag === 'td') {
      patchComponentStyle(component, {
        width: undefined,
        'min-width': undefined,
        'max-width': undefined
      });
    }
    component.components().forEach(visit);
  };
  visit(table);
}

function clearTableCellWidths(tableEl: HTMLTableElement): void {
  tableEl.querySelectorAll('th, td').forEach((node) => {
    const cell = node as HTMLElement;
    cell.style.removeProperty('width');
    cell.style.removeProperty('min-width');
    cell.style.removeProperty('max-width');
  });
}

function applyTableShellToDom(tableEl: HTMLTableElement, percents: number[]): void {
  tableEl.style.setProperty('table-layout', 'fixed', 'important');
  tableEl.style.setProperty('border-collapse', 'collapse', 'important');
  tableEl.setAttribute('data-col-widths', percentsToStorage(percents).join(','));
}

export function applyColPercentsToDom(tableEl: HTMLTableElement, percents: number[]): void {
  const colgroups = tableEl.querySelectorAll(':scope > colgroup');
  colgroups.forEach((node, index) => {
    if (index > 0) node.remove();
  });

  let colgroup = tableEl.querySelector(':scope > colgroup');
  if (!colgroup) {
    colgroup = tableEl.ownerDocument.createElement('colgroup');
    tableEl.insertBefore(colgroup, tableEl.firstChild);
  }

  while (colgroup.children.length < percents.length) {
    colgroup.appendChild(tableEl.ownerDocument.createElement('col'));
  }
  while (colgroup.children.length > percents.length) {
    colgroup.lastElementChild?.remove();
  }

  percents.forEach((percent, index) => {
    const col = colgroup?.children.item(index) as HTMLElement | null;
    if (!col) return;
    col.style.width = `${percent}%`;
  });
}

function syncTableColumnPercents(
  table: Component,
  percents: number[],
  options: { persistAttributes?: boolean; clearCellStyles?: boolean; domOnly?: boolean } = {}
): void {
  if (!isResizableTableComponent(table)) return;

  const grid = buildTableGrid(table);
  const normalized =
    percents.length === grid.colCount
      ? [...percents]
      : parsePercentList(percents.join(','), grid.colCount);

  const tableEl = table.view?.el as HTMLTableElement | undefined;

  if (tableEl) {
    applyTableShellToDom(tableEl, normalized);
    applyColPercentsToDom(tableEl, normalized);
    clearTableCellWidths(tableEl);
  }

  if (options.domOnly) return;

  table.addStyle({ ...TABLE_STRUCTURE_STYLE }, { silent: true });

  if (options.persistAttributes) {
    patchComponentAttributes(table, { 'data-col-widths': percentsToStorage(normalized).join(',') });
  }

  const colgroup = ensureColgroupComponent(table, normalized.length);
  if (colgroup) {
    const cols = listComponents(colgroup);
    cols.forEach((col, index) => {
      const percent = normalized[index];
      if (percent == null) return;
      col.addStyle({ width: `${percent}%` }, { silent: true });
    });
  }

  if (options.clearCellStyles) {
    clearGrapesCellWidths(table);
    if (tableEl) clearTableCellWidths(tableEl);
  }
}

export function applyTableColumnLayout(table: Component, percents?: number[]): void {
  const resolved = percents ?? readTableColumnPercents(table);
  syncTableColumnPercents(table, resolved, { persistAttributes: true, clearCellStyles: true });
}

export function resizeColumnPairPercents(
  percents: number[],
  colIndex: number,
  leftPercent: number
): number[] {
  const next = [...percents];
  if (colIndex < 0 || colIndex >= next.length - 1) return next;

  const pairTotal = next[colIndex] + next[colIndex + 1];
  const clamped = Math.max(MIN_COL_PERCENT, Math.min(leftPercent, pairTotal - MIN_COL_PERCENT));

  next[colIndex] = clamped;
  next[colIndex + 1] = pairTotal - clamped;
  return next;
}

/** Pixel position of border → left column % within the adjacent pair. */
export function percentFromBorderPx(
  percents: number[],
  pairColIndex: number,
  borderPx: number,
  tableWidthPx: number
): number {
  if (!tableWidthPx) return percents[pairColIndex] ?? 50;

  let before = 0;
  for (let i = 0; i < pairColIndex; i += 1) {
    before += percents[i] ?? 0;
  }

  const pairTotal = (percents[pairColIndex] ?? 0) + (percents[pairColIndex + 1] ?? 0);
  const minBorderPx = ((before + MIN_COL_PERCENT) / 100) * tableWidthPx;
  const maxBorderPx = ((before + pairTotal - MIN_COL_PERCENT) / 100) * tableWidthPx;
  const clampedPx = Math.max(minBorderPx, Math.min(borderPx, maxBorderPx));
  const borderPercent = (clampedPx / tableWidthPx) * 100;
  return borderPercent - before;
}

export function previewTableColumnPercents(table: Component, percents: number[]): void {
  syncTableColumnPercents(table, percents, { persistAttributes: false, domOnly: true });
}

export function commitTableColumnWidths(table: Component, percents: number[]): void {
  const grid = buildTableGrid(table);
  const normalized = parsePercentList(percents.join(','), grid.colCount);
  syncTableColumnPercents(table, normalized, { persistAttributes: true, clearCellStyles: true });
}

export function ensureTableColumnLayout(table: Component): void {
  if (!isResizableTableComponent(table)) return;
  applyTableColumnLayout(table);
}

export function insertTableColumnWidth(table: Component, at: number): void {
  const percents = readTableColumnPercents(table);
  const safeAt = Math.max(0, Math.min(at, percents.length));
  const nextCount = percents.length + 1;
  const newShare = 100 / nextCount;
  const scaled = percents.map((value) => (value * percents.length) / nextCount);
  scaled.splice(safeAt, 0, newShare);
  writeTableColumnWidths(table, weightsToPercents(scaled));
}

export function removeTableColumnWidth(table: Component, at: number): void {
  const percents = readTableColumnPercents(table);
  if (at < 0 || at >= percents.length || percents.length <= 1) return;
  const removed = percents[at] ?? 0;
  const next = percents.filter((_, index) => index !== at);
  if (!next.length) return;
  const bonus = removed / next.length;
  writeTableColumnWidths(
    table,
    next.map((value) => value + bonus)
  );
}

export const DEFAULT_TABLE_COL_WIDTH = 100;
export const MIN_TABLE_COL_WIDTH = MIN_COL_PERCENT;
export const DEFAULT_TABLE_COL_WEIGHT = 100;
export const MIN_TABLE_COL_WEIGHT = MIN_COL_PERCENT;

// Legacy export kept for resize module import compatibility
export function resizeColumnPair(
  percents: number[],
  colIndex: number,
  leftPercent: number
): number[] {
  return resizeColumnPairPercents(percents, colIndex, leftPercent);
}

export function previewTableColumnWidths(table: Component, percents: number[]): void {
  previewTableColumnPercents(table, percents);
}

export function tableColumnScale(): number {
  return 1;
}
