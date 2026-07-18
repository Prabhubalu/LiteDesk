/**
 * Human-readable message from apiClient/fetch errors (validation, generic HTTP messages).
 * Never return HTML error-page dumps suitable for toasts.
 */
export function getApiErrorMessage(err) {
  if (!err) return 'Request failed';
  const d = err.response?.data;
  if (d && typeof d.errors === 'object' && d.errors !== null && !Array.isArray(d.errors)) {
    const parts = Object.values(d.errors).filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  if (d?.error && typeof d.error === 'string' && d.error.trim()) return d.error.trim();
  if (d?.message && typeof d.message === 'string' && d.message.trim()) {
    const msg = d.message.trim();
    if (!looksLikeHtmlDump(msg)) return msg;
  }
  const raw = String(err.message || '').trim();
  if (raw && !looksLikeHtmlDump(raw)) return raw;
  if (err.status) return `Request failed (${err.status})`;
  return 'Request failed';
}

function looksLikeHtmlDump(message) {
  const m = String(message || '');
  return (
    m.includes('<!DOCTYPE')
    || m.includes('<html')
    || /non-JSON response/i.test(m)
  );
}
