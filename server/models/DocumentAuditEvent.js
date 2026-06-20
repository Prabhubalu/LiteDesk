const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const AUDIT_ACTIONS = [
  'upload',
  'preview',
  'download',
  'share',
  'delete',
  'restore',
  'version_change',
  'ownership_change',
  'create',
  'update',
  'reservation_created',
  'reservation_released',
  'reservation_expired',
  'reservation_taken_over',
  'presence_detected',
  'version_conflict_detected',
  'version_conflict_resolved',
  'version_conflict_cancelled',
  'portal_access_revoked'
];

const DocumentAuditEventSchema = new Schema(
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
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
      index: true
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: false }
);

DocumentAuditEventSchema.index({ organizationId: 1, documentId: 1, timestamp: -1 });
DocumentAuditEventSchema.index({ organizationId: 1, timestamp: -1 });

module.exports = wrapTenantModel(mongoose.model('DocumentAuditEvent', DocumentAuditEventSchema));
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
