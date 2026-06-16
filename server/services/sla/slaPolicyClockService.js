'use strict';

const {
  elapsedBusinessMinutes
} = require('../businessHoursEngine');

const WARNING_THRESHOLD_PERCENT = 80;

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePauseSegments(instance) {
  if (!Array.isArray(instance?.pauseSegments)) return [];
  return instance.pauseSegments
    .map((seg) => ({
      from: toDate(seg?.from),
      to: toDate(seg?.to)
    }))
    .filter((seg) => seg.from && seg.to && seg.to > seg.from);
}

function getEffectiveEndInstant(instance, now = new Date()) {
  const end = toDate(now) || new Date();
  if (instance?.status === 'paused') {
    const pausedAt = toDate(instance.pausedAt);
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

function elapsedMinutesForInstance(instance, scheduleResolution, now = new Date()) {
  const startedAt = toDate(instance?.startedAt);
  if (!startedAt) return 0;

  const effectiveEnd = getEffectiveEndInstant(instance, now);
  const pauseSegments = normalizePauseSegments(instance);
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

function resolveBudgetMinutes(instance) {
  const minutes = Number(instance?.policySnapshot?.durationMinutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function computeInstanceProgress(instance, scheduleResolution, now = new Date()) {
  const budgetMinutes = resolveBudgetMinutes(instance);
  if (!budgetMinutes) {
    return {
      budgetMinutes: null,
      elapsedMinutes: null,
      elapsedPercent: null,
      state: 'unknown',
      met: false
    };
  }

  if (instance.status === 'met' || instance.metAt) {
    return {
      budgetMinutes,
      elapsedMinutes: 0,
      elapsedPercent: 0,
      state: 'met',
      met: true,
      metAt: instance.metAt
    };
  }

  const elapsedMinutes = elapsedMinutesForInstance(instance, scheduleResolution, now);
  const elapsedPercent = Math.max(0, Math.round((elapsedMinutes / budgetMinutes) * 100));

  let state = 'ok';
  if (elapsedPercent >= 100) state = 'breached';
  else if (elapsedPercent >= WARNING_THRESHOLD_PERCENT) state = 'warning';

  return {
    budgetMinutes,
    elapsedMinutes,
    elapsedPercent,
    state,
    met: false
  };
}

module.exports = {
  WARNING_THRESHOLD_PERCENT,
  elapsedMinutesForInstance,
  computeInstanceProgress,
  normalizePauseSegments
};
