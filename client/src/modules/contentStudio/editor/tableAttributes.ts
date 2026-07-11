import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';

export interface TableSelectionContext {
  rowIndex: number;
  colIndex: number;
  cellType: 'tableCell' | 'tableHeader';
  cellAttrs: Record<string, unknown>;
  rowAttrs: Record<string, unknown>;
}

interface TableContextDepths {
  tableDepth: number;
  rowDepth: number;
  cellDepth: number;
  cellType: 'tableCell' | 'tableHeader';
  $from: EditorState['selection']['$from'];
}

function isTableCellType(name: string): name is 'tableCell' | 'tableHeader' {
  return name === 'tableCell' || name === 'tableHeader';
}

function findTableContext(state: EditorState): TableContextDepths | null {
  const { $from } = state.selection;
  let tableDepth: number | null = null;
  let rowDepth: number | null = null;
  let cellDepth: number | null = null;
  let cellType: 'tableCell' | 'tableHeader' | null = null;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (isTableCellType(name)) {
      cellDepth = depth;
      cellType = name;
    } else if (name === 'tableRow') rowDepth = depth;
    else if (name === 'table') tableDepth = depth;
  }

  if (tableDepth === null || rowDepth === null || cellDepth === null || cellType === null) return null;
  return { tableDepth, rowDepth, cellDepth, cellType, $from };
}

export function isEditorInTable(editor: Editor | null | undefined): boolean {
  if (!editor) return false;
  return findTableContext(editor.state) !== null;
}

export function updateActiveTableAttrs(
  editor: Editor,
  partial: Record<string, unknown>,
  selectionSnapshot?: { from: number; to: number } | null,
): boolean {
  let chain = editor.chain();
  if (selectionSnapshot) chain = chain.setTextSelection(selectionSnapshot);
  return chain.command(({ tr, state, dispatch }) => {
    const ctx = findTableContext(state);
    if (!ctx) return false;
    const tablePos = ctx.$from.before(ctx.tableDepth);
    const table = state.doc.nodeAt(tablePos);
    if (!table || table.type.name !== 'table') return false;
    tr.setNodeMarkup(tablePos, undefined, mergeTableAttrs(table.attrs, partial));
    if (dispatch) dispatch(tr);
    return true;
  }).run();
}

function mergeTableAttrs(
  current: Record<string, unknown>,
  partial: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...current, ...partial };
  for (const [key, value] of Object.entries(partial)) {
    if (value === null || value === undefined || value === '') delete next[key];
  }
  return next;
}

export function getTableSelectionContext(editor: Editor): TableSelectionContext | null {
  const ctx = findTableContext(editor.state);
  if (!ctx) return null;
  const { $from, tableDepth, rowDepth, cellDepth, cellType } = ctx;
  return {
    rowIndex: $from.index(tableDepth) + 1,
    colIndex: $from.index(rowDepth) + 1,
    cellType,
    cellAttrs: { ...$from.node(cellDepth).attrs },
    rowAttrs: { ...$from.node(rowDepth).attrs },
  };
}

export function renderTableCellDomAttrs(attrs: Record<string, unknown>): Record<string, string> {
  const styles: string[] = [];
  if (attrs.textColor) styles.push(`color:${String(attrs.textColor)}`);
  if (attrs.backgroundColor) styles.push(`background-color:${String(attrs.backgroundColor)}`);
  if (attrs.textAlign) styles.push(`text-align:${String(attrs.textAlign)}`);
  if (attrs.fontSize) styles.push(`font-size:${String(attrs.fontSize)}`);
  if (attrs.lineHeight) styles.push(`line-height:${String(attrs.lineHeight)}`);

  const domAttrs: Record<string, string> = {};
  if (styles.length) domAttrs.style = styles.join(';');
  if (attrs.textAlign) domAttrs['data-text-align'] = String(attrs.textAlign);
  if (attrs.textColor) domAttrs['data-text-color'] = String(attrs.textColor);
  if (attrs.backgroundColor) domAttrs['data-background-color'] = String(attrs.backgroundColor);
  if (Number(attrs.colspan) > 1) domAttrs.colspan = String(attrs.colspan);
  if (Number(attrs.rowspan) > 1) domAttrs.rowspan = String(attrs.rowspan);
  return domAttrs;
}

export function renderTableRowDomAttrs(attrs: Record<string, unknown>): Record<string, string> {
  const styles: string[] = [];
  if (attrs.backgroundColor) styles.push(`background-color:${String(attrs.backgroundColor)}`);
  const domAttrs: Record<string, string> = {};
  if (styles.length) domAttrs.style = styles.join(';');
  if (attrs.backgroundColor) domAttrs['data-row-background'] = String(attrs.backgroundColor);
  return domAttrs;
}

function updateTableAtIndex(
  editor: Editor,
  tablePos: number,
  mutate: (table: ProseMirrorNode, tr: Transaction, tablePos: number) => boolean,
): boolean {
  return editor.chain().command(({ tr, state, dispatch }) => {
    const table = state.doc.nodeAt(tablePos);
    if (!table || table.type.name !== 'table') return false;
    const changed = mutate(table, tr, tablePos);
    if (changed && dispatch) dispatch(tr);
    return changed;
  }).run();
}

export function updateTableRowAtIndex(
  editor: Editor,
  tablePos: number,
  rowIndex: number,
  partial: Record<string, unknown>,
): boolean {
  return updateTableAtIndex(editor, tablePos, (table, tr, pos) => {
    let rowOffset = pos + 1;
    for (let index = 0; index < table.childCount; index += 1) {
      const row = table.child(index);
      if (index === rowIndex) {
        tr.setNodeMarkup(rowOffset, undefined, mergeTableAttrs(row.attrs, partial));
        return true;
      }
      rowOffset += row.nodeSize;
    }
    return false;
  });
}

function runTableCommand(
  editor: Editor,
  selectionSnapshot: { from: number; to: number } | null | undefined,
  mutate: (ctx: TableContextDepths, tr: Transaction) => boolean,
): boolean {
  let chain = editor.chain();
  if (selectionSnapshot) chain = chain.setTextSelection(selectionSnapshot);
  return chain.command(({ tr, state, dispatch }) => {
    const ctx = findTableContext(state);
    if (!ctx) return false;
    const changed = mutate(ctx, tr);
    if (changed && dispatch) dispatch(tr);
    return changed;
  }).run();
}

export function updateTableCellAttrs(
  editor: Editor,
  partial: Record<string, unknown>,
  selectionSnapshot?: { from: number; to: number } | null,
): boolean {
  const { isHeader, colWidth, ...attrs } = partial;
  let chain = editor.chain();
  if (selectionSnapshot) chain = chain.setTextSelection(selectionSnapshot);

  if (typeof isHeader === 'boolean') {
    const ctx = findTableContext(editor.state);
    if (!ctx) return false;
    const isHeaderCell = ctx.cellType === 'tableHeader';
    if (isHeader !== isHeaderCell) {
      const toggled = chain.focus().toggleHeaderCell().run();
      if (!toggled) return false;
      chain = editor.chain();
      if (selectionSnapshot) chain = chain.setTextSelection(selectionSnapshot);
    }
  }

  const nextAttrs = { ...attrs };
  if (colWidth != null && colWidth !== '') {
    const parsed = Number.parseInt(String(colWidth), 10);
    if (Number.isFinite(parsed) && parsed > 0) nextAttrs.colwidth = [parsed];
  }

  for (const [key, value] of Object.entries(nextAttrs)) {
    chain = chain.setCellAttribute(key, value);
  }

  return chain.run();
}

export function updateTableRowAttrs(
  editor: Editor,
  partial: Record<string, unknown>,
  selectionSnapshot?: { from: number; to: number } | null,
): boolean {
  return runTableCommand(editor, selectionSnapshot, (ctx, tr) => {
    const { $from, rowDepth } = ctx;
    const row = $from.node(rowDepth);
    const rowPos = $from.before(rowDepth);
    tr.setNodeMarkup(rowPos, undefined, mergeTableAttrs(row.attrs, partial));
    return true;
  });
}

export function updateTableColumnAttrs(
  editor: Editor,
  partial: Record<string, unknown>,
  selectionSnapshot?: { from: number; to: number } | null,
): boolean {
  const { colWidth, ...rest } = partial;
  const normalized: Record<string, unknown> = { ...rest };
  if (colWidth != null) {
    const parsed = Number.parseInt(String(colWidth), 10);
    normalized.colwidth = Number.isFinite(parsed) && parsed > 0 ? [parsed] : null;
  }

  return runTableCommand(editor, selectionSnapshot, (ctx, tr) => {
    const { $from, tableDepth, rowDepth } = ctx;
    const table = $from.node(tableDepth);
    const colIndex = $from.index(rowDepth);
    const tablePos = $from.before(tableDepth);
    let rowOffset = tablePos + 1;
    let changed = false;

    for (let rowIndex = 0; rowIndex < table.childCount; rowIndex += 1) {
      const row = table.child(rowIndex);
      let cellOffset = rowOffset + 1;
      for (let cellIndex = 0; cellIndex < row.childCount; cellIndex += 1) {
        const cell = row.child(cellIndex);
        if (cellIndex === colIndex) {
          tr.setNodeMarkup(cellOffset, undefined, mergeTableAttrs(cell.attrs, normalized));
          changed = true;
        }
        cellOffset += cell.nodeSize;
      }
      rowOffset += row.nodeSize;
    }

    return changed;
  });
}
