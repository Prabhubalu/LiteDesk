const NotificationRule = require('../models/NotificationRule');
const { validateModuleRule, getSupportedConditions } = require('../constants/notificationRuleRegistry');
const mongoose = require('mongoose');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL'];
const EVENT_TYPES = ['ASSIGNED', 'CREATED', 'STATUS_CHANGED', 'DUE_SOON'];

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

/**
 * Validate conditions against module's supported conditions.
 */
async function validateConditions(conditions, organizationId, appKey, moduleKey) {
  if (!conditions) {
    return { valid: true };
  }

  const supportedConditions = await getSupportedConditions(organizationId, appKey, moduleKey);
  const providedConditions = Object.keys(conditions).filter(key => conditions[key] !== undefined);

  for (const conditionKey of providedConditions) {
    if (!supportedConditions.includes(conditionKey)) {
      return { valid: false, message: `Condition "${conditionKey}" not supported by module "${moduleKey}". Supported: ${supportedConditions.join(', ')}` };
    }
  }

  return { valid: true };
}

/**
 * Validate channels object.
 */
function validateChannels(channels) {
  if (!channels || typeof channels !== 'object') {
    return { valid: false, message: 'channels must be an object' };
  }

  const validChannels = ['inApp', 'email', 'push', 'whatsapp', 'sms'];
  for (const key of Object.keys(channels)) {
    if (!validChannels.includes(key)) {
      return { valid: false, message: `Invalid channel: ${key}` };
    }
    if (typeof channels[key] !== 'boolean') {
      return { valid: false, message: `Channel ${key} must be a boolean` };
    }
  }

  // At least one channel must be enabled
  const hasEnabledChannel = validChannels.some(ch => channels[ch] === true);
  if (!hasEnabledChannel) {
    return { valid: false, message: 'At least one channel must be enabled' };
  }

  return { valid: true };
}

// GET /api/notification-rules
exports.listRules = async (req, res) => {
  try {
    const appKey = normalizeAppKey(req);
    if (!appKey) {
      return res.status(400).json({ success: false, message: 'appKey is required' });
    }

    const rules = await NotificationRule.find({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      appKey
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: rules.map(rule => ({
        id: String(rule._id),
        appKey: rule.appKey,
        moduleKey: rule.moduleKey,
        entityType: rule.entityType, // Legacy field for backward compatibility
        eventType: rule.eventType,
        conditions: rule.conditions,
        channels: rule.channels,
        enabled: rule.enabled,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      }))
    });
  } catch (err) {
    console.error('[notificationRuleController:listRules] Error:', err);
    console.error('Stack:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to list notification rules',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// POST /api/notification-rules
exports.createRule = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  const { moduleKey, entityType, eventType, conditions, channels } = req.body;

  // Validate required fields
  if (!moduleKey) {
    return res.status(400).json({ success: false, message: 'moduleKey is required' });
  }

  if (!eventType || !EVENT_TYPES.includes(eventType)) {
    return res.status(400).json({ success: false, message: `Valid eventType is required. Must be one of: ${EVENT_TYPES.join(', ')}` });
  }

  // Phase 16: Dynamic module validation
  const moduleValidation = await validateModuleRule(req.user.organizationId, appKey, moduleKey, eventType);
  if (!moduleValidation.valid) {
    return res.status(400).json({ success: false, message: moduleValidation.message });
  }

  // Validate conditions against module's supported conditions
  const conditionsValidation = await validateConditions(conditions, req.user.organizationId, appKey, moduleKey);
  if (!conditionsValidation.valid) {
    return res.status(400).json({ success: false, message: conditionsValidation.message });
  }

  // Validate channels
  const channelValidation = validateChannels(channels);
  if (!channelValidation.valid) {
    return res.status(400).json({ success: false, message: channelValidation.message });
  }

  // Validate condition values (structure validation)
  if (conditions) {
    if (conditions.assignedTo && !['ME', 'ANY'].includes(conditions.assignedTo)) {
      return res.status(400).json({ success: false, message: 'conditions.assignedTo must be "ME" or "ANY"' });
    }
    if (conditions.priority && (!Array.isArray(conditions.priority) || conditions.priority.length === 0)) {
      return res.status(400).json({ success: false, message: 'conditions.priority must be a non-empty array' });
    }
    if (conditions.status && (!Array.isArray(conditions.status) || conditions.status.length === 0)) {
      return res.status(400).json({ success: false, message: 'conditions.status must be a non-empty array' });
    }
  }

  try {
    // Check rule count limit
    const existingCount = await NotificationRule.countDocuments({
      userId: req.user._id,
      appKey
    });

    if (existingCount >= 10) {
      return res.status(400).json({ success: false, message: 'Maximum 10 notification rules allowed per user per app' });
    }

    // Determine entityType for backward compatibility (legacy rules may not have moduleKey)
    // For new rules, entityType can be derived from moduleKey or left null
    let derivedEntityType = entityType;
    if (!derivedEntityType && moduleKey) {
      // Map common module keys to entity types for backward compatibility
      const moduleToEntityMap = {
        'tasks': 'TASK',
        'audit': 'AUDIT',
        'corrective_action': 'CORRECTIVE_ACTION'
      };
      derivedEntityType = moduleToEntityMap[moduleKey.toLowerCase()];
    }

    const rule = await NotificationRule.create({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      appKey,
      moduleKey: moduleKey.toLowerCase(), // Normalize to lowercase
      entityType: derivedEntityType, // For backward compatibility
      eventType,
      conditions: conditions || {},
      channels: channels || { inApp: true, email: true, push: false, whatsapp: false, sms: false },
      enabled: true
    });

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const data = {
      id: String(rule._id),
      appKey: rule.appKey,
      moduleKey: rule.moduleKey,
      entityType: rule.entityType, // Legacy field for backward compatibility
      eventType: rule.eventType,
      conditions: rule.conditions,
      channels: rule.channels,
      enabled: rule.enabled,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    };
    attachSettingsAuditDiff(res, {}, cloneForAudit(data), { body: req.body || {} });

    return res.status(201).json({
      success: true,
      data
    });
  } catch (err) {
    console.error('[notificationRuleController:createRule] Error:', err);
    if (err.message && err.message.includes('Maximum 10')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Failed to create notification rule' });
  }
};

// PUT /api/notification-rules/:id
exports.updateRule = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  const ruleId = req.params.id;
  if (!mongoose.isValidObjectId(ruleId)) {
    return res.status(400).json({ success: false, message: 'Invalid rule id' });
  }

  const { conditions, channels, enabled } = req.body;

  try {
    const rule = await NotificationRule.findOne({
      _id: ruleId,
      userId: req.user._id,
      organizationId: req.user.organizationId,
      appKey
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Notification rule not found' });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit({
      conditions: rule.conditions,
      channels: rule.channels,
      enabled: rule.enabled
    });

    // Validate channels if provided
    if (channels !== undefined) {
      const channelValidation = validateChannels(channels);
      if (!channelValidation.valid) {
        return res.status(400).json({ success: false, message: channelValidation.message });
      }
      rule.channels = channels;
    }

    // Validate conditions if provided
    if (conditions !== undefined) {
      // Validate conditions against module's supported conditions
      const moduleKeyForValidation = rule.moduleKey || req.body.moduleKey;
      if (moduleKeyForValidation) {
        const conditionsValidation = await validateConditions(conditions, req.user.organizationId, appKey, moduleKeyForValidation);
        if (!conditionsValidation.valid) {
          return res.status(400).json({ success: false, message: conditionsValidation.message });
        }
      }

      // Structure validation
      if (conditions.assignedTo && !['ME', 'ANY'].includes(conditions.assignedTo)) {
        return res.status(400).json({ success: false, message: 'conditions.assignedTo must be "ME" or "ANY"' });
      }
      if (conditions.priority && (!Array.isArray(conditions.priority) || conditions.priority.length === 0)) {
        return res.status(400).json({ success: false, message: 'conditions.priority must be a non-empty array' });
      }
      if (conditions.status && (!Array.isArray(conditions.status) || conditions.status.length === 0)) {
        return res.status(400).json({ success: false, message: 'conditions.status must be a non-empty array' });
      }
      rule.conditions = conditions;
    }

    // Update enabled status if provided
    if (typeof enabled === 'boolean') {
      rule.enabled = enabled;
    }

    await rule.save();

    const after = cloneForAudit({
      conditions: rule.conditions,
      channels: rule.channels,
      enabled: rule.enabled
    });
    attachSettingsAuditDiff(res, before, after, { body: req.body || {} });

    return res.json({
      success: true,
      data: {
        id: String(rule._id),
        appKey: rule.appKey,
        moduleKey: rule.moduleKey,
        entityType: rule.entityType, // Legacy field for backward compatibility
        eventType: rule.eventType,
        conditions: rule.conditions,
        channels: rule.channels,
        enabled: rule.enabled,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      }
    });
  } catch (err) {
    console.error('[notificationRuleController:updateRule] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update notification rule' });
  }
};

// DELETE /api/notification-rules/:id
exports.deleteRule = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  const ruleId = req.params.id;
  if (!mongoose.isValidObjectId(ruleId)) {
    return res.status(400).json({ success: false, message: 'Invalid rule id' });
  }

  try {
    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const existing = await NotificationRule.findOne({
      _id: ruleId,
      userId: req.user._id,
      organizationId: req.user.organizationId,
      appKey
    }).lean();

    const rule = await NotificationRule.findOneAndDelete({
      _id: ruleId,
      userId: req.user._id,
      organizationId: req.user.organizationId,
      appKey
    });

    if (!rule) {
      // Do not leak existence; treat as success
      return res.json({ success: true });
    }

    attachSettingsAuditDiff(
      res,
      cloneForAudit({
        moduleKey: existing?.moduleKey,
        eventType: existing?.eventType,
        enabled: existing?.enabled
      }),
      {},
      { keys: ['moduleKey', 'eventType', 'enabled'] }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[notificationRuleController:deleteRule] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete notification rule' });
  }
};

// POST /api/notification-rules/:id/toggle
exports.toggleRule = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  const ruleId = req.params.id;
  if (!mongoose.isValidObjectId(ruleId)) {
    return res.status(400).json({ success: false, message: 'Invalid rule id' });
  }

  try {
    const rule = await NotificationRule.findOne({
      _id: ruleId,
      userId: req.user._id,
      organizationId: req.user.organizationId,
      appKey
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Notification rule not found' });
    }

    const { attachSettingsAuditDiff } = require('../utils/settingsAuditSnapshot');
    const beforeEnabled = !!rule.enabled;
    rule.enabled = !rule.enabled;
    await rule.save();

    attachSettingsAuditDiff(
      res,
      { enabled: beforeEnabled },
      { enabled: rule.enabled },
      { keys: ['enabled'] }
    );

    return res.json({
      success: true,
      data: {
        id: String(rule._id),
        enabled: rule.enabled
      }
    });
  } catch (err) {
    console.error('[notificationRuleController:toggleRule] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to toggle notification rule' });
  }
};

