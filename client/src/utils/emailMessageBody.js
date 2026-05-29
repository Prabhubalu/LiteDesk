/**
 * Sanitize and render inbound/outbound email bodies (full HTML), shared with inbox thread reader.
 */

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function emailBodyLooksLikeHtml(body) {
  return /<[^>]+>/.test(String(body || ''));
}

/** Strip tags for collapsed snippets and search previews. */
export function emailBodyToPlainText(body) {
  return String(body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Permissive sanitizer for real email HTML (tables, images, inline styles on allowed elements).
 * Strips scripts, event handlers, and javascript: URLs.
 */
export function sanitizeEmailHtml(html) {
  const raw = String(html || '');
  if (!raw.trim()) return '';

  if (typeof document === 'undefined') {
    return raw.replace(/<script[\s\S]*?<\/script>/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '');
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return doc.body.innerHTML || '';
}

/**
 * Render email body: HTML emails sanitized; plain text wrapped with line breaks.
 */
export function renderEmailMessageBody(body, { emptyLabel = '(no content)' } = {}) {
  const raw = String(body || '').trim();
  if (!raw) return `<p class="text-gray-400">${escapeHtml(emptyLabel)}</p>`;
  if (emailBodyLooksLikeHtml(raw)) {
    const clean = sanitizeEmailHtml(raw);
    return clean || `<p class="text-gray-400">${escapeHtml(emptyLabel)}</p>`;
  }
  return `<p>${escapeHtml(raw).replace(/\n/g, '<br>')}</p>`;
}
