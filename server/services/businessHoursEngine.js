'use strict';

const { DateTime } = require('luxon');
const { buildDefaultWeek } = require('../constants/businessHoursDefaults');
const { parseTimeMinutes } = require('../utils/businessHoursValidation');

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_BUSINESS_MINUTE_ITERATIONS = 500000;

function luxonDayToSchemaDay(dt) {
  return dt.weekday % 7;
}

function toDateTime(instant, zone) {
  const d = instant instanceof Date ? instant : new Date(instant);
  return DateTime.fromJSDate(d, { zone });
}

function toJsDate(dt) {
  return dt.toJSDate();
}

/**
 * Normalize DB document or plain object into engine schedule.
 */
function normalizeSchedule(input = {}) {
  const weekSource = Array.isArray(input.week) && input.week.length
    ? input.week
    : buildDefaultWeek();

  const weekByDay = {};
  for (const entry of weekSource) {
    weekByDay[entry.day] = {
      day: entry.day,
      enabled: Boolean(entry.enabled),
      windows: (entry.windows || []).map((w) => ({
        start: w.start,
        end: w.end,
        startMinutes: parseTimeMinutes(w.start),
        endMinutes: parseTimeMinutes(w.end)
      })).filter((w) => w.startMinutes != null && w.endMinutes != null && w.endMinutes > w.startMinutes),
      breaks: (entry.breaks || []).map((b) => ({
        start: b.start,
        end: b.end,
        startMinutes: parseTimeMinutes(b.start),
        endMinutes: parseTimeMinutes(b.end)
      })).filter((b) => b.startMinutes != null && b.endMinutes != null && b.endMinutes > b.startMinutes)
    };
  }

  for (let d = 0; d <= 6; d += 1) {
    if (!weekByDay[d]) {
      weekByDay[d] = { day: d, enabled: false, windows: [], breaks: [] };
    }
  }

  const holidayDates = new Set();
  if (Array.isArray(input.holidayDates)) {
    for (const d of input.holidayDates) holidayDates.add(String(d));
  } else if (Array.isArray(input.dates)) {
    for (const row of input.dates) {
      if (row?.date) holidayDates.add(String(row.date));
    }
  }

  return {
    id: input._id ? String(input._id) : input.id || null,
    name: input.name || 'Schedule',
    timezone: input.timezone || 'UTC',
    weekByDay,
    holidayDates,
    overtimeAllowed: Boolean(input.overtimeAllowed),
    status: input.status === 'inactive' ? 'inactive' : 'active',
    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
    effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null
  };
}

function isScheduleEffective(schedule, instant) {
  const at = instant instanceof Date ? instant : new Date(instant);
  if (schedule.status !== 'active') return false;
  if (schedule.effectiveFrom && at < schedule.effectiveFrom) return false;
  if (schedule.effectiveTo && at > schedule.effectiveTo) return false;
  return true;
}

function isHolidayDate(dt, schedule) {
  return schedule.holidayDates.has(dt.toISODate());
}

function minutesInDay(dt) {
  return dt.hour * 60 + dt.minute;
}

function isMinuteInRange(minute, startMinutes, endMinutes) {
  return minute >= startMinutes && minute < endMinutes;
}

function isMinuteInBreak(minute, breaks) {
  return breaks.some((b) => isMinuteInRange(minute, b.startMinutes, b.endMinutes));
}

function isMinuteOpen(minute, dayConfig) {
  if (!dayConfig?.enabled) return false;
  const inWindow = dayConfig.windows.some((w) => isMinuteInRange(minute, w.startMinutes, w.endMinutes));
  if (!inWindow) return false;
  return !isMinuteInBreak(minute, dayConfig.breaks);
}

/**
 * @param {Date|string|number} instant
 * @param {object} schedule normalized schedule
 */
function isOpen(instant, schedule) {
  const normalized = schedule.weekByDay ? schedule : normalizeSchedule(schedule);
  if (!isScheduleEffective(normalized, instant)) {
    return normalized.overtimeAllowed;
  }

  const dt = toDateTime(instant, normalized.timezone);
  if (!dt.isValid) return false;
  if (isHolidayDate(dt, normalized)) return false;

  const day = luxonDayToSchemaDay(dt);
  const dayConfig = normalized.weekByDay[day];
  return isMinuteOpen(minutesInDay(dt), dayConfig);
}

function startOfNextMinute(dt) {
  return dt.startOf('minute').plus({ minutes: 1 });
}

function dayStartWithMinutes(dt, minutes) {
  return dt.startOf('day').plus({ minutes });
}

/**
 * Next instant when schedule is open (strictly after `from` unless `from` is open and inclusive).
 */
function nextOpenInstant(from, schedule, { inclusive = false } = {}) {
  const normalized = normalizeSchedule(schedule);
  let cursor = toDateTime(from, normalized.timezone);
  if (!cursor.isValid) return null;

  if (inclusive && isOpen(toJsDate(cursor), normalized)) {
    return toJsDate(cursor);
  }

  let guard = 0;
  while (guard < MAX_BUSINESS_MINUTE_ITERATIONS) {
    guard += 1;
    if (!isScheduleEffective(normalized, toJsDate(cursor))) {
      if (normalized.overtimeAllowed) return toJsDate(cursor);
      if (normalized.effectiveFrom && cursor.toJSDate() < normalized.effectiveFrom) {
        cursor = toDateTime(normalized.effectiveFrom, normalized.timezone);
        continue;
      }
      cursor = startOfNextMinute(cursor);
      continue;
    }

    if (isHolidayDate(cursor, normalized)) {
      cursor = cursor.plus({ days: 1 }).startOf('day');
      continue;
    }

    const day = luxonDayToSchemaDay(cursor);
    const dayConfig = normalized.weekByDay[day];
    const minute = minutesInDay(cursor);

    if (!dayConfig.enabled || dayConfig.windows.length === 0) {
      cursor = cursor.plus({ days: 1 }).startOf('day');
      continue;
    }

    if (isMinuteOpen(minute, dayConfig)) {
      return toJsDate(cursor);
    }

    let foundLaterToday = false;
    for (const window of dayConfig.windows) {
      let candidateMinute = minute;
      if (candidateMinute < window.startMinutes) {
        candidateMinute = window.startMinutes;
      }
      if (candidateMinute >= window.endMinutes) continue;
      if (!isMinuteInBreak(candidateMinute, dayConfig.breaks)) {
        cursor = dayStartWithMinutes(cursor, candidateMinute);
        foundLaterToday = true;
        break;
      }
      const breakHit = dayConfig.breaks.find(
        (b) => candidateMinute >= b.startMinutes && candidateMinute < b.endMinutes
      );
      if (breakHit) {
        cursor = dayStartWithMinutes(cursor, breakHit.endMinutes);
        foundLaterToday = true;
        break;
      }
    }

    if (foundLaterToday) {
      if (isOpen(toJsDate(cursor), normalized)) return toJsDate(cursor);
      continue;
    }

    cursor = cursor.plus({ days: 1 }).startOf('day');
  }

  return null;
}

function addBusinessMinutes(startAt, minutesToAdd, schedule) {
  const normalized = normalizeSchedule(schedule);
  const minutes = Math.max(0, Number(minutesToAdd) || 0);
  if (minutes === 0) return new Date(startAt);

  let remaining = minutes;
  let cursor = toDateTime(startAt, normalized.timezone);
  let guard = 0;

  while (remaining > 0 && guard < MAX_BUSINESS_MINUTE_ITERATIONS) {
    guard += 1;

    if (!isScheduleEffective(normalized, toJsDate(cursor))) {
      const next = nextOpenInstant(toJsDate(cursor), normalized, { inclusive: true });
      if (!next) return toJsDate(cursor);
      cursor = toDateTime(next, normalized.timezone);
      continue;
    }

    if (isHolidayDate(cursor, normalized)) {
      cursor = cursor.plus({ days: 1 }).startOf('day');
      continue;
    }

    const day = luxonDayToSchemaDay(cursor);
    const dayConfig = normalized.weekByDay[day];

    if (!dayConfig.enabled || !dayConfig.windows.length) {
      cursor = cursor.plus({ days: 1 }).startOf('day');
      continue;
    }

    if (!isMinuteOpen(minutesInDay(cursor), dayConfig)) {
      const next = nextOpenInstant(toJsDate(cursor), normalized, { inclusive: true });
      if (!next) return toJsDate(cursor);
      cursor = toDateTime(next, normalized.timezone);
      continue;
    }

    const minute = minutesInDay(cursor);
    let consumed = 0;

    for (const window of dayConfig.windows) {
      if (minute >= window.endMinutes) continue;
      const windowStart = Math.max(minute, window.startMinutes);
      if (windowStart >= window.endMinutes) continue;

      let chunkEnd = window.endMinutes;
      for (const br of dayConfig.breaks) {
        if (br.startMinutes > windowStart && br.startMinutes < chunkEnd) {
          chunkEnd = br.startMinutes;
        }
      }

      const available = chunkEnd - windowStart;
      if (available <= 0) continue;

      const take = Math.min(available, remaining);
      consumed = take;
      remaining -= take;
      cursor = dayStartWithMinutes(cursor, windowStart + take);
      break;
    }

    if (consumed === 0) {
      cursor = startOfNextMinute(cursor);
    }
  }

  return toJsDate(cursor);
}

/**
 * Count open schedule minutes between two instants (exclusive of end).
 */
function elapsedBusinessMinutes(startAt, endAt, schedule) {
  const normalized = normalizeSchedule(schedule);
  const start = toDateTime(startAt, normalized.timezone);
  const end = toDateTime(endAt, normalized.timezone);
  if (!start.isValid || !end.isValid || end <= start) return 0;

  let total = 0;
  let cursor = start;
  let guard = 0;

  while (cursor < end && guard < MAX_BUSINESS_MINUTE_ITERATIONS) {
    guard += 1;

    if (!isScheduleEffective(normalized, toJsDate(cursor))) {
      const next = nextOpenInstant(toJsDate(cursor), normalized, { inclusive: true });
      if (!next) break;
      const nextDt = toDateTime(next, normalized.timezone);
      if (nextDt >= end) break;
      cursor = nextDt;
      continue;
    }

    if (isHolidayDate(cursor, normalized)) {
      const nextDay = cursor.plus({ days: 1 }).startOf('day');
      cursor = nextDay >= end ? end : nextDay;
      continue;
    }

    const day = luxonDayToSchemaDay(cursor);
    const dayConfig = normalized.weekByDay[day];

    if (!dayConfig.enabled || !dayConfig.windows.length) {
      const nextDay = cursor.plus({ days: 1 }).startOf('day');
      cursor = nextDay >= end ? end : nextDay;
      continue;
    }

    if (!isMinuteOpen(minutesInDay(cursor), dayConfig)) {
      const next = nextOpenInstant(toJsDate(cursor), normalized, { inclusive: true });
      if (!next) break;
      const nextDt = toDateTime(next, normalized.timezone);
      if (nextDt >= end) break;
      cursor = nextDt;
      continue;
    }

    const minute = minutesInDay(cursor);
    let advanced = false;

    for (const window of dayConfig.windows) {
      if (minute >= window.endMinutes) continue;
      const windowStart = Math.max(minute, window.startMinutes);
      if (windowStart >= window.endMinutes) continue;

      let chunkEnd = window.endMinutes;
      for (const br of dayConfig.breaks) {
        if (br.startMinutes > windowStart && br.startMinutes < chunkEnd) {
          chunkEnd = br.startMinutes;
        }
      }

      const chunkStartDt = dayStartWithMinutes(cursor, windowStart);
      const chunkEndDt = dayStartWithMinutes(cursor, chunkEnd);
      const effectiveEnd = end < chunkEndDt ? end : chunkEndDt;

      if (effectiveEnd > chunkStartDt) {
        total += effectiveEnd.diff(chunkStartDt, 'minutes').minutes;
        cursor = effectiveEnd;
        advanced = true;
      }
      break;
    }

    if (!advanced) {
      const nextMinute = startOfNextMinute(cursor);
      cursor = nextMinute >= end ? end : nextMinute;
    }
  }

  return Math.max(0, Math.round(total));
}

function formatScheduleSummary(schedule) {
  const normalized = normalizeSchedule(schedule);
  const enabledDays = [];
  let sampleWindow = null;

  for (let d = 0; d <= 6; d += 1) {
    const cfg = normalized.weekByDay[d];
    if (cfg?.enabled && cfg.windows?.length) {
      enabledDays.push(d);
      if (!sampleWindow) sampleWindow = cfg.windows[0];
    }
  }

  if (!enabledDays.length) return `No working days (${normalized.timezone})`;

  const ranges = [];
  let start = enabledDays[0];
  let prev = enabledDays[0];
  for (let i = 1; i < enabledDays.length; i += 1) {
    if (enabledDays[i] === prev + 1) {
      prev = enabledDays[i];
    } else {
      ranges.push(start === prev ? DAY_LABELS[start] : `${DAY_LABELS[start]}–${DAY_LABELS[prev]}`);
      start = enabledDays[i];
      prev = enabledDays[i];
    }
  }
  ranges.push(start === prev ? DAY_LABELS[start] : `${DAY_LABELS[start]}–${DAY_LABELS[prev]}`);

  const hours = sampleWindow
    ? `${sampleWindow.start}–${sampleWindow.end}`
    : '';
  return `${ranges.join(', ')} ${hours}`.trim() + ` (${normalized.timezone})`;
}

function formatPauseReason(fromInstant, schedule) {
  const normalized = normalizeSchedule(schedule);
  const next = nextOpenInstant(fromInstant, normalized, { inclusive: false });
  if (!next) return 'Outside business hours';
  const nextDt = toDateTime(next, normalized.timezone);
  const fmt = nextDt.toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY);
  return `Outside business hours · resumes ${fmt}`;
}

function simulate({ at, minutesToAdd = 0 }, schedule) {
  const normalized = normalizeSchedule(schedule);
  const instant = at ? new Date(at) : new Date();
  const open = isOpen(instant, normalized);
  const nextOpen = nextOpenInstant(instant, normalized, { inclusive: !open });
  const targetAfterMinutes = minutesToAdd > 0
    ? addBusinessMinutes(instant, minutesToAdd, normalized)
    : null;

  return {
    at: instant.toISOString(),
    isOpen: open,
    nextOpenAt: nextOpen ? new Date(nextOpen).toISOString() : null,
    targetAfterMinutes: targetAfterMinutes ? targetAfterMinutes.toISOString() : null,
    pauseReason: open ? null : formatPauseReason(instant, normalized),
    summary: formatScheduleSummary(normalized)
  };
}

/**
 * Generate bookable slot windows within a range using schedule timezone, breaks, and holidays.
 */
function generateBookingSlots(scheduleInput, {
  rangeStart,
  rangeEnd,
  slotDurationMinutes = 30,
  bufferMinutes = 0
}) {
  const schedule = scheduleInput.weekByDay ? scheduleInput : normalizeSchedule(scheduleInput);
  const zone = schedule.timezone;
  const duration = slotDurationMinutes;
  const step = duration + bufferMinutes;
  if (step <= 0 || !rangeStart || !rangeEnd) return [];

  const rangeStartDt = toDateTime(rangeStart, zone);
  const rangeEndDt = toDateTime(rangeEnd, zone);
  let dayCursor = rangeStartDt.startOf('day');
  const slots = [];

  while (dayCursor <= rangeEndDt) {
    if (isHolidayDate(dayCursor, schedule)) {
      dayCursor = dayCursor.plus({ days: 1 });
      continue;
    }

    const day = luxonDayToSchemaDay(dayCursor);
    const dayConfig = schedule.weekByDay[day];
    if (!dayConfig?.enabled) {
      dayCursor = dayCursor.plus({ days: 1 });
      continue;
    }

    for (const window of dayConfig.windows) {
      for (let m = window.startMinutes; m + duration <= window.endMinutes; m += step) {
        if (isMinuteInBreak(m, dayConfig.breaks)) continue;

        const slotEndMinute = m + duration;
        const overlapsBreak = dayConfig.breaks.some(
          (br) => m < br.endMinutes && slotEndMinute > br.startMinutes
        );
        if (overlapsBreak) continue;

        const startDt = dayCursor.startOf('day').plus({ minutes: m });
        const endDt = startDt.plus({ minutes: duration });
        if (endDt <= rangeStartDt || startDt >= rangeEndDt) continue;
        if (!isOpen(startDt.toJSDate(), schedule)) continue;

        slots.push({ start: startDt.toJSDate(), end: endDt.toJSDate() });
      }
    }

    dayCursor = dayCursor.plus({ days: 1 });
  }

  return slots;
}

/**
 * Whether a calendar date (YYYY-MM-DD) has any bookable window in the schedule.
 */
/**
 * Total open minutes on a calendar date (YYYY-MM-DD) in the schedule timezone.
 */
function businessMinutesOnDate(dateStr, scheduleInput) {
  const schedule = scheduleInput.weekByDay ? scheduleInput : normalizeSchedule(scheduleInput);
  const zone = schedule.timezone;
  const dayStart = DateTime.fromISO(dateStr, { zone });
  if (!dayStart.isValid) return 0;

  const noon = dayStart.plus({ hours: 12 });
  if (!isScheduleEffective(schedule, noon.toJSDate())) return 0;

  const desc = describeDayAvailability(schedule, dateStr);
  if (desc.closed) return 0;

  const day = schedule.weekByDay[luxonDayToSchemaDay(dayStart)];
  if (!day?.enabled) return 0;

  let total = 0;
  for (const window of day.windows) {
    let windowMinutes = window.endMinutes - window.startMinutes;
    for (const br of day.breaks) {
      const overlapStart = Math.max(window.startMinutes, br.startMinutes);
      const overlapEnd = Math.min(window.endMinutes, br.endMinutes);
      if (overlapEnd > overlapStart) {
        windowMinutes -= overlapEnd - overlapStart;
      }
    }
    if (windowMinutes > 0) total += windowMinutes;
  }
  return total;
}

function describeDayAvailability(scheduleInput, dateStr) {
  const schedule = scheduleInput.weekByDay ? scheduleInput : normalizeSchedule(scheduleInput);
  const zone = schedule.timezone;
  const dayStart = DateTime.fromISO(dateStr, { zone });
  if (!dayStart.isValid) {
    return { valid: false, closed: true, reason: 'invalid_date' };
  }
  if (isHolidayDate(dayStart, schedule)) {
    return { valid: true, closed: true, reason: 'holiday', timezone: zone };
  }
  const day = luxonDayToSchemaDay(dayStart);
  if (!schedule.weekByDay[day]?.enabled) {
    return { valid: true, closed: true, reason: 'non_working_day', timezone: zone };
  }
  return { valid: true, closed: false, reason: null, timezone: zone };
}

module.exports = {
  normalizeSchedule,
  isScheduleEffective,
  isOpen,
  nextOpenInstant,
  addBusinessMinutes,
  elapsedBusinessMinutes,
  formatScheduleSummary,
  formatPauseReason,
  simulate,
  luxonDayToSchemaDay,
  generateBookingSlots,
  describeDayAvailability,
  businessMinutesOnDate
};
