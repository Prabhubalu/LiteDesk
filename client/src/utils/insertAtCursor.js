/**
 * Insert text at the current selection in an input or textarea.
 * Returns the new value and cursor position (for v-model updates).
 */
export function insertTextAtCursor(el, text) {
  const insertion = String(text ?? '');
  if (!el) {
    return { value: insertion, cursor: insertion.length };
  }

  const start = el.selectionStart ?? el.value?.length ?? 0;
  const end = el.selectionEnd ?? start;
  const value = el.value ?? '';
  const next = value.slice(0, start) + insertion + value.slice(end);

  return {
    value: next,
    cursor: start + insertion.length
  };
}

export function focusInputAtCursor(el, cursor) {
  if (!el) return;
  el.focus();
  el.setSelectionRange(cursor, cursor);
}
