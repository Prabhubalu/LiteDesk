'use strict';

const SLA_TRIGGER_TYPES = [
  'record_created',
  'field_change',
  'date_field_reached',
  'custom_event'
];

const SLA_EXECUTION_MODES = ['first_match', 'all_matches', 'highest_priority'];

const SLA_INSTANCE_STATUSES = ['pending', 'running', 'paused', 'met', 'breached', 'cancelled'];

const SLA_CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'in',
  'not_in',
  'gt',
  'gte',
  'lt',
  'lte',
  'before',
  'after',
  'is_true',
  'is_false',
  'exists'
];

const SLA_ALERT_TIMING = ['before', 'at', 'after'];

const SLA_ALERT_RECIPIENTS = [
  'assigned_user',
  'manager',
  'record_owner',
  'assigned_group',
  'specific_users',
  'dynamic_field'
];

const SLA_ALERT_CHANNELS = ['inApp', 'email', 'push', 'whatsapp', 'slack', 'teams'];

const SLA_ESCALATION_ACTIONS = [
  'notify_hierarchy',
  'reassign_owner',
  'trigger_workflow',
  'execute_automation',
  'webhook'
];

const SLA_MILESTONE_KEYS = ['first_response', 'resolution', 'approval'];

const SLA_EXECUTION_EVENT_TYPES = [
  'applied',
  'triggered',
  'paused',
  'resumed',
  'met',
  'breached',
  'escalated',
  'notified'
];

const DEFAULT_EXECUTION_MODE = 'first_match';
const DEFAULT_SLA_POLICY_KEY = 'default';

function buildSlaPolicyMetadata(moduleAdapter = null) {
  return {
    triggerTypes: [...SLA_TRIGGER_TYPES],
    executionModes: [...SLA_EXECUTION_MODES],
    conditionOperators: [...SLA_CONDITION_OPERATORS],
    alertTiming: [...SLA_ALERT_TIMING],
    alertRecipients: [...SLA_ALERT_RECIPIENTS],
    alertChannels: [...SLA_ALERT_CHANNELS],
    escalationActions: [...SLA_ESCALATION_ACTIONS],
    milestoneKeys: moduleAdapter?.milestoneKeys?.length
      ? [...moduleAdapter.milestoneKeys]
      : [...SLA_MILESTONE_KEYS],
    priorityDimension: moduleAdapter?.priorityDimension || 'priority',
    defaultExecutionMode: DEFAULT_EXECUTION_MODE
  };
}

module.exports = {
  SLA_TRIGGER_TYPES,
  SLA_EXECUTION_MODES,
  SLA_INSTANCE_STATUSES,
  SLA_CONDITION_OPERATORS,
  SLA_ALERT_TIMING,
  SLA_ALERT_RECIPIENTS,
  SLA_ALERT_CHANNELS,
  SLA_ESCALATION_ACTIONS,
  SLA_MILESTONE_KEYS,
  SLA_EXECUTION_EVENT_TYPES,
  DEFAULT_EXECUTION_MODE,
  DEFAULT_SLA_POLICY_KEY,
  buildSlaPolicyMetadata
};
