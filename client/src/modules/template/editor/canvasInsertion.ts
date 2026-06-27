import type { Component, Editor } from 'grapesjs';
import { chipHtmlToMergeTokens } from '@/utils/builderMergeTagHtml';
import { formatMergeToken } from './mergeTokens';
import { isTableCellComponent, resolveComponentFromElement } from './tableModel';

const EDITABLE_TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'li']);

function isEditableTextComponent(component: Component): boolean {
  const tag = String(component.get('tagName') || '').toLowerCase();
  return EDITABLE_TEXT_TAGS.has(tag);
}

interface SavedCanvasSelection {
  editor: Editor;
  element: HTMLElement;
  range: Range;
}

let savedCanvasSelection: SavedCanvasSelection | null = null;

function getCanvasDocument(editor: Editor): Document | null {
  return editor.Canvas.getFrameEl()?.contentDocument ?? null;
}

function getCanvasWindow(editor: Editor): Window | null {
  return editor.Canvas.getFrameEl()?.contentWindow ?? null;
}

function isCanvasTextEditable(element: HTMLElement): boolean {
  if (!element.isContentEditable) return false;
  if (element.classList.contains('arivu-sheet-cell-editing')) return false;
  if (element.closest('td, th')) return false;
  return true;
}

function findEditableFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const element = node instanceof HTMLElement ? node : node.parentElement;
  const editable = element?.closest('[contenteditable="true"]');
  return editable instanceof HTMLElement && isCanvasTextEditable(editable) ? editable : null;
}

function saveCanvasSelection(editor: Editor): void {
  const doc = getCanvasDocument(editor);
  const win = getCanvasWindow(editor);
  if (!doc || !win) return;

  const selection = win.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const editable = findEditableFromNode(selection.anchorNode);
  if (!editable) return;

  savedCanvasSelection = {
    editor,
    element: editable,
    range: selection.getRangeAt(0).cloneRange()
  };
}

function restoreCanvasSelection(editor: Editor): SavedCanvasSelection | null {
  if (!savedCanvasSelection || savedCanvasSelection.editor !== editor) return null;
  return savedCanvasSelection;
}

function clearSavedCanvasSelection(editor: Editor): void {
  if (savedCanvasSelection?.editor === editor) {
    savedCanvasSelection = null;
  }
}

function syncTextComponentFromElement(component: Component, element: HTMLElement): void {
  const content = chipHtmlToMergeTokens(element.innerHTML);
  component.set('content', content, { silent: true });
}

function retainCaretInElement(element: HTMLElement): void {
  const win = element.ownerDocument.defaultView;
  if (!win) return;

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

  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertTokenInElement(element: HTMLElement, token: string): boolean {
  const win = element.ownerDocument.defaultView;
  if (!win) return false;

  element.focus();
  if (typeof win.document.execCommand === 'function') {
    const inserted = win.document.execCommand('insertText', false, token);
    if (inserted) retainCaretInElement(element);
    return inserted;
  }

  const selection = win.getSelection();
  if (!selection || selection.rangeCount === 0) {
    element.textContent = `${element.textContent || ''}${token}`;
    retainCaretInElement(element);
    return true;
  }

  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) {
    element.textContent = `${element.textContent || ''}${token}`;
    retainCaretInElement(element);
    return true;
  }

  range.deleteContents();
  range.insertNode(element.ownerDocument.createTextNode(token));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  retainCaretInElement(element);
  return true;
}

function insertTokenWithSavedSelection(editor: Editor, token: string): boolean {
  const saved = restoreCanvasSelection(editor);
  if (!saved) return false;

  const win = getCanvasWindow(editor);
  if (!win) return false;

  saved.element.focus();
  const selection = win.getSelection();
  if (!selection) return false;

  try {
    selection.removeAllRanges();
    selection.addRange(saved.range);
  } catch {
    return false;
  }

  if (!insertTokenInElement(saved.element, token)) return false;

  const component = resolveComponentFromElement(saved.element);
  if (component && isEditableTextComponent(component) && !isTableCellComponent(component)) {
    syncTextComponentFromElement(component, saved.element);
  }

  retainCaretInElement(saved.element);
  saveCanvasSelection(editor);
  return true;
}

function insertTokenInFocusedEditable(editor: Editor, token: string): boolean {
  const doc = getCanvasDocument(editor);
  if (!doc) return false;

  const active = doc.activeElement;
  if (!(active instanceof HTMLElement) || !isCanvasTextEditable(active)) return false;

  if (!insertTokenInElement(active, token)) return false;

  const component = resolveComponentFromElement(active);
  if (component && isEditableTextComponent(component) && !isTableCellComponent(component)) {
    syncTextComponentFromElement(component, active);
  }

  retainCaretInElement(active);
  saveCanvasSelection(editor);
  return true;
}

export function bindCanvasTextInsertion(editor: Editor): void {
  const attach = () => {
    const doc = getCanvasDocument(editor);
    if (!doc || doc.documentElement.dataset.arivuCanvasInsertion === 'true') return;
    doc.documentElement.dataset.arivuCanvasInsertion = 'true';

    const onSelectionChange = () => saveCanvasSelection(editor);
    doc.addEventListener('selectionchange', onSelectionChange);

    editor.on('destroy', () => {
      doc.removeEventListener('selectionchange', onSelectionChange);
      delete doc.documentElement.dataset.arivuCanvasInsertion;
      clearSavedCanvasSelection(editor);
    });
  };

  editor.on('canvas:frame:load', attach);
  editor.on('load', attach);
  attach();
}

export function insertMergeIntoCanvasText(editor: Editor, path: string): boolean {
  const token = formatMergeToken(path);

  if (insertTokenInFocusedEditable(editor, token)) return true;
  if (insertTokenWithSavedSelection(editor, token)) return true;

  const selected = editor.getSelected();
  if (!selected || !isEditableTextComponent(selected) || isTableCellComponent(selected)) {
    return false;
  }

  const element = selected.view?.el as HTMLElement | undefined;
  if (element?.isContentEditable && isCanvasTextEditable(element)) {
    element.focus();
    const win = getCanvasWindow(editor);
    const selection = win?.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (element.contains(range.commonAncestorContainer) && insertTokenInElement(element, token)) {
        syncTextComponentFromElement(selected, element);
        retainCaretInElement(element);
        saveCanvasSelection(editor);
        return true;
      }
    }
  }

  return false;
}
