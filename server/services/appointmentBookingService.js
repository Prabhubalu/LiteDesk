const mongoose = require('mongoose');
const Event = require('../models/Event');
const People = require('../models/People');
const { assignResolvedSource } = require('./sourceResolver');
const { overlaps } = require('./appointmentAvailabilityService');
const { generateManageToken } = require('../utils/appointmentManageToken');

const APPOINTMENT_TYPE_LABELS = {
  demo: 'Demo',
  support: 'Support',
  consultation: 'Consultation',
  other: 'Meeting'
};

function buildEventTitle(appointmentType, guestName) {
  const label = APPOINTMENT_TYPE_LABELS[appointmentType] || 'Meeting';
  const who = guestName?.trim() || 'Guest';
  return `${label} with ${who}`;
}

async function findOrCreatePerson({ organizationId, ownerUserId, email, firstName, lastName, phone }) {
  const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
  if (normalizedEmail) {
    const existing = await People.findOne({ organizationId, email: normalizedEmail, deletedAt: null }).lean();
    if (existing) return existing._id;
  }

  const personData = {
    organizationId,
    createdBy: ownerUserId,
    assignedTo: ownerUserId,
    first_name: firstName || 'Guest',
    last_name: lastName || '',
    email: normalizedEmail || undefined,
    phone: phone || undefined,
    participations: {
      SALES: {
        role: 'Lead',
        lead_status: 'New'
      }
    }
  };
  assignResolvedSource(personData, 'web_form');
  const created = await People.create(personData);
  return created._id;
}

async function assertSlotAvailable(
  config,
  assignedTo,
  organizationId,
  startDateTime,
  endDateTime,
  excludeEventId = null
) {
  const conflictQuery = {
    organizationId,
    assignedTo: assignedTo,
    deletedAt: null,
    status: { $ne: 'Cancelled' },
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime }
  };
  if (excludeEventId) {
    conflictQuery._id = { $ne: excludeEventId };
  }
  const conflict = await Event.findOne(conflictQuery).lean();

  if (conflict) {
    const err = new Error('This time slot is no longer available.');
    err.code = 'SLOT_UNAVAILABLE';
    err.statusCode = 409;
    throw err;
  }

  const { resolveHostCalendarConfig } = require('./appointmentCalendarService');
  const {
    getExternalBusyIntervals,
    slotOverlapsBusyIntervals
  } = require('./appointmentExternalCalendarService');
  const hostConfig = await resolveHostCalendarConfig(organizationId, assignedTo);
  const busyConfig = hostConfig
    ? { ...hostConfig.toObject?.() || hostConfig, meetingType: config.meetingType }
    : { ...config.toObject?.() || config, meetingType: config.meetingType };
  const busy = await getExternalBusyIntervals(busyConfig, startDateTime, endDateTime);
  if (busy.length && slotOverlapsBusyIntervals(startDateTime, endDateTime, busy)) {
    const err = new Error('This time slot is no longer available.');
    err.code = 'SLOT_UNAVAILABLE';
    err.statusCode = 409;
    throw err;
  }

  const durationMs = endDateTime - startDateTime;
  const expectedMs = (config.slotDurationMinutes || 30) * 60 * 1000;
  if (Math.abs(durationMs - expectedMs) > 60000) {
    const err = new Error('Invalid slot duration.');
    err.code = 'INVALID_SLOT';
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Book an appointment (creates Event + optional Person).
 */
async function bookAppointment({
  config,
  startISO,
  guest,
  appointmentType,
  customerTimezone,
  formResponses,
  assigneeUserId = null
}) {
  const startDateTime = new Date(startISO);
  const endDateTime = new Date(
    startDateTime.getTime() + (config.slotDurationMinutes || 30) * 60 * 1000
  );

  if (Number.isNaN(startDateTime.getTime())) {
    const err = new Error('Invalid start time');
    err.statusCode = 400;
    throw err;
  }

  if (startDateTime < new Date()) {
    const err = new Error('Cannot book a time in the past.');
    err.code = 'PAST_SLOT';
    err.statusCode = 400;
    throw err;
  }

  const assignedTo = assigneeUserId || config.assignedTo;

  await assertSlotAvailable(
    config,
    assignedTo,
    config.organizationId,
    startDateTime,
    endDateTime
  );

  const guestName = [guest.firstName, guest.lastName].filter(Boolean).join(' ').trim() || guest.email;
  const personId = await findOrCreatePerson({
    organizationId: config.organizationId,
    ownerUserId: assignedTo,
    email: guest.email,
    firstName: guest.firstName,
    lastName: guest.lastName,
    phone: guest.phone
  });

  const meetingTypeOnline = config.meetingType !== 'offline';
  const eventPayload = {
    eventName: buildEventTitle(appointmentType, guestName),
    eventType: 'Meeting',
    startDateTime,
    endDateTime,
    assignedTo,
    organizationId: config.organizationId,
    createdBy: assignedTo,
    modifiedBy: assignedTo,
    location: meetingTypeOnline ? '' : 'In person',
    source: 'Web Form',
    appointment: {
      isAppointment: true,
      bookingConfigId: config._id,
      publicPageSlug: config.slug,
      bookingSource: 'public_page',
      meetingType: meetingTypeOnline ? 'online' : 'offline',
      meetingLink: null,
      meetingLinkAutoGenerated: false,
      customerTimezone: customerTimezone || config.workingHours?.timezone || 'UTC',
      appointmentType: appointmentType || 'consultation',
      reminderStatus: 'pending',
      bookedByPersonId: personId,
      bookedByEmail: guest.email,
      bookedByName: guestName,
      attendeeCount: 1,
      bookingChannel: 'Web',
      formResponses: formResponses || {},
      manageToken: generateManageToken()
    },
    auditHistory: [{
      timestamp: new Date(),
      actorUserId: assignedTo,
      action: 'created',
      to: { source: 'public_booking', slug: config.slug, team: config.ownerType === 'team' },
      metadata: { appointmentType, guestEmail: guest.email }
    }]
  };

  const event = await Event.create(eventPayload);

  if (config.meetingType === 'google_meet') {
    try {
      const {
        createGoogleMeetForAppointment,
        resolveHostCalendarConfig
      } = require('./appointmentCalendarService');
      const hostConfig =
        (await resolveHostCalendarConfig(config.organizationId, assignedTo)) || config;
      const meetResult = await createGoogleMeetForAppointment({
        bookingConfig: hostConfig,
        title: eventPayload.eventName,
        startDateTime,
        endDateTime,
        attendeeEmail: guest.email,
        timezone: customerTimezone || config.workingHours?.timezone
      });
      if (meetResult.meetLink || meetResult.eventId) {
        const { applyExternalCalendarIds, providerForMeetingType } = require('./appointmentCalendarSyncService');
        if (meetResult.meetLink) {
          event.appointment.meetingLink = meetResult.meetLink;
          event.appointment.meetingLinkAutoGenerated = true;
          event.location = meetResult.meetLink;
        }
        if (meetResult.eventId) {
          applyExternalCalendarIds(event, providerForMeetingType('google_meet'), meetResult.eventId);
        }
        await event.save();
      }
    } catch (err) {
      console.warn('[appointmentBooking] Google Meet creation failed:', err.message);
    }
  } else if (config.meetingType === 'ms_teams') {
    try {
      const { resolveHostCalendarConfig } = require('./appointmentCalendarService');
      const { createTeamsMeetingForAppointment } = require('./appointmentMicrosoftCalendarService');
      const hostConfig =
        (await resolveHostCalendarConfig(config.organizationId, assignedTo)) || config;
      const teamsResult = await createTeamsMeetingForAppointment({
        bookingConfig: hostConfig,
        title: eventPayload.eventName,
        startDateTime,
        endDateTime,
        attendeeEmail: guest.email,
        timezone: customerTimezone || config.workingHours?.timezone
      });
      if (teamsResult.meetLink || teamsResult.eventId) {
        const { applyExternalCalendarIds, providerForMeetingType } = require('./appointmentCalendarSyncService');
        if (teamsResult.meetLink) {
          event.appointment.meetingLink = teamsResult.meetLink;
          event.appointment.meetingLinkAutoGenerated = true;
          event.location = teamsResult.meetLink;
        }
        if (teamsResult.eventId) {
          applyExternalCalendarIds(event, providerForMeetingType('ms_teams'), teamsResult.eventId);
        }
        await event.save();
      }
    } catch (err) {
      console.warn('[appointmentBooking] Teams meeting creation failed:', err.message);
    }
  }

  try {
    const { emitAppointmentDomainEvent } = require('./appointmentDomainEvents');
    emitAppointmentDomainEvent('appointment.created', event, {
      triggeredBy: assignedTo,
      appKey: 'SALES'
    });
  } catch (err) {
    console.warn('[appointmentBooking] domain event emit failed:', err.message);
  }

  try {
    const {
      sendAppointmentConfirmationEmails
    } = require('./appointmentConfirmationEmailService');
    await sendAppointmentConfirmationEmails({ event, config, guest });
  } catch (err) {
    console.warn('[appointmentBooking] confirmation email failed:', err.message);
  }

  return { event, personId };
}

module.exports = {
  bookAppointment,
  buildEventTitle,
  findOrCreatePerson,
  assertSlotAvailable
};
