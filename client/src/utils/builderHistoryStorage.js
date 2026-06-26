const STORAGE_PREFIX = 'arivu-builder-history:';

/**
 * @param {string} templateId
 * @returns {{ past: unknown[]; future: unknown[]; selectedId: string | null } | null}
 */
export function loadBuilderHistory(templateId) {
  if (!templateId) return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${templateId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      past: Array.isArray(parsed.past) ? parsed.past : [],
      future: Array.isArray(parsed.future) ? parsed.future : [],
      selectedId: parsed.selectedId || null
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} templateId
 * @param {{ past: unknown[]; future: unknown[]; selectedId: string | null }} payload
 */
export function saveBuilderHistory(templateId, payload) {
  if (!templateId) return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${templateId}`, JSON.stringify(payload));
  } catch {
    // Ignore quota errors.
  }
}

/** @param {string} templateId */
export function clearBuilderHistory(templateId) {
  if (!templateId) return;
  sessionStorage.removeItem(`${STORAGE_PREFIX}${templateId}`);
}
