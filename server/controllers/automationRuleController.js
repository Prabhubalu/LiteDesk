/**
 * ============================================================================
 * PLATFORM CORE: Automation Rule Controller
 * ============================================================================
 *
 * CRUD endpoints for AutomationRule management (Admin only).
 * Includes validation and preview functionality.
 *
 * ============================================================================
 */

const AutomationRule = require('../models/AutomationRule');
const { processEvent } = require('../services/automationEngine');
const { createLogger } = require('../services/automationLogger');
const {
  CATEGORY_LABELS,
  getEventMetadata,
  buildPreviewTestEvent
} = require('../constants/automationEventMetadata');

const log = createLogger('automationRuleController');

// Known domain event types
const DOMAIN_EVENT_TYPES = [
  // People events
  'people.lifecycle.changed',
  'people.sales_type.changed',
  // Organization events
  'organization.lifecycle.changed',
  'organization.type.changed',
  // Deal events
  'deal.stage.changed',
  'deal.pipeline.changed',
  'deal.deal.won',
  'deal.deal.lost',
  // Appointment / event booking
  'appointment.created',
  'appointment.updated',
  'appointment.completed',
  'appointment.cancelled',
  'appointment.no_show',
  // Webform events
  'webform.submission.processed'
];

// Known action types
const ACTION_TYPES = ['create_task', 'notify_user'];

// Known app keys
const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL'];

// Known entity types
const ENTITY_TYPES = ['people', 'organization', 'deal', 'events', 'webform_submission'];

/**
 * Validate trigger schema
 */
function validateTrigger(trigger) {
  if (!trigger || typeof trigger !== 'object') {
    return { valid: false, error: 'Trigger is required' };
  }
  if (!trigger.eventType || typeof trigger.eventType !== 'string') {
    return { valid: false, error: 'Trigger eventType is required' };
  }
  if (!DOMAIN_EVENT_TYPES.includes(trigger.eventType)) {
    return { valid: false, error: `Invalid eventType: ${trigger.eventType}` };
  }
  // Condition is optional, but if present should be an object
  if (trigger.condition !== null && trigger.condition !== undefined && typeof trigger.condition !== 'object') {
    return { valid: false, error: 'Trigger condition must be an object or null' };
  }
  return { valid: true };
}

/**
 * Validate action schema
 */
function validateAction(action) {
  if (!action || typeof action !== 'object') {
    return { valid: false, error: 'Action is required' };
  }
  if (!action.type || typeof action.type !== 'string') {
    return { valid: false, error: 'Action type is required' };
  }
  if (!ACTION_TYPES.includes(action.type)) {
    return { valid: false, error: `Invalid action type: ${action.type}` };
  }
  
  // Validate action params based on type
  if (action.type === 'create_task') {
    if (!action.params || typeof action.params !== 'object') {
      return { valid: false, error: 'create_task requires params object' };
    }
    if (!action.params.title || typeof action.params.title !== 'string' || !action.params.title.trim()) {
      return { valid: false, error: 'create_task requires non-empty title' };
    }
    if (action.params.dueInDays !== undefined && (typeof action.params.dueInDays !== 'number' || action.params.dueInDays < 0)) {
      return { valid: false, error: 'create_task dueInDays must be a non-negative number' };
    }
    if (action.params.assignee !== undefined && !['owner', 'triggeredBy'].includes(action.params.assignee)) {
      return { valid: false, error: 'create_task assignee must be "owner" or "triggeredBy"' };
    }
    if (action.params.relatedEntity !== undefined) {
      if (typeof action.params.relatedEntity !== 'object' || !action.params.relatedEntity.entityType) {
        return { valid: false, error: 'create_task relatedEntity must have entityType' };
      }
      if (!ENTITY_TYPES.includes(action.params.relatedEntity.entityType)) {
        return { valid: false, error: `Invalid relatedEntity.entityType: ${action.params.relatedEntity.entityType}` };
      }
    }
  } else if (action.type === 'notify_user') {
    if (!action.params || typeof action.params !== 'object') {
      return { valid: false, error: 'notify_user requires params object' };
    }
    if (!action.params.message || typeof action.params.message !== 'string' || !action.params.message.trim()) {
      return { valid: false, error: 'notify_user requires non-empty message' };
    }
    if (action.params.recipient !== undefined && !['owner', 'triggeredBy'].includes(action.params.recipient)) {
      return { valid: false, error: 'notify_user recipient must be "owner" or "triggeredBy"' };
    }
  }
  
  return { valid: true };
}

/**
 * Validate full rule schema
 */
function validateRule(rule) {
  if (!rule.name || typeof rule.name !== 'string' || !rule.name.trim()) {
    return { valid: false, error: 'Name is required' };
  }
  if (rule.appKey && !APP_KEYS.includes(rule.appKey.toUpperCase())) {
    return { valid: false, error: `Invalid appKey: ${rule.appKey}` };
  }
  if (rule.entityType && !ENTITY_TYPES.includes(rule.entityType.toLowerCase())) {
    return { valid: false, error: `Invalid entityType: ${rule.entityType}` };
  }
  
  const triggerValidation = validateTrigger(rule.trigger);
  if (!triggerValidation.valid) {
    return triggerValidation;
  }
  
  const actionValidation = validateAction(rule.action);
  if (!actionValidation.valid) {
    return actionValidation;
  }
  
  return { valid: true };
}

/**
 * @route   GET /api/admin/automation-rules
 * @desc    Get all automation rules (admin only)
 * @access  Private (Admin only)
 */
exports.getAllRules = async (req, res) => {
  try {
    const { appKey, entityType, enabled } = req.query;
    const query = {};
    
    if (appKey) query.appKey = appKey.toUpperCase();
    if (entityType) query.entityType = entityType.toLowerCase();
    if (enabled !== undefined) query.enabled = enabled === 'true';
    
    // For now, only show global rules (organizationId: null) or rules for user's org
    // Admin can see all, but we scope to user's org for safety
    query.$or = [
      { organizationId: null },
      { organizationId: req.user.organizationId }
    ];
    
    const rules = await AutomationRule.find(query)
      .sort({ order: 1, createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    log.error('get_all_rules_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching automation rules',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/automation-rules/:id
 * @desc    Get single automation rule
 * @access  Private (Admin only)
 */
exports.getRuleById = async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    }).lean();
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Automation rule not found'
      });
    }
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    log.error('get_rule_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching automation rule',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/automation-rules
 * @desc    Create new automation rule
 * @access  Private (Admin only)
 */
exports.createRule = async (req, res) => {
  try {
    const validation = validateRule(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }
    
    const ruleData = {
      name: req.body.name.trim(),
      description: req.body.description?.trim() || '',
      appKey: (req.body.appKey || 'SALES').toUpperCase(),
      entityType: req.body.entityType?.toLowerCase() || null,
      organizationId: req.body.organizationId || req.user.organizationId || null,
      enabled: req.body.enabled !== undefined ? req.body.enabled : true,
      trigger: {
        eventType: req.body.trigger.eventType,
        condition: req.body.trigger.condition || null
      },
      action: {
        type: req.body.action.type,
        params: req.body.action.params || null
      },
      order: req.body.order || 0,
      respectBusinessHours: Boolean(req.body.respectBusinessHours)
    };
    
    const rule = await AutomationRule.create(ruleData);

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    attachSettingsAuditDiff(res, {}, cloneForAudit(rule.toObject()), { body: req.body || {} });
    
    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    log.error('create_rule_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error creating automation rule',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/admin/automation-rules/:id
 * @desc    Update automation rule
 * @access  Private (Admin only)
 */
exports.updateRule = async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Automation rule not found'
      });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit(rule.toObject());
    
    // Validate if trigger/action are being updated
    const updateData = { ...req.body };
    if (updateData.trigger || updateData.action) {
      const fullRule = { ...rule.toObject(), ...updateData };
      const validation = validateRule(fullRule);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
    }
    
    // Update allowed fields
    if (updateData.name !== undefined) rule.name = updateData.name.trim();
    if (updateData.description !== undefined) rule.description = updateData.description?.trim() || '';
    if (updateData.appKey !== undefined) rule.appKey = updateData.appKey.toUpperCase();
    if (updateData.entityType !== undefined) rule.entityType = updateData.entityType?.toLowerCase() || null;
    if (updateData.enabled !== undefined) rule.enabled = updateData.enabled;
    if (updateData.trigger !== undefined) {
      rule.trigger = {
        eventType: updateData.trigger.eventType,
        condition: updateData.trigger.condition || null
      };
    }
    if (updateData.action !== undefined) {
      rule.action = {
        type: updateData.action.type,
        params: updateData.action.params || null
      };
    }
    if (updateData.order !== undefined) rule.order = updateData.order;
    if (updateData.respectBusinessHours !== undefined) {
      rule.respectBusinessHours = Boolean(updateData.respectBusinessHours);
    }
    
    await rule.save();

    attachSettingsAuditDiff(res, before, cloneForAudit(rule.toObject()), { body: req.body || {} });
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    log.error('update_rule_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error updating automation rule',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/admin/automation-rules/:id
 * @desc    Delete automation rule (soft delete via enabled=false)
 * @access  Private (Admin only)
 */
exports.deleteRule = async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Automation rule not found'
      });
    }
    
    // Soft delete: set enabled=false
    const { attachSettingsAuditDiff } = require('../utils/settingsAuditSnapshot');
    const beforeEnabled = !!rule.enabled;
    rule.enabled = false;
    await rule.save();

    attachSettingsAuditDiff(res, { enabled: beforeEnabled }, { enabled: false }, { keys: ['enabled'] });
    
    res.json({
      success: true,
      message: 'Automation rule disabled (soft deleted)'
    });
  } catch (error) {
    log.error('delete_rule_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error deleting automation rule',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/automation-rules/:id/toggle
 * @desc    Toggle enabled/disabled state
 * @access  Private (Admin only)
 */
exports.toggleRule = async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Automation rule not found'
      });
    }
    
    const { attachSettingsAuditDiff } = require('../utils/settingsAuditSnapshot');
    const beforeEnabled = !!rule.enabled;
    rule.enabled = !rule.enabled;
    await rule.save();

    attachSettingsAuditDiff(res, { enabled: beforeEnabled }, { enabled: rule.enabled }, { keys: ['enabled'] });
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    log.error('toggle_rule_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error toggling automation rule',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/automation-rules/preview
 * @desc    Preview what actions would be planned for a test event
 * @access  Private (Admin only)
 */
exports.previewRule = async (req, res) => {
  try {
    const { rule, testEvent } = req.body;
    
    // Validate rule
    const validation = validateRule(rule);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }
    
    // Build test event if not provided
    const event =
      testEvent ||
      buildPreviewTestEvent(rule, {
        organizationId: req.user.organizationId,
        userId: req.user._id
      });
    
    // Temporarily create the rule in DB for preview (then delete it)
    let tempRuleId = null;
    try {
      const tempRule = await AutomationRule.create({
        ...rule,
        name: rule.name + ' (Preview)',
        enabled: true
      });
      tempRuleId = tempRule._id;
      
      // Process event with the temp rule
      const result = await processEvent(event);
      
      // Delete temp rule
      await AutomationRule.deleteOne({ _id: tempRuleId });
      
      res.json({
        success: true,
        data: {
          testEvent: event,
          plan: result.plan,
          executed: result.executed,
          skipped: result.skipped,
          failed: result.failed
        }
      });
    } catch (err) {
      // Cleanup temp rule if it exists
      if (tempRuleId) {
        try {
          await AutomationRule.deleteOne({ _id: tempRuleId });
        } catch (_) {}
      }
      throw err;
    }
  } catch (error) {
    log.error('preview_rule_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error previewing automation rule',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/automation-rules/metadata/event-types
 * @desc    Get list of available domain event types
 * @access  Private (Admin only)
 */
exports.getEventTypes = async (req, res) => {
  res.json({
    success: true,
    data: DOMAIN_EVENT_TYPES.map((type) => {
      const meta = getEventMetadata(type);
      return {
        value: type,
        label: meta.label,
        category: meta.category,
        categoryLabel: CATEGORY_LABELS[meta.category] || 'Other',
        suggestedEntityType: meta.suggestedEntityType,
        conditionFields: meta.conditionFields
      };
    }),
    categories: CATEGORY_LABELS
  });
};

/**
 * @route   GET /api/admin/automation-rules/metadata/action-types
 * @desc    Get list of available action types with their param schemas
 * @access  Private (Admin only)
 */
exports.getActionTypes = async (req, res) => {
  res.json({
    success: true,
    data: {
      create_task: {
        params: {
          title: { type: 'string', required: true, label: 'Task Title' },
          description: { type: 'string', required: false, label: 'Description' },
          dueInDays: { type: 'number', required: false, label: 'Due In (Days)', min: 0 },
          assignee: { type: 'select', required: false, label: 'Assign To', options: ['owner', 'triggeredBy'], default: 'triggeredBy' },
          relatedEntity: {
            type: 'object',
            required: false,
            label: 'Related Entity',
            fields: {
              entityType: { type: 'select', required: true, label: 'Entity Type', options: ENTITY_TYPES },
              entityId: { type: 'string', required: false, label: 'Entity ID (use "__trigger__" for event entity)' }
            }
          }
        }
      },
      notify_user: {
        params: {
          message: { type: 'string', required: true, label: 'Message' },
          recipient: { type: 'select', required: false, label: 'Recipient', options: ['owner', 'triggeredBy'], default: 'triggeredBy' }
        }
      }
    }
  });
};
