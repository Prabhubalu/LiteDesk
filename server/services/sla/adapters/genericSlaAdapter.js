'use strict';

const TERMINAL_STATUS_PATTERNS = [
  /^resolved$/i,
  /^closed$/i,
  /^completed$/i,
  /^done$/i,
  /^won$/i,
  /^lost$/i,
  /^cancelled$/i,
  /^canceled$/i
];

const PAUSE_STATUS_PATTERNS = [
  /^on\s*hold$/i,
  /^waiting/i,
  /^pending\s*customer/i,
  /^paused$/i
];

function createGenericSlaAdapter(moduleKey, appKey = null) {
  const key = String(moduleKey || '').toLowerCase();

  return {
    moduleKey: key,
    appKey: appKey ? String(appKey).toUpperCase() : null,
    milestoneKeys: ['resolution'],
    priorityDimension: 'priority',
    labelKey: null,
    generic: true,

    normalizeRecord(record) {
      const row = record?.toObject?.() || record || {};
      return {
        _id: row._id,
        status: row.status || row.stage || row.state || null,
        priority: row.priority || null,
        recordType: row.recordType || row.type || row.caseType || null,
        customFields: row.customFields || {}
      };
    },

    extractContext(record) {
      const row = this.normalizeRecord(record);
      return {
        status: row.status,
        priority: row.priority,
        recordType: row.recordType
      };
    },

    shouldPause(record) {
      const status = String(this.normalizeRecord(record).status || '');
      return PAUSE_STATUS_PATTERNS.some((pattern) => pattern.test(status));
    },

    isTerminalSuccess(record) {
      const status = String(this.normalizeRecord(record).status || '');
      return TERMINAL_STATUS_PATTERNS.some((pattern) => pattern.test(status));
    }
  };
}

module.exports = {
  createGenericSlaAdapter
};
