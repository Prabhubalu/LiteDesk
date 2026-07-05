let serializeDepth = 0;

export function runEditorSerialize<T>(fn: () => T): T {
  serializeDepth += 1;
  try {
    return fn();
  } finally {
    serializeDepth -= 1;
  }
}

export function isEditorSerializing(): boolean {
  return serializeDepth > 0;
}

interface DocumentFocusSnapshot {
  element: HTMLElement;
  selectionStart: number | null;
  selectionEnd: number | null;
}

export function captureBuilderUiFocus(): DocumentFocusSnapshot | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!active.closest('[data-arivu-builder-sidebar], [data-arivu-merge-picker]')) {
    return null;
  }

  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    return {
      element: active,
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd
    };
  }

  return { element: active, selectionStart: null, selectionEnd: null };
}

export function restoreBuilderUiFocus(snapshot: DocumentFocusSnapshot | null): void {
  if (!snapshot?.element?.isConnected) return;

  const { element, selectionStart, selectionEnd } = snapshot;
  element.focus({ preventScroll: true });

  if (
    (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
    && selectionStart != null
    && selectionEnd != null
  ) {
    try {
      element.setSelectionRange(selectionStart, selectionEnd);
    } catch {
      // ignore invalid selection on some input types
    }
  }
}
