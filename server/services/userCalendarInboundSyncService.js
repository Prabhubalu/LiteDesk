'use strict';

/**
 * Near real-time Google Calendar → Arivu Events sync.
 * Uses Calendar push channels (events.watch) + incremental syncToken pulls.
 */

const crypto = require('crypto');
const UserCalendarConnection = require('../models/UserCalendarConnection');
const Event = require('../models/Event');
const { getGoogleCalendarClient } = require('./userCalendarOAuthService');

const FULL_SYNC_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const WATCH_TTL_MS = 6 * 24 * 60 * 60 * 1000; // ~6 days (Google max is 7)
const RENEW_IF_EXPIRES_WITHIN_MS = 24 * 60 * 60 * 1000;
const LOCK_MS = 90 * 1000;

function resolveApiPublicOrigin() {
  const apiPublic = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (apiPublic) {
    try {
      return new URL(apiPublic).origin;
    } catch {
      /* fall through */
    }
  }
  const gmailRedirect = String(process.env.GOOGLE_GMAIL_REDIRECT_URI || '').trim();
  if (gmailRedirect) {
    try {
      return new URL(gmailRedirect).origin;
    } catch {
      /* fall through */
    }
  }
  return 'http://localhost:3000';
}

function googlePushWebhookUrl() {
  return `${resolveApiPublicOrigin()}/api/user/calendar-connections/google/push`;
}

function parseGoogleDateTime(slot) {
  if (!slot) return null;
  if (slot.dateTime) {
    const d = new Date(slot.dateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (slot.date) {
    // All-day: treat as midnight UTC of that date; end is exclusive in Google.
    const d = new Date(`${slot.date}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function extractMeetLink(gEvent) {
  if (!gEvent) return null;
  if (gEvent.hangoutLink) return String(gEvent.hangoutLink);
  const entry = gEvent.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');
  return entry?.uri ? String(entry.uri) : null;
}

function plainDescription(gEvent) {
  const raw = String(gEvent?.description || '').trim();
  if (!raw) return '';
  // Strip basic HTML if Google stored rich text
  return raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim().slice(0, 5000);
}

function isAppointmentEvent(event) {
  return !!(event?.appointment && event.appointment.isAppointment);
}

async function stopGoogleWatch(connection) {
  if (!connection?.googleWatchChannelId || !connection?.googleWatchResourceId) {
    return;
  }
  const client = await getGoogleCalendarClient(connection);
  if (client.error) return;
  try {
    await client.calendar.channels.stop({
      requestBody: {
        id: connection.googleWatchChannelId,
        resourceId: connection.googleWatchResourceId
      }
    });
  } catch (err) {
    // Channel may already be expired/stopped
    if (err?.code !== 404 && err?.code !== 410) {
      console.warn('[userCalendarInbound] stop watch:', err.message);
    }
  }
}

async function startGoogleWatch(connection) {
  const client = await getGoogleCalendarClient(connection);
  if (client.error) return { error: client.error };

  const channelId = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString('hex');
  const expirationMs = Date.now() + WATCH_TTL_MS;

  try {
    // Stop prior channel best-effort
    await stopGoogleWatch(connection);

    const res = await client.calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: googlePushWebhookUrl(),
        token,
        expiration: String(expirationMs)
      }
    });

    const resourceId = String(res.data.resourceId || '');
    const expiration = res.data.expiration
      ? new Date(Number(res.data.expiration))
      : new Date(expirationMs);

    await UserCalendarConnection.updateOne(
      { _id: connection._id },
      {
        $set: {
          googleWatchChannelId: channelId,
          googleWatchResourceId: resourceId,
          googleWatchExpiration: expiration,
          googleWebhookToken: token
        }
      }
    );

    connection.googleWatchChannelId = channelId;
    connection.googleWatchResourceId = resourceId;
    connection.googleWatchExpiration = expiration;
    connection.googleWebhookToken = token;
    return { ok: true, channelId, expiration };
  } catch (err) {
    console.warn('[userCalendarInbound] watch failed:', err.message);
    return { error: err.message };
  }
}

async function listGoogleChanges(client, connection, { full = false } = {}) {
  const items = [];
  let pageToken;
  let nextSyncToken = connection.googleSyncToken || '';
  const useSyncToken = !full && !!connection.googleSyncToken;

  do {
    const params = {
      calendarId: 'primary',
      maxResults: 250,
      singleEvents: true,
      showDeleted: true
    };
    if (pageToken) params.pageToken = pageToken;

    if (useSyncToken) {
      params.syncToken = connection.googleSyncToken;
    } else {
      params.timeMin = new Date(Date.now() - FULL_SYNC_LOOKBACK_MS).toISOString();
    }

    let res;
    try {
      res = await client.calendar.events.list(params);
    } catch (err) {
      // Expired sync token → full resync
      if ((err?.code === 410 || err?.status === 410) && useSyncToken) {
        return listGoogleChanges(client, { ...connection.toObject?.() || connection, googleSyncToken: '' }, {
          full: true
        });
      }
      throw err;
    }

    if (Array.isArray(res.data.items)) {
      items.push(...res.data.items);
    }
    pageToken = res.data.nextPageToken || null;
    if (res.data.nextSyncToken) {
      nextSyncToken = res.data.nextSyncToken;
    }
  } while (pageToken);

  return { items, nextSyncToken };
}

async function applyCancelledGoogleEvent({ organizationId, userId, googleEventId }) {
  if (!googleEventId) return { skipped: true };
  const event = await Event.findOne({
    organizationId,
    'calendarSync.googleEventId': googleEventId,
    deletedAt: null
  });
  if (!event) return { skipped: true, reason: 'not_found' };
  if (isAppointmentEvent(event)) return { skipped: true, reason: 'appointment' };
  if (String(event.assignedTo) !== String(userId)) {
    // Only owner-connected calendar owns this mapping
    return { skipped: true, reason: 'owner_mismatch' };
  }
  if (event.status === 'Cancelled') return { skipped: true, reason: 'already_cancelled' };

  event.status = 'Cancelled';
  event.cancelledAt = new Date();
  event.cancelledBy = userId;
  event.cancellationReason = 'Removed from Google Calendar';
  event.modifiedBy = userId;
  if (!event.calendarSync) event.calendarSync = {};
  event.calendarSync.fromGoogle = true;
  event.markModified('calendarSync');
  await event.save();
  return { ok: true, action: 'cancelled' };
}

async function applyUpsertGoogleEvent({ connection, gEvent }) {
  const organizationId = connection.organizationId;
  const userId = connection.userId;
  const googleEventId = String(gEvent.id || '').trim();
  if (!googleEventId) return { skipped: true };

  if (gEvent.status === 'cancelled') {
    return applyCancelledGoogleEvent({ organizationId, userId, googleEventId });
  }

  // Skip Google-specific special types that are not CRM meetings
  const gType = String(gEvent.eventType || 'default');
  if (gType === 'workingLocation' || gType === 'focusTime') {
    return { skipped: true, reason: 'special_type' };
  }

  let start = parseGoogleDateTime(gEvent.start);
  let end = parseGoogleDateTime(gEvent.end);
  if (!start || !end) return { skipped: true, reason: 'no_times' };

  // All-day exclusive end: ensure end > start
  if (end <= start) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  const meetLink = extractMeetLink(gEvent);
  const eventName = String(gEvent.summary || 'Untitled event').trim().slice(0, 255) || 'Untitled event';
  const agendaNotes = plainDescription(gEvent);
  const location = String(gEvent.location || '').trim().slice(0, 1024);

  let event = await Event.findOne({
    organizationId,
    'calendarSync.googleEventId': googleEventId,
    deletedAt: null
  });

  if (event) {
    if (isAppointmentEvent(event)) return { skipped: true, reason: 'appointment' };
    if (String(event.assignedTo) !== String(userId)) {
      return { skipped: true, reason: 'owner_mismatch' };
    }
    if (event.status === 'Cancelled' || event.statusCategory === 'CANCELLED') {
      // Restored in Google → back to open Meeting vocabulary
      event.status = 'Scheduled';
      event.statusCategory = 'OPEN';
      event.cancelledAt = null;
      event.cancelledBy = null;
      event.cancellationReason = null;
    }

    event.eventName = eventName;
    event.startDateTime = start;
    event.endDateTime = end;
    event.location = location;
    event.agendaNotes = agendaNotes;
    event.modifiedBy = userId;
    if (meetLink) {
      event.meetingLink = meetLink;
      if (!event.meetingMode || event.meetingMode === 'In-person') {
        event.meetingMode = 'Virtual';
      }
      if (!event.conferenceProvider) {
        event.conferenceProvider = 'google_meet';
      }
    }
    if (!event.calendarSync) event.calendarSync = {};
    event.calendarSync.googleEventId = googleEventId;
    event.calendarSync.fromGoogle = true;
    event.markModified('calendarSync');
    await event.save();
    return { ok: true, action: 'updated', eventId: event._id };
  }

  // Create CRM event from Google
  const payload = {
    organizationId,
    assignedTo: userId,
    createdBy: userId,
    modifiedBy: userId,
    eventName,
    eventType: 'Meeting',
    status: 'Scheduled',
    statusCategory: 'OPEN',
    startDateTime: start,
    endDateTime: end,
    location,
    agendaNotes,
    meetingMode: meetLink ? 'Virtual' : 'In-person',
    meetingLink: meetLink || null,
    conferenceProvider: meetLink ? 'google_meet' : undefined,
    source: 'Integration',
    calendarSync: {
      googleEventId,
      fromGoogle: true
    }
  };

  event = new Event(payload);
  await event.save();
  return { ok: true, action: 'created', eventId: event._id };
}

/**
 * Incremental or full pull + apply. Direct Event model writes (no outbound hooks).
 */
async function pullAndApplyGoogleEvents(connection, { full = false } = {}) {
  const client = await getGoogleCalendarClient(connection);
  if (client.error) return { error: client.error };

  const { items, nextSyncToken } = await listGoogleChanges(client, connection, { full });
  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;

  for (const gEvent of items) {
    try {
      const result = await applyUpsertGoogleEvent({ connection, gEvent });
      if (result?.action === 'created') created += 1;
      else if (result?.action === 'updated') updated += 1;
      else if (result?.action === 'cancelled') cancelled += 1;
      else skipped += 1;
    } catch (err) {
      console.warn('[userCalendarInbound] apply failed:', gEvent?.id, err.message);
      skipped += 1;
    }
  }

  const $set = {
    lastInboundSyncAt: new Date(),
    lastInboundSyncError: '',
    inboundSyncLockUntil: null
  };
  if (nextSyncToken) {
    $set.googleSyncToken = nextSyncToken;
  }

  await UserCalendarConnection.updateOne({ _id: connection._id }, { $set });

  return { ok: true, created, updated, cancelled, skipped, total: items.length };
}

async function tryAcquireInboundLock(connectionId) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_MS);
  const conn = await UserCalendarConnection.findOneAndUpdate(
    {
      _id: connectionId,
      encryptedRefreshToken: { $nin: [null, ''] },
      $or: [{ inboundSyncLockUntil: null }, { inboundSyncLockUntil: { $lte: now } }]
    },
    { $set: { inboundSyncLockUntil: lockUntil } },
    { new: true }
  );
  return conn;
}

async function releaseInboundLock(connectionId) {
  await UserCalendarConnection.updateOne(
    { _id: connectionId },
    { $set: { inboundSyncLockUntil: null } }
  );
}

async function processGoogleInboundSync(connectionId, { full = false } = {}) {
  const conn = await tryAcquireInboundLock(connectionId);
  if (!conn) return { skipped: true, reason: 'locked_or_missing' };

  try {
    const needsWatch =
      !conn.googleWatchChannelId ||
      !conn.googleWatchExpiration ||
      new Date(conn.googleWatchExpiration).getTime() < Date.now() + RENEW_IF_EXPIRES_WITHIN_MS;

    if (needsWatch) {
      const w = await startGoogleWatch(conn);
      if (w.error) {
        await UserCalendarConnection.updateOne(
          { _id: conn._id },
          { $set: { lastInboundSyncError: String(w.error).slice(0, 500) } }
        );
      }
    }

    const result = await pullAndApplyGoogleEvents(conn, {
      full: full || !conn.googleSyncToken
    });
    if (result.error) {
      await UserCalendarConnection.updateOne(
        { _id: conn._id },
        {
          $set: {
            lastInboundSyncError: String(result.error).slice(0, 500),
            inboundSyncLockUntil: null
          }
        }
      );
      return result;
    }
    return result;
  } catch (err) {
    console.error('[userCalendarInbound] process failed:', err);
    await UserCalendarConnection.updateOne(
      { _id: connectionId },
      {
        $set: {
          lastInboundSyncError: String(err.message || err).slice(0, 500),
          inboundSyncLockUntil: null
        }
      }
    );
    return { error: err.message };
  } finally {
    await releaseInboundLock(connectionId);
  }
}

/**
 * After OAuth connect or when listing connections: ensure watch + first pull.
 * Fire-and-forget safe.
 */
async function ensureGoogleInboundForConnection(connection) {
  if (!connection?._id || !connection.encryptedRefreshToken) return { skipped: true };
  // Non-blocking style caller; still await when used from OAuth
  return processGoogleInboundSync(connection._id, { full: !connection.googleSyncToken });
}

async function ensureGoogleInboundForUser({ organizationId, userId }) {
  const conn = await UserCalendarConnection.findOne({
    organizationId,
    userId,
    provider: 'google',
    encryptedRefreshToken: { $nin: [null, ''] }
  });
  if (!conn) return { skipped: true };
  // Kick async so listConnections stays fast
  setImmediate(() => {
    processGoogleInboundSync(conn._id, { full: !conn.googleSyncToken }).catch((err) => {
      console.warn('[userCalendarInbound] ensure failed:', err.message);
    });
  });
  return { ok: true, scheduled: true };
}

async function handleGooglePushNotification(headers) {
  const channelId = String(headers['x-goog-channel-id'] || '').trim();
  const resourceState = String(headers['x-goog-resource-state'] || '').trim().toLowerCase();
  const token = String(headers['x-goog-channel-token'] || '').trim();
  const resourceId = String(headers['x-goog-resource-id'] || '').trim();

  if (!channelId) return { ok: false, status: 400, message: 'missing channel' };

  const conn = await UserCalendarConnection.findOne({
    googleWatchChannelId: channelId,
    provider: 'google'
  });

  if (!conn || !conn.encryptedRefreshToken) {
    return { ok: false, status: 404, message: 'unknown channel' };
  }

  if (conn.googleWebhookToken && token && conn.googleWebhookToken !== token) {
    return { ok: false, status: 403, message: 'invalid token' };
  }

  if (resourceId && conn.googleWatchResourceId && conn.googleWatchResourceId !== resourceId) {
    return { ok: false, status: 403, message: 'resource mismatch' };
  }

  // Initial handshake after events.watch — no payload changes yet
  if (resourceState === 'sync') {
    return { ok: true, status: 200, handshake: true };
  }

  // Process pull async so Google gets a fast 200
  setImmediate(() => {
    processGoogleInboundSync(conn._id, { full: false }).catch((err) => {
      console.warn('[userCalendarInbound] push process failed:', err.message);
    });
  });

  return { ok: true, status: 200 };
}

async function teardownGoogleInbound(connection) {
  if (!connection) return;
  try {
    await stopGoogleWatch(connection);
  } catch {
    /* ignore */
  }
  await UserCalendarConnection.updateOne(
    { _id: connection._id },
    {
      $set: {
        googleSyncToken: '',
        googleWatchChannelId: '',
        googleWatchResourceId: '',
        googleWatchExpiration: null,
        googleWebhookToken: '',
        inboundSyncLockUntil: null,
        lastInboundSyncError: ''
      }
    }
  );
}

async function teardownGoogleInboundForUser({ organizationId, userId }) {
  const conn = await UserCalendarConnection.findOne({
    organizationId,
    userId,
    provider: 'google'
  });
  if (conn) await teardownGoogleInbound(conn);
}

module.exports = {
  googlePushWebhookUrl,
  processGoogleInboundSync,
  ensureGoogleInboundForConnection,
  ensureGoogleInboundForUser,
  handleGooglePushNotification,
  teardownGoogleInbound,
  teardownGoogleInboundForUser,
  startGoogleWatch,
  stopGoogleWatch
};
