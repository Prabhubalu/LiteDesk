/** Client fallback mirror of server/constants/helpdeskSlaPolicy.js — prefer API metadata when loaded. */
import { CASE_TYPES, CASE_PRIORITIES, CASE_CHANNELS } from '@/constants/caseLifecycle';

export const SLA_ALERT_RECIPIENTS = ['assigned_user', 'manager', 'assigned_group', 'record_owner'];
export const SLA_ALERT_CHANNELS = ['inApp', 'email', 'push'];
export const SLA_ESCALATION_ROLES = ['assigned_user', 'manager', 'team_lead', 'operations_head'];
export const SLA_HOUR_OVERRIDE_MODES = ['default', 'standard', 'calendar24x7'];
export const SLA_ALERT_TYPES = ['warning', 'breach'];
export const SLA_ALERT_TIMING_MODES = ['before', 'after', 'immediately'];

export const DEFAULT_ESCALATION_COOLDOWN_MINUTES = 15;
export const DEFAULT_ALERT_TIMING_MINUTES = 30;

export const DEFAULT_ESCALATION_STEPS = [
  { role: 'assigned_user', delayMinutes: 0 },
  { role: 'manager', delayMinutes: 30 },
  { role: 'team_lead', delayMinutes: 30 }
];

export const DEFAULT_SLA_ALERTS = [
  { type: 'warning' },
  { type: 'breach', timingMode: 'immediately' }
];

/** Dot classes by priority index (Low → Critical). */
export const SLA_PRIORITY_DOT_CLASSES = ['bg-gray-400', 'bg-amber-500', 'bg-orange-500', 'bg-red-500'];

export function buildHelpdeskExecutionMetadataFallback() {
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

export function resolveExecutionMetadata(metadata) {
  const fallback = buildHelpdeskExecutionMetadataFallback();
  if (!metadata || typeof metadata !== 'object') return fallback;
  return {
    priorities: Array.isArray(metadata.priorities) && metadata.priorities.length
      ? [...metadata.priorities]
      : fallback.priorities,
    caseTypes: Array.isArray(metadata.caseTypes) && metadata.caseTypes.length
      ? [...metadata.caseTypes]
      : fallback.caseTypes,
    channels: Array.isArray(metadata.channels) && metadata.channels.length
      ? [...metadata.channels]
      : fallback.channels,
    slaPolicy: {
      ...fallback.slaPolicy,
      ...(metadata.slaPolicy && typeof metadata.slaPolicy === 'object' ? metadata.slaPolicy : {})
    }
  };
}

export function priorityDotClass(priorities, priority) {
  const index = priorities.indexOf(priority);
  if (index < 0) return SLA_PRIORITY_DOT_CLASSES[SLA_PRIORITY_DOT_CLASSES.length - 1];
  return SLA_PRIORITY_DOT_CLASSES[Math.min(index, SLA_PRIORITY_DOT_CLASSES.length - 1)];
}

export function targetRowFromStandard(priority, standardTargets = {}, priorities = []) {
  const parseSource = (source) => {
    const responseHours = Number(source.responseHours);
    const resolutionHours = Number(source.resolutionHours);
    const responseMinutes = Number(source.firstResponseMinutes);
    const resolutionMinutes = Number(source.resolutionMinutes);
    const resolvedResponseHours = Number.isFinite(responseHours) && responseHours > 0
      ? responseHours
      : (Number.isFinite(responseMinutes) && responseMinutes > 0
        ? Math.max(1, Math.round(responseMinutes / 60))
        : null);
    const resolvedResolutionHours = Number.isFinite(resolutionHours) && resolutionHours > 0
      ? resolutionHours
      : (Number.isFinite(resolutionMinutes) && resolutionMinutes > 0
        ? Math.max(1, Math.round(resolutionMinutes / 60))
        : null);
    return {
      responseHours: resolvedResponseHours,
      resolutionHours: resolvedResolutionHours,
      overrideHours: source.overrideHours || 'default'
    };
  };

  if (standardTargets[priority]) {
    const row = parseSource(standardTargets[priority]);
    if (row.responseHours && row.resolutionHours) return row;
  }
  for (const p of priorities) {
    if (p !== priority && standardTargets[p]) {
      const row = parseSource(standardTargets[p]);
      if (row.responseHours && row.resolutionHours) return row;
    }
  }
  const first = priorities.find((p) => standardTargets[p]);
  if (first) {
    const row = parseSource(standardTargets[first]);
    if (row.responseHours && row.resolutionHours) return row;
  }
  return { responseHours: 1, resolutionHours: 1, overrideHours: 'default' };
}
