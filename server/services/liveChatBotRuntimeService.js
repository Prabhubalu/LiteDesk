const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const LiveChatBot = require('../models/LiveChatBot');
const { findBestBotAnswer } = require('./liveChatBotKnowledgeService');
const { emitMessageReceived } = require('./liveChatEventService');
const { assignWaitingSession } = require('./liveChatSessionAssignmentService');

const ESCALATION_PATTERN = /\b(agent|human|representative|live\s*agent|talk\s*to\s*someone|real\s*person)\b/i;

async function tryAiFaqAssist({ organizationId, session, bot, visitorText, deps = {} }) {
  if (bot.aiAssist !== true) return null;

  const isEntitledFn = deps.isAiSuiteEntitledForOrg
    || (() => {
      const { isAiSuiteEntitledForOrg } = require('../utils/addonAccessUtils');
      return isAiSuiteEntitledForOrg;
    })();

  try {
    const entitled = await isEntitledFn(organizationId);
    if (!entitled) return null;

    // Legacy AI FAQ service (aiLiveChatBotService) removed with Astra v2 cutover.
    // Disable AI FAQ gracefully unless test doubles are injected.
    const answerLiveChatFaq = deps.answerLiveChatFaq;
    const answerLiveChatFaqFromExcerpts = deps.answerLiveChatFaqFromExcerpts;
    const formatBotReplyBody = deps.formatBotReplyBody;
    if (!answerLiveChatFaq || !answerLiveChatFaqFromExcerpts || !formatBotReplyBody) {
      return null;
    }
    const findBest = deps.findBestBotAnswer || findBestBotAnswer;

    const { match } = await findBest({
      organizationId,
      bot,
      queryText: visitorText,
      pageUrl: session?.pageUrl || '',
    });

    // Prefer LLM over keyword excerpts (full article text) — works before vector embed backfill.
    let faq = null;
    const excerptBody = match?.fullText || match?.body;
    if (excerptBody) {
      faq = await answerLiveChatFaqFromExcerpts({
        organizationId,
        userId: null,
        question: visitorText,
        excerpts: [{
          title: match.title,
          body: excerptBody,
          sourceType: match.sourceType,
          sourceId: match.sourceId,
        }],
      });
    }

    if (!faq?.contained || !faq?.answer) {
      faq = await answerLiveChatFaq({
        organizationId,
        userId: null,
        question: visitorText,
      });
    }

    if (!faq?.contained || !faq?.answer) {
      return { contained: false, escalateSuggested: true };
    }

    return {
      contained: true,
      body: formatBotReplyBody(faq.answer),
      provider: faq.provider,
      model: faq.model,
    };
  } catch (err) {
    // Soft-fail: never block visitor chat on AI errors
    console.warn('[liveChatBot] AI FAQ soft-fail:', err?.message || err);
    return null;
  }
}

async function getDefaultEnabledBot(organizationId) {
  if (!organizationId) return null;

  const preferred = await LiveChatBot.findOne({
    organizationId,
    enabled: true,
    isDefault: true,
  }).lean();
  if (preferred) return preferred;

  return LiveChatBot.findOne({ organizationId, enabled: true })
    .sort({ name: 1, createdAt: 1 })
    .lean();
}

async function getBotForSession(session) {
  if (!session?.botId) return null;
  const organizationId = session.organizationId;
  if (!organizationId) return null;
  return LiveChatBot.findOne({ _id: session.botId, organizationId, enabled: true }).lean();
}

async function sendBotOutboundMessage({ organizationId, sessionId, bot, body }) {
  const text = String(body || '').trim();
  if (!text) return null;

  const msg = await ChatMessage.create({
    organizationId: organizationId || null,
    sessionId,
    direction: 'outbound',
    authorType: 'bot',
    authorName: String(bot?.name || 'Assistant').trim(),
    body: text,
  });

  const now = new Date();
  await ChatSession.updateOne(
    { _id: sessionId },
    {
      $inc: { botMessageCount: 1 },
      $set: { lastMessageAt: now, updatedAt: now },
    },
  );

  emitMessageReceived({
    organizationId,
    sessionId,
    messageId: msg._id,
    direction: 'outbound',
    metadata: { authorType: 'bot', botId: bot?._id ? String(bot._id) : null },
  });

  return msg;
}

async function startBotHandlingOnSession({ organizationId, sessionId }) {
  if (!organizationId || !sessionId) return { started: false, reason: 'invalid_input' };

  const bot = await getDefaultEnabledBot(organizationId);
  if (!bot) return { started: false, reason: 'no_enabled_bot' };

  const now = new Date();
  await ChatSession.updateOne(
    { _id: sessionId },
    {
      $set: {
        lifecycleStatus: 'bot_handling',
        botId: bot._id,
        botMissCount: 0,
        botInvolved: true,
        updatedAt: now,
      },
    },
  );

  const greeting = String(bot.greetingMessage || '').trim();
  if (greeting) {
    await sendBotOutboundMessage({
      organizationId,
      sessionId,
      bot,
      body: greeting,
    });
  }

  return { started: true, botId: bot._id };
}

async function escalateSessionToAgent({ organizationId, sessionId, reason = 'bot_escalation' }) {
  const session = await ChatSession.findById(sessionId).lean();
  if (!session || String(session.status || '') === 'closed') {
    return { escalated: false, reason: 'session_not_found' };
  }

  await ChatSession.updateOne(
    { _id: sessionId },
    {
      $set: {
        lifecycleStatus: 'waiting',
        botMissCount: 0,
        botEscalated: true,
        botResolution: 'escalated',
        updatedAt: new Date(),
      },
    },
  );

  const assignResult = await assignWaitingSession({ organizationId, sessionId });
  return {
    escalated: true,
    reason,
    assigned: Boolean(assignResult.assigned),
    agentId: assignResult.agentId || null,
  };
}

async function handleBotVisitorMessage({ organizationId, session, message, deps = {} }) {
  if (!organizationId || !session?._id || !message) {
    return { handled: false, reason: 'invalid_input' };
  }

  if (String(session.lifecycleStatus || '') !== 'bot_handling') {
    return { handled: false, reason: 'not_bot_handling' };
  }

  const bot = await getBotForSession(session);
  if (!bot) {
    await escalateSessionToAgent({ organizationId, sessionId: session._id, reason: 'bot_unavailable' });
    return { handled: true, escalated: true, reason: 'bot_unavailable' };
  }

  const visitorText = String(message.body || '').trim();
  if (ESCALATION_PATTERN.test(visitorText)) {
    const fallback = String(bot.fallbackMessage || '').trim()
      || 'Connecting you with an agent.';
    await sendBotOutboundMessage({
      organizationId,
      sessionId: session._id,
      bot,
      body: fallback,
    });
    const result = await escalateSessionToAgent({
      organizationId,
      sessionId: session._id,
      reason: 'visitor_requested_agent',
    });
    return { handled: true, escalated: true, assigned: result.assigned };
  }

  // Prefer AI FAQ when enabled — keyword match returns raw snippets and must not win first.
  const aiAssist = await tryAiFaqAssist({
    organizationId,
    session,
    bot,
    visitorText,
    deps,
  });
  if (aiAssist?.contained && aiAssist.body) {
    await sendBotOutboundMessage({
      organizationId,
      sessionId: session._id,
      bot,
      body: aiAssist.body,
    });
    await ChatSession.updateOne(
      { _id: session._id },
      {
        $set: {
          botMissCount: 0,
          botAiAnswered: true,
          updatedAt: new Date(),
        },
      },
    );
    return {
      handled: true,
      answered: true,
      ai: true,
      sourceType: 'ai_faq',
      provider: aiAssist.provider,
      model: aiAssist.model,
    };
  }

  // Keyword / website snippet path only when AI Assist is off (or soft-failed / not entitled).
  // Never dump raw KB text when the bot is configured for AI answers.
  const findBest = deps.findBestBotAnswer || findBestBotAnswer;
  const { match, score } = await findBest({
    organizationId,
    bot,
    queryText: visitorText,
    pageUrl: session.pageUrl || '',
  });

  if (match && bot.aiAssist !== true) {
    const replyBody = `${match.body}\n\n— ${match.title}`;
    await sendBotOutboundMessage({
      organizationId,
      sessionId: session._id,
      bot,
      body: replyBody,
    });
    await ChatSession.updateOne(
      { _id: session._id },
      { $set: { botMissCount: 0, updatedAt: new Date() } },
    );
    return { handled: true, answered: true, score, sourceType: match.sourceType };
  }

  const missCount = Number(session.botMissCount || 0) + 1;
  const fallback = String(bot.fallbackMessage || '').trim()
    || 'I could not find an answer. Connecting you with an agent.';

  await sendBotOutboundMessage({
    organizationId,
    sessionId: session._id,
    bot,
    body: fallback,
  });

  if (missCount >= 2) {
    await ChatSession.updateOne(
      { _id: session._id },
      { $set: { botMissCount: missCount, updatedAt: new Date() } },
    );
    const result = await escalateSessionToAgent({
      organizationId,
      sessionId: session._id,
      reason: 'no_confident_match',
    });
    return { handled: true, escalated: true, assigned: result.assigned, missCount };
  }

  await ChatSession.updateOne(
    { _id: session._id },
    { $set: { botMissCount: missCount, updatedAt: new Date() } },
  );

  return { handled: true, answered: false, missCount, score };
}

module.exports = {
  getDefaultEnabledBot,
  getBotForSession,
  startBotHandlingOnSession,
  handleBotVisitorMessage,
  escalateSessionToAgent,
  sendBotOutboundMessage,
  tryAiFaqAssist,
};
