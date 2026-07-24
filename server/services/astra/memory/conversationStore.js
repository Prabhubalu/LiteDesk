'use strict';

/**
 * Durable Astra chat threads (reuse AiConversation model).
 * Tenant + user scoped. Session memory remains ephemeral; this is the SoT
 * for the ChatGPT-style history sidebar.
 */

const mongoose = require('mongoose');
const AiConversation = require('../../../models/AiConversation');

const MAX_MESSAGES = 200;
const TITLE_MAX = 80;

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function makeMessageId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function titleFromQuery(query) {
  const text = String(query || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'New conversation';
  if (text.length <= TITLE_MAX) return text;
  return `${text.slice(0, TITLE_MAX - 1)}…`;
}

function previewFromMessages(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role === 'assistant' && String(msg.body || '').trim()) {
      return String(msg.body).replace(/\s+/g, ' ').trim().slice(0, 120);
    }
  }
  const firstUser = messages.find((m) => m?.role === 'user' && String(m.body || '').trim());
  return firstUser ? String(firstUser.body).replace(/\s+/g, ' ').trim().slice(0, 120) : '';
}

function summarize(doc) {
  if (!doc) return null;
  const messages = Array.isArray(doc.messages) ? doc.messages : [];
  const preview = String(doc.preview || '').trim() || previewFromMessages(messages);
  return {
    id: String(doc._id),
    title: doc.title || 'New conversation',
    preview,
    messageCount: Number(doc.messageCount || messages.length || 0),
    updatedAt: doc.updatedAt || doc.createdAt || null,
    createdAt: doc.createdAt || null,
  };
}

function toClientMessages(doc) {
  const messages = Array.isArray(doc?.messages) ? doc.messages : [];
  return messages.map((m) => {
    const structured = m.structured && typeof m.structured === 'object' ? m.structured : {};
    const proposals = Array.isArray(structured.proposals)
      ? structured.proposals.map((p) => ({
        ...p,
        status: p?.status || 'pending',
        href: p?.href || null,
        navigateLabel: p?.navigateLabel || null,
        recordId: p?.recordId || null,
        details: Array.isArray(p?.details) ? p.details : undefined,
      }))
      : [];
    return {
      id: m.id || makeMessageId('m'),
      role: m.role,
      body: m.body || '',
      blocks: Array.isArray(structured.blocks) ? structured.blocks : [],
      proposals,
      suggestions: Array.isArray(structured.suggestions) ? structured.suggestions : [],
      navigate: structured.navigate && typeof structured.navigate === 'object'
        ? structured.navigate
        : null,
      createdAt: m.createdAt || null,
    };
  });
}

function toLlmHistory(doc, limit = 8) {
  const messages = Array.isArray(doc?.messages) ? doc.messages : [];
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.body || '').trim())
    .slice(-limit)
    .map((m) => ({ role: m.role, content: String(m.body || '') }));
}

function encodeListCursor(updatedAt, id) {
  if (!updatedAt || !id) return null;
  const ts = updatedAt instanceof Date ? updatedAt.toISOString() : new Date(updatedAt).toISOString();
  if (Number.isNaN(Date.parse(ts))) return null;
  return Buffer.from(JSON.stringify({ u: ts, i: String(id) }), 'utf8').toString('base64url');
}

function decodeListCursor(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    const updatedAt = new Date(parsed?.u);
    const id = String(parsed?.i || '');
    if (Number.isNaN(updatedAt.getTime()) || !isObjectId(id)) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

/**
 * Cursor-paginated conversation summaries (newest first).
 * No total cap — clients load more via `nextCursor`.
 */
async function listConversations({
  organizationId,
  userId,
  limit = 40,
  cursor = null,
} = {}) {
  if (!organizationId || !userId) {
    return { conversations: [], nextCursor: null, hasMore: false };
  }

  const pageSize = Math.min(Math.max(Number(limit) || 40, 1), 50);
  const filter = { organizationId, userId };
  const decoded = decodeListCursor(cursor);
  if (decoded) {
    const cursorId = new mongoose.Types.ObjectId(decoded.id);
    filter.$or = [
      { updatedAt: { $lt: decoded.updatedAt } },
      { updatedAt: decoded.updatedAt, _id: { $lt: cursorId } },
    ];
  }

  const rows = await AiConversation.find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(pageSize + 1)
    .select('title preview messageCount createdAt updatedAt')
    .lean();

  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last
    ? encodeListCursor(last.updatedAt, last._id)
    : null;

  return {
    conversations: page.map(summarize),
    nextCursor,
    hasMore,
  };
}

async function getConversation({ organizationId, userId, conversationId } = {}) {
  if (!organizationId || !userId || !isObjectId(conversationId)) return null;
  const doc = await AiConversation.findOne({
    _id: conversationId,
    organizationId,
    userId,
  }).lean();
  if (!doc) return null;
  return {
    ...summarize(doc),
    messages: toClientMessages(doc),
  };
}

async function ensureConversation({
  organizationId,
  userId,
  conversationId = null,
  titleHint = '',
  moduleKey = '',
  recordId = '',
} = {}) {
  if (!organizationId || !userId) {
    const err = new Error('organizationId and userId are required');
    err.statusCode = 400;
    err.code = 'ASTRA_CONVERSATION_SCOPE_REQUIRED';
    throw err;
  }

  if (isObjectId(conversationId)) {
    const existing = await AiConversation.findOne({
      _id: conversationId,
      organizationId,
      userId,
    });
    if (existing) return existing;
  }

  return AiConversation.create({
    organizationId,
    userId,
    title: titleFromQuery(titleHint) || 'New conversation',
    messages: [],
    messageCount: 0,
    moduleKey: moduleKey || '',
    recordId: recordId || '',
  });
}

async function appendTurn({
  organizationId,
  userId,
  conversationId,
  userMessage,
  assistantMessage,
} = {}) {
  if (!organizationId || !userId || !isObjectId(conversationId)) return null;

  const doc = await AiConversation.findOne({
    _id: conversationId,
    organizationId,
    userId,
  });
  if (!doc) return null;

  const now = Date.now();
  const userBody = String(userMessage || '').trim();
  const assistantBody = String(assistantMessage?.body || '').trim();

  if (userBody) {
    doc.messages.push({
      id: makeMessageId('u'),
      role: 'user',
      body: userBody,
      structured: null,
      createdAt: now,
    });
  }

  if (assistantBody || assistantMessage?.structured) {
    doc.messages.push({
      id: makeMessageId('a'),
      role: 'assistant',
      body: assistantBody,
      structured: assistantMessage?.structured || null,
      createdAt: now + 1,
    });
  }

  while (doc.messages.length > MAX_MESSAGES) {
    doc.messages.shift();
  }

  doc.messageCount = doc.messages.length;
  doc.preview = previewFromMessages(doc.messages);
  if ((!doc.title || doc.title === 'New conversation') && userBody) {
    doc.title = titleFromQuery(userBody);
  }

  await doc.save();
  return summarize(doc.toObject());
}

async function deleteConversation({ organizationId, userId, conversationId } = {}) {
  if (!organizationId || !userId || !isObjectId(conversationId)) return false;
  const result = await AiConversation.deleteOne({
    _id: conversationId,
    organizationId,
    userId,
  });
  return result.deletedCount > 0;
}

/**
 * Delete all threads for a user. Optionally only those updated before `before`
 * (e.g. start of today) so "Today" chats can be kept.
 */
async function deleteAllConversations({
  organizationId,
  userId,
  before = null,
} = {}) {
  if (!organizationId || !userId) return 0;
  const filter = { organizationId, userId };
  if (before) {
    const cutoff = before instanceof Date ? before : new Date(before);
    if (!Number.isNaN(cutoff.getTime())) {
      filter.updatedAt = { $lt: cutoff };
    }
  }
  const result = await AiConversation.deleteMany(filter);
  return Number(result.deletedCount || 0);
}

async function renameConversation({ organizationId, userId, conversationId, title } = {}) {
  if (!organizationId || !userId || !isObjectId(conversationId)) return null;
  const nextTitle = titleFromQuery(title);
  const doc = await AiConversation.findOneAndUpdate(
    { _id: conversationId, organizationId, userId },
    { $set: { title: nextTitle } },
    { new: true },
  ).lean();
  return summarize(doc);
}

/**
 * Mark a pending proposal completed/dismissed so reload doesn't re-show Confirm.
 * Optionally appends a short assistant follow-up (e.g. "Event created").
 */
async function resolveProposal({
  organizationId,
  userId,
  conversationId,
  proposalId,
  status = 'completed',
  recordId = null,
  href = null,
  navigateLabel = null,
  label = null,
  rationale = null,
  assistantBody = null,
} = {}) {
  if (!organizationId || !userId || !isObjectId(conversationId) || !proposalId) {
    return null;
  }

  const doc = await AiConversation.findOne({
    _id: conversationId,
    organizationId,
    userId,
  });
  if (!doc) return null;

  let matched = false;
  for (const msg of doc.messages || []) {
    const structured = msg.structured && typeof msg.structured === 'object' ? msg.structured : null;
    if (!structured || !Array.isArray(structured.proposals)) continue;
    const idx = structured.proposals.findIndex((p) => p && String(p.id) === String(proposalId));
    if (idx < 0) continue;
    matched = true;
    if (status === 'dismissed') {
      structured.proposals.splice(idx, 1);
    } else {
      const prev = structured.proposals[idx] || {};
      structured.proposals[idx] = {
        ...prev,
        status: 'completed',
        recordId: recordId || prev.recordId || undefined,
        href: href || prev.href || undefined,
        navigateLabel: navigateLabel || prev.navigateLabel || undefined,
        label: label || prev.label,
        rationale: rationale || prev.rationale || 'Completed.',
      };
    }
    msg.structured = structured;
    msg.markModified('structured');
  }

  if (assistantBody) {
    doc.messages.push({
      id: makeMessageId('a'),
      role: 'assistant',
      body: String(assistantBody),
      structured: {
        blocks: [],
        suggestions: [],
        proposals: [],
        navigate: href
          ? { href, label: navigateLabel || 'Open record', recordId: recordId || undefined }
          : null,
      },
      createdAt: Date.now(),
    });
    while (doc.messages.length > MAX_MESSAGES) {
      doc.messages.shift();
    }
  }

  if (!matched && !assistantBody) return summarize(doc.toObject());

  doc.messageCount = doc.messages.length;
  await doc.save();
  return summarize(doc.toObject());
}

module.exports = {
  listConversations,
  getConversation,
  ensureConversation,
  appendTurn,
  deleteConversation,
  deleteAllConversations,
  renameConversation,
  resolveProposal,
  toLlmHistory,
  titleFromQuery,
  isObjectId,
};
