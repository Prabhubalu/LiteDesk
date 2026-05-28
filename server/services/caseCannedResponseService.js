const {
  DEFAULT_CASE_CANNED_RESPONSES,
  ALLOWED_CANNED_CHANNELS,
  MAX_CANNED_RESPONSES
} = require('../constants/caseCannedResponses');

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function slugifyId(raw, fallbackIndex) {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `macro-${fallbackIndex}`;
}

function normalizeCannedResponse(entry, index = 0) {
  if (!isPlainObject(entry)) return null;
  const name = String(entry.name || '').trim();
  const body = String(entry.body || '').trim();
  if (!name || !body) return null;

  const channelRaw = String(entry.channel || 'email').trim().toLowerCase();
  const channel = ALLOWED_CANNED_CHANNELS.has(channelRaw) ? channelRaw : 'email';

  return {
    id: slugifyId(entry.id, index),
    name,
    channel,
    subject: String(entry.subject || '').trim(),
    body
  };
}

function getDefaultCannedResponses() {
  return DEFAULT_CASE_CANNED_RESPONSES.map((item, idx) => normalizeCannedResponse(item, idx)).filter(Boolean);
}

/**
 * @param {unknown} list
 * @param {{ useDefaultsWhenMissing?: boolean }} [options]
 * - useDefaultsWhenMissing: true for first-time tenants (undefined/null source)
 * - false when persisting or re-loading a saved list (including empty [])
 */
function normalizeCannedResponses(list, { useDefaultsWhenMissing = true } = {}) {
  if (list == null) {
    return useDefaultsWhenMissing ? getDefaultCannedResponses() : [];
  }
  if (!Array.isArray(list)) {
    return useDefaultsWhenMissing ? getDefaultCannedResponses() : [];
  }
  if (list.length === 0) {
    return useDefaultsWhenMissing ? getDefaultCannedResponses() : [];
  }
  const seen = new Set();
  const output = [];
  for (let i = 0; i < list.length && output.length < MAX_CANNED_RESPONSES; i += 1) {
    const normalized = normalizeCannedResponse(list[i], i);
    if (!normalized) continue;
    let id = normalized.id;
    let suffix = 1;
    while (seen.has(id)) {
      id = `${normalized.id}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    output.push({ ...normalized, id });
  }
  if (!output.length) {
    return useDefaultsWhenMissing ? getDefaultCannedResponses() : [];
  }
  return output;
}

/** Sanitize user-provided list for persistence (never substitute defaults). */
function sanitizeCannedResponsesForSave(list) {
  return normalizeCannedResponses(list, { useDefaultsWhenMissing: false });
}

function validateCannedResponses(list) {
  if (!Array.isArray(list)) return 'cannedResponses must be an array';
  if (list.length > MAX_CANNED_RESPONSES) {
    return `cannedResponses cannot exceed ${MAX_CANNED_RESPONSES} items`;
  }
  const ids = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!isPlainObject(item)) return `cannedResponses[${i}] must be an object`;
    const name = String(item.name || '').trim();
    const body = String(item.body || '').trim();
    if (!name) return `cannedResponses[${i}].name is required`;
    if (!body) return `cannedResponses[${i}].body is required`;
    const channel = String(item.channel || '').trim().toLowerCase();
    if (!ALLOWED_CANNED_CHANNELS.has(channel)) {
      return `cannedResponses[${i}].channel must be email, internal, or all`;
    }
    const id = slugifyId(item.id, i);
    if (ids.has(id)) return `Duplicate canned response id: ${id}`;
    ids.add(id);
  }
  return null;
}

function contactFirstName(contact) {
  if (!contact || typeof contact !== 'object') return '';
  return String(contact.first_name || contact.firstName || '').trim();
}

function formatContactDisplayName(contact, fallbackEmail = '') {
  if (!contact || typeof contact !== 'object') {
    const email = String(fallbackEmail || '').trim();
    return email ? email.split('@')[0] : '';
  }
  const first = contactFirstName(contact);
  const last = String(contact.last_name || contact.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  if (full) return full;
  const email = String(contact.email || fallbackEmail || '').trim();
  return email ? email.split('@')[0] : '';
}

function buildTokenContext({ caseRecord = null, agentUser = null, contactEmail = '' } = {}) {
  const contact = caseRecord?.contactId;
  const contactName = formatContactDisplayName(contact, contactEmail);

  const agentName = agentUser
    ? [agentUser.firstName, agentUser.lastName].filter(Boolean).join(' ').trim()
      || String(agentUser.email || '').trim()
    : '';

  return {
    case: {
      id: String(caseRecord?._id || caseRecord?.id || ''),
      caseId: String(caseRecord?.caseId || ''),
      title: String(caseRecord?.title || ''),
      status: String(caseRecord?.status || ''),
      priority: String(caseRecord?.priority || ''),
      channel: String(caseRecord?.channel || '')
    },
    contact: {
      firstName: contactFirstName(contact) || contactName.split(/\s+/)[0] || 'there',
      name: contactName,
      email: String(
        (contact && typeof contact === 'object' ? contact.email : '') || contactEmail || ''
      ).trim()
    },
    agent: {
      name: agentName,
      email: String(agentUser?.email || '').trim()
    }
  };
}

function applyCaseCannedResponseTokens(template, context) {
  const text = String(template || '');
  if (!text) return '';
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
    const parts = String(path).split('.');
    let cursor = context;
    for (const part of parts) {
      if (cursor == null || typeof cursor !== 'object') return match;
      cursor = cursor[part];
    }
    const value = cursor == null ? '' : String(cursor);
    return value || match;
  });
}

function filterCannedResponsesForChannel(responses, channel) {
  const target = String(channel || '').toLowerCase();
  const mode = target === 'internal' ? 'internal' : 'email';
  return (responses || []).filter((item) => {
    const ch = String(item.channel || 'all').toLowerCase();
    return ch === 'all' || ch === mode;
  });
}

module.exports = {
  normalizeCannedResponses,
  sanitizeCannedResponsesForSave,
  validateCannedResponses,
  buildTokenContext,
  applyCaseCannedResponseTokens,
  filterCannedResponsesForChannel,
  DEFAULT_CASE_CANNED_RESPONSES,
  getDefaultCannedResponses
};
