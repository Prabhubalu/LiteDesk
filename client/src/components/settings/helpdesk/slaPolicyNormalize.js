import { buildHelpdeskExecutionMetadataFallback, targetRowFromStandard } from '@/constants/helpdeskSlaPolicy';

function resolveSlaPolicyOptions(slaPolicy) {
  const fallback = buildHelpdeskExecutionMetadataFallback().slaPolicy;
  if (!slaPolicy || typeof slaPolicy !== 'object') return fallback;
  return { ...fallback, ...slaPolicy };
}

export function normalizeSlaAlert(alert, priorities, slaPolicy, fallbackType = 'warning') {
  const options = resolveSlaPolicyOptions(slaPolicy);
  const type = alert?.type || fallbackType;
  const defaultRecipients = options.alertRecipients?.length ? [options.alertRecipients[0]] : [];
  const channelKeys = options.alertChannels || [];
  const channels = {};
  for (const key of channelKeys) {
    if (key === 'push') channels.push = Boolean(alert?.channels?.push);
    else channels[key] = alert?.channels?.[key] !== false;
  }

  return {
    id: alert?.id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    name: alert?.name || '',
    priorities: Array.isArray(alert?.priorities) && alert.priorities.length
      ? [...alert.priorities]
      : [...priorities],
    recipients: Array.isArray(alert?.recipients) && alert.recipients.length
      ? [...alert.recipients]
      : defaultRecipients,
    timingMode: alert?.timingMode || (type === 'breach' ? 'immediately' : 'before'),
    timingMinutes: Number.isFinite(Number(alert?.timingMinutes))
      ? Number(alert.timingMinutes)
      : options.defaultAlertTimingMinutes,
    channels
  };
}

export function normalizeSlaAlerts(alerts, priorities, slaPolicy) {
  const options = resolveSlaPolicyOptions(slaPolicy);
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return (options.defaultAlerts || []).map((alert) => normalizeSlaAlert(alert, priorities, options, alert.type));
  }
  return alerts.map((alert) => normalizeSlaAlert(alert, priorities, options));
}

export function normalizeEscalationStep(step, slaPolicy) {
  const options = resolveSlaPolicyOptions(slaPolicy);
  const defaultRole = options.escalationRoles?.[0] || '';
  return {
    id: step?.id || `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: step?.role || defaultRole,
    delayMinutes: Number.isFinite(Number(step?.delayMinutes))
      ? Number(step.delayMinutes)
      : options.defaultAlertTimingMinutes
  };
}

export function normalizeEscalationSteps(steps, slaPolicy) {
  const options = resolveSlaPolicyOptions(slaPolicy);
  if (!Array.isArray(steps) || steps.length === 0) {
    return (options.defaultEscalationSteps || []).map((step) => normalizeEscalationStep(step, options));
  }
  return steps.map((step) => normalizeEscalationStep(step, options));
}

export function ensurePriorityTargets(targets, priorities, standardTargets = {}) {
  const result = { ...targets };
  for (const priority of priorities) {
    if (!result[priority] || typeof result[priority] !== 'object') {
      result[priority] = targetRowFromStandard(priority, standardTargets, priorities);
    } else {
      const row = result[priority];
      const fallback = targetRowFromStandard(priority, standardTargets, priorities);
      result[priority] = {
        responseHours: Number(row.responseHours) > 0 ? Number(row.responseHours) : fallback.responseHours,
        resolutionHours: Number(row.resolutionHours) > 0 ? Number(row.resolutionHours) : fallback.resolutionHours,
        overrideHours: row.overrideHours || 'default'
      };
    }
  }
  return result;
}
