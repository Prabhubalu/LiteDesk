const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const LinkedRecordSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, trim: true, lowercase: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, index: true },
    linkType: { type: String, enum: ['created', 'linked'], default: 'linked' },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const LiveChatVisitorSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: true,
  },

  name: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true, index: true },
  phone: { type: String, default: '', trim: true },
  externalId: { type: String, default: '', trim: true, index: true },

  sessionCount: { type: Number, default: 0, min: 0 },
  linkedRecords: { type: [LinkedRecordSchema], default: [] },

  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  lastPageUrl: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

LiveChatVisitorSchema.index({ organizationId: 1, email: 1 });
LiveChatVisitorSchema.index({ organizationId: 1, externalId: 1 }, { sparse: true });

LiveChatVisitorSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('LiveChatVisitor', LiveChatVisitorSchema));
