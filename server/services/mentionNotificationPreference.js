'use strict';

/**
 * Mention notification preference helpers.
 * Single source of truth: NotificationPreference mongoose model (same as Preferences UI).
 * Fail closed: mention email only when events.RECORD_COMMENT_MENTION.email === true.
 */

const mongoose = require('mongoose');
const domainEvents = require('../constants/domainEvents');

const EVENT_TYPE = domainEvents.RECORD_COMMENT_MENTION;

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.Types.ObjectId.isValid(String(id))) {
    return new mongoose.Types.ObjectId(String(id));
  }
  return null;
}

function normalizeEventPref(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const emailRaw = raw.email;
  const email =
    typeof emailRaw === 'object' && emailRaw !== null
      ? emailRaw.enabled === true
      : emailRaw === true;
  const inAppRaw = raw.inApp;
  const inApp =
    typeof inAppRaw === 'object' && inAppRaw !== null
      ? inAppRaw.enabled === true
      : inAppRaw === true;
  return {
    inApp,
    email,
    push: {
      enabled: raw.push?.enabled === true,
      available: raw.push?.available !== false
    },
    whatsapp: {
      enabled: raw.whatsapp?.enabled === true,
      available: raw.whatsapp?.available !== false
    },
    sms: {
      enabled: raw.sms?.enabled === true,
      available: raw.sms?.available !== false
    }
  };
}

function extractEventFromPrefDoc(pref) {
  if (!pref?.events) return null;
  let raw = null;
  if (typeof pref.events.get === 'function') {
    raw = pref.events.get(EVENT_TYPE) || pref.events.get('RECORD_COMMENT_MENTION');
  } else if (typeof pref.events === 'object') {
    raw = pref.events[EVENT_TYPE] || pref.events.RECORD_COMMENT_MENTION || null;
  }
  if (raw && raw._doc) raw = raw._doc;
  return normalizeEventPref(raw);
}

/**
 * Read mention pref from the same model/DB the Preferences UI uses.
 */
async function readMentionEventPref(userId, appKey) {
  const NotificationPreference = require('../models/NotificationPreference');
  const uid = toObjectId(userId);
  const app = String(appKey || 'SALES').toUpperCase();
  if (!uid) return null;

  const pref = await NotificationPreference.findOne({ userId: uid, appKey: app });
  return extractEventFromPrefDoc(pref);
}

/**
 * Persist event prefs via Mongoose $set (tenant-aware model).
 * Also mirrors mention email flag across app keys.
 */
async function writeEventPrefs(userId, appKey, eventPlainByType) {
  const NotificationPreference = require('../models/NotificationPreference');
  const uid = toObjectId(userId);
  if (!uid || !appKey || !eventPlainByType) return { matched: 0, modified: 0 };

  const $set = { updatedAt: new Date() };
  for (const [eventType, plain] of Object.entries(eventPlainByType)) {
    $set[`events.${eventType}`] = normalizeEventPref(plain) || {
      inApp: false,
      email: false,
      push: { enabled: false, available: false },
      whatsapp: { enabled: false, available: false },
      sms: { enabled: false, available: false }
    };
  }

  const app = String(appKey).toUpperCase();
  const res = await NotificationPreference.updateOne(
    { userId: uid, appKey: app },
    {
      $setOnInsert: { userId: uid, appKey: app, createdAt: new Date() },
      $set
    },
    { upsert: true }
  );

  console.log(
    `[mentionNotificationPreference] write user=${uid} appKey=${app} matched=${res.matchedCount} modified=${res.modifiedCount} upserted=${!!res.upsertedCount} keys=${Object.keys(eventPlainByType).join(',')}`
  );

  return {
    matched: res.matchedCount || (res.upsertedCount ? 1 : 0),
    modified: res.modifiedCount || 0
  };
}

/**
 * Mention email allowed only when THIS appKey's saved email === true.
 * Missing pref / missing event / any error → false (fail closed).
 */
async function isMentionEmailEnabled(userId, appKey) {
  try {
    const app = String(appKey || 'SALES').toUpperCase();
    const pref = await readMentionEventPref(userId, app);
    const allowed = pref?.email === true;
    console.log(
      `[mentionNotificationPreference] email gate user=${userId} appKey=${app} allowed=${allowed} raw=${JSON.stringify(pref)}`
    );
    return allowed;
  } catch (err) {
    console.error('[mentionNotificationPreference] isMentionEmailEnabled error:', err.message);
    return false;
  }
}

/**
 * Resolve non-email channels for engine delivery.
 */
async function resolveMentionChannels(userId, appKey) {
  const pref = await readMentionEventPref(userId, appKey);
  if (!pref) {
    return ['IN_APP'];
  }
  const channels = [];
  if (pref.inApp) channels.push('IN_APP');
  if (pref.push.enabled && pref.push.available) channels.push('PUSH');
  return channels;
}

module.exports = {
  EVENT_TYPE,
  readMentionEventPref,
  writeEventPrefs,
  isMentionEmailEnabled,
  resolveMentionChannels
};
