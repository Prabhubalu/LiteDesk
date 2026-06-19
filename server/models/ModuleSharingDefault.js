/**
 * Per-module default sharing mode (Vtiger Organization Sharing Access).
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const SHARING_MODES = [
  'public_read',
  'public_read_write',
  'public_read_write_delete',
  'private',
  'record_level'
];

const moduleSharingDefaultSchema = new mongoose.Schema({
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
    uppercase: true
  },
  moduleKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  mode: {
    type: String,
    enum: SHARING_MODES,
    required: true,
    default: 'private'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

moduleSharingDefaultSchema.index(
  { organizationId: 1, appKey: 1, moduleKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('ModuleSharingDefault', moduleSharingDefaultSchema));
module.exports.SHARING_MODES = SHARING_MODES;
