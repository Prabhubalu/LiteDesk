/**
 * Internal Chat mention tokens are stored as <@mongoUserId> or <@all>.
 * UI and notifications should show @Display Name / @all instead.
 */

const MENTION_USER_TOKEN_RE = /<@([a-f0-9]{24})>/gi;
const MENTION_ALL_TOKEN_RE = /<@all>/gi;
const MENTION_ALL_PLAIN_RE = /(^|[\s])@all\b/gi;

export const INTERNAL_CHAT_MENTION_ALL = 'all';

export function internalChatUserDisplayName(user) {
  if (!user) return '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || '';
}

export function bodyHasMentionAll(text) {
  const raw = String(text || '');
  return /<@all>/i.test(raw) || /(^|[\s])@all\b/i.test(raw);
}

/**
 * @param {string} text
 * @param {Iterable<object>} users users with _id + name fields
 * @returns {string}
 */
export function formatInternalChatMentions(text, users = []) {
  const map = new Map();
  for (const user of users) {
    const id = user?._id != null ? String(user._id) : '';
    if (!id) continue;
    const label = internalChatUserDisplayName(user);
    if (label) map.set(id, label);
  }
  return String(text || '')
    .replace(MENTION_ALL_TOKEN_RE, '@all')
    .replace(MENTION_USER_TOKEN_RE, (_, id) => {
      const label = map.get(String(id));
      return label ? `@${label}` : '@someone';
    });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Split display text into plain / mention segments for highlighting.
 * @param {string} displayText already humanized (@Name) or raw
 * @param {Iterable<object>} users
 * @returns {Array<{ text: string, mention: boolean }>}
 */
export function splitInternalChatMentionParts(displayText, users = []) {
  const text = String(displayText || '');
  if (!text) return [];

  const labels = [...users]
    .map((u) => internalChatUserDisplayName(u))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const patterns = [
    '@all\\b',
    '<@all>',
    ...labels.map((label) => `@${escapeRegExp(label)}`),
    '<@[a-f0-9]{24}>',
    '@someone',
  ];
  const re = new RegExp(`(${patterns.join('|')})`, 'gi');
  const parts = [];
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index), mention: false });
    }
    parts.push({ text: match[0], mention: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), mention: false });
  }
  return parts.length ? parts : [{ text, mention: false }];
}

/**
 * HTML for composer mirror overlay (mentions highlighted).
 * @param {string} draftText
 * @param {Iterable<object>} users
 * @returns {string}
 */
export function buildComposerMentionHighlightHtml(draftText, users = []) {
  if (!String(draftText || '')) return '';
  const parts = splitInternalChatMentionParts(draftText, users);
  if (!parts.length) return '';
  return parts.map((part) => {
    const escaped = escapeHtml(part.text).replace(/\n/g, '<br>');
    if (!part.mention) return escaped;
    return `<span class="rounded-sm bg-primary-100/90 text-primary-800 dark:bg-primary-900/55 dark:text-primary-200">${escaped}</span>`;
  }).join('');
}

/**
 * Convert visible @Display Name / @all mentions into tokens for the API.
 * @param {string} text
 * @param {Iterable<object>} users
 * @returns {{ body: string, mentionUserIds: string[], mentionAll: boolean }}
 */
export function encodeInternalChatMentionsForSend(text, users = []) {
  let body = String(text || '');
  const mentionUserIds = [];

  body = body.replace(MENTION_ALL_PLAIN_RE, '$1<@all>');
  const mentionAll = /<@all>/i.test(body);

  const sorted = [...users]
    .filter((u) => u?._id && internalChatUserDisplayName(u))
    .sort((a, b) => internalChatUserDisplayName(b).length - internalChatUserDisplayName(a).length);

  for (const user of sorted) {
    const label = internalChatUserDisplayName(user);
    const re = new RegExp(`@${escapeRegExp(label)}(?![\\w])`, 'g');
    if (!re.test(body)) continue;
    re.lastIndex = 0;
    body = body.replace(re, `<@${user._id}>`);
    mentionUserIds.push(String(user._id));
  }

  MENTION_USER_TOKEN_RE.lastIndex = 0;
  let match;
  while ((match = MENTION_USER_TOKEN_RE.exec(body)) !== null) {
    mentionUserIds.push(String(match[1]));
  }

  return {
    body,
    mentionUserIds: [...new Set(mentionUserIds)],
    mentionAll,
  };
}
