/**
 * Profile — reusable permission template (module + field privileges).
 * Roles reference profiles via profileId when privilegeMode === 'profile'.
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const profileSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  profileKey: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  isSystemProfile: {
    type: Boolean,
    default: false
  },
  appPermissions: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: () => new Map()
  },
  permissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  fieldPermissions: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  copiedFromProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
    default: null
  },
  version: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

profileSchema.index({ organizationId: 1, name: 1 }, { unique: true });
profileSchema.index(
  { organizationId: 1, profileKey: 1 },
  { unique: true, partialFilterExpression: { profileKey: { $type: 'string', $ne: '' } } }
);

module.exports = wrapTenantModel(mongoose.model('Profile', profileSchema));
