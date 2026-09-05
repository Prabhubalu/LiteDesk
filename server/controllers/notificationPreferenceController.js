const domainEvents = require('../constants/domainEvents');
const NotificationPreference = require('../models/NotificationPreference');
const { ensureDefaultPreferences, buildDefaultMap } = require('../services/notificationPreferenceBootstrap');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL'];
const ALL_EVENTS = Object.values(domainEvents);

function normalizeAppKey(req) {
  const fromQuery = req.query.appKey;
  const fromBody = req.body?.appKey;
  const fromContext = req.appContext?.appKey;
  const appKey = fromQuery || fromBody || fromContext;
  if (!appKey || !APP_KEYS.includes(appKey)) {
    return null;
  }
  return appKey;
}

// GET /api/notification-preferences
exports.getPreferences = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  try {
    await ensureDefaultPreferences(req.user._id, appKey);
    const pref = await NotificationPreference.findOne({ userId: req.user._id, appKey });

    if (!pref) {
      // Should be bootstrapped, but return defaults if not
      return res.json({ appKey, events: buildDefaultMap(appKey) });
    }

    const eventsObj = {};
    pref.events.forEach((value, key) => {
      eventsObj[key] = value;
    });

    return res.json({ appKey, events: eventsObj });
  } catch (err) {
    console.error('[notificationPreferenceController:getPreferences] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch preferences' });
  }
};

// PUT /api/notification-preferences
exports.updatePreferences = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  const incomingEvents = req.body?.events || {};
  const updates = {};

  // Validate incoming event types and channels
  // Phase 14: Extended to support push, whatsapp, sms channels
  Object.keys(incomingEvents).forEach(eventType => {
    if (!ALL_EVENTS.includes(eventType)) {
      return; // skip unknown event types
    }
    const entry = incomingEvents[eventType] || {};
    const next = {};
    
    // Legacy boolean format support (backward compatible)
    if (typeof entry.inApp === 'boolean') next.inApp = entry.inApp;
    if (typeof entry.email === 'boolean') next.email = entry.email;
    
    // New channel structure support (Phase 13/14)
    if (entry.push && typeof entry.push.enabled === 'boolean') {
      next.push = { enabled: entry.push.enabled, available: entry.push.available !== false };
    }
    if (entry.whatsapp && typeof entry.whatsapp.enabled === 'boolean') {
      next.whatsapp = { enabled: entry.whatsapp.enabled, available: entry.whatsapp.available !== false };
    }
    if (entry.sms && typeof entry.sms.enabled === 'boolean') {
      next.sms = { enabled: entry.sms.enabled, available: entry.sms.available !== false };
    }
    
    // Only apply if at least one known channel provided
    if (Object.keys(next).length > 0) {
      updates[eventType] = next;
    }
  });

  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    let pref = await ensureDefaultPreferences(req.user._id, appKey);
    if (!pref) {
      pref = await NotificationPreference.findOne({ userId: req.user._id, appKey });
    }

    if (!pref) {
      // If still missing, create from defaults
      pref = new NotificationPreference({
        userId: req.user._id,
        appKey,
        events: buildDefaultMap(appKey)
      });
    }

    const beforeEvents = {};
    pref.events.forEach((value, key) => {
      beforeEvents[key] = value && value._doc ? { ...value._doc } : (value ? { ...value } : value);
    });
    const before = cloneForAudit({ events: beforeEvents });

    const $set = {};
    Object.entries(updates).forEach(([eventType, value]) => {
      // Get existing event from Map - handle Mongoose document structure
      const existingRaw = pref.events.get(eventType);
      // If existing is a Mongoose document subdocument, extract plain object
      const existing = existingRaw && typeof existingRaw === 'object' && existingRaw._doc
        ? { ...existingRaw._doc }
        : (existingRaw ? { ...existingRaw } : {
            inApp: false,
            email: false,
            push: { enabled: false, available: false },
            whatsapp: { enabled: false, available: false },
            sms: { enabled: false, available: false }
          });
      
      // Merge channel updates, preserving structure - create a fresh plain object
      const merged = {
        inApp: existing.inApp !== undefined ? existing.inApp : false,
        email: existing.email !== undefined ? existing.email : false,
        push: existing.push || { enabled: false, available: false },
        whatsapp: existing.whatsapp || { enabled: false, available: false },
        sms: existing.sms || { enabled: false, available: false }
      };
      
      // Handle legacy boolean format
      if (typeof value.inApp === 'boolean') {
        console.log(`[notificationPreferenceController] Setting ${eventType}.inApp = ${value.inApp} (was ${merged.inApp})`);
        merged.inApp = value.inApp;
      }
      if (typeof value.email === 'boolean') {
        console.log(`[notificationPreferenceController] Setting ${eventType}.email = ${value.email} (was ${merged.email})`);
        merged.email = value.email;
      }
      
      // Handle new channel structure
      if (value.push) merged.push = { ...existing.push, ...value.push };
      if (value.whatsapp) merged.whatsapp = { ...existing.whatsapp, ...value.whatsapp };
      if (value.sms) merged.sms = { ...existing.sms, ...value.sms };
      
      // Normalize nested channel objects to plain JSON (avoid mongoose subdoc refs)
      const plain = {
        inApp: !!merged.inApp,
        email: !!merged.email,
        push: {
          enabled: !!merged.push?.enabled,
          available: merged.push?.available !== false
        },
        whatsapp: {
          enabled: !!merged.whatsapp?.enabled,
          available: merged.whatsapp?.available !== false
        },
        sms: {
          enabled: !!merged.sms?.enabled,
          available: merged.sms?.available !== false
        }
      };

      pref.events.set(eventType, plain);
      $set[`events.${eventType}`] = plain;
      console.log(`[notificationPreferenceController] After merge, ${eventType}:`, JSON.stringify(plain));
    });

    // Persist via $set on tenant-aware model (avoid Mongoose Map save bugs)
    pref.markModified('events');
    if (Object.keys($set).length > 0) {
      const { writeEventPrefs, EVENT_TYPE } = require('../services/mentionNotificationPreference');
      const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
      const eventPlainByType = {};
      for (const [path, plain] of Object.entries($set)) {
        const eventType = path.replace(/^events\./, '');
        eventPlainByType[eventType] = plain;
      }

      const persist = async () => {
        // Authoritative write — same DB the GET preferences endpoint reads
        const upd = await NotificationPreference.updateOne({ _id: pref._id }, { $set });
        console.log(
          `[notificationPreferenceController] $set persist matched=${upd.matchedCount} modified=${upd.modifiedCount} email=${JSON.stringify(eventPlainByType.RECORD_COMMENT_MENTION?.email)}`
        );

        await writeEventPrefs(req.user._id, appKey, eventPlainByType);

        if (eventPlainByType[EVENT_TYPE] || eventPlainByType.RECORD_COMMENT_MENTION) {
          const mentionPlain =
            eventPlainByType[EVENT_TYPE] || eventPlainByType.RECORD_COMMENT_MENTION;
          for (const mirrorKey of ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK']) {
            if (mirrorKey === appKey) continue;
            try {
              await ensureDefaultPreferences(req.user._id, mirrorKey);
              await writeEventPrefs(req.user._id, mirrorKey, {
                [EVENT_TYPE]: mentionPlain
              });
            } catch (mirrorErr) {
              console.warn(
                `[notificationPreferenceController] Mention pref mirror failed for ${mirrorKey}:`,
                mirrorErr.message
              );
            }
          }
        }
      };

      const orgId = req.user?.organizationId;
      if (orgId) {
        await runWithOrganizationTenantContext(orgId, persist);
      } else {
        await persist();
      }

      // Reload so response matches DB
      pref = await NotificationPreference.findById(pref._id);
    } else {
      await pref.save();
    }
    console.log(`[notificationPreferenceController] After save, digest event:`, JSON.stringify(pref.events.get('DIGEST_DAILY')));

    const eventsObj = {};
    pref.events.forEach((value, key) => {
      eventsObj[key] = value;
    });

    console.log(`[notificationPreferenceController] Returning response, DIGEST_DAILY:`, JSON.stringify(eventsObj['DIGEST_DAILY']));

    attachSettingsAuditDiff(
      res,
      before,
      cloneForAudit({ events: eventsObj }),
      { keys: ['events'] }
    );

    return res.json({ success: true, appKey, events: eventsObj });
  } catch (err) {
    console.error('[notificationPreferenceController:updatePreferences] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
};

