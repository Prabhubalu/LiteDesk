'use strict';

const { DateTime } = require('luxon');

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayName(day) {
  return DAY_NAMES[day] || `Day ${day}`;
}

function windowLabel(day, kind, index) {
  const name = dayName(day);
  if (kind === 'break') {
    return index > 0 ? `${name} break ${index + 1}` : `${name} break`;
  }
  return index > 0 ? `${name} hours (${index + 1})` : name;
}

function isValidTimeHHMM(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (HHMM.test(trimmed)) return true;
  return /^(\d{1,2}):(\d{2}):\d{2}$/.test(trimmed);
}

function parseTimeMinutes(value) {
  if (!isValidTimeHHMM(value)) return null;
  const parts = String(value).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  return (h * 60) + m;
}

function isValidIanaTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  const trimmed = tz.trim();
  if (!trimmed) return false;
  const probe = DateTime.now().setZone(trimmed);
  return probe.isValid;
}

function validateTimeWindow(window, day, kind, index) {
  const label = windowLabel(day, kind, index);
  if (!window || typeof window !== 'object') return `${label}: invalid time range`;
  if (!isValidTimeHHMM(window.start)) return `${label}: start time must be a valid time (HH:MM)`;
  if (!isValidTimeHHMM(window.end)) return `${label}: end time must be a valid time (HH:MM)`;
  const start = parseTimeMinutes(window.start);
  const end = parseTimeMinutes(window.end);
  if (end <= start) return `${label}: end time must be after start time`;
  return null;
}

function validateDayEntry(dayEntry) {
  if (!dayEntry || typeof dayEntry !== 'object') return 'Each week day must be configured';
  if (!Number.isInteger(dayEntry.day) || dayEntry.day < 0 || dayEntry.day > 6) {
    return 'Each day must be Sunday through Saturday';
  }
  const name = dayName(dayEntry.day);
  if (typeof dayEntry.enabled !== 'boolean') return `${name}: open/closed setting is invalid`;
  if (!Array.isArray(dayEntry.windows)) return `${name}: hours are invalid`;
  if (!Array.isArray(dayEntry.breaks)) return `${name}: breaks are invalid`;

  if (!dayEntry.enabled) {
    return null;
  }

  if (dayEntry.windows.length === 0) {
    return `${name} is marked open but has no hours`;
  }

  for (let i = 0; i < dayEntry.windows.length; i += 1) {
    const err = validateTimeWindow(dayEntry.windows[i], dayEntry.day, 'window', i);
    if (err) return err;
  }

  for (let i = 0; i < dayEntry.breaks.length; i += 1) {
    const err = validateTimeWindow(dayEntry.breaks[i], dayEntry.day, 'break', i);
    if (err) return err;
  }

  return null;
}

function validateWeek(week) {
  if (!Array.isArray(week) || week.length === 0) return 'Week schedule is required';
  const seen = new Set();
  for (const entry of week) {
    const err = validateDayEntry(entry);
    if (err) return err;
    if (seen.has(entry.day)) return `Duplicate day in week schedule: ${dayName(entry.day)}`;
    seen.add(entry.day);
  }
  for (let d = 0; d <= 6; d += 1) {
    if (!seen.has(d)) return `Week schedule is missing ${dayName(d)}`;
  }
  return null;
}

function validateBusinessHourSetInput(body, { isUpdate = false } = {}) {
  if (!isUpdate && (!body.name || typeof body.name !== 'string' || !body.name.trim())) {
    return 'Name is required';
  }
  if (body.name != null && (typeof body.name !== 'string' || !body.name.trim())) {
    return 'Name must not be empty';
  }
  if (body.timezone != null && !isValidIanaTimezone(body.timezone)) {
    return 'Timezone must be a valid IANA timezone';
  }
  if (body.week != null) {
    const weekErr = validateWeek(body.week);
    if (weekErr) return weekErr;
  }
  if (body.linkedTo != null) {
    const lt = body.linkedTo;
    if (!lt || typeof lt !== 'object') return 'Schedule scope is invalid';
    if (!['company', 'group', 'user'].includes(lt.type)) {
      return 'Schedule scope must be company, team, or individual';
    }
    if (lt.type !== 'company' && !lt.id) return 'Team or user is required for this scope';
    if (lt.type === 'company' && lt.id) return 'Company scope cannot target a specific user or team';
  }
  if (body.status != null && !['active', 'inactive'].includes(body.status)) {
    return 'Status must be active or inactive';
  }
  return null;
}

function validateHolidayCalendarInput(body) {
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return 'Name is required';
  }
  if (body.dates != null) {
    if (!Array.isArray(body.dates)) return 'Holiday dates must be a list';
    for (let i = 0; i < body.dates.length; i += 1) {
      const row = body.dates[i];
      if (!row || typeof row !== 'object') return `Holiday ${i + 1} is invalid`;
      if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date))) {
        return `Holiday ${i + 1}: date must be YYYY-MM-DD`;
      }
      if (!row.name || typeof row.name !== 'string' || !row.name.trim()) {
        return `Holiday ${i + 1}: name is required`;
      }
    }
  }
  return null;
}

module.exports = {
  isValidTimeHHMM,
  isValidIanaTimezone,
  parseTimeMinutes,
  validateWeek,
  validateBusinessHourSetInput,
  validateHolidayCalendarInput
};
