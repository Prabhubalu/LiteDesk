import type { Component, Editor } from 'grapesjs';
import { elementToMergeTokens, nodesToMergeTokens } from '@/utils/builderMergeTagHtml';

export interface TextInsertTarget {
  editor: Editor;
  component: Component;
  element: HTMLElement;
  caretOffset: number;
  savedRange: Range | null;
}

let insertTarget: TextInsertTarget | null = null;
let insertTargetLocked = false;

function captureSelectionRange(element: HTMLElement): Range | null {
  const win = element.ownerDocument.defaultView;
  const selection = win?.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  try {
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer)) return null;
    return range.cloneRange();
  } catch {
    return null;
  }
}

function rangeToLogicalTokenOffset(element: HTMLElement, range: Range): number {
  try {
    const prefix = range.cloneRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(range.startContainer, range.startOffset);
    const holder = element.ownerDocument.createElement('div');
    holder.appendChild(prefix.cloneContents());
    return nodesToMergeTokens(holder).length;
  } catch {
    return elementToMergeTokens(element).length;
  }
}

function isCanvasTextFocused(element: HTMLElement): boolean {
  const doc = element.ownerDocument;
  const active = doc.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return active === element || element.contains(active);
}

export function isInsertTargetLocked(): boolean {
  return insertTargetLocked;
}

export function lockInsertTarget(): void {
  insertTargetLocked = true;
}

export function unlockInsertTarget(): void {
  insertTargetLocked = false;
}

export function clearInsertTarget(): void {
  insertTarget = null;
  unlockInsertTarget();
}

export function getInsertTarget(): TextInsertTarget | null {
  return insertTarget;
}

export function getInsertTargetForEditor(editor: Editor): TextInsertTarget | null {
  if (insertTarget?.editor === editor) return insertTarget;
  return null;
}

export function resolveInsertCaretOffset(
  editor: Editor,
  component: Component,
  fallbackLength: number
): number {
  if (insertTarget?.editor === editor && insertTarget.component === component) {
    return insertTarget.caretOffset;
  }
  return fallbackLength;
}

export function publishInsertTarget(
  editor: Editor,
  component: Component,
  element: HTMLElement,
  caretOffset: number
): void {
  insertTarget = {
    editor,
    component,
    element,
    caretOffset,
    savedRange: null
  };
}

export function updateInsertTargetFromRange(
  editor: Editor,
  component: Component,
  element: HTMLElement,
  range: Range | null,
  options: {
    force?: boolean;
    preserveWhenBlurred?: boolean;
    mergePickerActive?: boolean;
  } = {}
): void {
  if (insertTargetLocked && !options.force) return;

  if (!range) {
    if (insertTarget?.component === component && insertTarget.caretOffset >= 0) {
      return;
    }
    insertTarget = {
      editor,
      component,
      element,
      caretOffset: insertTarget?.component === component
        ? (insertTarget?.caretOffset ?? fallbackTokenLength(element))
        : fallbackTokenLength(element),
      savedRange: insertTarget?.component === component ? (insertTarget?.savedRange ?? null) : null
    };
    return;
  }

  const measured = rangeToLogicalTokenOffset(element, range);

  if (
    insertTarget?.component === component
    && measured === 0
    && insertTarget.caretOffset > 0
    && (
      options.preserveWhenBlurred
      || options.mergePickerActive
      || insertTargetLocked
      || !isCanvasTextFocused(element)
    )
  ) {
    return;
  }

  insertTarget = {
    editor,
    component,
    element,
    caretOffset: measured,
    savedRange: range.cloneRange()
  };
}

export function snapshotHostTextSelection(
  editor: Editor,
  component: Component,
  element: HTMLElement,
  options: {
    force?: boolean;
    mergePickerActive?: boolean;
  } = {}
): void {
  if (insertTargetLocked) return;

  const selection = element.ownerDocument.defaultView?.getSelection();
  if (selection && selection.rangeCount > 0) {
    try {
      const live = selection.getRangeAt(0);
      if (element.contains(live.startContainer)) {
        updateInsertTargetFromRange(editor, component, element, live.cloneRange(), options);
        return;
      }
    } catch {
      // fall through
    }
  }

  if (!options.force && insertTarget?.component === component) {
    return;
  }

  const captured = captureSelectionRange(element);
  updateInsertTargetFromRange(editor, component, element, captured, options);
}

function fallbackTokenLength(element: HTMLElement): number {
  return elementToMergeTokens(element).length;
}

export function readLiveHostCaretOffset(element: HTMLElement): number {
  const captured = captureSelectionRange(element);
  if (captured) {
    return rangeToLogicalTokenOffset(element, captured);
  }
  return fallbackTokenLength(element);
}
