'use strict';

const OWNER_FIELD_CANDIDATES = [
  'assignedTo',
  'ownerId',
  'caseOwnerId',
  'assigned_to',
  'owner_id'
];

const DEFAULT_REEVALUATE_FIELDS = [
  'assignedTo',
  'ownerId',
  'caseOwnerId',
  'status',
  'priority',
  'stage',
  'pipeline',
  'tags',
  'customFields',
  'derivedStatus',
  'type',
  'title',
  'name'
];

function inferOwnerPath(moduleFields = []) {
  const keys = (Array.isArray(moduleFields) ? moduleFields : []).map((f) => String(f?.key || '').trim());
  for (const candidate of OWNER_FIELD_CANDIDATES) {
    if (keys.includes(candidate)) return candidate;
  }
  return 'assignedTo';
}

function createGenericAssignmentAdapter(moduleKey, options = {}) {
  const key = String(moduleKey || '').toLowerCase();
  const appKey = options.appKey ? String(options.appKey).toUpperCase() : null;
  const moduleFields = Array.isArray(options.moduleFields) ? options.moduleFields : [];
  const ownerPath = options.ownerPath || inferOwnerPath(moduleFields);
  const fieldKeys = moduleFields.map((f) => String(f.key || '').trim()).filter(Boolean);
  const reevaluateFields = new Set([...DEFAULT_REEVALUATE_FIELDS, ownerPath, ...fieldKeys]);

  return {
    moduleKey: key,
    appKey,
    ownerPath,
    reevaluateFields,
    generic: true,
    supportsEscalation: false,
    supportsAssignmentLock: false,
    activityLogPath: 'activityLogs',

    normalizeRecord(record) {
      const row = record?.toObject?.({ depopulate: true, flattenMaps: true }) || { ...(record || {}) };
      return row;
    },

    getOwner(record) {
      const row = this.normalizeRecord(record);
      const value = row[this.ownerPath];
      if (value == null) return null;
      if (typeof value === 'object' && value._id) return String(value._id);
      return String(value);
    },

    setOwner(record, userId) {
      record[this.ownerPath] = userId;
      if (typeof record.markModified === 'function') {
        record.markModified(this.ownerPath);
      }
    },

    isAssignmentLocked() {
      return false;
    },

    shouldReevaluate(changedFields = []) {
      if (!Array.isArray(changedFields) || changedFields.length === 0) return true;
      return changedFields.some((field) => this.reevaluateFields.has(field));
    },

    buildSimulateContext(record, recordId) {
      return {
        previousOwnerId: this.getOwner(record),
        recordId: recordId || (record?._id ? String(record._id) : null)
      };
    }
  };
}

module.exports = {
  createGenericAssignmentAdapter,
  inferOwnerPath,
  OWNER_FIELD_CANDIDATES
};
