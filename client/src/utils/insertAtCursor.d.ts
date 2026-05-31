export interface InsertTextAtCursorResult {
  value: string;
  cursor: number;
}

export interface TextInputLike {
  value?: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  focus?: () => void;
  setSelectionRange?: (start: number, end: number) => void;
}

export function insertTextAtCursor(
  el: TextInputLike | null | undefined,
  text: string
): InsertTextAtCursorResult;

export function focusInputAtCursor(
  el: TextInputLike | null | undefined,
  cursor: number
): void;
