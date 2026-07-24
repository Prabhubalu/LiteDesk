'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MarketingAudienceMemberSchema = new Schema(
  {
    personId: { type: Schema.Types.ObjectId, ref: 'People', default: null },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true, default: '' },
    source: {
      type: String,
      enum: ['manual', 'import', 'people'],
      default: 'manual'
    },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const MarketingAudienceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    audienceNumber: { type: String, trim: true, index: true },
    description: { type: String, trim: true, default: '' },
    type: {
      type: String,
      enum: ['static', 'dynamic'],
      default: 'static'
    },
    segmentId: { type: Schema.Types.ObjectId, default: null },
    members: { type: [MarketingAudienceMemberSchema], default: [] },
    memberCount: { type: Number, default: 0 },
    importMetadata: {
      lastImportAt: { type: Date, default: null },
      lastImportFileName: { type: String, trim: true, default: null },
      lastImportStats: {
        added: { type: Number, default: 0 },
        skipped: { type: Number, default: 0 },
        duplicates: { type: Number, default: 0 }
      }
    },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

MarketingAudienceSchema.index({ organizationId: 1, updatedAt: -1 });
MarketingAudienceSchema.index({ organizationId: 1, name: 1 });
MarketingAudienceSchema.index({ organizationId: 1, audienceNumber: 1 }, { unique: true, sparse: true });

MarketingAudienceSchema.pre('validate', async function assignAudienceNumber(next) {
  if (this.audienceNumber || !this.isNew) return next();
  try {
    const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
    await assignModuleRecordNumber(this, { moduleKey: 'audiences', fieldKey: 'audienceNumber' });
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('MarketingAudience', MarketingAudienceSchema));
