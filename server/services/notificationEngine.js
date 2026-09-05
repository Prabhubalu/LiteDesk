const Notification = require('../models/Notification');
const domainEvents = require('../constants/domainEvents');
const notificationRules = require('../constants/notificationRules');
const resolveRecipients = require('./notificationRecipientResolver');
const { ensureDefaultPreferences } = require('./notificationPreferenceBootstrap');
const NotificationPreference = require('../models/NotificationPreference');
const { evaluateRules: evaluateUserRules } = require('./notificationRuleEngine');
const crypto = require('crypto');
const { pickEntityForStorage } = require('../utils/notificationEntityDisplay');

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';
const DEDUPLICATION_WINDOW_MS = 60000; // 60 seconds

// In-memory deduplication cache: hash -> timestamp
const deduplicationCache = new Map();

function debugLog(event, data) {
  if (NOTIFICATION_DEBUG) {
    // Never log PII or payload body
    const safeData = { ...data };
    if (safeData.body) delete safeData.body;
    if (safeData.payload) delete safeData.payload;
    console.log(`[${event}]`, JSON.stringify(safeData));
  }
}

/**
 * Generate deduplication key for a notification.
 */
/** Inbound customer messages must notify on every message, not once per case per minute. */
const SKIP_DEDUPLICATION_EVENT_TYPES = new Set([
  domainEvents.CASE_CHAT_MESSAGE_RECEIVED,
  domainEvents.CASE_EMAIL_RECEIVED,
  domainEvents.LIVE_CHAT_MESSAGE_RECEIVED,
  domainEvents.CASE_PORTAL_AGENT_REPLY,
  domainEvents.INTERNAL_CHAT_MENTIONED,
  domainEvents.INTERNAL_CHAT_MESSAGE_POSTED,
]);

function getDeduplicationKey(eventType, entity, userId) {
  const entityKey = entity ? `${entity.type}_${entity.id}` : 'no_entity';
  let hashInput = `${eventType}_${entityKey}_${userId}`;
  if (eventType === domainEvents.CASE_CHAT_MESSAGE_RECEIVED) {
    const preview = String(entity?.preview || entity?.chatSessionId || '').trim();
    hashInput += `_${preview || Date.now()}`;
  } else if (eventType === domainEvents.LIVE_CHAT_MESSAGE_RECEIVED) {
    const preview = String(entity?.preview || '').trim();
    hashInput += `_${preview || Date.now()}`;
  } else if (eventType === domainEvents.CASE_EMAIL_RECEIVED) {
    const subject = String(entity?.subject || '').trim();
    const preview = String(entity?.preview || '').trim();
    hashInput += `_${subject}_${preview}`;
  }
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Check if notification is duplicate within deduplication window.
 */
function isDuplicate(key) {
  const now = Date.now();
  const cached = deduplicationCache.get(key);
  
  if (cached && (now - cached) < DEDUPLICATION_WINDOW_MS) {
    return true;
  }
  
  // Update cache
  deduplicationCache.set(key, now);
  
  // Cleanup old entries periodically (every 100 checks, roughly)
  if (deduplicationCache.size > 1000) {
    for (const [k, timestamp] of deduplicationCache.entries()) {
      if (now - timestamp > DEDUPLICATION_WINDOW_MS * 2) {
        deduplicationCache.delete(k);
      }
    }
  }
  
  return false;
}

/**
 * Pluggable channel loader. New channels can be added without refactor.
 * Phase 13: Extended to support external channels (PUSH, WHATSAPP, SMS).
 */
const channelLoaders = {
  IN_APP: () => require('./notificationChannels/inAppChannel'),
  EMAIL: () => require('./notificationChannels/emailChannel'),
  PUSH: () => require('./notificationChannels/pushChannel'),
  WHATSAPP: () => require('./notificationChannels/whatsappChannel'),
  SMS: () => require('./notificationChannels/smsChannel')
};

const FALLBACK_CHANNELS = ['IN_APP'];

function safeLoadChannel(channel) {
  try {
    return channelLoaders[channel] ? channelLoaders[channel]() : null;
  } catch (err) {
    console.error(`[notificationEngine] Failed to load channel ${channel}:`, err);
    return null;
  }
}

/**
 * Non-blocking notification emit. Never throws, always logs failures.
 * 
 * Phase 10G: Added deduplication guard and structured logging.
 * Failures in any step are caught and logged but never affect business flows.
 */
async function emitNotification({
  eventType,
  entity,
  organizationId,
  triggeredBy,
  sourceAppKey = null,
  channels: channelOverride = null,
  title: titleOverride = null,
  body: bodyOverride = null
}) {
  // FAILURE ISOLATION: Unknown event type - log and continue, don't throw
  const isKnownEvent = eventType && Object.values(domainEvents).includes(eventType);
  if (!isKnownEvent) {
    console.warn('[notificationEngine] Unknown eventType, skipping:', eventType);
    return;
  }

  // Phase 16: Evaluate user-defined rules FIRST (non-blocking)
  // User rules should be evaluated even if no system rule exists
  // This runs before system notifications are processed
  // User rules never block business flows - failures are caught and logged
  try {
    await evaluateUserRules({
      eventType,
      entity,
      organizationId,
      triggeredBy,
      sourceAppKey
    });
  } catch (err) {
    // Never throw - user rules never block business flows
    console.error('[notificationEngine] User rule evaluation failed:', err);
  }

  // FAILURE ISOLATION: Missing system rule - log and continue, don't throw
  // System rules are optional - user rules may still apply
  const rule = notificationRules[eventType];
  if (!rule) {
    debugLog('NoSystemRule', { eventType });
    // Don't return - user rules may have already handled notifications
    // Just skip system notification processing
    return;
  }

  // FAILURE ISOLATION: Recipient resolution - catch errors, don't throw
  let recipients = [];
  try {
    // Handle appKey: '*' in rules - resolve to actual appKey from sourceAppKey or rule
    const resolvedAppKey = rule.appKey === '*' ? (sourceAppKey || 'SALES') : rule.appKey;
    recipients = await resolveRecipients(rule.recipients, { 
      entity, 
      organizationId, 
      triggeredBy, 
      eventType,
      appKey: resolvedAppKey,
      sourceAppKey
    });
  } catch (err) {
    // Never throw - business flow continues even if notification fails
    console.error('[notificationEngine] Recipient resolution failed:', err);
    return;
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    console.log('[notificationEngine] No recipients resolved, nothing to notify for', eventType);
    return;
  }

  // Bootstrap and fetch preferences for recipients for this app
  // Handle appKey: '*' in rules - resolve to actual appKey
    const resolvedAppKey = rule.appKey === '*' ? (sourceAppKey || 'SALES') : rule.appKey;
  const prefsByUserId = {};
  try {
    await Promise.all(recipients.map(r => ensureDefaultPreferences(r.userId, resolvedAppKey)));
    const prefs = await NotificationPreference.find({
      userId: { $in: recipients.map(r => r.userId) },
      appKey: resolvedAppKey
    });
    prefs.forEach(pref => {
      prefsByUserId[String(pref.userId)] = pref;
    });
  } catch (err) {
    console.error('[notificationEngine] Failed to load preferences, proceeding with defaults:', err);
  }

  const notificationsToPersist = [];
  for (const recipient of recipients) {
    if (
      triggeredBy
      && recipient?.userId
      && String(recipient.userId) === String(triggeredBy)
    ) {
      continue;
    }

    // FAILURE ISOLATION: Preference loading - already handled above, continue with defaults
    
    // Phase 10G: Deduplication guard - prevent spam from rapid state changes
    const dedupKey = getDeduplicationKey(eventType, entity, recipient.userId);
    if (!SKIP_DEDUPLICATION_EVENT_TYPES.has(eventType) && isDuplicate(dedupKey)) {
      debugLog('NotificationDedupe', {
        eventType,
        userId: String(recipient.userId),
        entityType: entity?.type,
        entityId: entity?.id ? String(entity.id) : null
      });
      continue; // Skip duplicate notification
    }

    const channels = Array.isArray(channelOverride) && channelOverride.length
      ? channelOverride
      : computeChannels(rule, prefsByUserId[String(recipient.userId)], eventType);
    if (!channels || channels.length === 0) {
      continue; // user has disabled all channels for this event
    }
    for (const channel of channels) {
      const doc = {
        userId: recipient.userId,
        organizationId,
        appKey: resolvedAppKey,
        sourceAppKey: sourceAppKey || resolvedAppKey,
        eventType,
        title: titleOverride || recipient.title || rule.title || eventType.replace(/_/g, ' '),
        body: bodyOverride || recipient.body || rule.body || '',
        entity: pickEntityForStorage(entity),
        channel,
        priority: rule.priority || 'NORMAL'
      };
      notificationsToPersist.push(doc);
    }
  }

  if (notificationsToPersist.length === 0) {
    console.log('[notificationEngine] No channels after preference filtering for', eventType);
    return;
  }

  // FAILURE ISOLATION: Persistence - catch errors, don't throw
  try {
    const saved = await Notification.insertMany(notificationsToPersist, { ordered: false });
    
    // Phase 10G: Structured logging (debug mode only)
    for (const notification of saved) {
      debugLog('NotificationEmit', {
        eventType,
        notificationId: String(notification._id),
        userId: String(notification.userId),
        organizationId: String(notification.organizationId),
        appKey: notification.appKey,
        channels: [notification.channel]
      });
    }
    
    // FAILURE ISOLATION: SSE publish - fire-and-forget, never throws
    publishToSSE(saved).catch(err => {
      // Never throw - business flow continues even if SSE fails
      console.error('[notificationEngine] SSE publish error:', err);
    });
    
    // FAILURE ISOLATION: Channel dispatch - fire-and-forget, never throws
    dispatchChannels(saved).catch(err => {
      // Never throw - business flow continues even if channel dispatch fails
      console.error('[notificationEngine] Channel dispatch error:', err);
    });
    
    console.log(`[notificationEngine] Saved ${saved.length} notification(s) for ${eventType}`);
  } catch (err) {
    // Never throw - business flow continues even if persistence fails
    console.error('[notificationEngine] Failed to persist notifications:', err);
  }

  // Note: User-defined rules are now evaluated BEFORE system rules (see above)
  // This ensures user rules work even when no system rule is configured
}

/**
 * Publish notifications to SSE hub (fire-and-forget).
 * 
 * FAILURE ISOLATION: Any error here is caught and logged but never throws.
 * Business flows (audit execution, Sales workflows, portal actions) continue unaffected.
 */
async function publishToSSE(notifications) {
  try {
    const { deliverNotificationSSE } = require('./notificationSSEDeliver');

    for (const notification of notifications) {
      // Only publish IN_APP notifications via SSE
      if (notification.channel !== 'IN_APP') continue;

      try {
        await deliverNotificationSSE({
          userId: notification.userId,
          organizationId: notification.organizationId,
          appKey: notification.appKey,
          payload: {
            id: String(notification._id),
            appKey: notification.appKey,
            eventType: notification.eventType,
            title: notification.title,
            body: notification.body,
            priority: notification.priority,
            entity: notification.entity,
            createdAt: notification.createdAt
          }
        });
      } catch (publishErr) {
        console.error(`[notificationEngine] SSE publish failed for notification ${notification._id}:`, publishErr);
      }
    }
  } catch (err) {
    console.error('[notificationEngine] SSE publish failed:', err);
  }
}

/**
 * Compute which channels to use for a notification.
 * Phase 13: Extended to intersect rule.channels × user.preferences for external channels.
 * 
 * Rules:
 * - Rule must explicitly allow channel in rule.channels
 * - User preference must enable channel (enabled && available)
 * - External channels (PUSH, WHATSAPP, SMS) only if both conditions met
 */
function computeChannels(rule, preference, eventType) {
  // Start with defaults from rule
  let channels = rule.defaultChannels || FALLBACK_CHANNELS;

  // Get rule channel metadata (Phase 13)
  const ruleChannels = rule.channels || {
    inApp: true,
    email: true,
    push: false,
    whatsapp: false,
    sms: false
  };

  // Apply user preference if present
  if (preference && preference.events) {
    const pref = preference.events.get(eventType);
    if (pref) {
      channels = [];
      
      // In-app: rule allows AND user enabled
      if (ruleChannels.inApp && pref.inApp) {
        channels.push('IN_APP');
      }
      
      // Email: rule allows AND user enabled
      if (ruleChannels.email && pref.email) {
        channels.push('EMAIL');
      }
      
      // Push: rule allows AND user enabled AND available
      if (ruleChannels.push && pref.push?.enabled && pref.push?.available) {
        channels.push('PUSH');
      }
      
      // WhatsApp: rule allows AND user enabled AND available
      if (ruleChannels.whatsapp && pref.whatsapp?.enabled && pref.whatsapp?.available) {
        channels.push('WHATSAPP');
      }
      
      // SMS: rule allows AND user enabled AND available
      if (ruleChannels.sms && pref.sms?.enabled && pref.sms?.available) {
        channels.push('SMS');
      }
    } else {
      // No user preference for this event - use rule defaults but respect rule.channels
      channels = [];
      if (ruleChannels.inApp && (rule.defaultChannels || FALLBACK_CHANNELS).includes('IN_APP')) {
        channels.push('IN_APP');
      }
      if (ruleChannels.email && (rule.defaultChannels || []).includes('EMAIL')) {
        channels.push('EMAIL');
      }
      // External channels require explicit user preference, so skip if no pref
    }
  } else {
    // No user preference at all - use rule defaults but respect rule.channels
    channels = [];
    if (ruleChannels.inApp && (rule.defaultChannels || FALLBACK_CHANNELS).includes('IN_APP')) {
      channels.push('IN_APP');
    }
    if (ruleChannels.email && (rule.defaultChannels || []).includes('EMAIL')) {
      channels.push('EMAIL');
    }
    // External channels require explicit user preference, so skip if no pref
  }

  // If user preference disables all channels, honor it
  if (!channels || channels.length === 0) {
    return [];
  }

  return channels;
}

/**
 * Dispatch notifications to channels (fire-and-forget).
 * Phase 13: Extended to support external channels (PUSH, WHATSAPP, SMS).
 * 
 * External channels are dispatched after persistence, in parallel, with full error isolation.
 */
async function dispatchChannels(notifications) {
  // Separate internal and external channels for observability
  const internalChannels = ['IN_APP', 'EMAIL'];
  const externalChannels = ['PUSH', 'WHATSAPP', 'SMS'];
  
  for (const notification of notifications) {
    const channel = safeLoadChannel(notification.channel);
    if (!channel || typeof channel.send !== 'function') {
      console.warn('[notificationEngine] Channel not available, skipping:', notification.channel);
      continue;
    }
    
    try {
      // Fire-and-forget per notification
      // External channels are dispatched in parallel, never block execution
      channel.send({ notification }).catch(err => {
        const channelType = externalChannels.includes(notification.channel) ? 'External' : 'Internal';
        console.error(`[notificationEngine] ${channelType} channel send failed for ${notification.channel}:`, err);
      });
    } catch (err) {
      const channelType = externalChannels.includes(notification.channel) ? 'External' : 'Internal';
      console.error(`[notificationEngine] ${channelType} channel send threw synchronously:`, err);
    }
  }
}

module.exports = {
  emitNotification
};

