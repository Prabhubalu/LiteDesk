/**
 * Custom sharing rules — exceptions that add visibility on top of defaults.
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const SOURCE_TYPES = ['role', 'role_subtree', 'group', 'user'];
const TARGET_TYPES = ['role', 'role_subtree', 'group', 'user', 'all_internal'];
const PRIVILEGES = ['read', 'read_write'];

const partySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [...SOURCE_TYPES, 'all_internal'],
      required: true
    },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { _id: false }
);

const moduleSharingRuleSchema = new mongoose.Schema(
  {
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
    priority: {
      type: Number,
      default: 100
    },
    enabled: {
      type: Boolean,
      default: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: partySchema,
      required: true
    },
    target: {
      type: partySchema,
      required: true
    },
    privilege: {
      type: String,
      enum: PRIVILEGES,
      default: 'read'
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
  },
  { timestamps: true }
);

moduleSharingRuleSchema.index({ organizationId: 1, appKey: 1, moduleKey: 1, priority: 1 });

module.exports = wrapTenantModel(mongoose.model('ModuleSharingRule', moduleSharingRuleSchema));
module.exports.SOURCE_TYPES = SOURCE_TYPES;
module.exports.TARGET_TYPES = TARGET_TYPES;
module.exports.PRIVILEGES = PRIVILEGES;
