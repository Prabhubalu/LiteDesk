const NotificationPreference = require('../models/NotificationPreference');
const domainEvents = require('../constants/domainEvents');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK', 'PLATFORM'];
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
    // Mentions: In-App + Push on; Email off by default (user opts in)
    defaults[domainEvents.RECORD_COMMENT_MENTION] = createEventPref(
      true, false, true, true, false, false, false, false
    );
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
    defaults[domainEvents.RECORD_COMMENT_MENTION] = createEventPref(
      true, false, true, true, false, false, false, false
    );
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

    defaults[domainEvents.CASE_PORTAL_AGENT_REPLY] = createEventPref(
      true, true, true, true, false, false, false, false
    );
    defaults[domainEvents.CASE_PORTAL_STATUS_UPDATE] = createEventPref(
      true, true, false, false, false, false, false, false
    );
    defaults[domainEvents.PORTAL_ACCOUNT_CREATED] = createEventPref(
      true, true, false, false, false, false, false, false
    );
    defaults[domainEvents.EVIDENCE_UPLOADED] = createEventPref(
      true, false, false, false, false, false, false, false
    );
    defaults[domainEvents.RECORD_COMMENT_MENTION] = createEventPref(
      true, false, true, true, false, false, false, false
    );
  }

  // Digest defaults - all OFF by default, users can enable them if they want
  if (appKey === 'SALES') {
    defaults[domainEvents.WEBFORM_SUBMISSION] = createEventPref(true, true, false, false, false, false, false, false);
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
      domainEvents.CASE_SLA_ESCALATION,
      domainEvents.CASE_SLA_LEADERSHIP_ESCALATION,
      domainEvents.CASE_EMAIL_RECEIVED,
      domainEvents.CASE_CHAT_MESSAGE_RECEIVED
    ];
    helpdeskEvents.forEach((evt) => {
      defaults[evt] = createEventPref(true, false, true, true, false, false, false, false);
    });
    defaults[domainEvents.RECORD_COMMENT_MENTION] = createEventPref(
      true, false, true, true, false, false, false, false
    );
  }

  if (appKey === 'PLATFORM') {
    const liveChatEvents = [
      domainEvents.LIVE_CHAT_MESSAGE_RECEIVED,
      domainEvents.LIVE_CHAT_SESSION_STARTED,
    ];
    liveChatEvents.forEach((evt) => {
      defaults[evt] = createEventPref(true, false, true, true, false, false, false, false);
    });

    const telephonyEvents = [
      domainEvents.TELEPHONY_INCOMING_CALL,
      domainEvents.TELEPHONY_CALL_MISSED,
      domainEvents.TELEPHONY_RECORDING_READY,
    ];
    telephonyEvents.forEach((evt) => {
      defaults[evt] = createEventPref(true, false, true, true, false, false, false, false);
    });
  }

  return defaults;
}

/** Events that were incorrectly bootstrapped as all-off before portal case notifications shipped. */
const PORTAL_LEGACY_UPGRADE_EVENTS = [
  domainEvents.CASE_PORTAL_AGENT_REPLY,
  domainEvents.CASE_PORTAL_STATUS_UPDATE,
  domainEvents.PORTAL_ACCOUNT_CREATED,
  domainEvents.EVIDENCE_UPLOADED
];

function isLegacyDisabledPortalPref(current) {
  if (!current) return false;
  return current.inApp === false && current.email === false;
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

    // Mentions: never expose WhatsApp/SMS; keep In-App / Email / Push only
    const mentionKey = domainEvents.RECORD_COMMENT_MENTION;
    if (pref.events.has(mentionKey)) {
      const cur = pref.events.get(mentionKey) || {};
      if (cur.whatsapp?.available || cur.whatsapp?.enabled || cur.sms?.available || cur.sms?.enabled) {
        pref.events.set(mentionKey, {
          inApp: cur.inApp,
          email: cur.email,
          push: cur.push || { enabled: true, available: true },
          whatsapp: { enabled: false, available: false },
          sms: { enabled: false, available: false }
        });
        modified = true;
      }
    }

    if (appKey === 'PORTAL') {
      PORTAL_LEGACY_UPGRADE_EVENTS.forEach((evt) => {
        const current = pref.events.get(evt);
        const next = defaults[evt];
        if (next?.inApp && isLegacyDisabledPortalPref(current)) {
          pref.events.set(evt, next);
          modified = true;
        }
      });
    }

    if (modified) {
      pref.markModified('events');
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

