/**
 * Copy text to the system clipboard.
 * Uses execCommand fallback when async Clipboard API is unavailable or blocked
 * (e.g. after an await, outside secure context, or without user activation).
 */
export function fallbackCopyText(text) {
  const value = String(text ?? '');
  if (!value) return false;

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.left = '0';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  if (typeof textarea.setSelectionRange === 'function') {
    textarea.setSelectionRange(0, value.length);
  }

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return ok;
}

/**
 * Best-effort copy; safe to call after async work (uses fallback first).
 */
export async function copyTextToClipboard(text) {
  const value = String(text ?? '');
  if (!value) return false;

  if (fallbackCopyText(value)) return true;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return fallbackCopyText(value);
    }
  }

  return false;
}

/**
 * Copy during a click handler before any await (execCommand first, then Clipboard API).
 */
export function copyTextToClipboardWithinGesture(text) {
  const value = String(text ?? '');
  if (!value) return false;

  if (fallbackCopyText(value)) return true;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).catch(() => {});
    return true;
  }

  return false;
}

export function buildPublicQuoteUrl(token, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const t = String(token || '').trim();
  if (!t) return '';
  return `${String(origin || '').replace(/\/$/, '')}/public/quotes/${t}`;
}

/**
 * Last-resort: show the URL in a prompt so the user can copy manually.
 */
export function promptCopyFallback(text, message = 'Copy this link:') {
  const value = String(text ?? '').trim();
  if (!value || typeof window === 'undefined') return false;
  window.prompt(message, value);
  return true;
}

export async function copyTextToClipboardWithPromptFallback(text, promptMessage) {
  const value = String(text ?? '').trim();
  if (!value) return false;
  if (copyTextToClipboardWithinGesture(value)) return true;
  if (await copyTextToClipboard(value)) return true;
  return promptCopyFallback(value, promptMessage);
}
