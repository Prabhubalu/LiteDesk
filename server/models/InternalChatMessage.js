'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const RecordRefSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, required: true, trim: true, lowercase: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
    url: { type: String, trim: true, default: '' },
    storagePath: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const ReactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true, trim: true, maxlength: 16 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: true }
);

const InternalChatMessageSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternalChatSpace',
      required: true,
      index: true,
    },
    threadRootId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternalChatMessage',
      default: null,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    body: {
      type: String,
      default: '',
      maxlength: 16000,
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    reactions: {
      type: [ReactionSchema],
      default: [],
    },
    mentionUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    recordRefs: {
      type: [RecordRefSchema],
      default: [],
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

InternalChatMessageSchema.index({ organizationId: 1, spaceId: 1, createdAt: -1 });
InternalChatMessageSchema.index({ organizationId: 1, spaceId: 1, threadRootId: 1, createdAt: 1 });
InternalChatMessageSchema.index({ organizationId: 1, body: 'text' });

module.exports = wrapTenantModel(mongoose.model('InternalChatMessage', InternalChatMessageSchema));
