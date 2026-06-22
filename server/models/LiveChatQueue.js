const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const DISTRIBUTION_MODES = ['round_robin', 'load_balanced', 'availability_based', 'queue', 'weighted'];

const LiveChatQueueSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },

  queueKey: { type: String, trim: true, lowercase: true, required: true, index: true },
  name: { type: String, trim: true, required: true },
  description: { type: String, trim: true, default: '' },

  primaryGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  fallbackGroupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],

  distributionMode: {
    type: String,
    enum: DISTRIBUTION_MODES,
    default: 'round_robin',
    index: true,
  },

  isDefault: { type: Boolean, default: false, index: true },
  enabled: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 0, index: true },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

LiveChatQueueSchema.index({ organizationId: 1, queueKey: 1 }, { unique: true });
LiveChatQueueSchema.index({ organizationId: 1, isDefault: 1 });

LiveChatQueueSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('LiveChatQueue', LiveChatQueueSchema));
module.exports.DISTRIBUTION_MODES = DISTRIBUTION_MODES;
