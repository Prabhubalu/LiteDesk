/**
 * ============================================================================
 * PLATFORM CORE: Module Definition Model (Platform Metadata)
 * ============================================================================
 * 
 * This model defines platform-level metadata about modules:
 * - What modules belong to each app
 * - Module behavior (people/org usage, lifecycle, permissions, automation)
 * - Module capabilities and constraints
 * 
 * ⚠️ This is PLATFORM metadata, NOT tenant data
 * ⚠️ No business logic, no UI, no automation
 * ⚠️ Required for multi-app architecture
 * 
 * NOTE: This replaces the previous tenant-specific ModuleDefinition.
 * Tenant-specific module configurations (fields, pipelines) should use
 * a separate model (e.g., TenantModuleConfiguration).
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');

const ModuleDefinitionSchema = new mongoose.Schema({
  moduleKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },

  appKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },

  label: {
    type: String,
    required: true,
    trim: true
  },

  pluralLabel: {
    type: String,
    required: true,
    trim: true
  },

  entityType: {
    type: String,
    enum: ['CORE', 'TRANSACTION', 'ACTIVITY'],
    required: true
  },

  primaryField: {
    type: String,
    default: 'name'
  },

  peopleConstraints: {
    allowedTypes: {
      type: [String], // Lead, Contact
      default: []
    },
    required: {
      type: Boolean,
      default: false
    }
  },

  organizationConstraints: {
    required: {
      type: Boolean,
      default: false
    }
  },

  lifecycle: {
    statusField: {
      type: String,
      trim: true
    },
    allowedStatuses: {
      type: [String],
      default: []
    },
    // Phase 0I.1: Execution domain metadata
    executionDriven: {
      type: Boolean,
      default: false
    },
    immutableAfter: {
      type: String,
      trim: true
      // e.g., "executionStatus:Submitted"
    }
  },

  supports: {
    ownership: { 
      type: Boolean, 
      default: true 
    },
    assignment: { 
      type: Boolean, 
      default: true 
    },
    comments: { 
      type: Boolean, 
      default: true 
    },
    attachments: { 
      type: Boolean, 
      default: true 
    },
    automation: { 
      type: Boolean, 
      default: true 
    },
    // Phase 0I.1: Execution domain capabilities
    correctiveActions: {
      type: Boolean,
      default: false
    },
    approvalFlow: {
      type: Boolean,
      default: false
    },
    auditReview: {
      type: Boolean,
      default: false
    },
    reporting: {
      type: Boolean,
      default: false
    }
  },

  permissions: {
    create: { 
      type: Boolean, 
      default: true 
    },
    edit: { 
      type: Boolean, 
      default: true 
    },
    delete: { 
      type: Boolean, 
      default: false 
    },
    view: { 
      type: Boolean, 
      default: true 
    },
    // Phase 0I.1: Execution domain permissions
    execution: {
      type: Boolean,
      default: false
    },
    review: {
      type: Boolean,
      default: false
    },
    approve: {
      type: Boolean,
      default: false
    }
  },

  // Phase 0D: UI Composition Metadata
  ui: {
    routeBase: {
      type: String,
      trim: true
      // e.g., "/sales/deals" or "/people"
    },
    icon: {
      type: String,
      trim: true
    },
    showInSidebar: {
      type: Boolean,
      default: true
    },
    sidebarOrder: {
      type: Number,
      default: 0
    },
    createLabel: {
      type: String,
      trim: true
      // e.g., "Create Deal"
    },
    listLabel: {
      type: String,
      trim: true
      // e.g., "All Deals"
    },
    // Phase 0I.1: Tab display metadata
    showAsTabUnder: {
      type: [String],
      default: []
      // e.g., ['forms'] - shows Responses tab under Forms
    },
    // Navigation Intent Flags (for four-section sidebar)
    navigationCore: {
      type: Boolean,
      default: false
      // If true, place in Core section (personal/attention layer)
      // Cannot be set with appKey
    },
    navigationEntity: {
      type: Boolean,
      default: false
      // If true, place in Entities section (shared system primitives)
      // Cannot be set with appKey
    },
    excludeFromApps: {
      type: Boolean,
      default: false
      // If true, hard stop - never appear in Apps section
      // Typically used with navigationEntity for core entities
    }
  },

  // Phase 2A.1: Projection Metadata (Optional)
  // Declares that this module is a projection of a platform-owned primitive
  projection: {
    enabled: {
      type: Boolean,
      default: false
    },
    basePrimitive: {
      type: String,
      trim: true,
      lowercase: true
      // e.g., 'people', 'organizations', 'events', 'forms'
      // References the base primitive module key
    }
  },

  // Tenant-specific overrides (for organization-specific module configurations)
  // These fields are used when organizationId is present (tenant override)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    sparse: true // Allow null for platform-level definitions
    // index: true removed - using explicit indexes below instead
  },
  key: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true // Allow null for platform-level definitions
    // index: true removed - using explicit indexes below instead
  },
  type: {
    type: String,
    enum: ['system', 'custom'],
    default: 'system'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  name: String,
  fields: [{
    type: mongoose.Schema.Types.Mixed
  }],
  relationships: [{
    type: mongoose.Schema.Types.Mixed
  }],
  quickCreate: {
    type: [String],
    default: [],
    select: false // Excluded by default, use +quickCreate to include
  },
  quickCreateLayout: {
    type: mongoose.Schema.Types.Mixed,
    default: { version: 1, rows: [] },
    select: false // Excluded by default, use +quickCreateLayout to include
  },
  /**
   * Field Configuration layout (settings UI only).
   * Orthogonal to ownership axes (core/participation/system | platform/app/org).
   * sections[] + field.sectionId place fields in admin-managed blocks.
   */
  fieldLayout: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  pipelineSettings: [{
    type: mongoose.Schema.Types.Mixed
  }]
}, { 
  timestamps: true,
  strict: false // Allow additional fields for tenant-specific overrides
});

// Compound unique index for appKey + moduleKey (platform-level only)
// Partial: only applies when organizationId is null (platform-level modules)
ModuleDefinitionSchema.index({ appKey: 1, moduleKey: 1 }, { unique: true, partialFilterExpression: { organizationId: null } });
ModuleDefinitionSchema.index({ appKey: 1 });

// Indexes for tenant-specific overrides
ModuleDefinitionSchema.index({ organizationId: 1, key: 1 }, { unique: true, sparse: true });

// Auto-activate pending default relationships when modules become available
ModuleDefinitionSchema.post('save', async function(doc) {
  try {
    if (!doc || doc.organizationId || doc.enabled === false) {
      return;
    }

    const {
      registerDefaultTaskRelationships,
      activatePendingRelationshipsForModule
    } = require('../services/taskRelationshipInitializer');

    if (doc.appKey === 'platform' && doc.moduleKey === 'tasks') {
      await registerDefaultTaskRelationships();
    }

    await activatePendingRelationshipsForModule(doc.appKey, doc.moduleKey);
  } catch (error) {
    console.error('[ModuleDefinition] Error handling relationship activation:', error);
  }
});

module.exports = mongoose.model('ModuleDefinition', ModuleDefinitionSchema);
