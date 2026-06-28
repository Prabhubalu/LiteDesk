'use strict';

const { SLA_PAUSE_STATUSES } = require('../../../constants/caseLifecycle');

const SLA_PAUSE_STATUS_SET = new Set(SLA_PAUSE_STATUSES);

module.exports = {
  moduleKey: 'cases',
  appKey: 'HELPDESK',
  milestoneKeys: ['first_response', 'resolution'],
  priorityDimension: 'priority',
  labelKey: 'navigation.moduleCases',

  normalizeRecord(record) {
    const row = record?.toObject?.() || record || {};
    return {
      _id: row._id,
      status: row.status,
      priority: row.priority,
      caseType: row.caseType,
      channel: row.channel,
      assignedTo: row.assignedTo,
      recordType: row.caseType || null,
      customFields: row.customFields || {}
    };
  },

  extractContext(record) {
    const row = this.normalizeRecord(record);
    return {
      caseType: row.caseType,
      priority: row.priority,
      channel: row.channel,
      status: row.status
    };
  },

  shouldPause(record) {
    return SLA_PAUSE_STATUS_SET.has(this.normalizeRecord(record).status);
  },

  isTerminalSuccess(record) {
    const status = this.normalizeRecord(record).status;
    return status === 'Resolved' || status === 'Closed';
  },

  legacyBridge: {
    enabled: true,
    milestoneToCycleField: {
      first_response: 'responseTargetAt',
      resolution: 'resolutionTargetAt'
    },
    metField: {
      first_response: 'responseMetAt'
    }
  }
};
