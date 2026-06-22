'use strict';

const LIVE_CHAT_SESSION_REEVALUATE_FIELDS = new Set([
  'assignedAgentId',
  'queueId',
  'queueKey',
  'lifecycleStatus',
  'channel',
  'pageUrl',
  'visitor',
  'status',
]);

module.exports = {
  moduleKey: 'live_chat_sessions',
  appKey: 'PLATFORM',
  ownerPath: 'assignedAgentId',
  labelKey: 'settings.assignRulesModLiveChatSessions',
  reevaluateFields: LIVE_CHAT_SESSION_REEVALUATE_FIELDS,
  generic: false,
  supportsEscalation: false,
  supportsAssignmentLock: false,
  addonKey: 'live_chat',

  normalizeRecord(record) {
    return record?.toObject?.({ depopulate: true, flattenMaps: true }) || { ...(record || {}) };
  },

  getOwner(record) {
    const row = this.normalizeRecord(record);
    const value = row.assignedAgentId;
    if (value == null) return null;
    if (typeof value === 'object' && value._id) return String(value._id);
    return String(value);
  },

  setOwner(record, userId) {
    record.assignedAgentId = userId;
    if (typeof record.markModified === 'function') {
      record.markModified('assignedAgentId');
    }
  },

  isAssignmentLocked() {
    return false;
  },

  shouldReevaluate(changedFields = []) {
    if (!Array.isArray(changedFields) || changedFields.length === 0) return true;
    return changedFields.some((field) => LIVE_CHAT_SESSION_REEVALUATE_FIELDS.has(field));
  },

  buildSimulateContext(record, recordId) {
    return {
      previousOwnerId: this.getOwner(record),
      recordId: recordId || (record?._id ? String(record._id) : null),
    };
  },
};
