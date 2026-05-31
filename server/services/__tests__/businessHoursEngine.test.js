'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');
const {
  normalizeSchedule,
  isOpen,
  addBusinessMinutes,
  elapsedBusinessMinutes,
  nextOpenInstant,
  simulate,
  generateBookingSlots,
  describeDayAvailability,
  businessMinutesOnDate
} = require('../businessHoursEngine');
const { buildDefaultWeek } = require('../../constants/businessHoursDefaults');

function baseSchedule(overrides = {}) {
  return normalizeSchedule({
    name: 'Test',
    timezone: 'America/New_York',
    week: buildDefaultWeek(),
    status: 'active',
    holidayDates: [],
    ...overrides
  });
}

test('isOpen returns true during weekday window', () => {
  const schedule = baseSchedule();
  const dt = DateTime.fromObject(
    { year: 2026, month: 5, day: 12, hour: 10, minute: 0 },
    { zone: 'America/New_York' }
  );
  assert.equal(isOpen(dt.toJSDate(), schedule), true);
});

test('isOpen returns false on weekend', () => {
  const schedule = baseSchedule();
  const dt = DateTime.fromObject(
    { year: 2026, month: 5, day: 10, hour: 10, minute: 0 },
    { zone: 'America/New_York' }
  );
  assert.equal(isOpen(dt.toJSDate(), schedule), false);
});

test('isOpen returns false on holiday', () => {
  const schedule = baseSchedule({ holidayDates: ['2026-05-12'] });
  const dt = DateTime.fromObject(
    { year: 2026, month: 5, day: 12, hour: 10, minute: 0 },
    { zone: 'America/New_York' }
  );
  assert.equal(isOpen(dt.toJSDate(), schedule), false);
});

test('isOpen respects lunch break', () => {
  const week = buildDefaultWeek();
  const mon = week.find((d) => d.day === 1);
  mon.breaks = [{ start: '12:00', end: '13:00' }];
  const schedule = baseSchedule({ week });

  const open = DateTime.fromObject(
    { year: 2026, month: 5, day: 11, hour: 11, minute: 30 },
    { zone: 'America/New_York' }
  );
  const lunch = DateTime.fromObject(
    { year: 2026, month: 5, day: 11, hour: 12, minute: 30 },
    { zone: 'America/New_York' }
  );
  assert.equal(isOpen(open.toJSDate(), schedule), true);
  assert.equal(isOpen(lunch.toJSDate(), schedule), false);
});

test('elapsedBusinessMinutes counts only open minutes', () => {
  const schedule = baseSchedule();
  const start = DateTime.fromObject(
    { year: 2026, month: 5, day: 15, hour: 17, minute: 0 },
    { zone: 'America/New_York' }
  );
  const end = DateTime.fromObject(
    { year: 2026, month: 5, day: 18, hour: 10, minute: 0 },
    { zone: 'America/New_York' }
  );
  const elapsed = elapsedBusinessMinutes(start.toJSDate(), end.toJSDate(), schedule);
  assert.equal(elapsed, 120);
});

test('addBusinessMinutes skips weekend', () => {
  const schedule = baseSchedule();
  const friday = DateTime.fromObject(
    { year: 2026, month: 5, day: 15, hour: 17, minute: 0 },
    { zone: 'America/New_York' }
  );
  const result = addBusinessMinutes(friday.toJSDate(), 120, schedule);
  const resultDt = DateTime.fromJSDate(result, { zone: 'America/New_York' });
  assert.equal(resultDt.weekday, 1);
  assert.equal(resultDt.hour, 10);
});

test('nextOpenInstant finds Monday morning after Friday evening', () => {
  const schedule = baseSchedule();
  const friday = DateTime.fromObject(
    { year: 2026, month: 5, day: 15, hour: 19, minute: 0 },
    { zone: 'America/New_York' }
  );
  const next = nextOpenInstant(friday.toJSDate(), schedule);
  const nextDt = DateTime.fromJSDate(next, { zone: 'America/New_York' });
  assert.equal(nextDt.weekday, 1);
  assert.equal(nextDt.hour, 9);
});

test('generateBookingSlots respects holidays and breaks', () => {
  const week = buildDefaultWeek();
  const mon = week.find((d) => d.day === 1);
  mon.breaks = [{ start: '12:00', end: '13:00' }];
  const schedule = baseSchedule({ week, holidayDates: ['2026-05-12'] });
  const dayStart = DateTime.fromObject(
    { year: 2026, month: 5, day: 11, hour: 0, minute: 0 },
    { zone: 'America/New_York' }
  );
  const rangeEnd = dayStart.plus({ days: 2 });
  const slots = generateBookingSlots(schedule, {
    rangeStart: dayStart.toJSDate(),
    rangeEnd: rangeEnd.toJSDate(),
    slotDurationMinutes: 30,
    bufferMinutes: 0
  });
  assert.ok(slots.length > 0);
  const onHoliday = slots.some((s) => {
    const dt = DateTime.fromJSDate(s.start, { zone: 'America/New_York' });
    return dt.toISODate() === '2026-05-12';
  });
  assert.equal(onHoliday, false);

  const lunchSlot = slots.find((s) => {
    const dt = DateTime.fromJSDate(s.start, { zone: 'America/New_York' });
    return dt.toISODate() === '2026-05-11' && dt.hour === 12 && dt.minute === 0;
  });
  assert.equal(lunchSlot, undefined);
});

test('describeDayAvailability flags holidays and weekends', () => {
  const schedule = baseSchedule({ holidayDates: ['2026-05-12'] });
  assert.equal(describeDayAvailability(schedule, '2026-05-12').reason, 'holiday');
  assert.equal(describeDayAvailability(schedule, '2026-05-10').reason, 'non_working_day');
  assert.equal(describeDayAvailability(schedule, '2026-05-11').closed, false);
});

test('businessMinutesOnDate sums windows minus breaks', () => {
  const week = buildDefaultWeek();
  const mon = week.find((d) => d.day === 1);
  mon.breaks = [{ start: '12:00', end: '13:00' }];
  const schedule = baseSchedule({ week });
  const minutes = businessMinutesOnDate('2026-05-11', schedule);
  assert.equal(minutes, 9 * 60 - 60);
});

test('businessMinutesOnDate returns zero on holiday', () => {
  const schedule = baseSchedule({ holidayDates: ['2026-05-12'] });
  assert.equal(businessMinutesOnDate('2026-05-12', schedule), 0);
});

test('simulate reports SLA-style target across weekend', () => {
  const schedule = baseSchedule();
  const friday = DateTime.fromObject(
    { year: 2026, month: 5, day: 15, hour: 17, minute: 30 },
    { zone: 'America/New_York' }
  );
  const result = simulate({ at: friday.toJSDate(), minutesToAdd: 60 }, schedule);
  assert.equal(result.isOpen, true);
  const target = DateTime.fromISO(result.targetAfterMinutes, { zone: 'America/New_York' });
  assert.equal(target.weekday, 1);
});
