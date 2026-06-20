/**
 * Generic activity and comments for any module record.
 * Used when a module does not have its own activityLogs/comments (e.g. custom modules).
 * Supports activity log entries and threaded comments in one collection.
 */
const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const Schema = mongoose.Schema;

const RecordActivitySchema = new Schema({
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
    index: true
  },
  recordId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  /** 'activity' | 'comment' */
  type: {
    type: String,
    required: true,
    enum: ['activity', 'comment'],
    index: true
  },
  /** For type=activity: { action, message, details } */
  action: { type: String, trim: true },
  message: { type: String, trim: true },
  details: { type: Schema.Types.Mixed, default: {} },
  /** For type=comment: content and thread */
  content: { type: String, trim: true },
  parentCommentId: { type: Schema.Types.ObjectId, default: null, index: true },
  attachments: [{
    url: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimetype: { type: String, default: '' },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null }
  }],
  reactions: [{
    emoji: { type: String, required: true, trim: true, maxlength: 16 },
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  }],
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
    index: true
  },
  editedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

RecordActivitySchema.index({ organizationId: 1, moduleKey: 1, recordId: 1, type: 1, createdAt: 1 });
RecordActivitySchema.index({ organizationId: 1, moduleKey: 1, recordId: 1, parentCommentId: 1, createdAt: 1 });

module.exports = wrapTenantModel(mongoose.model('RecordActivity', RecordActivitySchema));
