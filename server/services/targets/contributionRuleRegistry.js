'use strict';

const crypto = require('crypto');

const DEFAULT_RULE_TEMPLATES = {
  'SALES:deals': {
    metricField: 'amount',
    metricKind: 'currency',
    filters: [{ field: 'status', operator: 'equals', value: 'Won' }],
    attribution: { type: 'owner', field: 'assignedTo' }
  },
  'HELPDESK:cases': {
    metricField: null,
    metricKind: 'count',
    filters: [{ field: 'status', operator: 'equals', value: 'Resolved' }],
    attribution: { type: 'owner', field: 'assignedTo' }
  },
  'PLATFORM:tasks': {
    metricField: null,
    metricKind: 'count',
    filters: [{ field: 'status', operator: 'equals', value: 'completed' }],
    attribution: { type: 'owner', field: 'assignedTo' }
  }
};

function templateForModule(appKey, moduleKey) {
  return DEFAULT_RULE_TEMPLATES[`${appKey}:${moduleKey}`] || {
    metricKind: 'count',
    filters: [],
    attribution: { type: 'owner', field: null }
  };
}

function buildDefaultRule(appKey, moduleKey, index = 0) {
  const tpl = templateForModule(appKey, moduleKey);
  return {
    id: `rule_${crypto.randomBytes(4).toString('hex')}`,
    appKey,
    moduleKey,
    metricField: tpl.metricField,
    metricKind: tpl.metricKind,
    filters: tpl.filters,
    attribution: tpl.attribution,
    weight: 1,
    enabled: true
  };
}

function entityTypeFromEvent(event) {
  const t = String(event?.entityType || '').toLowerCase();
  if (t === 'deal') return 'deal';
  if (t === 'case') return 'case';
  if (t === 'task') return 'task';
  return t;
}

function moduleKeyFromEntity(entityType) {
  if (entityType === 'deal') return 'deals';
  if (entityType === 'case') return 'cases';
  if (entityType === 'task') return 'tasks';
  return entityType;
}

module.exports = {
  DEFAULT_RULE_TEMPLATES,
  templateForModule,
  buildDefaultRule,
  entityTypeFromEvent,
  moduleKeyFromEntity
};
