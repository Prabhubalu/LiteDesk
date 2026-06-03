/**
 * ============================================================================
 * PLATFORM CORE: Tenant App Configuration Model
 * ============================================================================
 * 
 * This model defines tenant-level (organization) app configuration:
 * - Which apps are enabled for the tenant
 * - App-specific settings and overrides
 * - Feature toggles per app
 * 
 * ⚠️ This is TENANT configuration, NOT platform metadata
 * ⚠️ References platform AppDefinition for app capabilities
 * ⚠️ Must not duplicate platform metadata
 * 
 * Relationship:
 * - TenantAppConfiguration references AppDefinition.appKey
 * - One TenantAppConfiguration per (organizationId, appKey) combination
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');

const TenantAppConfigurationSchema = new mongoose.Schema({
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
    enum: ['SALES', 'HELPDESK', 'PROJECTS', 'AUDIT', 'PORTAL', 'LMS', 'INVENTORY'],
    index: true
  },

  enabled: {
    type: Boolean,
    default: true,
    index: true
  },

  settings: {
    labelOverrides: {
      type: mongoose.Schema.Types.Mixed, // Object with key-value pairs
      default: null
    },
    featureToggles: {
      type: mongoose.Schema.Types.Mixed, // Object with key-value pairs
      default: null
    },
    /** Helpdesk SLA, channel rules, canned responses/macros, etc. */
    helpdeskExecution: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    // Backward-compatible flat mirrors (legacy readers)
    slaPriorityTargets: { type: mongoose.Schema.Types.Mixed, default: null },
    businessHours: { type: mongoose.Schema.Types.Mixed, default: null },
    slaPolicies: { type: mongoose.Schema.Types.Mixed, default: null },
    defaultSlaPolicyKey: { type: String, default: null },
    channelRules: { type: mongoose.Schema.Types.Mixed, default: null }
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

// Compound unique index for (organizationId + appKey)
TenantAppConfigurationSchema.index(
  { organizationId: 1, appKey: 1 },
  { unique: true }
);

// Index for enabled apps lookup
TenantAppConfigurationSchema.index({ organizationId: 1, enabled: 1 });

// Pre-save hook to update updatedAt
TenantAppConfigurationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-update hook to update updatedAt
TenantAppConfigurationSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('TenantAppConfiguration', TenantAppConfigurationSchema);

