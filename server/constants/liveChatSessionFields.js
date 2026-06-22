'use strict';

const RESOLUTION_RATINGS = Object.freeze(['excellent', 'good', 'average', 'poor']);
const {
  normalizeVisitorType,
  normalizeSessionPriority,
  normalizeInternalNotes,
} = require('./liveChatSessionIdentity');
const {
  normalizeIntent,
  normalizeSentiment,
  normalizeAiSummary,
} = require('./liveChatSessionIntelligence');

const MAX_SUBJECT_LENGTH = 255;
const MAX_SUMMARY_LENGTH = 10000;
const MAX_FEEDBACK_COMMENT_LENGTH = 5000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 64;

function normalizeSubject(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().slice(0, MAX_SUBJECT_LENGTH);
}

function normalizeSummary(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().slice(0, MAX_SUMMARY_LENGTH);
}

function normalizeFeedbackComment(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().slice(0, MAX_FEEDBACK_COMMENT_LENGTH);
}

function normalizeTags(raw) {
  if (raw === null || raw === undefined) return [];
  const source = Array.isArray(raw) ? raw : String(raw).split(',');
  const seen = new Set();
  const tags = [];
  for (const item of source) {
    const tag = String(item || '').trim().slice(0, MAX_TAG_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

function normalizeCsatScore(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const score = Number(raw);
  if (!Number.isFinite(score)) return null;
  const rounded = Math.round(score);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizeResolutionRating(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  return RESOLUTION_RATINGS.includes(key) ? key : null;
}

function buildAgentSessionFieldPatch(body) {
  const patch = {};
  if (body && Object.prototype.hasOwnProperty.call(body, 'subject')) {
    patch.subject = normalizeSubject(body.subject);
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'summary')) {
    patch.summary = normalizeSummary(body.summary);
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'tags')) {
    patch.tags = normalizeTags(body.tags);
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'visitorType')) {
    if (body.visitorType === null || body.visitorType === '') {
      patch.visitorType = null;
    } else {
      const visitorType = normalizeVisitorType(body.visitorType);
      if (!visitorType) {
        const err = new Error('Invalid visitorType');
        err.statusCode = 400;
        throw err;
      }
      patch.visitorType = visitorType;
    }
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'priority')) {
    if (body.priority === null || body.priority === '') {
      patch.priority = null;
    } else {
      const priority = normalizeSessionPriority(body.priority);
      if (!priority) {
        const err = new Error('Invalid priority');
        err.statusCode = 400;
        throw err;
      }
      patch.priority = priority;
    }
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'internalNotes')) {
    patch.internalNotes = normalizeInternalNotes(body.internalNotes);
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'intent')) {
    if (body.intent === null || body.intent === '') {
      patch.intent = null;
    } else {
      const intent = normalizeIntent(body.intent);
      if (!intent) {
        const err = new Error('Invalid intent');
        err.statusCode = 400;
        throw err;
      }
      patch.intent = intent;
    }
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'sentiment')) {
    if (body.sentiment === null || body.sentiment === '') {
      patch.sentiment = null;
    } else {
      const sentiment = normalizeSentiment(body.sentiment);
      if (!sentiment) {
        const err = new Error('Invalid sentiment');
        err.statusCode = 400;
        throw err;
      }
      patch.sentiment = sentiment;
    }
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'aiSummary')) {
    patch.aiSummary = normalizeAiSummary(body.aiSummary);
  }
  return patch;
}

function buildVisitorFeedbackPatch(body) {
  const patch = {};
  const csatScore = normalizeCsatScore(body?.csatScore);
  if (csatScore === null) {
    const err = new Error('csatScore must be an integer from 1 to 5');
    err.statusCode = 400;
    throw err;
  }
  patch.csatScore = csatScore;
  patch.ratedByVisitor = true;

  if (body && Object.prototype.hasOwnProperty.call(body, 'feedbackComment')) {
    patch.feedbackComment = normalizeFeedbackComment(body.feedbackComment);
  }
  if (body && Object.prototype.hasOwnProperty.call(body, 'resolutionRating')) {
    const rating = normalizeResolutionRating(body.resolutionRating);
    if (body.resolutionRating && !rating) {
      const err = new Error('Invalid resolutionRating');
      err.statusCode = 400;
      throw err;
    }
    if (rating) patch.resolutionRating = rating;
  }
  return patch;
}

module.exports = {
  RESOLUTION_RATINGS,
  MAX_SUBJECT_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_FEEDBACK_COMMENT_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  normalizeSubject,
  normalizeSummary,
  normalizeFeedbackComment,
  normalizeTags,
  normalizeCsatScore,
  normalizeResolutionRating,
  buildAgentSessionFieldPatch,
  buildVisitorFeedbackPatch,
};
