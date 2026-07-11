const Task = require('../models/Task');
const People = require('../models/People');
const Deal = require('../models/Deal');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Event = require('../models/Event');
const ModuleDefinition = require('../models/ModuleDefinition');

/**
 * Module metadata helper for notification rules.
 * 
 * Phase 16: Provides generic module information for rule evaluation.
 * Removes hardcoded module logic from rule engine.
 */

// Module metadata mapping: moduleKey -> { model, fieldMapping }
const MODULE_METADATA = {
  'tasks': {
    model: Task,
    modelName: 'Task',
    fields: {
      assignedTo: 'assignedTo',
      status: 'status',
      priority: 'priority',
      title: 'title'
    },
    statusValues: ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'],
    priorityValues: ['low', 'medium', 'high', 'urgent']
  },
  'people': {
    model: People,
    modelName: 'People',
    fields: {
      assignedTo: 'assignedTo',
      status: 'derivedStatus',
      priority: null,
      title: 'first_name'
    },
    statusValues: [],
    priorityValues: []
  },
  'deals': {
    model: Deal,
    modelName: 'Deal',
    fields: {
      assignedTo: 'assignedTo',
      status: 'status',
      priority: 'priority',
      title: 'name'
    },
    statusValues: ['Open', 'Won', 'Lost'],
    priorityValues: ['Low', 'Medium', 'High', 'Urgent']
  },
  /**
   * CRM company/partner/vendor record (Organization model, isTenant: false).
   * Scoped to tenant via createdBy user belonging to organizationId.
   */
  'organizations': {
    model: Organization,
    modelName: 'CrmOrganization',
    loadByCreatedByTenant: true,
    fields: {
      assignedTo: 'assignedTo',
      status: 'derivedStatus',
      priority: null,
      title: 'name'
    },
    statusValues: [],
    priorityValues: []
  },
  'audit': {
    model: Event,
    modelName: 'Event',
    fields: {
      assignedTo: null, // Uses formAssignment.assignedAuditor or auditorId or assignedTo
      status: 'auditState',
      priority: null,
      title: 'eventName'
    },
    statusValues: ['Ready to start', 'checked_in', 'submitted', 'pending_corrective', 'needs_review', 'approved', 'rejected', 'closed'],
    priorityValues: []
  }
  // More modules can be added here dynamically
};

/**
 * Get module metadata for a module key.
 * Falls back to ModuleDefinition if not in static mapping.
 */
async function getModuleMetadata(moduleKey, organizationId) {
  // Check static mapping first
  if (MODULE_METADATA[moduleKey.toLowerCase()]) {
    return MODULE_METADATA[moduleKey.toLowerCase()];
  }

  // For dynamic modules, try to load from ModuleDefinition
  // This allows future modules to work without code changes
  try {
    const moduleDef = await ModuleDefinition.findOne({
      organizationId,
      key: moduleKey.toLowerCase(),
      enabled: true
    });

    if (moduleDef) {
      // For now, return basic metadata
      // Future: Could derive field mappings from module definition fields
      return {
        model: null, // Unknown model - will need to be determined
        modelName: moduleDef.name,
        fields: {
          assignedTo: 'assignedTo', // Default assumption
          status: 'status', // Default assumption
          priority: 'priority', // Default assumption
          title: 'name' // Default assumption
        },
        statusValues: [],
        priorityValues: []
      };
    }
  } catch (err) {
    console.error(`[notificationRuleModuleHelper] Error loading module definition for ${moduleKey}:`, err);
  }

  return null;
}

/**
 * Load entity for evaluation based on module metadata.
 */
async function loadEntity(moduleMetadata, entityId, organizationId) {
  if (!moduleMetadata || !moduleMetadata.model) {
    return null;
  }

  try {
    const fieldsToSelect = [];

    if (moduleMetadata.fields.assignedTo) {
      fieldsToSelect.push(moduleMetadata.fields.assignedTo);
    }
    if (moduleMetadata.fields.status) {
      fieldsToSelect.push(moduleMetadata.fields.status);
    }
    if (moduleMetadata.fields.priority) {
      fieldsToSelect.push(moduleMetadata.fields.priority);
    }
    if (moduleMetadata.fields.title) {
      fieldsToSelect.push(moduleMetadata.fields.title);
    }

    if (moduleMetadata.modelName === 'Event') {
      fieldsToSelect.push('formAssignment', 'auditorId', 'assignedTo');
    }

    if (moduleMetadata.loadByCreatedByTenant) {
      fieldsToSelect.push('createdBy');
      const selectFields =
        fieldsToSelect.length > 0 ? `_id ${fieldsToSelect.join(' ')}` : '_id createdBy';

      const entity = await moduleMetadata.model
        .findOne({
          _id: entityId,
          isTenant: false
        })
        .select(selectFields);

      if (!entity || !entity.createdBy || !organizationId) {
        return null;
      }
      const allowed = await User.exists({ _id: entity.createdBy, organizationId });
      return allowed ? entity : null;
    }

    const selectFields =
      fieldsToSelect.length > 0
        ? '_id organizationId ' + fieldsToSelect.join(' ')
        : '_id organizationId';

    const entity = await moduleMetadata.model
      .findOne({
        _id: entityId,
        organizationId
      })
      .select(selectFields);

    return entity;
  } catch (err) {
    console.error(`[notificationRuleModuleHelper] Error loading entity for ${moduleMetadata.modelName}:`, err);
    return null;
  }
}

/**
 * Get assigned user ID from entity based on module metadata.
 */
function getAssignedUserId(entity, moduleMetadata) {
  if (!entity || !moduleMetadata) {
    return null;
  }

  const assignedToField = moduleMetadata.fields.assignedTo;

  if (moduleMetadata.modelName === 'Event') {
    // Special handling for audit/event
    return entity.formAssignment?.assignedAuditor || entity.auditorId || entity.assignedTo;
  }

  if (assignedToField && entity[assignedToField]) {
    return entity[assignedToField];
  }

  return null;
}

/**
 * Get status value from entity based on module metadata.
 */
function getStatus(entity, moduleMetadata) {
  if (!entity || !moduleMetadata) {
    return null;
  }

  const statusField = moduleMetadata.fields.status;
  if (statusField && entity[statusField]) {
    return entity[statusField];
  }

  return null;
}

/**
 * Get priority value from entity based on module metadata.
 */
function getPriority(entity, moduleMetadata) {
  if (!entity || !moduleMetadata) {
    return null;
  }

  const priorityField = moduleMetadata.fields.priority;
  if (priorityField && entity[priorityField]) {
    return entity[priorityField];
  }

  return null;
}

/**
 * Get title/name from entity based on module metadata.
 */
function getTitle(entity, moduleMetadata) {
  if (!entity || !moduleMetadata) {
    return 'Entity';
  }

  const titleField = moduleMetadata.fields.title;
  if (titleField && entity[titleField]) {
    return entity[titleField];
  }

  return moduleMetadata.modelName || 'Entity';
}

module.exports = {
  getModuleMetadata,
  loadEntity,
  getAssignedUserId,
  getStatus,
  getPriority,
  getTitle,
  MODULE_METADATA
};

