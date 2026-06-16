'use strict';

const CASE_REEVALUATE_FIELDS = new Set([
  'priority',
  'caseType',
  'channel',
  'status',
  'contactId',
  'organizationRefId',
  'caseOwnerId',
  'title',
  'source'
]);

function getAssignmentControl(caseRecord) {
  const control = caseRecord?.assignmentControl && typeof caseRecord.assignmentControl === 'object'
    ? caseRecord.assignmentControl
    : {};
  return {
    isLocked: Boolean(control.isLocked),
    lockReason: control.lockReason || null,
    lockRuleId: control.lockRuleId || null
  };
}

module.exports = {
  moduleKey: 'cases',
  appKey: 'HELPDESK',
  ownerPath: 'caseOwnerId',
  reevaluateFields: CASE_REEVALUATE_FIELDS,
  generic: false,
  supportsEscalation: true,
  supportsAssignmentLock: true,
  activityLogPath: 'activities',

  normalizeRecord(record) {
    return record?.toObject?.() || { ...(record || {}) };
  },

  getOwner(record) {
    const row = this.normalizeRecord(record);
    const value = row.caseOwnerId;
    if (value == null) return null;
    if (typeof value === 'object' && value._id) return String(value._id);
    return String(value);
  },

  setOwner(record, userId) {
    record.caseOwnerId = userId;
    if (typeof record.markModified === 'function') {
      record.markModified('caseOwnerId');
    }
  },

  isAssignmentLocked(record) {
    return getAssignmentControl(record).isLocked;
  },

  shouldReevaluate(changedFields = []) {
    if (!Array.isArray(changedFields) || changedFields.length === 0) return true;
    return changedFields.some((field) => CASE_REEVALUATE_FIELDS.has(field));
  },

  buildSimulateContext(record, recordId) {
    return {
      previousOwnerId: this.getOwner(record),
      recordId: recordId || (record?._id ? String(record._id) : null)
    };
  },

  getAssignmentControl
};
