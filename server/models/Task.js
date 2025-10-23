const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TaskSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  // Basic Info
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },

  // Relationships - Related To (Contact, Deal, Project, Organization)
  relatedTo: {
    type: {
      type: String,
      enum: ['contact', 'deal', 'project', 'organization', 'none'],
      default: 'none'
    },
    id: {
      type: Schema.Types.ObjectId,
      refPath: 'relatedTo.type'
    }
  },

  // Optional: Direct project reference for easier querying
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },

  // Assignment
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Status & Priority
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'],
    default: 'todo',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },

  // Timeline
  dueDate: {
    type: Date,
    index: true
  },
  startDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },

  // Time Tracking
  estimatedHours: {
    type: Number,
    min: 0
  },
  actualHours: {
    type: Number,
    min: 0,
    default: 0
  },

  // Checklist/Subtasks
  subtasks: [{
    title: {
      type: String,
      required: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Classification
  tags: [{
    type: String,
    trim: true
  }],

  // Notifications
  reminderDate: Date,
  reminderSent: {
    type: Boolean,
    default: false
  },

  // Metadata
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
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

// Compound indexes for common queries
TaskSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
TaskSchema.index({ organizationId: 1, dueDate: 1, status: 1 });
TaskSchema.index({ organizationId: 1, priority: 1, status: 1 });
TaskSchema.index({ organizationId: 1, projectId: 1 });

// Virtual for overdue status
TaskSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return this.dueDate && this.dueDate < new Date();
});

// Virtual for completion percentage (based on subtasks)
TaskSchema.virtual('completionPercentage').get(function() {
  if (!this.subtasks || this.subtasks.length === 0) {
    return this.status === 'completed' ? 100 : 0;
  }
  const completed = this.subtasks.filter(st => st.completed).length;
  return Math.round((completed / this.subtasks.length) * 100);
});

// Pre-save middleware
TaskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-set completedDate when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
  }
  
  next();
});

// Instance methods
TaskSchema.methods.markComplete = function(userId) {
  this.status = 'completed';
  this.completedDate = new Date();
  return this.save();
};

TaskSchema.methods.markIncomplete = function() {
  this.status = 'todo';
  this.completedDate = null;
  return this.save();
};

// Ensure virtuals are included in JSON
TaskSchema.set('toJSON', { virtuals: true });
TaskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', TaskSchema);

