'use strict';

const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const ChatMessage = require('../models/ChatMessage');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { buildIntelligencePatchOnClose } = require('../constants/liveChatSessionIntelligence');

async function isSessionIntelligenceEnabled(organizationId) {
  if (process.env.LIVE_CHAT_SESSION_INTELLIGENCE === 'false') return false;
  if (process.env.LIVE_CHAT_SESSION_INTELLIGENCE === 'true') return true;
  if (!organizationId) return false;

  const config = await TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: ADDON_KEYS.LIVE_CHAT,
    archivedAt: { $in: [null, undefined] },
    enabled: { $ne: false },
  })
    .select('settings')
    .lean();

  return Boolean(config?.settings?.sessionIntelligenceEnabled);
}

async function loadMessagesForIntelligence(sessionId) {
  return ChatMessage.find({ sessionId })
    .select('authorType body createdAt')
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();
}

async function buildIntelligencePatchForSessionClose({ organizationId, sessionId, session }) {
  const enabled = await isSessionIntelligenceEnabled(organizationId);
  if (!enabled) return {};

  const messages = await loadMessagesForIntelligence(sessionId);
  return buildIntelligencePatchOnClose({ session, messages, enabled: true });
}

module.exports = {
  isSessionIntelligenceEnabled,
  buildIntelligencePatchForSessionClose,
};
