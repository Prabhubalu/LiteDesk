'use strict';

/**
 * Standard Live Chat session outcomes (spec v2.0).
 * Tenants may add custom outcomes via TenantAddonConfiguration.settings.outcomes.custom.
 */
const STANDARD_LIVE_CHAT_OUTCOMES = Object.freeze([
  { key: 'resolved', label: 'Resolved in Chat', system: true },
  { key: 'missed', label: 'Missed', system: true },
  { key: 'follow_up_required', label: 'Follow-up Required', system: true },
  { key: 'escalated', label: 'Escalated', system: true },
  { key: 'abandoned', label: 'Abandoned', system: true },
  { key: 'spam', label: 'Spam', system: true },
  { key: 'informational', label: 'Informational', system: true },
]);

const STANDARD_OUTCOME_KEYS = new Set(STANDARD_LIVE_CHAT_OUTCOMES.map((row) => row.key));

function normalizeOutcomeKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 64);
}

module.exports = {
  STANDARD_LIVE_CHAT_OUTCOMES,
  STANDARD_OUTCOME_KEYS,
  normalizeOutcomeKey,
};
