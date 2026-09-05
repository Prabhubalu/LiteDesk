const NotificationRule = require('../models/NotificationRule');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { ensureDefaultPreferences } = require('./notificationPreferenceBootstrap');
const {
  getModuleMetadata,
  loadEntity,
  getAssignedUserId,
  getStatus,
  getPriority,
  getTitle
} = require('./notificationRuleModuleHelper');
const crypto = require('crypto');
const domainEvents = require('../constants/domainEvents');

// Channel loaders (same as notificationEngine)
const channelLoaders = {
  IN_APP: () => require('./notificationChannels/inAppChannel'),
  EMAIL: () => require('./notificationChannels/emailChannel'),
  PUSH: () => require('./notificationChannels/pushChannel'),
  WHATSAPP: () => require('./notificationChannels/whatsappChannel'),
  SMS: () => require('./notificationChannels/smsChannel')
};

function safeLoadChannel(channel) {
  try {
    return channelLoaders[channel] ? channelLoaders[channel]() : null;
  } catch (err) {
    console.error(`[notificationRuleEngine] Failed to load channel ${channel}:`, err);
    return null;
  }
}

const DEDUPLICATION_WINDOW_MS = 60000; // 60 seconds
const deduplicationCache = new Map();

const RULE_DEBUG = process.env.NOTIFICATION_RULE_DEBUG === 'true';

function debugLog(event, data) {
  if (RULE_DEBUG) {
    const safeData = { ...data };
    if (safeData.entity?.body) delete safeData.entity.body;
    if (safeData.entity?.payload) delete safeData.entity.payload;
    console.log(`[notificationRuleEngine:${event}]`, JSON.stringify(safeData));
  }
}

/**
 * Generate deduplication key for a notification (same logic as notificationEngine).
 */
function getDeduplicationKey(eventType, entity, userId) {
  const entityKey = entity ? `${entity.type}_${entity.id}` : 'no_entity';
  const hashInput = `${eventType}_${entityKey}_${userId}`;
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Check if notification is duplicate within deduplication window (same logic as notificationEngine).
 */
function isDuplicate(key) {
  const now = Date.now();
  const cached = deduplicationCache.get(key);
  
  if (cached && (now - cached) < DEDUPLICATION_WINDOW_MS) {
    return true;
  }
  
  deduplicationCache.set(key, now);
  
  // Cleanup old entries periodically
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
 * Compute channels for rule notification (intersects rule channels with user preferences).
 */
function computeRuleChannels(ruleChannels, userPreference, eventType) {
  const channels = [];
  const ruleChs = ruleChannels || {};

  const isOn = (value) => {
    if (typeof value === 'boolean') return value === true;
    if (value && typeof value === 'object') return value.enabled === true;
    return false;
  };

  if (userPreference && userPreference.events) {
    const pref =
      (typeof userPreference.events.get === 'function'
        ? userPreference.events.get(eventType)
        : null) || userPreference.events[eventType];
    if (pref) {
      if (ruleChs.inApp && isOn(pref.inApp)) channels.push('IN_APP');
      if (ruleChs.email && isOn(pref.email)) channels.push('EMAIL');
      if (ruleChs.push && pref.push?.enabled && pref.push?.available) channels.push('PUSH');
      if (ruleChs.whatsapp && pref.whatsapp?.enabled && pref.whatsapp?.available) channels.push('WHATSAPP');
      if (ruleChs.sms && pref.sms?.enabled && pref.sms?.available) channels.push('SMS');
    } else {
      // No preference for this event - use rule defaults
      if (ruleChs.inApp) channels.push('IN_APP');
      if (ruleChs.email) channels.push('EMAIL');
    }
  } else {
    // No preference - use rule defaults
    if (ruleChs.inApp) channels.push('IN_APP');
    if (ruleChs.email) channels.push('EMAIL');
  }
  
  return channels;
}

/**
 * Map domain events to moduleKey + eventType for rule matching.
 * 
 * Phase 16: Generic mapping based on module key.
 * This mapping determines which user rules to evaluate when a domain event occurs.
 * 
 * Also includes entityType for backward compatibility with legacy rules.
 */
const eventTypeMapping = {
  // Task events (if they exist in domainEvents)
  // For now, we'll use synthetic mappings
  'TASK_ASSIGNED': { moduleKey: 'tasks', entityType: 'TASK', eventType: 'ASSIGNED' },
  'TASK_STATUS_CHANGED': { moduleKey: 'tasks', entityType: 'TASK', eventType: 'STATUS_CHANGED' },
  'TASK_CREATED': { moduleKey: 'tasks', entityType: 'TASK', eventType: 'CREATED' },
  [domainEvents.PEOPLE_ASSIGNED]: { moduleKey: 'people', entityType: 'PEOPLE', eventType: 'ASSIGNED' },
  [domainEvents.DEAL_ASSIGNED]: { moduleKey: 'deals', entityType: 'DEAL', eventType: 'ASSIGNED' },
  [domainEvents.ORGANIZATION_ASSIGNED]: {
    moduleKey: 'organizations',
    entityType: 'ORGANIZATION',
    eventType: 'ASSIGNED'
  },
  
  // Audit events
  [domainEvents.AUDIT_ASSIGNED]: { moduleKey: 'audit', entityType: 'AUDIT', eventType: 'ASSIGNED' },
  [domainEvents.AUDIT_SUBMITTED]: { moduleKey: 'audit', entityType: 'AUDIT', eventType: 'STATUS_CHANGED' },
  [domainEvents.AUDIT_APPROVED]: { moduleKey: 'audit', entityType: 'AUDIT', eventType: 'STATUS_CHANGED' },
  [domainEvents.AUDIT_REJECTED]: { moduleKey: 'audit', entityType: 'AUDIT', eventType: 'STATUS_CHANGED' },
  [domainEvents.AUDIT_CHECKED_IN]: { moduleKey: 'audit', entityType: 'AUDIT', eventType: 'STATUS_CHANGED' },
  
  // Corrective action events
  [domainEvents.CORRECTIVE_ACTION_CREATED]: { moduleKey: 'corrective_action', entityType: 'CORRECTIVE_ACTION', eventType: 'CREATED' },
  [domainEvents.CORRECTIVE_ACTION_DUE_SOON]: { moduleKey: 'corrective_action', entityType: 'CORRECTIVE_ACTION', eventType: 'STATUS_CHANGED' },
  [domainEvents.CORRECTIVE_ACTION_OVERDUE]: { moduleKey: 'corrective_action', entityType: 'CORRECTIVE_ACTION', eventType: 'STATUS_CHANGED' }
};

/**
 * Evaluate rule conditions against entity using module metadata.
 * Returns true if all conditions match.
 * 
 * Phase 16: Generic condition evaluation using module helper.
 */
function evaluateConditions(rule, entity, moduleMetadata, userId) {
  if (!entity || !moduleMetadata) {
    return false; // Cannot evaluate without entity or metadata
  }

  const conditions = rule.conditions || {};

  // Check assignedTo condition
  if (conditions.assignedTo) {
    if (conditions.assignedTo === 'ME') {
      const assignedToUserId = getAssignedUserId(entity, moduleMetadata);
      if (!assignedToUserId || String(assignedToUserId) !== String(userId)) {
        return false; // Not assigned to me
      }
    }
    // If 'ANY', no check needed
  }

  // Check priority condition (generic)
  if (conditions.priority && Array.isArray(conditions.priority) && conditions.priority.length > 0) {
    const entityPriority = getPriority(entity, moduleMetadata);
    if (entityPriority && !conditions.priority.includes(entityPriority)) {
      return false; // Priority doesn't match
    }
    // If entity doesn't have priority field, condition fails (must match)
    if (!entityPriority) {
      return false;
    }
  }

  // Check status condition (generic)
  if (conditions.status && Array.isArray(conditions.status) && conditions.status.length > 0) {
    const entityStatus = getStatus(entity, moduleMetadata);
    if (entityStatus && !conditions.status.includes(entityStatus)) {
      return false; // Status doesn't match
    }
    // If entity doesn't have status field, condition fails (must match)
    if (!entityStatus) {
      return false;
    }
  }

  return true; // All conditions matched
}

/**
 * Evaluate user-defined notification rules for a domain event.
 * 
 * Phase 16: User-Defined Notification Rules
 * 
 * This function:
 * 1. Maps domain event to entityType + eventType
 * 2. Loads matching user rules
 * 3. Evaluates conditions
 * 4. Emits notifications via existing notification engine
 * 
 * GUARANTEES:
 * - Fully non-blocking (wrapped in try/catch)
 * - Never throws errors
 * - Honors existing deduplication
 * - Respects user preferences and channels
 * 
 * @param {Object} params
 * @param {String} params.eventType - Domain event type (e.g., 'AUDIT_ASSIGNED')
 * @param {Object} params.entity - Entity reference { type, id }
 * @param {ObjectId} params.organizationId - Organization ID
 * @param {ObjectId} params.triggeredBy - User who triggered the event
 * @param {String} params.sourceAppKey - App where event originated
 */
async function evaluateRules({ eventType, entity, organizationId, triggeredBy, sourceAppKey }) {
  // FAILURE ISOLATION: Never throw, always catch and log
  try {
    // Map domain event to moduleKey + eventType
    const mapping = eventTypeMapping[eventType];
    if (!mapping) {
      // Event doesn't map to any user rule type, skip
      debugLog('EventNotMapped', { eventType });
      return;
    }

    const { moduleKey, eventType: ruleEventType } = mapping;

    if (!entity?.id || !organizationId) {
      debugLog('MissingRequiredFields', { eventType, hasEntityId: !!entity?.id, hasOrgId: !!organizationId });
      return;
    }

    // Determine appKey from sourceAppKey or infer from moduleKey
    let appKey = sourceAppKey;
    if (!appKey) {
      // Default to SALES for most modules
      if (moduleKey === 'audit') {
        appKey = 'AUDIT';
      } else if (moduleKey === 'corrective_action') {
        appKey = 'PORTAL';
      } else {
        appKey = 'SALES';
      }
    }

    // Load module metadata
    const moduleMetadata = await getModuleMetadata(moduleKey, organizationId);
    if (!moduleMetadata) {
      debugLog('ModuleMetadataNotFound', { moduleKey, eventType });
      return;
    }

    // Load matching enabled rules
    // Phase 16: Support both moduleKey-based (new) and entityType-based (legacy) rules
    const rules = await NotificationRule.find({
      organizationId,
      appKey,
      $or: [
        { moduleKey: moduleKey }, // New generic rules
        { entityType: mapping.entityType } // Legacy rules (backward compatibility)
      ],
      eventType: ruleEventType,
      enabled: true
    }).select('userId conditions channels moduleKey entityType');

    if (!rules || rules.length === 0) {
      debugLog('NoMatchingRules', { eventType, moduleKey, appKey });
      console.log(`[notificationRuleEngine] ℹ️  No matching rules found for ${eventType} (module: ${moduleKey}, app: ${appKey})`);
      return;
    }

    console.log(`[notificationRuleEngine] 🔍 Found ${rules.length} matching rule(s) for ${eventType} (module: ${moduleKey})`);

    // Load entity for condition evaluation using generic helper
    const entityDoc = await loadEntity(moduleMetadata, entity.id, organizationId);
    if (!entityDoc) {
      debugLog('EntityNotFound', { moduleKey, entityId: entity.id });
      return;
    }

    // Debug: Log entity data
    debugLog('EntityLoaded', {
      moduleKey,
      entityId: entity.id,
      assignedTo: entityDoc.assignedTo ? String(entityDoc.assignedTo) : null,
      status: entityDoc.status,
      priority: entityDoc.priority
    });

    // Evaluate each rule
    for (const rule of rules) {
      try {
        // For legacy rules without moduleKey, use moduleKey from mapping
        const ruleModuleKey = rule.moduleKey || moduleKey;
        
        // Get module metadata for this rule (may be different if legacy rule)
        let ruleModuleMetadata = moduleMetadata;
        if (rule.moduleKey && rule.moduleKey !== moduleKey) {
          ruleModuleMetadata = await getModuleMetadata(rule.moduleKey, organizationId);
          if (!ruleModuleMetadata) {
            debugLog('RuleModuleMetadataNotFound', { ruleId: String(rule._id), moduleKey: rule.moduleKey });
            continue;
          }
        }

        // Evaluate conditions using generic helper
        const assignedToId = ruleModuleMetadata.fields?.assignedTo ? entityDoc[ruleModuleMetadata.fields.assignedTo] : null;
        debugLog('EvaluatingRule', {
          ruleId: String(rule._id),
          userId: String(rule.userId),
          ruleConditions: rule.conditions,
          entityAssignedTo: assignedToId ? String(assignedToId) : null,
          entityStatus: entityDoc.status,
          entityPriority: entityDoc.priority,
          matches: String(assignedToId) === String(rule.userId)
        });

        const matches = evaluateConditions(rule, entityDoc, ruleModuleMetadata, rule.userId);
        
        if (!matches) {
          debugLog('RuleConditionNotMet', {
            ruleId: String(rule._id),
            userId: String(rule.userId),
            eventType,
            moduleKey: ruleModuleKey,
            ruleConditions: rule.conditions,
            entityAssignedTo: assignedToId ? String(assignedToId) : null
          });
          continue;
        }

        debugLog('RuleMatched', {
          ruleId: String(rule._id),
          userId: String(rule.userId),
          eventType
        });
        console.log(`[notificationRuleEngine] ✅ Rule ${rule._id} matched conditions for user ${rule.userId}`);

        // Check if any channels are enabled
        const channels = rule.channels || {};
        const enabledChannels = [];
        if (channels.inApp) enabledChannels.push('IN_APP');
        if (channels.email) enabledChannels.push('EMAIL');
        if (channels.push) enabledChannels.push('PUSH');
        if (channels.whatsapp) enabledChannels.push('WHATSAPP');
        if (channels.sms) enabledChannels.push('SMS');

        if (enabledChannels.length === 0) {
          debugLog('NoChannelsEnabled', { ruleId: String(rule._id) });
          continue;
        }

        // Build notification title and body using generic helper
        const title = getTitle(entityDoc, ruleModuleMetadata);
        let body = '';
        
        const moduleDisplayName = ruleModuleMetadata.modelName || ruleModuleKey;
        const entityStatus = getStatus(entityDoc, ruleModuleMetadata);
        
        if (ruleEventType === 'ASSIGNED') {
          body = `${moduleDisplayName} "${title}" has been assigned to you.`;
        } else if (ruleEventType === 'STATUS_CHANGED') {
          body = `${moduleDisplayName} "${title}" status changed to ${entityStatus || 'unknown'}.`;
        } else if (ruleEventType === 'CREATED') {
          body = `New ${moduleDisplayName} "${title}" has been created.`;
        } else if (ruleEventType === 'DUE_SOON') {
          body = `${moduleDisplayName} "${title}" is due soon.`;
        } else {
          body = `${moduleDisplayName} "${title}" - ${ruleEventType.replace(/_/g, ' ').toLowerCase()}.`;
        }

        // Check deduplication
        const dedupKey = getDeduplicationKey(eventType, entity, rule.userId);
        if (isDuplicate(dedupKey)) {
          debugLog('RuleNotificationDedupe', {
            ruleId: String(rule._id),
            userId: String(rule.userId),
            eventType,
            entityId: entity?.id,
            dedupKey: dedupKey.substring(0, 8) + '...'
          });
          console.log(`[notificationRuleEngine] ⚠️ Notification deduplicated for rule ${rule._id} - event ${eventType} for user ${rule.userId} (60s window)`);
          continue;
        }

        debugLog('RuleNotificationNotDedupe', {
          ruleId: String(rule._id),
          userId: String(rule.userId),
          eventType,
          entityId: entity?.id
        });

        // Load user preferences
        let userPreference = null;
        try {
          await ensureDefaultPreferences(rule.userId, appKey);
          userPreference = await NotificationPreference.findOne({
            userId: rule.userId,
            appKey
          });
        } catch (prefErr) {
          console.error(`[notificationRuleEngine] Failed to load preferences for user ${rule.userId}:`, prefErr);
          // Continue with defaults
        }

        // Compute channels (intersect rule channels with user preferences)
        const channelsToUse = computeRuleChannels(rule.channels, userPreference, eventType);
        if (!channelsToUse || channelsToUse.length === 0) {
          debugLog('NoChannelsAfterPreference', { ruleId: String(rule._id) });
          continue;
        }

        // Create notifications for each channel
        const notificationsToPersist = [];
        for (const channel of channelsToUse) {
          notificationsToPersist.push({
            userId: rule.userId,
            organizationId,
            appKey,
            sourceAppKey,
            eventType,
            title,
            body,
            entity: entity ? { type: entity.type, id: entity.id } : undefined,
            channel,
            priority: 'NORMAL',
            source: 'USER_RULE',
            ruleId: rule._id
          });
        }

        // Persist notifications
        try {
          const saved = await Notification.insertMany(notificationsToPersist, { ordered: false });
          
          debugLog('RuleNotificationCreated', {
            ruleId: String(rule._id),
            userId: String(rule.userId),
            eventType,
            notificationCount: saved.length
          });

          console.log(`[notificationRuleEngine] ✅ Created ${saved.length} notification(s) for rule ${rule._id} - ${eventType} for user ${rule.userId}`);
          saved.forEach(n => {
            console.log(`   📬 Notification ${n._id}: ${n.title} (${n.channel})`);
          });

          const { deliverNotificationSSE } = require('./notificationSSEDeliver');
          for (const notification of saved) {
            if (notification.channel === 'IN_APP') {
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
              } catch (sseErr) {
                console.error(`[notificationRuleEngine] SSE publish failed for notification ${notification._id}:`, sseErr);
              }
            }
          }

          // Dispatch to channels (fire-and-forget)
          for (const notification of saved) {
            const channel = safeLoadChannel(notification.channel);
            if (!channel || typeof channel.send !== 'function') {
              continue;
            }
            
            try {
              // Fire-and-forget per notification
              channel.send({ notification }).catch(err => {
                console.error(`[notificationRuleEngine] Channel send failed for ${notification.channel}:`, err);
              });
            } catch (err) {
              console.error(`[notificationRuleEngine] Channel send threw synchronously:`, err);
            }
          }
          
        } catch (saveErr) {
          console.error(`[notificationRuleEngine] Failed to persist notifications for rule ${rule._id}:`, saveErr);
        }
        
      } catch (ruleErr) {
        // Never throw - log and continue with next rule
        console.error(`[notificationRuleEngine] Error evaluating rule ${rule._id}:`, ruleErr);
      }
    }
  } catch (err) {
    // Never throw - user rules never block business flows
    console.error('[notificationRuleEngine] Error in evaluateRules:', err);
  }
}

module.exports = {
  evaluateRules
};

