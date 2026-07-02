/**
 * ============================================================================
 * PLATFORM CORE: Tenant Module Configuration Model
 * ============================================================================
 * 
 * This model defines tenant-level (organization) module configuration:
 * - How a module behaves within a tenant & app context
 * - Module enablement per tenant/app
 * - Module-specific settings (label overrides, people mode, UI settings)
 * - Required relationships for the module
 * 
 * ⚠️ This is TENANT configuration, NOT platform metadata
 * ⚠️ References platform ModuleDefinition for module capabilities
 * ⚠️ Must not duplicate platform metadata
 * 
 * Relationship:
 * - TenantModuleConfiguration references ModuleDefinition (appKey, moduleKey)
 * - One TenantModuleConfiguration per (organizationId, appKey, moduleKey) combination
 * 
 * People Mode:
 * - 'LEAD': Module uses people as Leads only
 * - 'CONTACT': Module uses people as Contacts only
 * - 'BOTH': Module uses people as both Leads and Contacts
 * - null/undefined: Inherits from platform ModuleDefinition
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');

const TenantModuleConfigurationSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  appKey: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    enum: ['SALES', 'HELPDESK', 'PROJECTS', 'AUDIT', 'PORTAL', 'LMS', 'INVENTORY', 'MARKETING'],
    index: true
  },

  moduleKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },

  enabled: {
    type: Boolean,
    default: true,
    index: true
  },

  labelOverride: {
    type: String,
    trim: true
  },

  peopleMode: {
    type: String,
    enum: ['LEAD', 'CONTACT', 'BOTH'],
    default: null
  },

  requiredRelationships: [{
    type: String, // relationshipKeys from RelationshipDefinition
    trim: true
  }],

  ui: {
    showInSidebar: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: null
    },
    // Phase 0D: Additional UI Overrides
    sidebarOrder: {
      type: Number,
      default: null
    }
  },

  // Module-specific settings (e.g., organization status-types configuration)
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index for (organizationId + appKey + moduleKey)
TenantModuleConfigurationSchema.index(
  { organizationId: 1, appKey: 1, moduleKey: 1 },
  { unique: true }
);

// Index for enabled modules lookup
TenantModuleConfigurationSchema.index({ organizationId: 1, appKey: 1, enabled: 1 });

// Index for UI ordering
TenantModuleConfigurationSchema.index({ organizationId: 1, appKey: 1, 'ui.order': 1 });

// Pre-save hook to update updatedAt
TenantModuleConfigurationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-update hook to update updatedAt
TenantModuleConfigurationSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('TenantModuleConfiguration', TenantModuleConfigurationSchema);

