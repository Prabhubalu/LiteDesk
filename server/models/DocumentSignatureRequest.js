'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const SIGNER_STATUSES = ['pending', 'signed', 'declined'];

const DocumentSignatureRequestSchema = new Schema(
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partially_signed', 'completed', 'declined', 'expired', 'cancelled'],
      default: 'draft',
      index: true
    },
    provider: {
      type: String,
      enum: ['internal'],
      default: 'internal'
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },
    signers: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      email: { type: String, trim: true, required: true },
      name: { type: String, trim: true, default: '' },
      order: { type: Number, default: 1 },
      status: { type: String, enum: SIGNER_STATUSES, default: 'pending' },
      signatureText: { type: String, trim: true, default: null },
      signedAt: { type: Date, default: null },
      declinedAt: { type: Date, default: null },
      declineReason: { type: String, trim: true, default: null }
    }],
    completedAt: {
      type: Date,
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

DocumentSignatureRequestSchema.index({ organizationId: 1, documentId: 1, status: 1, updatedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('DocumentSignatureRequest', DocumentSignatureRequestSchema));
