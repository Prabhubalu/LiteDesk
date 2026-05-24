'use strict';

const TARGET_LIFECYCLE = Object.freeze([
  'draft',
  'active',
  'locked',
  'completed',
  'closed'
]);

const TARGET_STATUS = Object.freeze([
  'on_track',
  'at_risk',
  'achieved',
  'overachieved',
  'not_started'
]);

const DISTRIBUTION_TYPES = Object.freeze([
  'equal',
  'weighted',
  'manual',
  'capacity'
]);

const METRIC_KINDS = Object.freeze(['count', 'sum', 'currency']);

const DEFAULT_TARGET_TYPES = Object.freeze([
  {
    key: 'revenue',
    name: 'Revenue Target',
    metricKind: 'currency',
    defaultSourceModules: [{ appKey: 'SALES', moduleKey: 'deals' }]
  },
  {
    key: 'deal_count',
    name: 'Deal Count Target',
    metricKind: 'count',
    defaultSourceModules: [{ appKey: 'SALES', moduleKey: 'deals' }]
  },
  {
    key: 'case_resolution',
    name: 'Case Resolution Target',
    metricKind: 'count',
    defaultSourceModules: [{ appKey: 'HELPDESK', moduleKey: 'cases' }]
  },
  {
    key: 'task_completion',
    name: 'Task Completion Target',
    metricKind: 'count',
    defaultSourceModules: [{ appKey: 'PLATFORM', moduleKey: 'tasks' }]
  }
]);

const TARGET_SYNTHETIC_EVENTS = Object.freeze([
  'target.lifecycle.activated',
  'target.progress.updated',
  'target.threshold.crossed',
  'target.status.changed'
]);

const CONTRIBUTION_EVENT_MAP = Object.freeze({
  deal: ['deal.stage.changed', 'deal.deal.won', 'deal.deal.lost', 'deal.updated'],
  case: ['case.status.changed', 'case.updated', 'case.created'],
  task: ['task.status.changed', 'task.updated', 'task.created']
});

module.exports = {
  TARGET_LIFECYCLE,
  TARGET_STATUS,
  DISTRIBUTION_TYPES,
  METRIC_KINDS,
  DEFAULT_TARGET_TYPES,
  TARGET_SYNTHETIC_EVENTS,
  CONTRIBUTION_EVENT_MAP
};
