const { DateTime } = require('luxon');
const Event = require('../models/Event');
const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
const {
  generateBookingSlots,
  describeDayAvailability
} = require('./businessHoursEngine');
const {
  resolveScheduleForBookingConfig,
  getDisplayTimezone
} = require('./appointmentBusinessHoursService');
const {
  getExternalBusyIntervals,
  slotOverlapsBusyIntervals
} = require('./appointmentExternalCalendarService');

const DAY_MS = 24 * 60 * 60 * 1000;

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function loadConfigWithCalendar(config) {
  if (config?.googleCalendar?.encryptedRefreshToken) return config;
  if (config?.microsoftCalendar?.encryptedRefreshToken) return config;
  if (!config?._id) return config;
  return AppointmentBookingConfig.findById(config._id).lean();
}

/**
 * @param {import('../models/AppointmentBookingConfig')} config
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @param {ObjectId} assignedTo
 * @param {ObjectId} organizationId
 */
async function getAvailableSlots(config, rangeStart, rangeEnd, assignedTo, organizationId) {
  const resolved = await resolveScheduleForBookingConfig(config, organizationId, assignedTo);
  const timezone = getDisplayTimezone(config, resolved);
  const now = new Date();

  const configForCalendar = await loadConfigWithCalendar(config);
  const externalBusy = await getExternalBusyIntervals(
    configForCalendar || config,
    rangeStart,
    rangeEnd
  );

  const existing = await Event.find({
    organizationId,
    assignedTo: assignedTo,
    deletedAt: null,
    status: { $ne: 'Cancelled' },
    startDateTime: { $lt: rangeEnd },
    endDateTime: { $gt: rangeStart }
  })
    .select('startDateTime endDateTime')
    .lean();

  let slots = generateBookingSlots(resolved.schedule, {
    rangeStart,
    rangeEnd,
    slotDurationMinutes: config.slotDurationMinutes || 30,
    bufferMinutes: config.bufferMinutes || 0
  });

  if (config.dailyCapacity != null && config.dailyCapacity > 0) {
    const zone = timezone;
    const bookedByDay = new Map();
    for (const ev of existing) {
      const key = DateTime.fromJSDate(new Date(ev.startDateTime), { zone }).toISODate();
      bookedByDay.set(key, (bookedByDay.get(key) || 0) + 1);
    }
    slots = slots.filter((slot) => {
      const key = DateTime.fromJSDate(slot.start, { zone }).toISODate();
      return (bookedByDay.get(key) || 0) < config.dailyCapacity;
    });
  }

  slots = slots.filter((slot) => {
    if (slot.start < now) return false;
    if (
      existing.some((ev) =>
        overlaps(slot.start, slot.end, new Date(ev.startDateTime), new Date(ev.endDateTime))
      )
    ) {
      return false;
    }
    return !slotOverlapsBusyIntervals(slot.start, slot.end, externalBusy);
  });

  return slots.map((slot) => ({
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    timezone
  }));
}

/**
 * Metadata for a single booking day (holidays, closed weekdays).
 */
async function getDayAvailabilityMeta(config, dateStr, assignedTo, organizationId) {
  const resolved = await resolveScheduleForBookingConfig(config, organizationId, assignedTo);
  const meta = describeDayAvailability(resolved.schedule, dateStr);
  return {
    ...meta,
    scheduleSource: resolved.source,
    timezone: meta.timezone || getDisplayTimezone(config, resolved)
  };
}

/**
 * Single-day slots for public API (date interpreted in schedule timezone).
 */
async function getSlotsForDate(config, dateStr, assignedTo, organizationId) {
  const resolved = await resolveScheduleForBookingConfig(config, organizationId, assignedTo);
  const timezone = getDisplayTimezone(config, resolved);
  const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf('day');
  if (!dayStart.isValid) {
    throw new Error('Invalid date');
  }

  const rangeStart = dayStart.toJSDate();
  const rangeEnd = dayStart.plus({ days: 1 }).toJSDate();
  const slots = await getAvailableSlots(config, rangeStart, rangeEnd, assignedTo, organizationId);
  const dayMeta = describeDayAvailability(resolved.schedule, dateStr);

  return { slots, dayMeta, timezone, scheduleSource: resolved.source };
}

/** @deprecated Use generateBookingSlots via resolveScheduleForBookingConfig */
function generateDaySlots(config, dayStart) {
  const { legacyConfigToSchedule } = require('./appointmentBusinessHoursService');
  const schedule = legacyConfigToSchedule(config);
  const rangeEnd = new Date(dayStart.getTime() + DAY_MS);
  return generateBookingSlots(schedule, {
    rangeStart: dayStart,
    rangeEnd,
    slotDurationMinutes: config.slotDurationMinutes || 30,
    bufferMinutes: config.bufferMinutes || 0
  });
}

module.exports = {
  getAvailableSlots,
  getSlotsForDate,
  getDayAvailabilityMeta,
  generateDaySlots,
  overlaps
};
