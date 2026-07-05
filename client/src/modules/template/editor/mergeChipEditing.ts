import type { Component, Editor } from 'grapesjs';
import {
  applyMergeChipsInPlace,
  applyMergeChipsToElement,
  BUILDER_MERGE_CHIP_CLASS,
  contentHasHtmlMarkup,
  createMergeChipElement,
  elementToMergeTokens,
  hostHasLineBreakMarkup,
  hostHasRichMarkup,
  mergeTokensToChipHtml,
  MERGE_CHIP_CARET_ANCHOR,
  nodesToMergeTokens,
  serializeElementHtmlWithMergeTokens
} from '@/utils/builderMergeTagHtml';
import { formatMergeToken, normalizeMergeTagPath } from './mergeTokens';

export type MergeChipContentSync = (tokenText: string) => void;

interface MergeChipHostBinding {
  detach: () => void;
}

const hostBindings = new WeakMap<HTMLElement, MergeChipHostBinding>();

function isMergeChipElement(node: Node | null | undefined): node is HTMLElement {
  return (
    node instanceof HTMLElement
    && (node.classList.contains(BUILDER_MERGE_CHIP_CLASS) || node.hasAttribute('data-merge-path'))
  );
}

function isCaretAnchorNode(node: Node | null | undefined): node is Text {
  return node?.nodeType === Node.TEXT_NODE && (node.textContent ?? '') === MERGE_CHIP_CARET_ANCHOR;
}

function findMergeChipAncestor(node: Node | null): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (isMergeChipElement(current)) return current;
    current = current.parentNode;
  }
  return null;
}

function getCollapsedRangeInElement(element: HTMLElement): Range | null {
  const doc = element.ownerDocument;
  const selection = doc.defaultView?.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return null;
  return range;
}

function setCollapsedCaret(doc: Document, node: Node, offset: number): void {
  const range = doc.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = doc.defaultView?.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function caretAfterChip(doc: Document, chip: HTMLElement): void {
  const anchor = chip.nextSibling;
  if (isCaretAnchorNode(anchor)) {
    setCollapsedCaret(doc, anchor, anchor.textContent?.length ?? 1);
    return;
  }
  const parent = chip.parentNode;
  if (!parent) return;
  const index = Array.from(parent.childNodes).indexOf(chip);
  setCollapsedCaret(doc, parent, index + 1);
}

/** Place the collapsed caret at a merge-token string offset inside a chip-decorated host. */
export function restoreTextCaretAtOffset(element: HTMLElement, tokenOffset: number): void {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  if (!win) return;

  element.focus({ preventScroll: true });
  let remaining = Math.max(0, tokenOffset);

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text === MERGE_CHIP_CARET_ANCHOR) {
        if (remaining === 0) {
          setCollapsedCaret(doc, node, text.length);
          return true;
        }
        return false;
      }
      const len = text.replace(/\u200B/g, '').length;
      if (remaining <= len) {
        setCollapsedCaret(doc, node, remaining);
        return true;
      }
      remaining -= len;
      return false;
    }

    if (node instanceof HTMLElement) {
      if (node.tagName === 'BR') {
        if (remaining <= 1) {
          const parent = node.parentNode;
          if (parent) {
            const index = Array.from(parent.childNodes).indexOf(node);
            setCollapsedCaret(doc, parent, remaining === 0 ? index : index + 1);
          }
          return true;
        }
        remaining -= 1;
        return false;
      }

      if (isMergeChipElement(node)) {
        const path = node.getAttribute('data-merge-path') || node.textContent || '';
        const tokenLen = formatMergeToken(path).length;
        if (remaining <= tokenLen) {
          if (remaining === 0) {
            const parent = node.parentNode;
            if (parent) {
              const index = Array.from(parent.childNodes).indexOf(node);
              setCollapsedCaret(doc, parent, index);
            }
          } else {
            caretAfterChip(doc, node);
          }
          return true;
        }
        remaining -= tokenLen;
        return false;
      }
    }

    for (const child of Array.from(node.childNodes)) {
      if (walk(child)) return true;
    }
    return false;
  }

  if (!walk(element)) {
    const range = doc.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const sel = win.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}

function resolveChipForBackspace(range: Range): HTMLElement | null {
  const inside = findMergeChipAncestor(range.startContainer);
  if (inside) return inside;

  const { startContainer, startOffset } = range;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent ?? '';
    if (text === MERGE_CHIP_CARET_ANCHOR && startOffset === 0) {
      const chip = startContainer.previousSibling;
      return isMergeChipElement(chip) ? chip : null;
    }
    if (startOffset > 0 && text !== MERGE_CHIP_CARET_ANCHOR) return null;
    if (text === MERGE_CHIP_CARET_ANCHOR && startOffset > 0) {
      const chip = startContainer.previousSibling;
      return isMergeChipElement(chip) ? chip : null;
    }
    let prev: Node | null = startContainer.previousSibling;
    if (isCaretAnchorNode(prev)) prev = prev.previousSibling;
    return isMergeChipElement(prev) ? prev : null;
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    if (startOffset === 0) return null;
    let prev: Node | null = startContainer.childNodes[startOffset - 1] ?? null;
    if (isCaretAnchorNode(prev)) prev = prev.previousSibling;
    return isMergeChipElement(prev) ? prev : null;
  }

  return null;
}

function resolveChipForDelete(range: Range): HTMLElement | null {
  const inside = findMergeChipAncestor(range.startContainer);
  if (inside) return inside;

  const { startContainer, startOffset } = range;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent ?? '';
    if (startOffset < text.length) return null;
    let next: Node | null = startContainer.nextSibling;
    if (isCaretAnchorNode(next)) next = next.nextSibling;
    return isMergeChipElement(next) ? next : null;
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const next: Node | null = startContainer.childNodes[startOffset] ?? null;
    return isMergeChipElement(next) ? next : null;
  }

  return null;
}

function removeMergeChipFromHost(
  element: HTMLElement,
  chip: HTMLElement,
  onContentChange: MergeChipContentSync
): number {
  const parent = chip.parentNode;
  const index = parent ? Array.from(parent.childNodes).indexOf(chip) : 0;

  let offset = 0;
  try {
    const prefix = element.ownerDocument.createRange();
    prefix.setStart(element, 0);
    if (parent) {
      prefix.setEnd(parent, index);
    } else {
      prefix.setEndBefore(chip);
    }
    const holder = element.ownerDocument.createElement('div');
    holder.appendChild(prefix.cloneContents());
    offset = nodesToMergeTokens(holder).length;
  } catch {
    offset = 0;
  }

  const anchor = chip.nextSibling;
  if (isCaretAnchorNode(anchor)) anchor.remove();
  chip.remove();

  onContentChange(elementToMergeTokens(element));
  return offset;
}

export function snapCaretOutOfMergeChip(element: HTMLElement): void {
  const range = getCollapsedRangeInElement(element);
  if (!range) return;

  const chip = findMergeChipAncestor(range.startContainer);
  if (!chip) return;

  caretAfterChip(element.ownerDocument, chip);
}

function handleMergeChipKeydownForHost(
  event: KeyboardEvent,
  element: HTMLElement,
  onContentChange: MergeChipContentSync
): void {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return;

  const range = getCollapsedRangeInElement(element);
  if (!range) return;

  const chip = event.key === 'Backspace'
    ? resolveChipForBackspace(range)
    : resolveChipForDelete(range);

  if (!chip) {
    snapCaretOutOfMergeChip(element);
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const offset = removeMergeChipFromHost(element, chip, onContentChange);
  element.focus({ preventScroll: true });
  restoreTextCaretAtOffset(element, offset);
}

export function applyMergeChipsForTokenText(element: HTMLElement, tokenText: string): void {
  if (!String(tokenText).includes('{{')) return;
  if (hostHasRichMarkup(element) || hostHasLineBreakMarkup(element)) {
    applyMergeChipsInPlace(element);
    return;
  }
  applyMergeChipsToElement(element, tokenText);
}

export function applyMergeChipsFromComponent(element: HTMLElement, component: Component): void {
  const stored = String(component.get('content') ?? '');
  const fromDom = elementToMergeTokens(element);
  const hasLiveDomText = fromDom.length > 0 || (element.textContent?.length ?? 0) > 0;

  if (!hasLiveDomText && contentHasHtmlMarkup(stored)) {
    element.innerHTML = stored.replace(/\u200B/g, '');
    applyMergeChipsInPlace(element);
    return;
  }

  if (hasLiveDomText && (hostHasRichMarkup(element) || hostHasLineBreakMarkup(element))) {
    applyMergeChipsInPlace(element);
    return;
  }

  const tokenText = hasLiveDomText ? fromDom : stored;
  applyMergeChipsForTokenText(element, tokenText);
}

function syncComponentContentValue(element: HTMLElement, component: Component): void {
  if (hostHasRichMarkup(element) || hostHasLineBreakMarkup(element)) {
    component.set('content', serializeElementHtmlWithMergeTokens(element), { silent: true });
    return;
  }
  component.set('content', elementToMergeTokens(element), { silent: true });
}

export function syncComponentContentFromDom(element: HTMLElement, component: Component): void {
  syncComponentContentValue(element, component);
}

function insertMergeTokenAtRange(
  element: HTMLElement,
  range: Range,
  token: string,
  onContentChange: MergeChipContentSync
): number {
  const path = normalizeMergeTagPath(token.replace(/^\{\{|\}\}$/g, '').trim());
  const doc = element.ownerDocument;
  const chip = createMergeChipElement(path, doc);
  const anchor = doc.createTextNode(MERGE_CHIP_CARET_ANCHOR);

  range.deleteContents();
  range.insertNode(anchor);
  range.insertNode(chip);

  let offset = 0;
  try {
    const prefix = doc.createRange();
    prefix.setStart(element, 0);
    prefix.setEndBefore(chip);
    const holder = doc.createElement('div');
    holder.appendChild(prefix.cloneContents());
    offset = nodesToMergeTokens(holder).length + formatMergeToken(path).length;
  } catch {
    offset = elementToMergeTokens(element).length;
  }

  onContentChange(elementToMergeTokens(element));
  restoreTextCaretAtOffset(element, offset);
  return offset;
}

export function insertMergeTokenAtLogicalOffset(
  element: HTMLElement,
  tokenText: string,
  token: string,
  offset: number,
  onContentChange: MergeChipContentSync
): number {
  if (element.isContentEditable) {
    const range = getCollapsedRangeInElement(element);
    if (range) {
      return insertMergeTokenAtRange(element, range, token, onContentChange);
    }
  }

  const safeOffset = Math.max(0, Math.min(offset, tokenText.length));
  const next = `${tokenText.slice(0, safeOffset)}${token}${tokenText.slice(safeOffset)}`;
  element.innerHTML = mergeTokensToChipHtml(next);
  const normalized = elementToMergeTokens(element);
  onContentChange(normalized);
  return safeOffset + token.length;
}

export function attachMergeChipEditingToHost(
  element: HTMLElement,
  options: {
    isActive: () => boolean;
    onContentChange: MergeChipContentSync;
  }
): () => void {
  detachMergeChipEditingFromHost(element);

  const doc = element.ownerDocument;
  const onKeyDown = (event: KeyboardEvent) => {
    if (!options.isActive()) return;
    handleMergeChipKeydownForHost(event, element, options.onContentChange);
  };
  const onSelectionChange = () => {
    if (!options.isActive()) return;
    snapCaretOutOfMergeChip(element);
  };

  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('selectionchange', onSelectionChange);

  const detach = () => {
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('selectionchange', onSelectionChange);
    hostBindings.delete(element);
  };

  hostBindings.set(element, { detach });
  return detach;
}

export function detachMergeChipEditingFromHost(element: HTMLElement): void {
  hostBindings.get(element)?.detach();
}

export function bindMergeChipEditing(editor: Editor): void {
  editor.on('rte:enable', (view: { el?: HTMLElement; model?: Component }) => {
    const component = view?.model;
    const element = (view?.el ?? component?.view?.el) as HTMLElement | undefined;
    if (!component || !(element instanceof HTMLElement)) return;

    element.classList.add('arivu-inline-text-editing');
    applyMergeChipsFromComponent(element, component);

    attachMergeChipEditingToHost(element, {
      isActive: () => editor.getEditing?.() === component,
      onContentChange: () => {
        syncComponentContentValue(element, component);
      }
    });

    editor.once('rte:disable', () => {
      syncComponentContentFromDom(element, component);
      element.classList.remove('arivu-inline-text-editing');
      if (editor.getEditing?.() === component) return;
      detachMergeChipEditingFromHost(element);
    });
  });
}
