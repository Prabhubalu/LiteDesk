/**
 * Normalize document richContent (TipTap HTML stored in Mixed field).
 */
export function getRichContentHtml(richContent) {
  if (!richContent) return '';
  if (typeof richContent === 'string') return richContent;
  if (typeof richContent === 'object' && richContent.html) return String(richContent.html);
  return '';
}

export function getDocumentPreviewSnippet(record, maxLength = 120) {
  const html = getRichContentHtml(record?.richContent);
  if (!html) return record?.description || '';
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

export function toRichContentPayload(html) {
  const value = String(html || '').trim();
  if (!value) return null;
  return { format: 'tiptap_html', html: value };
}

export function isFileDocument(record) {
  return String(record?.documentType || 'file') === 'file';
}

export function isExternalLinkDocument(record) {
  return String(record?.documentType || '') === 'external_link' || record?.sourceType === 'external';
}

export function isRichDocument(record) {
  return !isFileDocument(record) && !isExternalLinkDocument(record);
}
