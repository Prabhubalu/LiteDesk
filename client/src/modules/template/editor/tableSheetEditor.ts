import type { Component, Editor } from 'grapesjs';
import {
  BUILDER_MERGE_CHIP_CLASS,
  chipHtmlToMergeTokens,
  mergeTokensToChipHtml
} from '@/utils/builderMergeTagHtml';
import { formatMergeToken } from './mergeTokens';
import { ensureTableColumnLayout } from './tableColumnWidths';
import { registerTableCellComponents } from './tableCellComponents';
import { isTableMutationInProgress } from './tableActions';
import {
  findTableRoot,
  isSelectionInTableContext,
  isTableCellComponent,
  paintTableCellContent,
  readCellText,
  repaintTableCells,
  resolveMergeTargetTableCell,
  resolveTableCellComponent,
  resolveTableCellFromElement,
  writeCellText
} from './tableModel';
import { isLineItemDataRow, normalizeLineScopeMergePath } from './lineItemModel';

const EDITING_CLASS = 'arivu-sheet-cell-editing';

interface ActiveSheetEditor {
  editor: Editor;
  cell: Component;
  element: HTMLElement;
}

interface FrameHandlers {
  onDblClick: (event: MouseEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onParentKeyDown: (event: KeyboardEvent) => void;
  onParentMouseDown: (event: MouseEvent) => void;
}

let activeEditor: ActiveSheetEditor | null = null;
let lastSelectedTableCell: Component | null = null;

const boundEditors = new WeakMap<Editor, FrameHandlers>();

export function isTableSheetEditing(): boolean {
  return Boolean(activeEditor);
}

export function flushTableSheetEdits(editor?: Editor | null): void {
  if (!activeEditor) return;
  if (editor && activeEditor.editor !== editor) return;
  commitActiveEdit();
}

export function getActiveTableSheetCell(): Component | null {
  return activeEditor?.cell ?? null;
}

function escapeAttr(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function mergeChipHtml(path: string): string {
  const trimmed = path.trim();
  return `<span class="${BUILDER_MERGE_CHIP_CLASS}" contenteditable="false" data-merge-path="${escapeAttr(trimmed)}">${escapeAttr(trimmed)}</span>`;
}

function frameWindow(element: HTMLElement): Window {
  return element.ownerDocument.defaultView || window;
}

function focusEditableEnd(element: HTMLElement): void {
  const doc = element.ownerDocument;
  const win = frameWindow(element);
  element.focus();
  const range = doc.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = win.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function retainCaretInElement(element: HTMLElement): void {
  const win = frameWindow(element);
  element.focus();
  const selection = win.getSelection();
  if (!selection) return;

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  focusEditableEnd(element);
}

function insertTextInElement(element: HTMLElement, text: string): void {
  const win = frameWindow(element);
  element.focus();
  if (typeof win.document.execCommand === 'function') {
    win.document.execCommand('insertText', false, String(text ?? ''));
    return;
  }
  element.textContent = `${element.textContent || ''}${text}`;
}

function insertHtmlInElement(element: HTMLElement, html: string): void {
  const win = frameWindow(element);
  element.focus();
  if (typeof win.document.execCommand === 'function') {
    win.document.execCommand('insertHTML', false, html);
    retainCaretInElement(element);
  }
}

function isPrintableKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  return event.key.length === 1;
}

function shouldHandleGlobalKeys(event: KeyboardEvent): boolean {
  if (activeEditor) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return true;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
  if (target.isContentEditable) return false;
  if (target.closest('aside, [role="dialog"], .arivu-table-col-resize-handle')) return false;
  return true;
}

function detachEditBlur(element: HTMLElement, handler: () => void): void {
  element.removeEventListener('blur', handler, true);
}

function commitActiveEdit(): void {
  if (!activeEditor) return;

  const { cell, element, editor } = activeEditor;
  const html = chipHtmlToMergeTokens(element.innerHTML);
  writeCellText(cell, html);
  const blurHandler = (element as HTMLElement & { __arivuBlur?: () => void }).__arivuBlur;
  if (blurHandler) detachEditBlur(element, blurHandler);
  element.removeAttribute('contenteditable');
  element.classList.remove(EDITING_CLASS);
  activeEditor = null;
  editor.trigger('arivu:sheet-edit-committed');
}

function cancelActiveEdit(): void {
  if (!activeEditor) return;
  const { cell, element } = activeEditor;
  element.innerHTML = mergeTokensToChipHtml(readCellText(cell));
  const blurHandler = (element as HTMLElement & { __arivuBlur?: () => void }).__arivuBlur;
  if (blurHandler) detachEditBlur(element, blurHandler);
  element.removeAttribute('contenteditable');
  element.classList.remove(EDITING_CLASS);
  activeEditor = null;
}

function focusCanvas(editor: Editor): void {
  editor.Canvas.getFrameEl()?.contentWindow?.focus();
}

function startSheetEdit(editor: Editor, cell: Component): void {
  const element = cell.view?.el as HTMLElement | undefined;
  if (!element || !isTableCellComponent(cell)) return;

  if (activeEditor?.cell === cell) {
    focusEditableEnd(element);
    return;
  }

  if (activeEditor) {
    commitActiveEdit();
  }

  const table = findTableRoot(cell);
  if (table) {
    try {
      ensureTableColumnLayout(table);
    } catch {
      // ignore layout errors during edit
    }
  }

  element.classList.add(EDITING_CLASS);
  element.setAttribute('contenteditable', 'true');
  const raw = readCellText(cell);
  let display =
    raw === '&nbsp;' || raw === '\u00a0' || !String(raw).replace(/<[^>]+>/g, '').trim()
      ? ''
      : raw;
  if (!display) {
    const painted = element.innerHTML.trim();
    if (painted && painted !== '&nbsp;') {
      display = chipHtmlToMergeTokens(painted);
    }
  }
  element.innerHTML = mergeTokensToChipHtml(display);

  activeEditor = { editor, cell, element };
  editor.select(cell);

  const onBlur = () => {
    if (!activeEditor || activeEditor.element !== element) return;
    window.setTimeout(() => {
      if (!activeEditor || activeEditor.element !== element) return;
      const doc = element.ownerDocument;
      const active = doc.activeElement;
      if (active === element || element.contains(active)) return;
      commitActiveEdit();
      editor.trigger('arivu:table-column-resize-end');
    }, 0);
  };

  (element as HTMLElement & { __arivuBlur?: () => void }).__arivuBlur = onBlur;
  element.addEventListener('blur', onBlur, true);
  focusEditableEnd(element);
  focusCanvas(editor);
}

function handleSheetKeydown(editor: Editor, event: KeyboardEvent): void {
  if (!shouldHandleGlobalKeys(event) && !activeEditor) return;

  if (event.key === 'Escape') {
    if (activeEditor) {
      event.preventDefault();
      event.stopPropagation();
      cancelActiveEdit();
    }
    return;
  }

  if (activeEditor) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      commitActiveEdit();
      editor.trigger('arivu:table-column-resize-end');
    }
    return;
  }

  if (!isPrintableKey(event)) return;

  const selected = editor.getSelected();
  const cell = resolveTableCellComponent(selected);
  if (!cell) return;

  event.preventDefault();
  event.stopPropagation();
  startSheetEdit(editor, cell);
  const editEl = cell.view?.el as HTMLElement | undefined;
  if (editEl) {
    insertTextInElement(editEl, event.key);
  }
}

function handleDocumentMousedown(editor: Editor, event: MouseEvent): void {
  if (!activeEditor) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('[data-arivu-merge-insert]')) return;
  if (target && activeEditor.element.contains(target)) return;
  commitActiveEdit();
  editor.trigger('arivu:table-column-resize-end');
}

function detachFrameHandlers(editor: Editor): void {
  const handlers = boundEditors.get(editor);
  if (!handlers) return;

  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (doc) {
    doc.removeEventListener('dblclick', handlers.onDblClick, true);
    doc.removeEventListener('keydown', handlers.onKeyDown, true);
  }

  window.removeEventListener('keydown', handlers.onParentKeyDown, true);
  window.removeEventListener('mousedown', handlers.onParentMouseDown, true);
  boundEditors.delete(editor);
}

function attachFrameHandlers(editor: Editor): void {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) return;

  detachFrameHandlers(editor);

  const onDblClick = (event: MouseEvent) => {
    const cell = resolveTableCellFromElement(event.target, editor);
    if (!cell) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    startSheetEdit(editor, cell);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTableMutationInProgress()) return;
    handleSheetKeydown(editor, event);
  };

  const onParentKeyDown = (event: KeyboardEvent) => {
    if (isTableMutationInProgress()) return;
    handleSheetKeydown(editor, event);
  };

  const onParentMouseDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.arivu-table-col-resize-handle')) return;
    handleDocumentMousedown(editor, event);
  };

  doc.addEventListener('dblclick', onDblClick, true);
  doc.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keydown', onParentKeyDown, true);
  window.addEventListener('mousedown', onParentMouseDown, true);

  boundEditors.set(editor, {
    onDblClick,
    onKeyDown,
    onParentKeyDown,
    onParentMouseDown
  });
}

function syncAllTableLayouts(editor: Editor): void {
  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  const visit = (component: Component) => {
    if (String(component.get('tagName') || '').toLowerCase() === 'table') {
      try {
        ensureTableColumnLayout(component);
      } catch {
        // skip invalid tables during sync
      }
    }
    component.components().forEach(visit);
  };
  visit(wrapper);
}

export function insertMergeIntoTableCell(editor: Editor, path: string): boolean {
  let trimmedPath = path.replace(/^\{\{|\}\}$/g, '').trim() || path.trim();

  if (activeEditor && activeEditor.editor === editor) {
    if (isLineItemDataRow(activeEditor.cell)) {
      trimmedPath = normalizeLineScopeMergePath(trimmedPath);
    }
    insertHtmlInElement(activeEditor.element, mergeChipHtml(trimmedPath));
    return true;
  }

  const selected = editor.getSelected();
  if (!isSelectionInTableContext(selected)) {
    return false;
  }

  const cell = resolveMergeTargetTableCell(editor, lastSelectedTableCell);
  if (!cell) return false;

  if (activeEditor && activeEditor.cell !== cell) {
    commitActiveEdit();
  }

  if (isLineItemDataRow(cell)) {
    trimmedPath = normalizeLineScopeMergePath(trimmedPath);
  }

  const current = readCellText(cell);
  const nextToken = formatMergeToken(trimmedPath);
  const spacer = current && !current.endsWith(' ') ? ' ' : '';
  writeCellText(cell, `${current}${spacer}${nextToken}`);
  lastSelectedTableCell = cell;
  startSheetEdit(editor, cell);
  return true;
}

export function bindTableSheetEditor(editor: Editor): void {
  registerTableCellComponents(editor);

  const boot = () => {
    attachFrameHandlers(editor);
    syncAllTableLayouts(editor);
    const wrapper = editor.getWrapper();
    if (wrapper) {
      const visit = (component: Component) => {
        if (String(component.get('tagName') || '').toLowerCase() === 'table') {
          repaintTableCells(component);
        }
        component.components().forEach(visit);
      };
      visit(wrapper);
    }
  };

  editor.on('canvas:frame:load', boot);
  editor.on('load', boot);

  editor.on('component:selected', (component: Component) => {
    if (activeEditor && activeEditor.cell !== component) {
      commitActiveEdit();
    }
    const cell = resolveTableCellComponent(component);
    if (cell) {
      lastSelectedTableCell = cell;
      if (!activeEditor || activeEditor.cell !== cell) {
        paintTableCellContent(cell);
      }
      if (!activeEditor) {
        focusCanvas(editor);
      }
      const table = findTableRoot(cell);
      if (table) {
        try {
          ensureTableColumnLayout(table);
        } catch {
          // ignore
        }
      }
    }
    editor.trigger('arivu:table-column-resize-end');
  });

  editor.on('component:add', (component: Component) => {
    if (String(component.get('tagName') || '').toLowerCase() === 'table') {
      try {
        ensureTableColumnLayout(component);
      } catch {
        // ignore
      }
    }
  });

  editor.on('destroy', () => {
    detachFrameHandlers(editor);
    if (activeEditor?.editor === editor) {
      activeEditor = null;
    }
  });

  boot();
}
