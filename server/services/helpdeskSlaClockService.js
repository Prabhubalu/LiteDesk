'use strict';

const { elapsedBusinessMinutes } = require('./businessHoursEngine');

const WARNING_THRESHOLD_PERCENT = 80;

const CUSTOMER_INBOUND_ACTIVITY_TYPES = new Set([
  'email_received',
  'channel_message_received',
  'case_created'
]);

const AGENT_RESPONSE_ACTIVITY_TYPES = new Set([
  'agent_message',
  'email_sent',
  'chat_message_sent'
]);

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePauseSegments(cycle) {
  if (!Array.isArray(cycle?.pauseSegments)) return [];
  return cycle.pauseSegments
    .map((seg) => ({
      from: toDate(seg?.from),
      to: toDate(seg?.to)
    }))
    .filter((seg) => seg.from && seg.to && seg.to > seg.from);
}

function getEffectiveEndInstant(cycle, now = new Date()) {
  const end = toDate(now) || new Date();
  if (cycle?.status === 'paused') {
    const pausedAt = toDate(cycle.pausedAt);
    if (pausedAt && pausedAt < end) return pausedAt;
  }
  return end;
}

function elapsedCalendarMinutes(startAt, endAt, pauseSegments = []) {
  const start = toDate(startAt);
  const end = toDate(endAt);
  if (!start || !end || end <= start) return 0;

  let elapsedMs = end.getTime() - start.getTime();
  for (const seg of pauseSegments) {
    elapsedMs -= seg.to.getTime() - seg.from.getTime();
  }
  return Math.max(0, elapsedMs / 60000);
}

function elapsedMinutesForCycle(cycle, scheduleResolution, now = new Date()) {
  const startedAt = toDate(cycle?.startedAt);
  if (!startedAt) return 0;

  const effectiveEnd = getEffectiveEndInstant(cycle, now);
  const pauseSegments = normalizePauseSegments(cycle);
  const useBusiness = Boolean(scheduleResolution && !scheduleResolution.useCalendarTime && scheduleResolution.schedule);

  if (useBusiness) {
    let elapsed = elapsedBusinessMinutes(startedAt, effectiveEnd, scheduleResolution.schedule);
    for (const seg of pauseSegments) {
      elapsed -= elapsedBusinessMinutes(seg.from, seg.to, scheduleResolution.schedule);
    }
    return Math.max(0, elapsed);
  }

  return elapsedCalendarMinutes(startedAt, effectiveEnd, pauseSegments);
}

function resolveBudgetMinutes(cycle, metric) {
  const snapshot = cycle?.policySnapshot || {};
  if (metric === 'response') {
    const minutes = Number(snapshot.firstResponseMinutes);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }
  const minutes = Number(snapshot.resolutionMinutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function computeMetricProgress(cycle, metric, scheduleResolution, now = new Date()) {
  const budgetMinutes = resolveBudgetMinutes(cycle, metric);
  if (!budgetMinutes) {
    return {
      metric,
      budgetMinutes: null,
      elapsedMinutes: null,
      elapsedPercent: null,
      state: 'unknown',
      met: false
    };
  }

  if (metric === 'response' && toDate(cycle?.responseMetAt)) {
    return {
      metric,
      budgetMinutes,
      elapsedMinutes: 0,
      elapsedPercent: 0,
      state: 'met',
      met: true,
      metAt: cycle.responseMetAt
    };
  }

  const elapsedMinutes = elapsedMinutesForCycle(cycle, scheduleResolution, now);
  const elapsedPercent = Math.max(0, Math.round((elapsedMinutes / budgetMinutes) * 100));

  let state = 'ok';
  if (elapsedPercent >= 100) state = 'breached';
  else if (elapsedPercent >= WARNING_THRESHOLD_PERCENT) state = 'warning';

  return {
    metric,
    budgetMinutes,
    elapsedMinutes,
    elapsedPercent,
    state,
    met: false
  };
}

function normalizeAlertState(existing) {
  const base = existing && typeof existing === 'object' ? existing : {};
  return {
    responseWarningNotifiedAt: base.responseWarningNotifiedAt || base.warningNotifiedAt || null,
    responseBreachNotifiedAt: base.responseBreachNotifiedAt || null,
    resolutionWarningNotifiedAt: base.resolutionWarningNotifiedAt || base.warningNotifiedAt || null,
    resolutionBreachNotifiedAt: base.resolutionBreachNotifiedAt || base.breachNotifiedAt || null,
    escalationsSent: base.escalationsSent && typeof base.escalationsSent === 'object'
      ? { ...base.escalationsSent }
      : {}
  };
}

function computeCycleSlaProgress(cycle, scheduleResolution, now = new Date()) {
  const response = computeMetricProgress(cycle, 'response', scheduleResolution, now);
  const resolution = computeMetricProgress(cycle, 'resolution', scheduleResolution, now);
  return { response, resolution, warningThresholdPercent: WARNING_THRESHOLD_PERCENT };
}

function shouldMarkFirstResponseSla({ activityType, internal, actorId }) {
  const type = String(activityType || '').trim();
  if (CUSTOMER_INBOUND_ACTIVITY_TYPES.has(type)) return false;
  if (!actorId) return false;
  if (AGENT_RESPONSE_ACTIVITY_TYPES.has(type)) return true;
  return !internal;
}

function tryMarkResponseSlaMetOnCycle(cycle, activityContext, at = new Date()) {
  if (!cycle || cycle.responseMetAt || cycle.status === 'stopped') return false;
  if (!shouldMarkFirstResponseSla(activityContext)) return false;
  cycle.responseMetAt = at;
  return true;
}

module.exports = {
  WARNING_THRESHOLD_PERCENT,
  normalizePauseSegments,
  getEffectiveEndInstant,
  elapsedMinutesForCycle,
  computeMetricProgress,
  computeCycleSlaProgress,
  normalizeAlertState,
  shouldMarkFirstResponseSla,
  tryMarkResponseSlaMetOnCycle
};
