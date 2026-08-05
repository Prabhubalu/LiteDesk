'use strict';

/**
 * User calendar sync for CRM Events.
 * Meetings: create Meet/Teams conference rooms, invite participants, persist join link.
 */

const { randomUUID } = require('crypto');
const UserCalendarConnection = require('../models/UserCalendarConnection');
const {
  getConnection,
  getGoogleCalendarClient,
  getMicrosoftAccessToken,
  graphRequest
} = require('./userCalendarOAuthService');

function shouldSyncEvent(event) {
  if (!event) return false;
  if (event.deletedAt) return false;
  // Appointments already sync via booking-page calendar connections.
  if (event.appointment?.isAppointment) return false;
  if (!event.assignedTo || !event.organizationId) return false;
  if (!event.startDateTime || !event.endDateTime) return false;
  return true;
}

function timezoneForEvent(event) {
  return event.appointment?.customerTimezone || 'UTC';
}

function isMeetingEvent(event) {
  const t = String(event?.eventType || '').trim();
  return t === 'Meeting' || t === 'MEETING' || t.toLowerCase() === 'meeting';
}

function isOnlineMeetingMode(event) {
  const mode = String(event?.meetingMode || '').trim();
  return mode === 'Virtual' || mode === 'Hybrid';
}

function buildEventDescription(event) {
  const parts = [];
  if (event.agendaNotes) parts.push(String(event.agendaNotes));
  if (event.meetingLink && event.meetingMode !== 'In-person') {
    parts.push(`Join: ${event.meetingLink}`);
  }
  if (typeof event.notes === 'string' && event.notes.trim()) {
    parts.push(event.notes.trim());
  }
  return parts.length ? parts.join('\n\n') : undefined;
}

function extractGoogleMeetLink(data) {
  if (!data) return null;
  if (data.hangoutLink) return data.hangoutLink;
  const entry = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');
  return entry?.uri || null;
}

function extractTeamsJoinUrl(data) {
  if (!data) return null;
  return (
    data.onlineMeeting?.joinUrl ||
    data.onlineMeetingUrl ||
    null
  );
}

/**
 * Load emails for owner + attendee User ids (invitation targets).
 */
async function resolveAttendeeEmails(event) {
  const User = require('../models/User');
  const idSet = new Set();
  const pushId = (raw) => {
    if (raw == null || raw === '') return;
    if (typeof raw === 'object') {
      const id = raw._id || raw.id || raw.userId;
      if (id) idSet.add(String(id));
      return;
    }
    idSet.add(String(raw));
  };

  pushId(event.assignedTo);
  if (Array.isArray(event.attendees)) {
    event.attendees.forEach(pushId);
  }

  if (!idSet.size) return [];

  const users = await User.find({
    _id: { $in: [...idSet] },
    organizationId: event.organizationId,
    email: { $nin: [null, ''] }
  })
    .select('email firstName lastName')
    .lean();

  const seen = new Set();
  const out = [];
  for (const u of users) {
    const email = String(u.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    out.push({ email, displayName: name || undefined });
  }
  return out;
}

async function loadConnectedProviders(organizationId, userId) {
  const rows = await UserCalendarConnection.find({
    organizationId,
    userId,
    encryptedRefreshToken: { $nin: [null, ''] }
  });
  return rows.filter((r) => (typeof r.isConnected === 'function' ? r.isConnected() : !!r.encryptedRefreshToken));
}

/**
 * Prefer the calendar that can mint the selected conference room.
 * For online Meet/Teams: only sync the matching calendar so participants get
 * one invite with the correct room (no dual Google+Outlook spam).
 * In-person / hybrid-without-generate / Zoom-pasted: sync all connected calendars.
 */
function orderConnectionsForConference(connections, conferenceProvider, online) {
  const list = [...connections];
  if (!online) return list;
  if (conferenceProvider === 'google_meet') {
    const googleOnly = list.filter((c) => c.provider === 'google');
    if (googleOnly.length) return googleOnly;
    return list;
  }
  if (conferenceProvider === 'ms_teams') {
    const msOnly = list.filter((c) => c.provider === 'microsoft');
    if (msOnly.length) return msOnly;
    return list;
  }
  return list;
}

async function createGoogleEvent(connection, event, options = {}) {
  const client = await getGoogleCalendarClient(connection);
  if (client.error) return { error: client.error };

  const tz = timezoneForEvent(event);
  const attendees = Array.isArray(options.attendees) ? options.attendees : [];
  const createConference = !!options.createConference;
  const location =
    options.locationOverride != null && options.locationOverride !== ''
      ? String(options.locationOverride)
      : (event.location || undefined);
  const description = options.description != null ? options.description : buildEventDescription(event);

  try {
    const requestBody = {
      summary: event.eventName || 'Event',
      description: description || undefined,
      location: location || undefined,
      start: { dateTime: new Date(event.startDateTime).toISOString(), timeZone: tz },
      end: { dateTime: new Date(event.endDateTime).toISOString(), timeZone: tz },
      attendees: attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName || undefined
      }))
    };
    if (createConference) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      };
    }

    const res = await client.calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: createConference ? 1 : 0,
      sendUpdates: attendees.length ? 'all' : 'none',
      requestBody
    });

    return {
      eventId: res.data.id,
      meetLink: extractGoogleMeetLink(res.data) || null
    };
  } catch (err) {
    console.warn('[userCalendarSync] Google create failed:', err.message);
    return { error: err.message };
  }
}

async function patchGoogleEvent(connection, event, externalEventId) {
  const client = await getGoogleCalendarClient(connection);
  if (client.error) return { error: client.error };

  const tz = timezoneForEvent(event);
  try {
    await client.calendar.events.patch({
      calendarId: 'primary',
      eventId: externalEventId,
      sendUpdates: 'all',
      requestBody: {
        summary: event.eventName || 'Event',
        description: buildEventDescription(event),
        location: event.location || event.meetingLink || undefined,
        start: { dateTime: new Date(event.startDateTime).toISOString(), timeZone: tz },
        end: { dateTime: new Date(event.endDateTime).toISOString(), timeZone: tz }
      }
    });
    return { ok: true };
  } catch (err) {
    if (err?.code === 404 || err?.code === 410) return { ok: true, gone: true };
    console.warn('[userCalendarSync] Google patch failed:', err.message);
    return { error: err.message };
  }
}

async function deleteGoogleEvent(connection, externalEventId) {
  const client = await getGoogleCalendarClient(connection);
  if (client.error) return { error: client.error };
  try {
    await client.calendar.events.delete({
      calendarId: 'primary',
      eventId: externalEventId,
      sendUpdates: 'all'
    });
    return { ok: true };
  } catch (err) {
    if (err?.code === 404 || err?.code === 410) return { ok: true, gone: true };
    console.warn('[userCalendarSync] Google delete failed:', err.message);
    return { error: err.message };
  }
}

async function createMicrosoftEvent(connection, event, options = {}) {
  const tokenResult = await getMicrosoftAccessToken(connection);
  if (tokenResult.error) return { error: tokenResult.error };

  const tz = timezoneForEvent(event);
  const startLocal = new Date(event.startDateTime).toISOString().slice(0, 19);
  const endLocal = new Date(event.endDateTime).toISOString().slice(0, 19);
  const attendees = Array.isArray(options.attendees) ? options.attendees : [];
  const createConference = !!options.createConference;
  const description = options.description != null ? options.description : buildEventDescription(event);
  const locationText =
    options.locationOverride != null && options.locationOverride !== ''
      ? String(options.locationOverride)
      : (event.location || undefined);

  try {
    const body = {
      subject: event.eventName || 'Event',
      body: description
        ? { contentType: 'text', content: String(description) }
        : undefined,
      location: locationText ? { displayName: String(locationText) } : undefined,
      start: { dateTime: startLocal, timeZone: tz },
      end: { dateTime: endLocal, timeZone: tz },
      attendees: attendees.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.displayName || a.email
        },
        type: 'required'
      }))
    };
    if (createConference) {
      body.isOnlineMeeting = true;
      body.onlineMeetingProvider = 'teamsForBusiness';
    }

    const created = await graphRequest(tokenResult.accessToken, '/me/events', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return {
      eventId: created.id,
      meetLink: extractTeamsJoinUrl(created) || null
    };
  } catch (err) {
    console.warn('[userCalendarSync] Microsoft create failed:', err.message);
    return { error: err.message };
  }
}

async function patchMicrosoftEvent(connection, event, externalEventId) {
  const tokenResult = await getMicrosoftAccessToken(connection);
  if (tokenResult.error) return { error: tokenResult.error };

  const tz = timezoneForEvent(event);
  const startLocal = new Date(event.startDateTime).toISOString().slice(0, 19);
  const endLocal = new Date(event.endDateTime).toISOString().slice(0, 19);
  const description = buildEventDescription(event);

  try {
    await graphRequest(tokenResult.accessToken, `/me/events/${encodeURIComponent(externalEventId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        subject: event.eventName || 'Event',
        body: description
          ? { contentType: 'text', content: String(description) }
          : undefined,
        location: (event.location || event.meetingLink)
          ? { displayName: String(event.location || event.meetingLink) }
          : undefined,
        start: { dateTime: startLocal, timeZone: tz },
        end: { dateTime: endLocal, timeZone: tz }
      })
    });
    return { ok: true };
  } catch (err) {
    if (err?.status === 404) return { ok: true, gone: true };
    console.warn('[userCalendarSync] Microsoft patch failed:', err.message);
    return { error: err.message };
  }
}

async function deleteMicrosoftEvent(connection, externalEventId) {
  const tokenResult = await getMicrosoftAccessToken(connection);
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
    console.warn('[userCalendarSync] Microsoft delete failed:', err.message);
    return { error: err.message };
  }
}

function ensureCalendarSync(event) {
  if (!event.calendarSync) {
    event.calendarSync = {};
  }
  return event.calendarSync;
}

function applyMeetingLinkToEvent(event, meetLink, autoGenerated) {
  if (!meetLink) return false;
  event.meetingLink = meetLink;
  if (!event.appointment || typeof event.appointment !== 'object') {
    event.appointment = {};
  }
  event.appointment.meetingLink = meetLink;
  event.appointment.meetingLinkAutoGenerated = !!autoGenerated;
  event.appointment.meetingType = 'online';
  if (typeof event.markModified === 'function') {
    event.markModified('appointment');
  }
  return true;
}

/**
 * Create external calendar events for the assignee.
 * For Meetings: mints Google Meet / Teams when calendar is connected, invites participants.
 */
async function syncEventOnCreate(event) {
  if (!shouldSyncEvent(event)) return { skipped: true };

  const userId = event.assignedTo;
  const organizationId = event.organizationId;
  const connections = await loadConnectedProviders(organizationId, userId);
  if (!connections.length) {
    return {
      skipped: true,
      reason: 'no_connections',
      conference: {
        status: 'no_calendar',
        message:
          'Connect Google or Microsoft Calendar on the host user to auto-create Meet/Teams and send invites.'
      }
    };
  }

  const attendees = await resolveAttendeeEmails(event);
  const online = isMeetingEvent(event) && isOnlineMeetingMode(event);
  const provider = String(event.conferenceProvider || '').trim();
  const hasManualLink = !!(event.meetingLink && String(event.meetingLink).trim());
  const ordered = orderConnectionsForConference(connections, provider, online);

  const sync = ensureCalendarSync(event);
  let changed = false;
  let conferenceLink = hasManualLink ? String(event.meetingLink).trim() : null;
  let conferenceGenerated = false;
  let conferenceStatus = hasManualLink
    ? { status: 'manual_link', provider }
    : { status: 'pending', provider };
  let primaryConferenceCreated = false;

  for (const conn of ordered) {
    if (conn.provider === 'google' && !sync.googleEventId) {
      // Only mint Meet once, on the preferred connection; secondary calendars stay invite-free rooms.
      const createMeet =
        online &&
        provider === 'google_meet' &&
        !hasManualLink &&
        !primaryConferenceCreated;
      const result = await createGoogleEvent(conn, event, {
        attendees: createMeet || hasManualLink ? attendees : attendees,
        createConference: createMeet,
        locationOverride: conferenceLink || (event.location || undefined),
        description: buildEventDescription({
          eventName: event.eventName,
          agendaNotes: event.agendaNotes,
          meetingLink: conferenceLink || event.meetingLink,
          notes: event.notes,
          meetingMode: event.meetingMode
        })
      });
      if (result.eventId) {
        sync.googleEventId = result.eventId;
        changed = true;
        if (result.meetLink && !conferenceLink) {
          conferenceLink = result.meetLink;
          conferenceGenerated = true;
          primaryConferenceCreated = true;
          conferenceStatus = {
            status: 'generated',
            provider: 'google_meet',
            invites: attendees.length
          };
        } else if (createMeet && !result.meetLink && !conferenceLink) {
          conferenceStatus = {
            status: 'generate_failed',
            provider: 'google_meet',
            error: result.error || 'Google Meet link was not returned'
          };
        } else if (attendees.length && (createMeet || conferenceLink || hasManualLink)) {
          conferenceStatus = {
            ...conferenceStatus,
            invites: attendees.length,
            invitedVia: 'google_calendar'
          };
        }
      } else if (createMeet && result.error) {
        conferenceStatus = {
          status: 'generate_failed',
          provider: 'google_meet',
          error: result.error
        };
      }
    }

    if (conn.provider === 'microsoft' && !sync.microsoftEventId) {
      const createTeams =
        online &&
        provider === 'ms_teams' &&
        !hasManualLink &&
        !primaryConferenceCreated;
      // Skip secondary calendar when we already provisioned conference on the primary provider
      if (primaryConferenceCreated && !createTeams && provider === 'google_meet') {
        // Optional: still add secondary invite calendar without second conference room
      }
      const result = await createMicrosoftEvent(conn, event, {
        attendees,
        createConference: createTeams,
        locationOverride: conferenceLink || (event.location || undefined),
        description: buildEventDescription({
          eventName: event.eventName,
          agendaNotes: event.agendaNotes,
          meetingLink: conferenceLink || event.meetingLink,
          notes: event.notes,
          meetingMode: event.meetingMode
        })
      });
      if (result.eventId) {
        sync.microsoftEventId = result.eventId;
        changed = true;
        if (result.meetLink && !conferenceLink) {
          conferenceLink = result.meetLink;
          conferenceGenerated = true;
          primaryConferenceCreated = true;
          conferenceStatus = {
            status: 'generated',
            provider: 'ms_teams',
            invites: attendees.length
          };
        } else if (createTeams && !result.meetLink && !conferenceLink) {
          conferenceStatus = {
            status: 'generate_failed',
            provider: 'ms_teams',
            error: result.error || 'Teams join link was not returned'
          };
        }
      } else if (createTeams && result.error) {
        conferenceStatus = {
          status: 'generate_failed',
          provider: 'ms_teams',
          error: result.error
        };
      }
    }
  }

  if (online && provider === 'zoom' && !hasManualLink) {
    conferenceStatus = {
      status: 'paste_required',
      provider: 'zoom',
      message: 'Zoom room generation is not available yet. Paste a Zoom join link on the meeting.'
    };
  }

  if (online && provider === 'google_meet' && !hasManualLink && !conferenceGenerated) {
    const hasGoogle = connections.some((c) => c.provider === 'google');
    if (!hasGoogle) {
      conferenceStatus = {
        status: 'connect_required',
        provider: 'google_meet',
        message: 'Connect Google Calendar for the meeting host to auto-create a Google Meet and invite participants.'
      };
    }
  }

  if (online && provider === 'ms_teams' && !hasManualLink && !conferenceGenerated) {
    const hasMs = connections.some((c) => c.provider === 'microsoft');
    if (!hasMs) {
      conferenceStatus = {
        status: 'connect_required',
        provider: 'ms_teams',
        message: 'Connect Microsoft 365 Calendar for the meeting host to auto-create Teams and invite participants.'
      };
    }
  }

  if (applyMeetingLinkToEvent(event, conferenceLink, conferenceGenerated)) {
    if (conferenceGenerated) changed = true;
  }
  if (hasManualLink && event.appointment) {
    event.appointment.meetingLinkAutoGenerated = false;
    if (typeof event.markModified === 'function') {
      event.markModified('appointment');
    }
  }

  if (changed && typeof event.markModified === 'function') {
    event.markModified('calendarSync');
  }
  return {
    ok: true,
    changed,
    conference: conferenceStatus,
    invitedCount: attendees.length
  };
}

/**
 * Patch or create external events when CRM event times/title change.
 * If Virtual/Hybrid still has no join link, mint Meet/Teams (same as create).
 */
async function syncEventOnUpdate(event) {
  if (!shouldSyncEvent(event)) return { skipped: true };

  const userId = event.assignedTo;
  const organizationId = event.organizationId;
  const connections = await loadConnectedProviders(organizationId, userId);
  if (!connections.length) return { skipped: true, reason: 'no_connections' };

  const attendees = await resolveAttendeeEmails(event);
  const online = isMeetingEvent(event) && isOnlineMeetingMode(event);
  const provider = String(event.conferenceProvider || '').trim();
  const hasLink = !!(event.meetingLink && String(event.meetingLink).trim());
  const needsConference =
    online &&
    !hasLink &&
    (provider === 'google_meet' || provider === 'ms_teams');

  // First-class room mint when link was never created (e.g. calendar connected after create)
  if (needsConference) {
    const createResult = await syncEventOnCreate(event);
    return createResult;
  }

  const sync = ensureCalendarSync(event);
  let changed = false;
  const ordered = orderConnectionsForConference(connections, provider, online);

  for (const conn of ordered) {
    if (conn.provider === 'google') {
      if (sync.googleEventId) {
        const result = await patchGoogleEvent(conn, event, sync.googleEventId);
        if (result.gone) {
          sync.googleEventId = null;
          const created = await createGoogleEvent(conn, event, {
            attendees,
            createConference: false,
            locationOverride: event.meetingLink || event.location
          });
          if (created.eventId) {
            sync.googleEventId = created.eventId;
            changed = true;
          }
        }
      } else {
        const created = await createGoogleEvent(conn, event, {
          attendees,
          createConference: false,
          locationOverride: event.meetingLink || event.location
        });
        if (created.eventId) {
          sync.googleEventId = created.eventId;
          changed = true;
        }
      }
    }

    if (conn.provider === 'microsoft') {
      if (sync.microsoftEventId) {
        const result = await patchMicrosoftEvent(conn, event, sync.microsoftEventId);
        if (result.gone) {
          sync.microsoftEventId = null;
          const created = await createMicrosoftEvent(conn, event, {
            attendees,
            createConference: false,
            locationOverride: event.meetingLink || event.location
          });
          if (created.eventId) {
            sync.microsoftEventId = created.eventId;
            changed = true;
          }
        }
      } else {
        const created = await createMicrosoftEvent(conn, event, {
          attendees,
          createConference: false,
          locationOverride: event.meetingLink || event.location
        });
        if (created.eventId) {
          sync.microsoftEventId = created.eventId;
          changed = true;
        }
      }
    }
  }

  if (changed && typeof event.markModified === 'function') {
    event.markModified('calendarSync');
  }
  return { ok: true, changed };
}

/**
 * Delete external calendar events when CRM event is removed/trashed.
 */
async function syncEventOnDelete(event) {
  if (!event?.calendarSync) return { skipped: true };
  if (!event.assignedTo || !event.organizationId) return { skipped: true };

  const sync = event.calendarSync;
  const organizationId = event.organizationId;
  const userId = event.assignedTo;

  if (sync.googleEventId) {
    const conn =
      (await getConnection(organizationId, userId, 'google')) ||
      (await UserCalendarConnection.findOne({
        organizationId,
        userId,
        provider: 'google'
      }));
    if (conn?.encryptedRefreshToken) {
      await deleteGoogleEvent(conn, sync.googleEventId);
    }
    sync.googleEventId = null;
  }

  if (sync.microsoftEventId) {
    const conn =
      (await getConnection(organizationId, userId, 'microsoft')) ||
      (await UserCalendarConnection.findOne({
        organizationId,
        userId,
        provider: 'microsoft'
      }));
    if (conn?.encryptedRefreshToken) {
      await deleteMicrosoftEvent(conn, sync.microsoftEventId);
    }
    sync.microsoftEventId = null;
  }

  return { ok: true };
}

/**
 * Best-effort sync; never throws to callers.
 */
async function safeSyncOnCreate(eventDoc) {
  try {
    const result = await syncEventOnCreate(eventDoc);
    if (result?.changed) {
      await eventDoc.save();
    }
    return result;
  } catch (err) {
    console.warn('[userCalendarSync] create sync failed:', err.message);
    return { error: err.message };
  }
}

async function safeSyncOnUpdate(eventDoc) {
  try {
    const Event = require('../models/Event');
    let doc = eventDoc;
    if (!eventDoc.save) {
      doc = await Event.findById(eventDoc._id);
      if (!doc) return { skipped: true };
    }
    const result = await syncEventOnUpdate(doc);
    if (result?.changed) {
      await doc.save();
    }
    return result;
  } catch (err) {
    console.warn('[userCalendarSync] update sync failed:', err.message);
    return { error: err.message };
  }
}

async function safeSyncOnDelete(eventLike) {
  try {
    return await syncEventOnDelete(eventLike);
  } catch (err) {
    console.warn('[userCalendarSync] delete sync failed:', err.message);
    return { error: err.message };
  }
}

module.exports = {
  shouldSyncEvent,
  syncEventOnCreate,
  syncEventOnUpdate,
  syncEventOnDelete,
  safeSyncOnCreate,
  safeSyncOnUpdate,
  safeSyncOnDelete,
  resolveAttendeeEmails
};
