'use strict';

const Event = require('../models/Event');
const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
const { getSlotsForDate } = require('./appointmentAvailabilityService');
const { memberHasConflict } = require('./appointmentTeamService');
const { assertSlotAvailable } = require('./appointmentBookingService');
const { emitAppointmentDomainEvent } = require('./appointmentDomainEvents');
const { sendAppointmentCancellationEmail } = require('./appointmentConfirmationEmailService');

const DAY_MS = 24 * 60 * 60 * 1000;

async function findEventByManageToken(token) {
  if (!token || String(token).length < 16) return null;
  return Event.findOne({
    'appointment.manageToken': String(token),
    'appointment.isAppointment': true,
    deletedAt: null
  });
}

async function loadBookingConfig(event, { requireEnabled = true } = {}) {
  const configId = event.appointment?.bookingConfigId;
  if (!configId) return null;
  const query = {
    _id: configId,
    organizationId: event.organizationId
  };
  if (requireEnabled) query.enabled = true;
  return AppointmentBookingConfig.findOne(query);
}

/** Resolve booking page config for an event (guest or host reschedule). */
async function resolveEventBookingConfig(event) {
  let config = await loadBookingConfig(event, { requireEnabled: false });
  if (config) return config;

  if (event.assignedTo) {
    config = await AppointmentBookingConfig.findOne({
      organizationId: event.organizationId,
      ownerType: 'user',
      assignedTo: event.assignedTo
    }).sort({ updatedAt: -1 });
  }
  return config;
}

function publicManagePayload(event, config) {
  const appt = event.appointment || {};
  return {
    eventId: event.eventId || event._id,
    eventName: event.eventName,
    status: event.status,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    meetingLink: appt.meetingLink || event.location || null,
    bookedByName: appt.bookedByName,
    bookedByEmail: appt.bookedByEmail,
    customerTimezone: appt.customerTimezone,
    appointmentType: appt.appointmentType,
    slug: config?.slug || appt.publicPageSlug,
    displayName: config?.displayName,
    slotDurationMinutes: config?.slotDurationMinutes || 30,
    canReschedule: event.status === 'Planned' && !appt.noShow,
    canCancel: event.status === 'Planned' && !appt.noShow
  };
}

async function getRescheduleSlots(event, config, dateStr) {
  const assignedTo = event.assignedTo;
  const organizationId = event.organizationId;
  const excludeEventId = event._id;

  const { slots: rawSlots } = await getSlotsForDate(config, dateStr, assignedTo, organizationId);
  const results = [];

  for (const slot of rawSlots) {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    const busy = await memberHasConflict(
      organizationId,
      assignedTo,
      start,
      end,
      null,
      config.meetingType,
      excludeEventId
    );
    if (!busy) results.push(slot);
  }
  return results;
}

async function rescheduleAppointment(event, config, startISO, options = {}) {
  const {
    actorUserId = event.assignedTo,
    source = 'guest_manage',
    notifyGuest = true
  } = options;
  if (event.status !== 'Planned') {
    const err = new Error('This appointment can no longer be rescheduled.');
    err.statusCode = 400;
    throw err;
  }
  if (event.appointment?.noShow) {
    const err = new Error('This appointment was marked as a no-show.');
    err.statusCode = 400;
    throw err;
  }

  const startDateTime = new Date(startISO);
  const endDateTime = new Date(
    startDateTime.getTime() + (config.slotDurationMinutes || 30) * 60 * 1000
  );

  await assertSlotAvailable(
    config,
    event.assignedTo,
    event.organizationId,
    startDateTime,
    endDateTime,
    event._id
  );

  const previousStart = event.startDateTime;
  const previousEnd = event.endDateTime;

  event.startDateTime = startDateTime;
  event.endDateTime = endDateTime;
  event.modifiedTime = new Date();
  event.auditHistory = event.auditHistory || [];
  event.auditHistory.push({
    timestamp: new Date(),
    actorUserId,
    action: 'rescheduled',
    from: { startDateTime: previousStart, endDateTime: previousEnd },
    to: { startDateTime, endDateTime },
    metadata: { source }
  });
  event.modifiedBy = actorUserId;

  if (event.appointment) {
    const hoursUntil = (startDateTime.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursUntil > 24) {
      event.appointment.reminderEmailSentAt = null;
      event.appointment.reminderStatus = 'pending';
    }
  }

  await event.save();

  try {
    const { syncExternalCalendarOnReschedule } = require('./appointmentCalendarSyncService');
    const syncResult = await syncExternalCalendarOnReschedule(event);
    if (syncResult?.created || syncResult?.updatedMeetingLink) {
      event.markModified('appointment');
      if (syncResult.updatedMeetingLink) event.markModified('location');
      await event.save();
    }
  } catch (err) {
    console.warn('[appointmentManage] external calendar reschedule sync failed:', err.message);
  }

  if (notifyGuest) {
    try {
      const configLean = config.toObject ? config.toObject() : config;
      const {
        sendAppointmentConfirmationEmails
      } = require('./appointmentConfirmationEmailService');
      await sendAppointmentConfirmationEmails({
        event,
        config: configLean,
        guest: {
          email: event.appointment?.bookedByEmail,
          firstName: event.appointment?.bookedByName?.split(' ')[0] || '',
          lastName: event.appointment?.bookedByName?.split(' ').slice(1).join(' ') || ''
        }
      });
    } catch (err) {
      console.warn('[appointmentManage] reschedule confirmation email failed:', err.message);
    }
  }

  try {
    emitAppointmentDomainEvent('appointment.updated', event, {
      triggeredBy: actorUserId,
      previousState: {
        startDateTime: previousStart,
        endDateTime: previousEnd,
        status: event.status
      },
      appKey: 'SALES'
    });
  } catch (err) {
    console.warn('[appointmentManage] domain event failed:', err.message);
  }

  return event;
}

async function cancelAppointmentByGuest(event, reason) {
  if (event.status !== 'Planned') {
    const err = new Error('This appointment can no longer be cancelled.');
    err.statusCode = 400;
    throw err;
  }

  const previousStatus = event.status;
  event.status = 'Cancelled';
  event.cancelledAt = new Date();
  event.cancellationReason = reason || 'Cancelled by guest';
  event.modifiedTime = new Date();
  if (event.appointment) {
    event.appointment.cancellationSource = 'customer';
    event.appointment.reminderStatus = 'none';
  }
  event.auditHistory = event.auditHistory || [];
  event.auditHistory.push({
    timestamp: new Date(),
    actorUserId: event.assignedTo,
    action: 'status_changed',
    from: previousStatus,
    to: 'Cancelled',
    metadata: { source: 'guest_manage' }
  });

  try {
    const { syncExternalCalendarOnCancel } = require('./appointmentCalendarSyncService');
    await syncExternalCalendarOnCancel(event);
  } catch (err) {
    console.warn('[appointmentManage] external calendar cancel sync failed:', err.message);
  }

  await event.save();

  try {
    emitAppointmentDomainEvent('appointment.cancelled', event, {
      triggeredBy: event.assignedTo,
      previousState: { status: previousStatus },
      appKey: 'SALES'
    });
  } catch (err) {
    console.warn('[appointmentManage] domain event failed:', err.message);
  }

  try {
    await sendAppointmentCancellationEmail({ event, reason: event.cancellationReason });
  } catch (err) {
    console.warn('[appointmentManage] cancellation email failed:', err.message);
  }

  return event;
}

module.exports = {
  findEventByManageToken,
  loadBookingConfig,
  resolveEventBookingConfig,
  publicManagePayload,
  getRescheduleSlots,
  rescheduleAppointment,
  cancelAppointmentByGuest
};
