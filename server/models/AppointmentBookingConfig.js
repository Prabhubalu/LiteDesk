/**
 * Per-user (or team) public booking page configuration.
 * Each booked slot creates an Event with appointment metadata.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const customFieldSchema = new Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'email', 'phone', 'textarea', 'select'], default: 'text' },
  required: { type: Boolean, default: false },
  options: [{ type: String, trim: true }]
}, { _id: false });

const appointmentBookingConfigSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  ownerType: {
    type: String,
    enum: ['user', 'team'],
    default: 'user',
    required: true
  },
  /** User owner for personal pages; team manager (createdBy) for team pages */
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  /** Team pages: members who can receive bookings */
  memberUserIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  assignmentStrategy: {
    type: String,
    enum: ['round_robin', 'first_available'],
    default: 'round_robin'
  },
  roundRobinIndex: { type: Number, default: 0, min: 0 },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 64,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  },
  enabled: { type: Boolean, default: true, index: true },
  displayName: { type: String, trim: true, maxlength: 120 },
  availableDays: {
    type: [{ type: Number, min: 0, max: 6 }],
    default: [1, 2, 3, 4, 5]
  },
  workingHours: {
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' },
    timezone: { type: String, default: 'UTC' }
  },
  /** inherit = user/team/company Business Hours; custom = businessHourSetId; unset = legacy inline hours */
  scheduleSource: {
    type: String,
    enum: ['inherit', 'custom', 'legacy'],
    default: null
  },
  businessHourSetId: {
    type: Schema.Types.ObjectId,
    ref: 'BusinessHourSet',
    default: null
  },
  slotDurationMinutes: {
    type: Number,
    enum: [15, 30, 45, 60],
    default: 30
  },
  bufferMinutes: {
    type: Number,
    enum: [0, 5, 10, 15, 30],
    default: 10
  },
  dailyCapacity: { type: Number, min: 1, max: 50, default: null },
  meetingType: {
    type: String,
    enum: ['google_meet', 'ms_teams', 'offline'],
    default: 'offline'
  },
  appointmentTypes: {
    type: [{ type: String, enum: ['demo', 'support', 'consultation', 'other'] }],
    default: ['demo', 'consultation']
  },
  customFields: [customFieldSchema],
  branding: {
    logoUrl: { type: String, default: '' },
    themeColor: { type: String, default: '#4f46e5' },
    welcomeNote: { type: String, default: '', maxlength: 2000 }
  },
  googleCalendar: {
    encryptedRefreshToken: { type: String, default: '' },
    accountEmail: { type: String, default: '', trim: true, lowercase: true },
    connectedAt: { type: Date, default: null }
  },
  microsoftCalendar: {
    encryptedRefreshToken: { type: String, default: '' },
    accountEmail: { type: String, default: '', trim: true, lowercase: true },
    connectedAt: { type: Date, default: null }
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

appointmentBookingConfigSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
appointmentBookingConfigSchema.index(
  { organizationId: 1, ownerType: 1, assignedTo: 1 },
  { unique: true, partialFilterExpression: { ownerType: 'user' } }
);

module.exports = wrapTenantModel(mongoose.model('AppointmentBookingConfig', appointmentBookingConfigSchema));
