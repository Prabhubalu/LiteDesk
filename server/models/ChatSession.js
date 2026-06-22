const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { LIVE_CHAT_ASSIGNED_BY_VALUES } = require('../constants/liveChatSessionAssignment');
const { LIVE_CHAT_DEVICE_TYPES } = require('../constants/liveChatVisitorContext');
const {
  LIVE_CHAT_VISITOR_TYPE_VALUES,
  LIVE_CHAT_SESSION_PRIORITY_VALUES,
} = require('../constants/liveChatSessionIdentity');
const { LIVE_CHAT_BOT_RESOLUTIONS } = require('../constants/liveChatBotSession');
const {
  LIVE_CHAT_SENTIMENT_VALUES,
  LIVE_CHAT_INTENT_VALUES,
} = require('../constants/liveChatSessionIntelligence');

const ChatSessionSchema = new mongoose.Schema({
  // In tenant DB mode, org scope is implicit; keep for analytics / safety.
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, required: false },

  // Legacy Helpdesk case link (deprecated — use linkedRecords).
  caseRecordId: { type: mongoose.Schema.Types.ObjectId, index: true, required: false },

  linkedRecords: [{
    moduleKey: { type: String, trim: true, lowercase: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, index: true },
    linkType: { type: String, enum: ['created', 'linked'], default: 'linked' },
    linkedAt: { type: Date, default: Date.now },
  }],

  sessionKey: { type: String, trim: true, index: true },
  channel: { type: String, default: 'web', trim: true, index: true },
  visitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveChatVisitor', index: true },

  instancePublicKey: { type: String, index: true, required: true },
  sessionSecret: { type: String, required: true },

  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  lifecycleStatus: {
    type: String,
    enum: ['waiting', 'assigned', 'active', 'ended', 'bot_handling'],
    default: 'waiting',
    index: true,
  },

  outcome: { type: String, trim: true, default: null, index: true },
  endedAt: { type: Date, default: null, index: true },
  endedByAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  subject: { type: String, trim: true, default: '', maxlength: 255 },
  tags: { type: [String], default: [] },
  summary: { type: String, default: '', maxlength: 10000 },

  csatScore: { type: Number, min: 1, max: 5, default: null, index: true },
  feedbackComment: { type: String, default: '', maxlength: 5000 },
  ratedByVisitor: { type: Boolean, default: false },
  resolutionRating: {
    type: String,
    enum: ['excellent', 'good', 'average', 'poor'],
    default: null,
  },

  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignedAt: { type: Date, default: null, index: true },
  firstResponseAt: { type: Date, default: null, index: true },
  assignedBy: {
    type: String,
    enum: LIVE_CHAT_ASSIGNED_BY_VALUES,
    default: null,
    index: true,
  },
  transferCount: { type: Number, default: 0, min: 0 },
  agentsInvolved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  queueId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveChatQueue', default: null, index: true },
  botId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveChatBot', default: null, index: true },
  botMissCount: { type: Number, default: 0 },
  botInvolved: { type: Boolean, default: false, index: true },
  botEscalated: { type: Boolean, default: false, index: true },
  botResolution: {
    type: String,
    enum: LIVE_CHAT_BOT_RESOLUTIONS,
    default: null,
  },
  botMessageCount: { type: Number, default: 0, min: 0 },

  visitorMessageCount: { type: Number, default: 0, min: 0 },
  agentMessageCount: { type: Number, default: 0, min: 0 },
  attachmentCount: { type: Number, default: 0, min: 0 },
  agentCount: { type: Number, default: 0, min: 0 },

  intent: {
    type: String,
    enum: LIVE_CHAT_INTENT_VALUES,
    default: null,
    index: true,
  },
  sentiment: {
    type: String,
    enum: LIVE_CHAT_SENTIMENT_VALUES,
    default: null,
    index: true,
  },
  aiSummary: { type: String, default: '', maxlength: 10000 },
  aiIntent: {
    type: String,
    enum: LIVE_CHAT_INTENT_VALUES,
    default: null,
  },
  aiSentimentScore: { type: Number, min: -1, max: 1, default: null },

  consentGiven: { type: Boolean, default: false, index: true },
  consentTimestamp: { type: Date, default: null, index: true },
  sessionArchived: { type: Boolean, default: false, index: true },
  archiveDate: { type: Date, default: null, index: true },
  exported: { type: Boolean, default: false, index: true },

  visitor: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    externalId: { type: String, default: '' }
  },

  visitorType: {
    type: String,
    enum: LIVE_CHAT_VISITOR_TYPE_VALUES,
    default: null,
    index: true,
  },
  priority: {
    type: String,
    enum: LIVE_CHAT_SESSION_PRIORITY_VALUES,
    default: null,
    index: true,
  },
  internalNotes: { type: String, default: '', maxlength: 10000 },
  linkedContactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'People',
    default: null,
    index: true,
  },
  linkedOrganizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },

  pageUrl: { type: String, default: '' },
  referrerUrl: { type: String, default: '' },
  entryPage: { type: String, default: '' },
  browser: { type: String, default: '', trim: true },
  operatingSystem: { type: String, default: '', trim: true },
  deviceType: {
    type: String,
    enum: LIVE_CHAT_DEVICE_TYPES,
    default: 'desktop',
    index: true,
  },
  country: { type: String, default: '', trim: true, uppercase: true, maxlength: 2 },
  language: { type: String, default: '', trim: true, maxlength: 32 },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now, index: true },
  lastMessageAt: { type: Date, default: null, index: true }
});

ChatSessionSchema.index({ organizationId: 1, sessionKey: 1 }, { unique: true, sparse: true });

ChatSessionSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('ChatSession', ChatSessionSchema));

