/**
 * In-memory create/edit drawer drafts keyed by workspace tab.
 * Survives tab switches (and keep-alive eviction when the drawer remounts).
 */

/** @type {Map<string, object>} */
const drafts = new Map();

/**
 * @param {string|null|undefined} tabId
 * @param {string} moduleKey
 * @param {string|null|undefined} recordId
 */
export function tabDrawerDraftKey(tabId, moduleKey, recordId = null) {
  const tab = String(tabId || '').trim() || '_none';
  const mod = String(moduleKey || '').trim().toLowerCase() || '_module';
  const rec = recordId != null && String(recordId).trim() ? String(recordId).trim() : '';
  return rec ? `${tab}::${mod}::edit::${rec}` : `${tab}::${mod}::create`;
}

/**
 * @param {string} key
 * @param {object} payload
 */
export function saveTabDrawerDraft(key, payload) {
  if (!key || !payload || typeof payload !== 'object') return;
  drafts.set(key, {
    ...payload,
    formData: payload.formData ? structuredCloneSafe(payload.formData) : {},
    dealRelationships: payload.dealRelationships
      ? structuredCloneSafe(payload.dealRelationships)
      : undefined,
    dealLinesDraft: payload.dealLinesDraft != null
      ? structuredCloneSafe(payload.dealLinesDraft)
      : undefined,
    commercialFormRecord: payload.commercialFormRecord
      ? structuredCloneSafe(payload.commercialFormRecord)
      : null,
    updatedAt: Date.now(),
  });
}

/**
 * @param {string} key
 * @returns {object|null}
 */
export function getTabDrawerDraft(key) {
  if (!key) return null;
  const draft = drafts.get(key);
  return draft ? structuredCloneSafe(draft) : null;
}

/**
 * @param {string} key
 */
export function clearTabDrawerDraft(key) {
  if (!key) return;
  drafts.delete(key);
}

/**
 * Drop all drafts owned by a closed workspace tab.
 * @param {string} tabId
 */
export function clearTabDrawerDraftsForTab(tabId) {
  const prefix = `${String(tabId || '').trim()}::`;
  if (prefix === '::') return;
  for (const key of [...drafts.keys()]) {
    if (key.startsWith(prefix)) drafts.delete(key);
  }
}

/** @param {unknown} value */
function structuredCloneSafe(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch {
    /* fall through */
  }
  return JSON.parse(JSON.stringify(value));
}
