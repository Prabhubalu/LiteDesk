const NotificationPreference = require('../models/NotificationPreference');
const domainEvents = require('../constants/domainEvents');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK'];
const ALL_EVENTS = Object.values(domainEvents);

/**
 * Build default preference map for an app.
 * Phase 13: Extended to include push, whatsapp, sms channel defaults.
 */
function buildDefaultMap(appKey) {
  const defaults = {};

  // Helper to create event preference with channel defaults
  const createEventPref = (inApp, email, pushEnabled = false, pushAvailable = false, whatsappEnabled = false, whatsappAvailable = false, smsEnabled = false, smsAvailable = false) => ({
    inApp,
    email,
    push: { enabled: pushEnabled, available: pushAvailable },
    whatsapp: { enabled: whatsappEnabled, available: whatsappAvailable },
    sms: { enabled: smsEnabled, available: smsAvailable }
  });

  // Start with all false
  ALL_EVENTS.forEach(evt => {
    defaults[evt] = createEventPref(false, false);
  });

  // Sales defaults: push enabled, whatsapp/sms unavailable
  if (appKey === 'SALES') {
    ALL_EVENTS.forEach(evt => {
      defaults[evt] = createEventPref(true, false, true, true, false, false, false, false);
    });
  }

  // AUDIT defaults: push enabled, whatsapp enabled
  if (appKey === 'AUDIT') {
    const auditEvents = [
      domainEvents.AUDIT_ASSIGNED,
      domainEvents.AUDIT_CHECKED_IN,
      domainEvents.AUDIT_SUBMITTED,
      domainEvents.AUDIT_APPROVED,
      domainEvents.AUDIT_REJECTED
    ];
    auditEvents.forEach(evt => {
      defaults[evt] = createEventPref(true, false, true, true, true, true, false, false);
    });
  }

  // PORTAL defaults: whatsapp enabled, sms enabled, push/email conservative
  if (appKey === 'PORTAL') {
    const correctiveEvents = [
      domainEvents.CORRECTIVE_ACTION_CREATED,
      domainEvents.CORRECTIVE_ACTION_DUE_SOON,
      domainEvents.CORRECTIVE_ACTION_OVERDUE
    ];
    correctiveEvents.forEach(evt => {
      defaults[evt] = createEventPref(true, false, false, false, true, true, true, true);
    });
  }

  // Digest defaults - all OFF by default, users can enable them if they want
  if (appKey === 'SALES') {
    defaults[domainEvents.DIGEST_DAILY] = createEventPref(false, false, false, false, false, false, false, false);
    defaults[domainEvents.DIGEST_WEEKLY] = createEventPref(false, false, false, false, false, false, false, false);
  }

  if (appKey === 'AUDIT') {
    defaults[domainEvents.DIGEST_DAILY] = createEventPref(false, false, false, false, false, false, false, false);
    defaults[domainEvents.DIGEST_WEEKLY] = createEventPref(false, false, false, false, false, false, false, false);
  }

  if (appKey === 'PORTAL') {
    defaults[domainEvents.DIGEST_DAILY] = createEventPref(false, false, false, false, false, false, false, false);
    defaults[domainEvents.DIGEST_WEEKLY] = createEventPref(false, false, false, false, false, false, false, false);
  }

  if (appKey === 'HELPDESK') {
    const helpdeskEvents = [
      domainEvents.CASE_CREATED,
      domainEvents.CASE_ASSIGNED,
      domainEvents.CASE_STATUS_CHANGED,
      domainEvents.CASE_REOPENED,
      domainEvents.CASE_ESCALATED,
      domainEvents.CASE_SLA_WARNING,
      domainEvents.CASE_SLA_BREACHED,
      domainEvents.CASE_EMAIL_RECEIVED,
      domainEvents.CASE_CHAT_MESSAGE_RECEIVED
    ];
    helpdeskEvents.forEach((evt) => {
      defaults[evt] = createEventPref(true, false, true, true, false, false, false, false);
    });
  }

  return defaults;
}

async function ensureDefaultPreferences(userId, appKey) {
  if (!userId || !appKey || !APP_KEYS.includes(appKey)) return null;

  try {
    let pref = await NotificationPreference.findOne({ userId, appKey });
    const defaults = buildDefaultMap(appKey);

    if (!pref) {
      // Create with defaults
      pref = new NotificationPreference({
        userId,
        appKey,
        events: defaults
      });
      await pref.save();
      return pref;
    }

    // Idempotent: only fill missing event keys; never overwrite user-set values
    let modified = false;
    ALL_EVENTS.forEach(evt => {
      if (!pref.events.has(evt)) {
        pref.events.set(evt, defaults[evt]);
        modified = true;
      }
    });

    if (modified) {
      await pref.save();
    }

    return pref;
  } catch (err) {
    console.error('[notificationPreferenceBootstrap] Failed to ensure defaults:', err);
    return null; // never throw
  }
}

module.exports = {
  ensureDefaultPreferences,
  buildDefaultMap
};

