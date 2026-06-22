'use strict';

const LIVE_CHAT_BOT_RESOLUTIONS = Object.freeze(['escalated', 'unresolved', 'resolved']);

function normalizeBotResolution(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  return LIVE_CHAT_BOT_RESOLUTIONS.includes(key) ? key : null;
}

function buildBotClosePatch(session) {
  if (!session?.botInvolved) return {};
  if (session.botResolution) return {};
  if (session.botEscalated) return {};
  return { botResolution: 'unresolved' };
}

module.exports = {
  LIVE_CHAT_BOT_RESOLUTIONS,
  normalizeBotResolution,
  buildBotClosePatch,
};
