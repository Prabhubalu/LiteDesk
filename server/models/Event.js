const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendeeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  email: String,
  name: String,
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'declined', 'tentative'], 
    default: 'pending' 
  },
  isOrganizer: { type: Boolean, default: false }
}, { _id: false });

const eventSchema = new Schema({
  // Basic Information
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    default: ''
  },
  
  // Date & Time
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  allDay: { 
    type: Boolean, 
    default: false 
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Location
  location: { 
    type: String,
    default: ''
  },
  meetingUrl: { 
    type: String,
    default: ''
  },
  
  // Type & Category
  type: { 
    type: String, 
    enum: ['meeting', 'call', 'email', 'task', 'deadline', 'follow-up', 'other'],
    default: 'meeting'
  },
  category: {
    type: String,
    enum: ['sales', 'support', 'internal', 'external', 'personal', 'other'],
    default: 'other'
  },
  
  // Status & Priority
  status: { 
    type: String, 
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Attendees
  attendees: [attendeeSchema],
  
  // Organizer
  organizer: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  
  // Related Records
  relatedTo: {
    type: { 
      type: String, 
      enum: ['Contact', 'Deal', 'Task', 'Organization']
    },
    id: { 
      type: Schema.Types.ObjectId,
      refPath: 'relatedTo.type'
    }
  },
  
  // Recurring Events
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrence: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
    },
    interval: Number, // Every X days/weeks/months/years
    endDate: Date,
    occurrences: Number, // Number of times to repeat
    daysOfWeek: [Number], // For weekly: 0=Sunday, 1=Monday, etc.
    dayOfMonth: Number, // For monthly
  },
  parentEventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },
  
  // Reminders
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'notification', 'sms'],
      default: 'notification'
    },
    minutesBefore: Number,
    sent: { type: Boolean, default: false }
  }],
  
  // Additional Fields
  color: {
    type: String,
    default: '#3B82F6' // Blue
  },
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
  
  // Timestamps
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User'
  },
  updatedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Indexes
eventSchema.index({ organizationId: 1, startDate: 1 });
eventSchema.index({ organizationId: 1, endDate: 1 });
eventSchema.index({ organizationId: 1, status: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ 'attendees.userId': 1 });
eventSchema.index({ 'relatedTo.type': 1, 'relatedTo.id': 1 });

// Virtual for duration
eventSchema.virtual('duration').get(function() {
  return this.endDate - this.startDate;
});

// Validate end date is after start date
eventSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);

