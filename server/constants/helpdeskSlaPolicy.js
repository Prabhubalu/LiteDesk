const { CASE_TYPES, CASE_PRIORITIES, CASE_CHANNELS } = require('./caseLifecycle');

const SLA_ALERT_RECIPIENTS = ['assigned_user', 'manager', 'assigned_group', 'record_owner'];
const SLA_ALERT_CHANNELS = ['inApp', 'email', 'push'];
const SLA_ESCALATION_ROLES = ['assigned_user', 'manager', 'team_lead', 'operations_head'];
const SLA_HOUR_OVERRIDE_MODES = ['default', 'standard', 'calendar24x7'];
const SLA_ALERT_TYPES = ['warning', 'breach'];
const SLA_ALERT_TIMING_MODES = ['before', 'after', 'immediately'];

const DEFAULT_ESCALATION_COOLDOWN_MINUTES = 15;
const DEFAULT_ALERT_TIMING_MINUTES = 30;

const DEFAULT_ESCALATION_STEPS = [
  { role: 'assigned_user', delayMinutes: 0 },
  { role: 'manager', delayMinutes: 30 },
  { role: 'team_lead', delayMinutes: 30 }
];

const DEFAULT_SLA_ALERTS = [
  { type: 'warning' },
  { type: 'breach', timingMode: 'immediately' }
];

function buildHelpdeskExecutionMetadata() {
  return {
    priorities: [...CASE_PRIORITIES],
    caseTypes: [...CASE_TYPES],
    channels: [...CASE_CHANNELS],
    slaPolicy: {
      alertRecipients: [...SLA_ALERT_RECIPIENTS],
      alertChannels: [...SLA_ALERT_CHANNELS],
      escalationRoles: [...SLA_ESCALATION_ROLES],
      hourOverrideModes: [...SLA_HOUR_OVERRIDE_MODES],
      alertTypes: [...SLA_ALERT_TYPES],
      alertTimingModes: [...SLA_ALERT_TIMING_MODES],
      defaultEscalationCooldownMinutes: DEFAULT_ESCALATION_COOLDOWN_MINUTES,
      defaultAlertTimingMinutes: DEFAULT_ALERT_TIMING_MINUTES,
      defaultEscalationSteps: DEFAULT_ESCALATION_STEPS.map((step) => ({ ...step })),
      defaultAlerts: DEFAULT_SLA_ALERTS.map((alert) => ({ ...alert }))
    }
  };
}

module.exports = {
  SLA_ALERT_RECIPIENTS,
  SLA_ALERT_CHANNELS,
  SLA_ESCALATION_ROLES,
  SLA_HOUR_OVERRIDE_MODES,
  SLA_ALERT_TYPES,
  SLA_ALERT_TIMING_MODES,
  DEFAULT_ESCALATION_COOLDOWN_MINUTES,
  DEFAULT_ALERT_TIMING_MINUTES,
  DEFAULT_ESCALATION_STEPS,
  DEFAULT_SLA_ALERTS,
  buildHelpdeskExecutionMetadata
};
