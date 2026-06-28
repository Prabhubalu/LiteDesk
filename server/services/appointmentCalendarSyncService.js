'use strict';

const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
const { resolveHostCalendarConfig } = require('./appointmentCalendarService');

function providerForMeetingType(meetingType) {
  if (meetingType === 'google_meet') return 'google';
  if (meetingType === 'ms_teams') return 'microsoft';
  return null;
}

async function loadHostConfigForEvent(event) {
  const organizationId = event.organizationId;
  const hostUserId = event.assignedTo;
  let hostConfig = await resolveHostCalendarConfig(organizationId, hostUserId);

  if (!hostConfig && event.appointment?.bookingConfigId) {
    const pageConfig = await AppointmentBookingConfig.findById(event.appointment.bookingConfigId).lean();
    if (pageConfig) hostConfig = pageConfig;
  }
  return hostConfig;
}

async function updateGoogleCalendarEvent({
  bookingConfig,
  externalEventId,
  title,
  startDateTime,
  endDateTime,
  timezone
}) {
  const { getCalendarClientForConfig } = require('./appointmentCalendarService');
  const client = await getCalendarClientForConfig(bookingConfig);
  if (client.error) return { error: client.error };

  const tz = timezone || bookingConfig.workingHours?.timezone || 'UTC';
  try {
    await client.calendar.events.patch({
      calendarId: 'primary',
      eventId: externalEventId,
      requestBody: {
        summary: title,
        start: { dateTime: new Date(startDateTime).toISOString(), timeZone: tz },
        end: { dateTime: new Date(endDateTime).toISOString(), timeZone: tz }
      }
    });
    return { ok: true };
  } catch (err) {
    if (err?.code === 404 || err?.code === 410) return { ok: true, gone: true };
    console.warn('[appointmentCalendarSync] Google patch failed:', err.message);
    return { error: err.message };
  }
}

async function deleteGoogleCalendarEvent({ bookingConfig, externalEventId }) {
  const { getCalendarClientForConfig } = require('./appointmentCalendarService');
  const client = await getCalendarClientForConfig(bookingConfig);
  if (client.error) return { error: client.error };

  try {
    await client.calendar.events.delete({
      calendarId: 'primary',
      eventId: externalEventId
    });
    return { ok: true };
  } catch (err) {
    if (err?.code === 404 || err?.code === 410) return { ok: true, gone: true };
    console.warn('[appointmentCalendarSync] Google delete failed:', err.message);
    return { error: err.message };
  }
}

async function updateMicrosoftCalendarEvent({
  bookingConfig,
  externalEventId,
  title,
  startDateTime,
  endDateTime,
  timezone
}) {
  const { getAccessTokenForConfig, graphRequest } = require('./appointmentMicrosoftCalendarService');
  const tokenResult = await getAccessTokenForConfig(bookingConfig);
  if (tokenResult.error) return { error: tokenResult.error };

  const tz = timezone || bookingConfig.workingHours?.timezone || 'UTC';
  const startLocal = new Date(startDateTime).toISOString().slice(0, 19);
  const endLocal = new Date(endDateTime).toISOString().slice(0, 19);

  try {
    await graphRequest(tokenResult.accessToken, `/me/events/${encodeURIComponent(externalEventId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        subject: title,
        start: { dateTime: startLocal, timeZone: tz },
        end: { dateTime: endLocal, timeZone: tz }
      })
    });
    return { ok: true };
  } catch (err) {
    if (err?.status === 404) return { ok: true, gone: true };
    console.warn('[appointmentCalendarSync] Microsoft patch failed:', err.message);
    return { error: err.message };
  }
}

async function deleteMicrosoftCalendarEvent({ bookingConfig, externalEventId }) {
  const { getAccessTokenForConfig, graphRequest } = require('./appointmentMicrosoftCalendarService');

  const tokenResult = await getAccessTokenForConfig(bookingConfig);
  if (tokenResult.error) return { error: tokenResult.error };

  try {
    await graphRequest(
      tokenResult.accessToken,
      `/me/events/${encodeURIComponent(externalEventId)}`,
      { method: 'DELETE' }
    );
    return { ok: true };
  } catch (err) {
    if (err?.status === 404) return { ok: true, gone: true };
    console.warn('[appointmentCalendarSync] Microsoft delete failed:', err.message);
    return { error: err.message };
  }
}

/**
 * Persist external calendar ids after creating Meet/Teams event.
 */
function applyExternalCalendarIds(event, provider, externalEventId) {
  if (!event.appointment) return;
  event.appointment.externalCalendarProvider = provider;
  event.appointment.externalCalendarEventId = externalEventId || null;
}

function isGoogleCalendarConnected(config) {
  const gc = config?.googleCalendar;
  return !!(gc?.encryptedRefreshToken || gc?.connected);
}

function isMicrosoftCalendarConnected(config) {
  const mc = config?.microsoftCalendar;
  return !!(mc?.encryptedRefreshToken || mc?.connected);
}

function applyCreateCalendarResult(event, provider, result) {
  if (result?.error) return { error: result.error };
  if (!result?.eventId && !result?.meetLink) {
    return { skipped: true, reason: 'create_empty' };
  }
  if (event.appointment) {
    if (result.meetLink) {
      event.appointment.meetingLink = result.meetLink;
      event.appointment.meetingLinkAutoGenerated = true;
      event.location = result.meetLink;
    }
    if (result.eventId) {
      applyExternalCalendarIds(event, provider, result.eventId);
    }
  }
  return {
    ok: true,
    created: !!result.eventId,
    updatedMeetingLink: !!result.meetLink
  };
}

async function createExternalCalendarForReschedule(event, hostConfig) {
  const appt = event.appointment || {};
  const meetingType = hostConfig.meetingType || 'offline';
  const timezone = appt.customerTimezone || hostConfig.workingHours?.timezone || 'UTC';
  const base = {
    bookingConfig: hostConfig,
    title: event.eventName,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    attendeeEmail: appt.bookedByEmail || null,
    timezone
  };

  if (meetingType === 'google_meet' && isGoogleCalendarConnected(hostConfig)) {
    const { createGoogleMeetForAppointment } = require('./appointmentCalendarService');
    const result = await createGoogleMeetForAppointment(base);
    return applyCreateCalendarResult(event, providerForMeetingType('google_meet'), result);
  }

  if (meetingType === 'ms_teams' && isMicrosoftCalendarConnected(hostConfig)) {
    const { createTeamsMeetingForAppointment } = require('./appointmentMicrosoftCalendarService');
    const result = await createTeamsMeetingForAppointment(base);
    return applyCreateCalendarResult(event, providerForMeetingType('ms_teams'), result);
  }

  return { skipped: true, reason: 'no_video_calendar' };
}

/**
 * Update or create Google/Microsoft calendar when appointment times change.
 */
async function syncExternalCalendarOnReschedule(event) {
  const appt = event.appointment;
  if (!appt) return { skipped: true, reason: 'not_appointment' };

  const hostConfig = await loadHostConfigForEvent(event);
  if (!hostConfig) return { skipped: true, reason: 'no_host_config' };

  const timezone = appt.customerTimezone || hostConfig.workingHours?.timezone || 'UTC';

  if (appt.externalCalendarEventId && appt.externalCalendarProvider) {
    const payload = {
      bookingConfig: hostConfig,
      externalEventId: appt.externalCalendarEventId,
      title: event.eventName,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      timezone
    };

    let patchResult;
    if (appt.externalCalendarProvider === 'google') {
      patchResult = await updateGoogleCalendarEvent(payload);
    } else if (appt.externalCalendarProvider === 'microsoft') {
      patchResult = await updateMicrosoftCalendarEvent(payload);
    } else {
      return { skipped: true, reason: 'unknown_provider' };
    }

    if (patchResult?.gone) {
      appt.externalCalendarEventId = null;
      appt.externalCalendarProvider = null;
      return createExternalCalendarForReschedule(event, hostConfig);
    }
    if (patchResult?.ok) return { ok: true, updated: true };
    return patchResult;
  }

  return createExternalCalendarForReschedule(event, hostConfig);
}

/**
 * Remove calendar event when appointment is cancelled.
 */
async function syncExternalCalendarOnCancel(event) {
  const appt = event.appointment;
  if (!appt?.externalCalendarEventId || !appt.externalCalendarProvider) {
    return { skipped: true, reason: 'no_external_event' };
  }

  const hostConfig = await loadHostConfigForEvent(event);
  if (!hostConfig) return { skipped: true, reason: 'no_host_config' };

  const payload = {
    bookingConfig: hostConfig,
    externalEventId: appt.externalCalendarEventId
  };

  let result;
  if (appt.externalCalendarProvider === 'google') {
    result = await deleteGoogleCalendarEvent(payload);
  } else if (appt.externalCalendarProvider === 'microsoft') {
    result = await deleteMicrosoftCalendarEvent(payload);
  } else {
    return { skipped: true, reason: 'unknown_provider' };
  }

  if (result?.ok) {
    appt.externalCalendarEventId = null;
  }
  return result;
}

module.exports = {
  providerForMeetingType,
  applyExternalCalendarIds,
  syncExternalCalendarOnReschedule,
  syncExternalCalendarOnCancel
};
