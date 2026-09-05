import DOMPurify from 'dompurify';
import {
  ALLOWED_RICH_DESCRIPTION_ATTR,
  withLinksOpenInNewTab,
} from '@/utils/richDescriptionHtml';
import {
  formatInternalChatMentions,
  internalChatUserDisplayName,
} from '@/utils/internalChatMentions';

/** TipTap chat — description-compatible tags (no images; attachments cover media). */
export const ALLOWED_INTERNAL_CHAT_HTML_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'span',
  'h1',
  'h2',
  'h3',
  'blockquote',
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function looksLikeInternalChatHtml(value) {
  return /<\/?(p|strong|em|ul|ol|li|a|code|pre|s|u|span|br|h[1-3]|blockquote)\b/i.test(String(value || ''));
}

/** TipTap empty doc is usually `<p></p>`. */
export function isInternalChatBodyEmpty(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (!looksLikeInternalChatHtml(raw)) return !raw;
  const text = plainTextFromInternalChatHtml(raw);
  return !text;
}

export function plainTextFromInternalChatHtml(html) {
  const raw = String(html || '');
  if (!raw) return '';
  if (typeof document !== 'undefined') {
    const tpl = document.createElement('template');
    tpl.innerHTML = raw;
    return (tpl.content.textContent || '').replace(/\u00a0/g, ' ').trim();
  }
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function decorateMentionLabels(html, users = []) {
  let out = String(html || '');
  const labels = [...users]
    .map((u) => internalChatUserDisplayName(u))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const label of labels) {
    const re = new RegExp(`@${escapeRegExp(label)}(?![\\w])`, 'g');
    out = out.replace(
      re,
      `<span class="ic-mention">@${escapeHtml(label)}</span>`
    );
  }
  out = out.replace(/(^|[^>\w])@all\b/gi, '$1<span class="ic-mention">@all</span>');
  return out;
}

/**
 * Sanitize TipTap HTML for chat bubbles (description-compatible tags, no images).
 */
export function sanitizeInternalChatHtml(raw) {
  const str = String(raw || '');
  if (!str.trim()) return '';
  const clean = DOMPurify.sanitize(str, {
    ALLOWED_TAGS: ALLOWED_INTERNAL_CHAT_HTML_TAGS,
    ALLOWED_ATTR: ALLOWED_RICH_DESCRIPTION_ATTR.filter((a) => a !== 'src' && a !== 'alt' && a !== 'width' && a !== 'height' && a !== 'data-width'),
  });
  return withLinksOpenInNewTab(clean);
}

/**
 * Humanize mention tokens, decorate @names, sanitize for display.
 */
export function renderInternalChatMessageHtml(body, users = []) {
  const raw = String(body || '');
  if (!raw) return '';

  if (!looksLikeInternalChatHtml(raw)) {
    // Legacy plain / markdown-era messages: escape + soft markdown bold/italic for back-compat
    const escaped = escapeHtml(formatInternalChatMentions(raw, users));
    let html = escaped
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_\n]+)_/g, '<em>$1</em>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/~([^~\n]+)~/g, '<s>$1</s>')
      .replace(/\n/g, '<br>');
    html = decorateMentionLabels(html, users);
    return sanitizeInternalChatHtml(`<p>${html}</p>`);
  }

  const humanized = formatInternalChatMentions(raw, users);
  return sanitizeInternalChatHtml(decorateMentionLabels(humanized, users));
}
