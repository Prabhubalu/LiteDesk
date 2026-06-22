'use strict';

const LIVE_CHAT_SENTIMENT_VALUES = Object.freeze(['positive', 'neutral', 'negative']);

const LIVE_CHAT_INTENT_VALUES = Object.freeze(['support', 'sales', 'billing', 'general']);

const INTENT_KEYWORDS = Object.freeze({
  billing: ['bill', 'billing', 'invoice', 'payment', 'refund', 'charge', 'subscription'],
  sales: ['pricing', 'price', 'demo', 'purchase', 'buy', 'quote', 'trial', 'plan'],
  support: ['help', 'issue', 'error', 'broken', 'problem', 'not working', 'bug', 'fix'],
});

const POSITIVE_WORDS = Object.freeze(['great', 'thanks', 'thank you', 'excellent', 'awesome', 'perfect', 'love']);
const NEGATIVE_WORDS = Object.freeze(['bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'worst', 'useless']);

const MAX_AI_SUMMARY_LENGTH = 10000;
const MAX_INTENT_LENGTH = 64;

function normalizeSentiment(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  return LIVE_CHAT_SENTIMENT_VALUES.includes(key) ? key : null;
}

function normalizeIntent(raw) {
  const key = String(raw || '').trim().toLowerCase().slice(0, MAX_INTENT_LENGTH);
  if (!key) return null;
  return LIVE_CHAT_INTENT_VALUES.includes(key) ? key : null;
}

function normalizeAiSummary(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().slice(0, MAX_AI_SUMMARY_LENGTH);
}

function normalizeAiSentimentScore(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const score = Number(raw);
  if (!Number.isFinite(score)) return null;
  return Math.max(-1, Math.min(1, Math.round(score * 100) / 100));
}

function sentimentToScore(sentiment) {
  if (sentiment === 'positive') return 0.6;
  if (sentiment === 'negative') return -0.6;
  return 0;
}

function scoreTextForSentiment(text) {
  const lower = String(text || '').toLowerCase();
  if (!lower) return 0;
  let score = 0;
  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) score += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) score -= 1;
  }
  return score;
}

function deriveSentimentFromSession({ csatScore, feedbackComment, resolutionRating } = {}) {
  if (typeof csatScore === 'number') {
    if (csatScore >= 4) return 'positive';
    if (csatScore <= 2) return 'negative';
    return 'neutral';
  }

  const rating = String(resolutionRating || '').trim().toLowerCase();
  if (rating === 'excellent' || rating === 'good') return 'positive';
  if (rating === 'poor') return 'negative';
  if (rating === 'average') return 'neutral';

  const textScore = scoreTextForSentiment(feedbackComment);
  if (textScore > 0) return 'positive';
  if (textScore < 0) return 'negative';
  return 'neutral';
}

function deriveIntentFromText(text) {
  const lower = String(text || '').toLowerCase();
  if (!lower) return 'general';

  const scores = { billing: 0, sales: 0, support: 0 };
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) scores[intent] += 1;
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] === 0) return 'general';
  if (ranked[0][1] === ranked[1][1]) return 'general';
  return ranked[0][0];
}

function deriveIntentFromMessages(messages) {
  const visitorText = (Array.isArray(messages) ? messages : [])
    .filter((row) => String(row?.authorType || '') === 'visitor')
    .map((row) => String(row?.body || '').trim())
    .filter(Boolean)
    .join(' ');
  return deriveIntentFromText(visitorText);
}

function deriveAiSummary({ summary, messages } = {}) {
  const existing = String(summary || '').trim();
  if (existing) return existing.slice(0, MAX_AI_SUMMARY_LENGTH);

  const visitorBodies = (Array.isArray(messages) ? messages : [])
    .filter((row) => String(row?.authorType || '') === 'visitor')
    .map((row) => String(row?.body || '').trim())
    .filter(Boolean);

  if (!visitorBodies.length) return '';

  const first = visitorBodies[0].slice(0, 280);
  if (visitorBodies.length === 1) return first;
  return `${first} (+${visitorBodies.length - 1} more visitor message${visitorBodies.length > 2 ? 's' : ''})`;
}

function buildIntelligencePatchOnClose({ session, messages, enabled }) {
  if (!enabled) return {};

  const patch = {};
  const hasIntent = Boolean(String(session?.intent || '').trim());
  const hasSentiment = Boolean(normalizeSentiment(session?.sentiment));
  const hasAiSummary = Boolean(String(session?.aiSummary || '').trim());

  if (!hasIntent) {
    const intent = deriveIntentFromMessages(messages);
    patch.intent = intent;
    patch.aiIntent = intent;
  }
  if (!hasSentiment) {
    const sentiment = deriveSentimentFromSession(session);
    patch.sentiment = sentiment;
    patch.aiSentimentScore = sentimentToScore(sentiment);
  }
  if (!hasAiSummary) {
    patch.aiSummary = deriveAiSummary({ summary: session?.summary, messages });
  } else if (!session?.aiIntent && session?.intent) {
    patch.aiIntent = normalizeIntent(session.intent) || session.intent;
  }

  if (session?.aiSentimentScore === null || session?.aiSentimentScore === undefined) {
    const sentiment = patch.sentiment || normalizeSentiment(session?.sentiment);
    if (sentiment) patch.aiSentimentScore = sentimentToScore(sentiment);
  }

  return patch;
}

module.exports = {
  LIVE_CHAT_SENTIMENT_VALUES,
  LIVE_CHAT_INTENT_VALUES,
  MAX_AI_SUMMARY_LENGTH,
  normalizeSentiment,
  normalizeIntent,
  normalizeAiSummary,
  normalizeAiSentimentScore,
  deriveSentimentFromSession,
  deriveIntentFromText,
  deriveIntentFromMessages,
  deriveAiSummary,
  buildIntelligencePatchOnClose,
};
