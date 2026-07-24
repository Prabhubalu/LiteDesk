'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MarketingSegmentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    segmentNumber: { type: String, trim: true },
    description: { type: String, trim: true, default: '' },
    primaryEntity: {
      appKey: { type: String, trim: true, lowercase: true, default: 'sales' },
      moduleKey: { type: String, trim: true, lowercase: true, default: 'people' }
    },
    filterQueryVersion: { type: Number, default: 1 },
    explainSummary: { type: String, trim: true, default: '' },
    filterQuery: { type: Schema.Types.Mixed, default: null },
    memberCount: { type: Number, default: 0 },
    lastRefreshedAt: { type: Date, default: null },
    refreshError: { type: String, trim: true, default: null },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

MarketingSegmentSchema.index({ organizationId: 1, updatedAt: -1 });
MarketingSegmentSchema.index({ organizationId: 1, name: 1 });
MarketingSegmentSchema.index({ organizationId: 1, segmentNumber: 1 }, { unique: true, sparse: true });

MarketingSegmentSchema.pre('validate', async function assignSegmentNumber(next) {
  if (this.segmentNumber || !this.isNew) return next();
  try {
    const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
    await assignModuleRecordNumber(this, { moduleKey: 'segments', fieldKey: 'segmentNumber' });
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('MarketingSegment', MarketingSegmentSchema));
