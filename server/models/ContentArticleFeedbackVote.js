'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentArticleFeedbackVoteSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    contentDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentDocument',
      required: true,
      index: true,
    },
    visitorHash: { type: String, required: true, trim: true },
    vote: { type: String, enum: ['yes', 'no'], required: true },
  },
  { timestamps: true },
);

ContentArticleFeedbackVoteSchema.index(
  { organizationId: 1, contentDocumentId: 1, visitorHash: 1 },
  { unique: true },
);

module.exports = wrapTenantModel(mongoose.model('ContentArticleFeedbackVote', ContentArticleFeedbackVoteSchema));
