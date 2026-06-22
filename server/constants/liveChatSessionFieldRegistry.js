'use strict';

const LIVE_CHAT_SESSION_FIELD_TIERS = Object.freeze(['default', 'advanced']);

const LIVE_CHAT_SESSION_LIST_FIELDS = Object.freeze([
  { key: 'visitor', tier: 'default', locked: true, sortable: false, width: 280, labelKey: 'liveChat.closedColVisitor' },
  { key: 'sessionKey', tier: 'default', locked: true, sortable: true, width: 120, labelKey: 'liveChat.closedColSessionId' },
  { key: 'channel', tier: 'default', sortable: true, width: 100, labelKey: 'liveChat.closedColChannel' },
  { key: 'lifecycleStatus', tier: 'default', sortable: true, width: 110, labelKey: 'liveChat.closedColStatus' },
  { key: 'outcome', tier: 'default', sortable: true, width: 150, labelKey: 'liveChat.closedColOutcome' },
  { key: 'queue', tier: 'default', sortable: false, width: 140, labelKey: 'liveChat.closedColQueue' },
  { key: 'assignedAgent', tier: 'default', sortable: false, width: 140, labelKey: 'liveChat.closedColAssignedAgent' },
  { key: 'handledBy', tier: 'default', sortable: false, width: 140, labelKey: 'liveChat.closedColHandledBy' },
  { key: 'startedAt', tier: 'default', sortable: true, dataType: 'datetime', width: 170, labelKey: 'liveChat.closedColStarted' },
  { key: 'endedAt', tier: 'default', sortable: true, dataType: 'datetime', width: 170, labelKey: 'liveChat.closedColClosed' },
  { key: 'duration', tier: 'default', sortable: false, width: 100, labelKey: 'liveChat.closedColDuration' },
  { key: 'summary', tier: 'default', sortable: false, width: 220, labelKey: 'liveChat.closedColSummary' },
  { key: 'tags', tier: 'default', sortable: false, width: 160, labelKey: 'liveChat.closedColTags' },
  { key: 'csatScore', tier: 'default', sortable: true, width: 90, labelKey: 'liveChat.closedColCsat' },
  { key: 'messageCount', tier: 'advanced', sortable: true, width: 100, labelKey: 'liveChat.closedColMessages' },
  { key: 'visitorMessageCount', tier: 'advanced', sortable: true, width: 120, labelKey: 'liveChat.closedColVisitorMessages' },
  { key: 'agentMessageCount', tier: 'advanced', sortable: true, width: 120, labelKey: 'liveChat.closedColAgentMessages' },
  { key: 'transferCount', tier: 'advanced', sortable: true, width: 110, labelKey: 'liveChat.closedColTransfers' },
  { key: 'waitTime', tier: 'advanced', sortable: false, width: 110, labelKey: 'liveChat.closedColWaitTime' },
  { key: 'firstResponseTime', tier: 'advanced', sortable: false, width: 130, labelKey: 'liveChat.closedColFirstResponse' },
  { key: 'handleTime', tier: 'advanced', sortable: false, width: 110, labelKey: 'liveChat.closedColHandleTime' },
  { key: 'visitorType', tier: 'advanced', sortable: true, width: 120, labelKey: 'liveChat.closedColVisitorType' },
  { key: 'priority', tier: 'advanced', sortable: true, width: 100, labelKey: 'liveChat.closedColPriority' },
  { key: 'sentiment', tier: 'advanced', sortable: true, width: 110, labelKey: 'liveChat.closedColSentiment' },
  { key: 'intent', tier: 'advanced', sortable: true, width: 110, labelKey: 'liveChat.closedColIntent' },
  { key: 'botInvolved', tier: 'advanced', sortable: true, width: 110, labelKey: 'liveChat.closedColBotInvolved' },
  { key: 'consentGiven', tier: 'advanced', adminOnly: true, sortable: true, width: 110, labelKey: 'liveChat.closedColConsent' },
  { key: 'sessionArchived', tier: 'advanced', adminOnly: true, sortable: true, width: 110, labelKey: 'liveChat.closedColArchived' },
  { key: 'exported', tier: 'advanced', adminOnly: true, sortable: true, width: 110, labelKey: 'liveChat.closedColExported' },
]);

const DEFAULT_COLUMN_KEYS = LIVE_CHAT_SESSION_LIST_FIELDS
  .filter((field) => field.tier === 'default')
  .map((field) => field.key);

const LOCKED_COLUMN_KEYS = LIVE_CHAT_SESSION_LIST_FIELDS
  .filter((field) => field.locked)
  .map((field) => field.key);

const FIELD_BY_KEY = new Map(LIVE_CHAT_SESSION_LIST_FIELDS.map((field) => [field.key, field]));

function isValidSessionListFieldKey(key) {
  return FIELD_BY_KEY.has(String(key || '').trim());
}

function normalizeSessionColumnKeys(raw, { allowedKeys } = {}) {
  if (!Array.isArray(raw)) return [];
  const allowed = allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys || []);
  const seen = new Set();
  const keys = [];
  for (const item of raw) {
    const key = String(item || '').trim();
    if (!key || !isValidSessionListFieldKey(key)) continue;
    if (allowed.size > 0 && !allowed.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  for (const lockedKey of LOCKED_COLUMN_KEYS) {
    if (allowed.size > 0 && !allowed.has(lockedKey)) continue;
    if (!seen.has(lockedKey)) {
      keys.unshift(lockedKey);
      seen.add(lockedKey);
    }
  }
  // Ensure locked columns stay in registry order at the front.
  const lockedPrefix = LOCKED_COLUMN_KEYS.filter((key) => seen.has(key));
  const remainder = keys.filter((key) => !LOCKED_COLUMN_KEYS.includes(key));
  return [...lockedPrefix, ...remainder];
}

function listFieldsForViewer({ advancedEnabled = false, isAdmin = false } = {}) {
  return LIVE_CHAT_SESSION_LIST_FIELDS.filter((field) => {
    if (field.tier === 'advanced' && !advancedEnabled) return false;
    if (field.adminOnly && !isAdmin) return false;
    return true;
  });
}

function resolveEffectiveColumnKeys({
  tenantDefaultColumns,
  advancedEnabled = false,
  isAdmin = false,
} = {}) {
  const allowedFields = listFieldsForViewer({ advancedEnabled, isAdmin });
  const allowedKeys = new Set(allowedFields.map((field) => field.key));
  const source = Array.isArray(tenantDefaultColumns) && tenantDefaultColumns.length
    ? tenantDefaultColumns
    : DEFAULT_COLUMN_KEYS;
  const normalized = normalizeSessionColumnKeys(source, { allowedKeys });
  return normalized.length ? normalized : normalizeSessionColumnKeys(DEFAULT_COLUMN_KEYS, { allowedKeys });
}

function buildFieldMetadataResponse({ advancedEnabled = false, isAdmin = false } = {}) {
  return listFieldsForViewer({ advancedEnabled, isAdmin }).map((field) => ({
    key: field.key,
    tier: field.tier,
    locked: Boolean(field.locked),
    sortable: Boolean(field.sortable),
    adminOnly: Boolean(field.adminOnly),
    dataType: field.dataType || null,
    width: field.width || null,
    labelKey: field.labelKey,
  }));
}

module.exports = {
  LIVE_CHAT_SESSION_FIELD_TIERS,
  LIVE_CHAT_SESSION_LIST_FIELDS,
  DEFAULT_COLUMN_KEYS,
  LOCKED_COLUMN_KEYS,
  isValidSessionListFieldKey,
  normalizeSessionColumnKeys,
  listFieldsForViewer,
  resolveEffectiveColumnKeys,
  buildFieldMetadataResponse,
};
