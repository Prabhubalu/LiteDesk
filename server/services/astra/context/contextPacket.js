'use strict';

/**
 * ContextPacket — the single, normalized context object the orchestrator and
 * tools consume. Nothing downstream reads req/res directly; everything flows
 * through this immutable-ish packet so behavior is deterministic and testable.
 */

/**
 * @typedef {Object} ContextPacket
 * @property {string} organizationId
 * @property {string|null} userId
 * @property {string} surface            e.g. 'chat' | 'deals' | 'inbox' | 'home'
 * @property {{ moduleKey?: string, recordId?: string, title?: string }|null} focus
 * @property {string} query
 * @property {Array<{role: string, content: string}>} history
 * @property {{ personal: object, org: object[] }} memory
 * @property {string} locale
 * @property {number} now                epoch ms (injectable for tests)
 * @property {object} flags
 */

/**
 * Build a normalized ContextPacket from loosely-typed request inputs.
 * @param {Object} input
 * @returns {ContextPacket}
 */
function buildContextPacket(input = {}) {
  const rawFocus = input.focus && typeof input.focus === 'object' ? input.focus : null;
  const moduleKey = String(rawFocus?.moduleKey || rawFocus?.kind || '').trim();
  const recordId = String(rawFocus?.recordId || rawFocus?.id || '').trim();
  const title = String(rawFocus?.title || rawFocus?.name || '').trim();
  const focus = rawFocus && (moduleKey || recordId)
    ? {
        moduleKey,
        recordId,
        title,
      }
    : null;

  const flags = input.flags && typeof input.flags === 'object' ? { ...input.flags } : {};
  if (input.canvasId) {
    flags.canvasId = String(input.canvasId);
  }
  if (input.targetWidgetId || flags.targetWidgetId) {
    flags.targetWidgetId = String(input.targetWidgetId || flags.targetWidgetId);
  }

  return {
    organizationId: String(input.organizationId || ''),
    userId: input.userId ? String(input.userId) : null,
    surface: String(input.surface || 'chat'),
    focus,
    canvasId: input.canvasId ? String(input.canvasId) : flags.canvasId || null,
    targetWidgetId: flags.targetWidgetId || null,
    query: String(input.query || '').trim(),
    history: Array.isArray(input.history) ? input.history.slice(-20) : [],
    memory: {
      personal: input.memory?.personal || {},
      org: Array.isArray(input.memory?.org) ? input.memory.org : [],
    },
    locale: String(input.locale || 'en'),
    now: Number.isFinite(input.now) ? input.now : Date.now(),
    flags,
  };
}

module.exports = { buildContextPacket };
