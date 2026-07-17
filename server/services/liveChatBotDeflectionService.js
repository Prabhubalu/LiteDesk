'use strict';

/**
 * Deflection metrics for live-chat bots (Phase 4).
 * Contained = bot-involved session that was not escalated.
 */

const ChatSession = require('../models/ChatSession');

async function getBotDeflectionMetrics({
  organizationId,
  sinceDays = 7,
  ChatSessionModel = ChatSession,
} = {}) {
  const days = Math.min(90, Math.max(1, Number(sinceDays) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const base = {
    organizationId,
    botInvolved: true,
    createdAt: { $gte: since },
  };

  const [botSessions, escalated, aiAnswered] = await Promise.all([
    ChatSessionModel.countDocuments(base),
    ChatSessionModel.countDocuments({ ...base, botEscalated: true }),
    ChatSessionModel.countDocuments({ ...base, botAiAnswered: true }),
  ]);

  const contained = Math.max(0, botSessions - escalated);
  const deflectionRate = botSessions > 0 ? contained / botSessions : null;

  return {
    windowDays: days,
    since: since.toISOString(),
    botSessions,
    escalated,
    contained,
    aiAnswered,
    deflectionRate,
  };
}

module.exports = {
  getBotDeflectionMetrics,
};
