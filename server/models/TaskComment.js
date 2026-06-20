const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const Schema = mongoose.Schema;

const TaskCommentSchema = new Schema({
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  parentCommentId: {
    type: Schema.Types.ObjectId,
    ref: 'TaskComment',
    default: null,
    index: true
  },
  attachments: [{
    url: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimetype: { type: String, default: '' },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null }
  }],
  reactions: [{
    emoji: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16
    },
    users: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  editedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

TaskCommentSchema.index({ taskId: 1, createdAt: 1 });
TaskCommentSchema.index({ taskId: 1, parentCommentId: 1, createdAt: 1 });

module.exports = wrapTenantModel(mongoose.model('TaskComment', TaskCommentSchema));
