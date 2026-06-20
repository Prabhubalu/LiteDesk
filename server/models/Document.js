const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DOCUMENT_TYPES = [
  'file',
  'rich_document',
  'generated_document',
  'external_link',
  'template',
  'sop',
  'knowledge_article',
  'playbook',
  'meeting_notes',
  'checklist'
];

const DOCUMENT_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'published',
  'archived',
  'deleted'
];

const SOURCE_TYPES = ['internal', 'external'];

const DocumentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    documentNumber: {
      type: String,
      trim: true,
      required: true,
      index: true
    },
    title: {
      type: String,
      trim: true,
      required: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    documentType: {
      type: String,
      enum: DOCUMENT_TYPES,
      default: 'file',
      index: true
    },
    category: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentFolder',
      default: null,
      index: true
    },
    tags: {
      type: [String],
      default: []
    },
    sourceType: {
      type: String,
      enum: SOURCE_TYPES,
      default: 'internal',
      index: true
    },
    sourceProvider: {
      type: String,
      trim: true,
      default: null
    },
    externalUrl: {
      type: String,
      trim: true,
      default: null
    },
    richContent: {
      type: Schema.Types.Mixed,
      default: null
    },
    richContentText: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    richContentVersions: [{
      content: { type: String, default: '' },
      createdAt: { type: Date, default: Date.now, required: true },
      createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
    }],
    fileType: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    fileSizeBytes: {
      type: Number,
      default: null
    },
    mimeType: {
      type: String,
      trim: true,
      default: null
    },
    checksum: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    storageProvider: {
      type: String,
      trim: true,
      default: 'oci'
    },
    storagePath: {
      type: String,
      trim: true,
      default: null
    },
    versionNumber: {
      type: Number,
      default: 1,
      min: 1,
      index: true
    },
    currentVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentVersion',
      default: null
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: DOCUMENT_STATUSES,
      default: 'draft',
      index: true
    },
    effectiveDate: {
      type: Date,
      default: null
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true
    },
    renewalDate: {
      type: Date,
      default: null
    },
    retentionPolicy: {
      type: String,
      trim: true,
      default: null
    },
    visibility: {
      private: { type: Boolean, default: false },
      teamIds: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
      roleIds: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
      portalVisible: { type: Boolean, default: false },
      knowledgeBase: { type: Boolean, default: false }
    },
    reservationStatus: {
      type: String,
      enum: ['available', 'reserved', 'expired'],
      default: 'available',
      index: true
    },
    reservedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reservedAt: {
      type: Date,
      default: null
    },
    reservationExpiresAt: {
      type: Date,
      default: null,
      index: true
    },
    reservationReason: {
      type: String,
      trim: true,
      default: null
    },
    externalLinkStatus: {
      type: String,
      enum: ['available', 'unavailable'],
      default: null
    },
    expiryNotifiedAt: {
      type: Date,
      default: null
    },
    portalAccessRevokedAt: {
      type: Date,
      default: null
    },
    ocrText: {
      type: String,
      default: null
    },
    ocrStatus: {
      type: String,
      enum: ['pending', 'indexed', 'failed', 'skipped'],
      default: null
    },
    ocrIndexedAt: {
      type: Date,
      default: null
    },
    searchEmbedding: {
      type: [Number],
      default: null
    },
    semanticIndexedAt: {
      type: Date,
      default: null
    },
    legacyAttachmentId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    legacyCommentAttachmentKey: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deletionReason: {
      type: String,
      trim: true,
      default: null
    }
  },
  { timestamps: true }
);

DocumentSchema.index({ organizationId: 1, documentNumber: 1 }, { unique: true });
DocumentSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
DocumentSchema.index({ organizationId: 1, folderId: 1, title: 1 });
DocumentSchema.index({ organizationId: 1, deletedAt: 1, updatedAt: -1 });
DocumentSchema.index({ organizationId: 1, 'visibility.knowledgeBase': 1, status: 1, updatedAt: -1 });
DocumentSchema.index({ organizationId: 1, 'visibility.portalVisible': 1, status: 1, portalAccessRevokedAt: 1, updatedAt: -1 });
DocumentSchema.index({ organizationId: 1, ocrStatus: 1, documentType: 1 });
DocumentSchema.index(
  {
    title: 'text',
    description: 'text',
    richContentText: 'text',
    ocrText: 'text',
    tags: 'text',
    documentNumber: 'text'
  },
  {
    name: 'document_text_search',
    weights: {
      title: 10,
      documentNumber: 8,
      tags: 5,
      description: 3,
      richContentText: 2,
      ocrText: 2
    }
  }
);

module.exports = wrapTenantModel(mongoose.model('Document', DocumentSchema));
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
module.exports.DOCUMENT_STATUSES = DOCUMENT_STATUSES;
