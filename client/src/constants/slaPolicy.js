/** Client mirror of server/constants/slaPolicy.js — prefer API metadata when loaded. */
export const SLA_TRIGGER_TYPES = [
  'record_created',
  'field_change',
  'date_field_reached',
  'custom_event'
];

export const SLA_EXECUTION_MODES = ['first_match', 'all_matches', 'highest_priority'];

export const SLA_CONDITION_OPERATORS = [
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

export const DEFAULT_SLA_POLICY_KEY = 'default';

export function emptyConditionGroup() {
  return { combinator: 'all', clauses: [], groups: [] };
}

export function buildSlaPolicyMetadataFallback() {
  return {
    triggerTypes: [...SLA_TRIGGER_TYPES],
    executionModes: [...SLA_EXECUTION_MODES],
    conditionOperators: [...SLA_CONDITION_OPERATORS],
    milestoneKeys: ['first_response', 'resolution', 'approval'],
    defaultExecutionMode: 'first_match'
  };
}

export function resolveSlaPolicyMetadata(metadata) {
  const fallback = buildSlaPolicyMetadataFallback();
  if (!metadata || typeof metadata !== 'object') return fallback;
  return { ...fallback, ...metadata };
}
