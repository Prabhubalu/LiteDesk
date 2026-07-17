'use strict';

const mongoose = require('mongoose');
const AiConversation = require('../../models/AiConversation');

const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 120;

function toPublic(doc, { includeMessages = true } = {}) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const messages = Array.isArray(plain.messages) ? plain.messages : [];
  const messageCount = Number.isFinite(Number(plain.messageCount))
    ? Number(plain.messageCount)
    : messages.length;
  const out = {
    id: String(plain._id),
    title: String(plain.title || 'New conversation'),
    createdAt: plain.createdAt ? new Date(plain.createdAt).getTime() : Date.now(),
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt).getTime() : Date.now(),
    moduleKey: plain.moduleKey || undefined,
    recordId: plain.recordId || undefined,
    contextLabel: plain.contextLabel || undefined,
    messageCount,
  };
  if (includeMessages) {
    out.messages = messages.slice(-MAX_MESSAGES).map((m) => ({
      id: String(m.id || ''),
      role: m.role === 'assistant' ? 'assistant' : 'user',
      body: String(m.body || ''),
      structured: m.structured || null,
      citations: Array.isArray(m.citations) ? m.citations : undefined,
      source: m.source || '',
      meta: m.meta || undefined,
      createdAt: Number(m.createdAt) || undefined,
    }));
  }
  return out;
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      id: String(m.id || `m_${Date.now()}`).slice(0, 64),
      role: m.role === 'assistant' ? 'assistant' : 'user',
      body: String(m.body || '').slice(0, 20000),
      structured: m.structured && typeof m.structured === 'object' ? m.structured : null,
      citations: Array.isArray(m.citations) ? m.citations.slice(0, 40) : undefined,
      source: String(m.source || '').slice(0, 40),
      meta: m.meta && typeof m.meta === 'object' ? m.meta : undefined,
      createdAt: Number(m.createdAt) || Date.now(),
    }));
}

function titleFromMessages(messages, fallback) {
  const firstUser = (messages || []).find((m) => m.role === 'user' && String(m.body || '').trim());
  const text = String(firstUser?.body || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback || 'New conversation';
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

async function listConversations(organizationId, userId, { limit = MAX_CONVERSATIONS } = {}) {
  const rows = await AiConversation.find({
    organizationId,
    userId,
  })
    .select('-messages')
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || MAX_CONVERSATIONS, 1), MAX_CONVERSATIONS))
    .lean();

  return rows.map((row) => toPublic(row, { includeMessages: false }));
}

async function getConversation(organizationId, userId, conversationId) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return null;
  const doc = await AiConversation.findOne({
    _id: conversationId,
    organizationId,
    userId,
  }).lean();
  return toPublic(doc, { includeMessages: true });
}

async function createConversation({
  organizationId,
  userId,
  title,
  messages,
  moduleKey,
  recordId,
  contextLabel,
  appKey,
}) {
  const sanitized = sanitizeMessages(messages);
  const doc = await AiConversation.create({
    organizationId,
    userId,
    title: String(title || titleFromMessages(sanitized) || 'New conversation').slice(0, 120),
    messages: sanitized,
    messageCount: sanitized.length,
    moduleKey: String(moduleKey || '').slice(0, 80),
    recordId: String(recordId || '').slice(0, 80),
    contextLabel: String(contextLabel || '').slice(0, 200),
    appKey: String(appKey || '').slice(0, 80),
  });

  // Enforce per-user cap: drop oldest beyond MAX_CONVERSATIONS
  const excess = await AiConversation.find({ organizationId, userId })
    .select('_id')
    .sort({ updatedAt: -1 })
    .skip(MAX_CONVERSATIONS)
    .lean();
  if (excess.length) {
    await AiConversation.deleteMany({
      organizationId,
      userId,
      _id: { $in: excess.map((e) => e._id) },
    });
  }

  return toPublic(doc, { includeMessages: true });
}

async function updateConversation({
  organizationId,
  userId,
  conversationId,
  title,
  messages,
  moduleKey,
  recordId,
  contextLabel,
}) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    err.code = 'AI_CONVERSATION_NOT_FOUND';
    throw err;
  }

  const update = {};
  if (messages !== undefined) {
    update.messages = sanitizeMessages(messages);
    update.messageCount = update.messages.length;
    if (title === undefined) {
      update.title = titleFromMessages(update.messages, 'New conversation').slice(0, 120);
    }
  }
  if (title !== undefined) {
    update.title = String(title || 'New conversation').slice(0, 120);
  }
  if (moduleKey !== undefined) update.moduleKey = String(moduleKey || '').slice(0, 80);
  if (recordId !== undefined) update.recordId = String(recordId || '').slice(0, 80);
  if (contextLabel !== undefined) update.contextLabel = String(contextLabel || '').slice(0, 200);

  const doc = await AiConversation.findOneAndUpdate(
    { _id: conversationId, organizationId, userId },
    { $set: update },
    { new: true },
  ).lean();

  if (!doc) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    err.code = 'AI_CONVERSATION_NOT_FOUND';
    throw err;
  }
  return toPublic(doc, { includeMessages: true });
}

async function deleteConversation(organizationId, userId, conversationId) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return false;
  const result = await AiConversation.deleteOne({
    _id: conversationId,
    organizationId,
    userId,
  });
  return result.deletedCount > 0;
}

module.exports = {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  toPublic,
  MAX_CONVERSATIONS,
  MAX_MESSAGES,
};
