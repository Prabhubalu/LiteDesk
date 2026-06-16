const ASSIGNMENT_TRIGGER_TYPES = ['immediate', 'delayed', 'scheduled'];
const ASSIGNMENT_DISTRIBUTION_MODES = [
  'queue',
  'round_robin',
  'weighted',
  'load_balanced',
  'availability_based'
];
const ASSIGNMENT_REVERT_MODES = ['reapply_rules', 'revert_previous_owner', 'lock_current_owner'];
const ASSIGNMENT_ESCALATION_ACTIONS = ['notify_owner', 'reassign_group', 'notify_leadership'];

const ASSIGNMENT_CONDITION_OPERATORS = [
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

const ASSIGNMENT_APPLY_STRATEGIES = [
  'new_records_only',
  'manual_re_evaluation',
  'freeze_mode'
];

function buildAssignmentRulesMetadata() {
  return {
    triggerTypes: [...ASSIGNMENT_TRIGGER_TYPES],
    distributionModes: [...ASSIGNMENT_DISTRIBUTION_MODES],
    conditionOperators: [...ASSIGNMENT_CONDITION_OPERATORS],
    applyStrategies: [...ASSIGNMENT_APPLY_STRATEGIES],
    revertModes: [...ASSIGNMENT_REVERT_MODES],
    escalationActions: [...ASSIGNMENT_ESCALATION_ACTIONS]
  };
}

module.exports = {
  ASSIGNMENT_TRIGGER_TYPES,
  ASSIGNMENT_DISTRIBUTION_MODES,
  ASSIGNMENT_REVERT_MODES,
  ASSIGNMENT_ESCALATION_ACTIONS,
  ASSIGNMENT_CONDITION_OPERATORS,
  ASSIGNMENT_APPLY_STRATEGIES,
  buildAssignmentRulesMetadata
};
