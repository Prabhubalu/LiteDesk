'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DocumentInlineCommentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentInlineComment',
      default: null,
      index: true
    },
    commentType: {
      type: String,
      enum: ['comment', 'suggestion'],
      default: 'comment',
      index: true
    },
    body: {
      type: String,
      trim: true,
      required: true
    },
    suggestedText: {
      type: String,
      trim: true,
      default: null
    },
    quotedText: {
      type: String,
      trim: true,
      default: null
    },
    anchorFrom: {
      type: Number,
      default: null
    },
    anchorTo: {
      type: Number,
      default: null
    },
    status: {
      type: String,
      enum: ['open', 'resolved'],
      default: 'open',
      index: true
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

DocumentInlineCommentSchema.index({ organizationId: 1, documentId: 1, status: 1, createdAt: 1 });
DocumentInlineCommentSchema.index({ organizationId: 1, documentId: 1, parentCommentId: 1, createdAt: 1 });

module.exports = wrapTenantModel(mongoose.model('DocumentInlineComment', DocumentInlineCommentSchema));
