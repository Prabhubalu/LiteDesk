const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const PlaybookAlertScheduleJobSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      index: true
    },
    stageKey: { type: String, required: true, trim: true },
    actionKey: { type: String, required: true, trim: true },
    alertIndex: { type: Number, required: true, min: 0 },
    playbookStartedAt: { type: Date, required: true },
    runAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'skipped', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    dedupeKey: { type: String, required: true, trim: true, unique: true, index: true },
    details: { type: Schema.Types.Mixed, default: {} },
    lastError: { type: String, default: null }
  },
  { timestamps: true }
);

PlaybookAlertScheduleJobSchema.index({ organizationId: 1, status: 1, runAt: 1 });
PlaybookAlertScheduleJobSchema.index({ organizationId: 1, dealId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('PlaybookAlertScheduleJob', PlaybookAlertScheduleJobSchema));
