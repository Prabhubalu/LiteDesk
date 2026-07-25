'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { CANVAS_TYPES, CANVAS_STATUSES, SHARE_ROLES } = require('../services/astraStudio/constants');

const FocusSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, trim: true, lowercase: true, required: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const LinkShareSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    role: { type: String, enum: SHARE_ROLES, default: 'viewer' },
    token: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const PermissionsSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    viewerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    linkShare: { type: LinkShareSchema, default: () => ({}) },
  },
  { _id: false }
);

const LayoutMetaSchema = new mongoose.Schema(
  {
    cameraX: { type: Number, default: 0 },
    cameraY: { type: Number, default: 0 },
    zoom: { type: Number, default: 1 },
    /** Living Canvas: user dragged widgets — skip auto-pack */
    userArranged: { type: Boolean, default: false },
    /** Living Canvas: masonry pack already applied once */
    packed: { type: Boolean, default: false },
  },
  { _id: false }
);

const AstraCanvasSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    title: { type: String, trim: true, required: true, maxlength: 240 },
    canvasType: {
      type: String,
      enum: CANVAS_TYPES,
      default: 'blank',
      index: true,
    },
    focus: { type: [FocusSchema], default: [] },
    permissions: { type: PermissionsSchema, required: true },
    /** Encoded Yjs document snapshot (Uint8Array as Buffer). */
    yjsState: { type: Buffer, default: null },
    yjsClock: { type: Number, default: 0 },
    layoutMeta: { type: LayoutMetaSchema, default: () => ({}) },
    status: {
      type: String,
      enum: CANVAS_STATUSES,
      default: 'draft',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

AstraCanvasSchema.index({ organizationId: 1, deletedAt: 1, updatedAt: -1 });
AstraCanvasSchema.index({ organizationId: 1, 'permissions.ownerId': 1, deletedAt: 1 });
AstraCanvasSchema.index({ 'permissions.linkShare.token': 1 }, { sparse: true });

module.exports = wrapTenantModel(mongoose.model('AstraCanvas', AstraCanvasSchema));
