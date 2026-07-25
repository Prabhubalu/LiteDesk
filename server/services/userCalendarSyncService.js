'use strict';

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

async function loadConnectedProviders(organizationId, userId) {
  const rows = await UserCalendarConnection.find({
    organizationId,
    userId,
    encryptedRefreshToken: { $nin: [null, ''] }
  });
  return rows.filter((r) => (typeof r.isConnected === 'function' ? r.isConnected() : !!r.encryptedRefreshToken));
}

async function createGoogleEvent(connection, event) {
  const client = await getGoogleCalendarClient(connection);
  if (client.error) return { error: client.error };

  const tz = timezoneForEvent(event);
  try {
    const res = await client.calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.eventName || 'Event',
        description: event.description || undefined,
        location: event.location || undefined,
        start: { dateTime: new Date(event.startDateTime).toISOString(), timeZone: tz },
        end: { dateTime: new Date(event.endDateTime).toISOString(), timeZone: tz }
      }
    });
    return { eventId: res.data.id };
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
      requestBody: {
        summary: event.eventName || 'Event',
        description: event.description || undefined,
        location: event.location || undefined,
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
      eventId: externalEventId
    });
    return { ok: true };
  } catch (err) {
    if (err?.code === 404 || err?.code === 410) return { ok: true, gone: true };
    console.warn('[userCalendarSync] Google delete failed:', err.message);
    return { error: err.message };
  }
}

async function createMicrosoftEvent(connection, event) {
  const tokenResult = await getMicrosoftAccessToken(connection);
  if (tokenResult.error) return { error: tokenResult.error };

  const tz = timezoneForEvent(event);
  const startLocal = new Date(event.startDateTime).toISOString().slice(0, 19);
  const endLocal = new Date(event.endDateTime).toISOString().slice(0, 19);

  try {
    const created = await graphRequest(tokenResult.accessToken, '/me/events', {
      method: 'POST',
      body: JSON.stringify({
        subject: event.eventName || 'Event',
        body: event.description
          ? { contentType: 'text', content: String(event.description) }
          : undefined,
        location: event.location ? { displayName: String(event.location) } : undefined,
        start: { dateTime: startLocal, timeZone: tz },
        end: { dateTime: endLocal, timeZone: tz }
      })
    });
    return { eventId: created.id };
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

  try {
    await graphRequest(tokenResult.accessToken, `/me/events/${encodeURIComponent(externalEventId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        subject: event.eventName || 'Event',
        body: event.description
          ? { contentType: 'text', content: String(event.description) }
          : undefined,
        location: event.location ? { displayName: String(event.location) } : undefined,
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

/**
 * Create external calendar events for all connected providers of the assignee.
 * Persists IDs on event.calendarSync.
 */
async function syncEventOnCreate(event) {
  if (!shouldSyncEvent(event)) return { skipped: true };

  const userId = event.assignedTo;
  const organizationId = event.organizationId;
  const connections = await loadConnectedProviders(organizationId, userId);
  if (!connections.length) return { skipped: true, reason: 'no_connections' };

  const sync = ensureCalendarSync(event);
  let changed = false;

  for (const conn of connections) {
    if (conn.provider === 'google' && !sync.googleEventId) {
      const result = await createGoogleEvent(conn, event);
      if (result.eventId) {
        sync.googleEventId = result.eventId;
        changed = true;
      }
    }
    if (conn.provider === 'microsoft' && !sync.microsoftEventId) {
      const result = await createMicrosoftEvent(conn, event);
      if (result.eventId) {
        sync.microsoftEventId = result.eventId;
        changed = true;
      }
    }
  }

  if (changed && typeof event.markModified === 'function') {
    event.markModified('calendarSync');
  }
  return { ok: true, changed };
}

/**
 * Patch or create external events when CRM event times/title change.
 */
async function syncEventOnUpdate(event) {
  if (!shouldSyncEvent(event)) return { skipped: true };

  const userId = event.assignedTo;
  const organizationId = event.organizationId;
  const connections = await loadConnectedProviders(organizationId, userId);
  if (!connections.length) return { skipped: true, reason: 'no_connections' };

  const sync = ensureCalendarSync(event);
  let changed = false;

  for (const conn of connections) {
    if (conn.provider === 'google') {
      if (sync.googleEventId) {
        const result = await patchGoogleEvent(conn, event, sync.googleEventId);
        if (result.gone) {
          sync.googleEventId = null;
          const created = await createGoogleEvent(conn, event);
          if (created.eventId) {
            sync.googleEventId = created.eventId;
            changed = true;
          }
        }
      } else {
        const created = await createGoogleEvent(conn, event);
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
          const created = await createMicrosoftEvent(conn, event);
          if (created.eventId) {
            sync.microsoftEventId = created.eventId;
            changed = true;
          }
        }
      } else {
        const created = await createMicrosoftEvent(conn, event);
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
    // Prefer mongoose doc when possible for markModified
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
  safeSyncOnDelete
};
