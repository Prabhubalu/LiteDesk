export const SAVED_VIEW_NAME_MAX_LENGTH = 40;

/** Header view selector: character cap for display only (storage unchanged). */
export const SAVED_VIEW_NAME_HEADER_DISPLAY_MAX_LENGTH = 30;

export function truncateTextForDisplay(text: string, maxLength: number): string {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

export function isTextTruncatedForDisplay(text: string, maxLength: number): boolean {
  return String(text || '').length > maxLength;
}

export function normalizeSavedViewName(name: string): string {
  return String(name || '').trim();
}

export function isSavedViewNameValid(name: string): boolean {
  const normalized = normalizeSavedViewName(name);
  return normalized.length > 0 && normalized.length <= SAVED_VIEW_NAME_MAX_LENGTH;
}

export function assertSavedViewName(name: string): string {
  const normalized = normalizeSavedViewName(name);
  if (!normalized) {
    throw new Error('View name required');
  }
  if (normalized.length > SAVED_VIEW_NAME_MAX_LENGTH) {
    throw new Error(`View name must be ${SAVED_VIEW_NAME_MAX_LENGTH} characters or fewer`);
  }
  return normalized;
}

export function suggestCopyViewName(label: string): string {
  const prefix = 'Copy of ';
  const base = normalizeSavedViewName(label);
  if (!base) return '';
  const maxBaseLength = Math.max(0, SAVED_VIEW_NAME_MAX_LENGTH - prefix.length);
  return `${prefix}${base.slice(0, maxBaseLength)}`;
}
