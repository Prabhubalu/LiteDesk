'use strict';

/**
 * Normalize client/page focus into the shape tools and sessionMemory expect:
 * `{ kind, id, moduleKey, name? }` while preserving `recordId` for contextPacket.
 *
 * @param {object|null|undefined} focus
 * @param {{ moduleKey?: string|null, recordId?: string|null, name?: string|null }} [extras]
 * @returns {{ kind?: string, moduleKey?: string, id?: string, recordId?: string, name?: string }|null}
 */
function normalizeFocus(focus, extras = {}) {
  const raw = focus && typeof focus === 'object' ? focus : {};
  const moduleKey = String(
    raw.kind || raw.moduleKey || extras.moduleKey || '',
  ).trim().toLowerCase();
  const id = String(
    raw.id || raw.recordId || extras.recordId || '',
  ).trim();
  const name = String(raw.name || raw.title || extras.name || '').trim();

  if (!moduleKey && !id) return null;

  return {
    ...(moduleKey ? { kind: moduleKey, moduleKey } : {}),
    ...(id ? { id, recordId: id } : {}),
    ...(name ? { name } : {}),
  };
}

module.exports = { normalizeFocus };
