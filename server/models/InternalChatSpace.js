'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { INTERNAL_CHAT_SPACE_TYPES } = require('../constants/internalChatConstants');

const InternalChatSpaceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: INTERNAL_CHAT_SPACE_TYPES,
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    topic: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    /** Record-linked spaces: module key (e.g. deals, cases, people) */
    moduleKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      index: true,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    /** Stable key for DM / group_dm uniqueness (sorted member ids hash) */
    dmKey: {
      type: String,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    pinnedMessageIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InternalChatMessage' }],
      default: [],
    },
  },
  { timestamps: true }
);

InternalChatSpaceSchema.index(
  { organizationId: 1, moduleKey: 1, recordId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'record',
      moduleKey: { $type: 'string' },
      recordId: { $type: 'objectId' },
      archivedAt: null,
    },
  }
);

InternalChatSpaceSchema.index(
  { organizationId: 1, dmKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dmKey: { $type: 'string' },
      archivedAt: null,
    },
  }
);

InternalChatSpaceSchema.index({ organizationId: 1, type: 1, archivedAt: 1, lastMessageAt: -1 });

module.exports = wrapTenantModel(mongoose.model('InternalChatSpace', InternalChatSpaceSchema));
