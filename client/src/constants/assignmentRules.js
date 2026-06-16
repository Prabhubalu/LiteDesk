/** Client mirror of server/constants/assignmentRules.js — prefer API metadata when loaded. */
export const ASSIGNMENT_TRIGGER_TYPES = ['immediate', 'delayed', 'scheduled'];

export const ASSIGNMENT_DISTRIBUTION_MODES = [
  'queue',
  'round_robin',
  'weighted',
  'load_balanced',
  'availability_based'
];

export const ASSIGNMENT_CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'in',
  'not_in',
  'gt',
  'gte',
  'lt',
  'lte',
  'exists'
];

export function buildAssignmentRulesMetadataFallback() {
  return {
    triggerTypes: [...ASSIGNMENT_TRIGGER_TYPES],
    distributionModes: [...ASSIGNMENT_DISTRIBUTION_MODES],
    conditionOperators: [...ASSIGNMENT_CONDITION_OPERATORS],
    applyStrategies: ['new_records_only', 'manual_re_evaluation', 'freeze_mode']
  };
}

export function resolveAssignmentRulesMetadata(metadata) {
  const fallback = buildAssignmentRulesMetadataFallback();
  if (!metadata || typeof metadata !== 'object') return fallback;
  return { ...fallback, ...metadata };
}

export function resolveModuleLabel(module, t, labelKeys = {}) {
  if (!module) return '';
  if (module.labelKey && typeof t === 'function') return t(module.labelKey);
  const i18nKey = labelKeys[module.moduleKey];
  if (i18nKey && typeof t === 'function') return t(i18nKey);
  return module.label || module.moduleKey || '';
}
