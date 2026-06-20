const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const RecordPresenceSessionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    recordId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    activityType: {
      type: String,
      enum: ['editing', 'viewing', 'idle'],
      default: 'viewing',
      index: true
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

RecordPresenceSessionSchema.index(
  { organizationId: 1, moduleKey: 1, recordId: 1, userId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('RecordPresenceSession', RecordPresenceSessionSchema));
