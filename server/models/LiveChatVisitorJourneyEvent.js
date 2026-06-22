const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { LIVE_CHAT_JOURNEY_ACTION_VALUES } = require('../constants/liveChatVisitorContext');

const LiveChatVisitorJourneyEventSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    index: true,
    required: true,
  },
  page: { type: String, default: '', trim: true, maxlength: 2048 },
  action: {
    type: String,
    enum: LIVE_CHAT_JOURNEY_ACTION_VALUES,
    default: 'page_view',
    index: true,
  },
  createdAt: { type: Date, default: Date.now, index: true },
});

LiveChatVisitorJourneyEventSchema.index({ organizationId: 1, sessionId: 1, createdAt: 1 });

module.exports = wrapTenantModel(
  mongoose.model('LiveChatVisitorJourneyEvent', LiveChatVisitorJourneyEventSchema),
);
