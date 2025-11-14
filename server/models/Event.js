const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { v4: uuidv4 } = require('uuid');

// Audit history entry schema
const auditHistoryEntrySchema = new Schema({
  timestamp: { 
    type: Date, 
    default: Date.now, 
    required: true 
  },
  actorUserId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  action: { 
    type: String, 
    required: true,
    enum: ['status_changed', 'rescheduled', 'attendee_added', 'attendee_removed', 'attendee_status_changed', 'created', 'updated', 'deleted', 'note_added'] // Picklist
  },
  from: Schema.Types.Mixed, // Previous value
  to: Schema.Types.Mixed,    // New value
  metadata: Schema.Types.Mixed // Additional context (reason, oldStart, newStart, etc.)
}, { _id: false });

// Attendee schema - supports both Person (People) and User lookups
const attendeeSchema = new Schema({
  // Can be either Person (People) ID or User ID
  personId: { type: Schema.Types.ObjectId, ref: 'People' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  email: String,
  name: String,
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'declined', 'tentative'], 
    default: 'pending' 
  }
}, { _id: false });

const eventSchema = new Schema({
  // Primary Key - UUID
  eventId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },
  
  // Basic Information
  eventName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 255
  },
  
  // Type & Status (Picklist fields)
  eventType: { 
    type: String, 
    enum: ['Meeting', 'Call', 'Site Visit', 'Demo', 'Training', 'Webinar', 'Other'], // Picklist
    required: true,
    default: 'Meeting'
  },
  
  status: { 
    type: String, 
    enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'], // Picklist
    required: true,
    default: 'Scheduled'
  },
  
  // Polymorphic Related To
  relatedToId: {
    type: Schema.Types.ObjectId,
    refPath: 'relatedToType'
  },
  relatedToType: {
    type: String,
    enum: ['Person', 'Organization', 'Deal', 'Item'], // Picklist
    default: null
  },
  
  // Event Owner
  eventOwnerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  
  // Date & Time
  startDateTime: { 
    type: Date, 
    required: true 
  },
  endDateTime: { 
    type: Date, 
    required: true 
  },
  
  // Location (can be address or URL)
  location: { 
    type: String,
    maxlength: 1024,
    default: ''
  },
  
  // Reminder
  reminderAt: {
    type: Date,
    default: null
  },
  
  // Recurrence (stored as JSON)
  recurrence: {
    type: Schema.Types.Mixed, // JSON object with rrule, timezone, endCondition
    default: null
  },
  
  // Attendees (array of Person/User lookups)
  attendees: [attendeeSchema],
  
  // Agenda Notes
  agendaNotes: { 
    type: String,
    maxlength: 5000,
    default: ''
  },
  
  // Linked Records
  linkedTaskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  linkedFormId: {
    type: Schema.Types.ObjectId,
    ref: 'Form',
    default: null
  },
  
  // Tags
  tags: [{
    type: String,
    trim: true
  }],
  
  // Audit History
  auditHistory: [auditHistoryEntrySchema],
  
  // Notes (for user-added notes/comments - backward compatibility)
  notes: [{
    text: { type: String, required: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    created_at: { type: Date, default: Date.now }
  }],
  
  // Multi-tenancy
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization',
    required: true
  },
  
  // Timestamps (auto-filled)
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  createdTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  modifiedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  modifiedTime: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { 
  timestamps: false // We use createdTime/modifiedTime instead
});

// Indexes as per specification
eventSchema.index({ eventOwnerId: 1, startDateTime: 1 }, { name: 'idx_events_owner_start' });
eventSchema.index({ relatedToId: 1, relatedToType: 1 }, { name: 'idx_events_relatedTo' });
eventSchema.index({ organizationId: 1, startDateTime: 1 });
eventSchema.index({ organizationId: 1, status: 1 });
eventSchema.index({ 'attendees.userId': 1 });
eventSchema.index({ 'attendees.personId': 1 });
eventSchema.index({ linkedTaskId: 1 });
// eventId is already indexed via unique: true, no need for explicit index

// Virtual for duration
eventSchema.virtual('duration').get(function() {
  if (this.startDateTime && this.endDateTime) {
    return this.endDateTime - this.startDateTime;
  }
  return null;
});

// Pre-save middleware to update timestamps and add audit entries
eventSchema.pre('save', function(next) {
  const now = new Date();
  
  // Set createdTime on new documents
  if (this.isNew) {
    this.createdTime = now;
    this.modifiedTime = now;
    
    // Add creation audit entry
    if (!this.auditHistory) {
      this.auditHistory = [];
    }
    this.auditHistory.push({
      timestamp: now,
      actorUserId: this.createdBy,
      action: 'created',
      from: null,
      to: null,
      metadata: {
        eventName: this.eventName,
        eventType: this.eventType,
        startDateTime: this.startDateTime
      }
    });
  } else {
    // Update modifiedTime on existing documents
    this.modifiedTime = now;
  }
  
  // Validate end date is after start date
  if (this.endDateTime && this.startDateTime && this.endDateTime <= this.startDateTime) {
    return next(new Error('End date must be after start date'));
  }
  
  next();
});

// Method to add audit history entry
eventSchema.methods.addAuditEntry = function(action, actorUserId, from, to, metadata) {
  if (!this.auditHistory) {
    this.auditHistory = [];
  }
  this.auditHistory.push({
    timestamp: new Date(),
    actorUserId: actorUserId,
    action: action,
    from: from,
    to: to,
    metadata: metadata || {}
  });
};

module.exports = mongoose.model('Event', eventSchema);
