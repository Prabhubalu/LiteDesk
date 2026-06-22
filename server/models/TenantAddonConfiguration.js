/**
 * Tenant-level addon operational configuration (master DB).
 */

const mongoose = require('mongoose');

const TenantAddonConfigurationSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  addonKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true,
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  installedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  installedAt: {
    type: Date,
    default: Date.now,
  },
  disabledAt: {
    type: Date,
    default: null,
  },
  archivedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

TenantAddonConfigurationSchema.index(
  { organizationId: 1, addonKey: 1 },
  { unique: true },
);

TenantAddonConfigurationSchema.index({ organizationId: 1, enabled: 1 });

module.exports = mongoose.model('TenantAddonConfiguration', TenantAddonConfigurationSchema);
