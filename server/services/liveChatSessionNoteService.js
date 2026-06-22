'use strict';

const mongoose = require('mongoose');
const LiveChatSessionNote = require('../models/LiveChatSessionNote');
const { normalizeSessionNoteBody } = require('../constants/liveChatSessionIdentity');
const { loadUsersById } = require('./liveChatSessionEnrichmentService');

async function listSessionNotes({ organizationId, sessionId, limit = 50 }) {
  if (!organizationId || !sessionId) return [];

  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await LiveChatSessionNote.find({ organizationId, sessionId })
    .sort({ createdAt: -1 })
    .limit(cappedLimit)
    .lean();

  const authorIds = rows.map((row) => row.authorId).filter(Boolean);
  const usersById = await loadUsersById(authorIds);

  return rows.map((row) => ({
    _id: row._id,
    body: String(row.body || '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: row.authorId ? usersById.get(String(row.authorId)) || null : null,
    authorId: row.authorId || null,
  }));
}

async function createSessionNote({ organizationId, sessionId, authorId, body }) {
  if (!organizationId || !sessionId || !authorId) {
    const err = new Error('Invalid note request');
    err.statusCode = 400;
    throw err;
  }

  const normalizedBody = normalizeSessionNoteBody(body);
  if (!normalizedBody) {
    const err = new Error('Note body is required');
    err.statusCode = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(authorId)) {
    const err = new Error('Invalid author');
    err.statusCode = 400;
    throw err;
  }

  const row = await LiveChatSessionNote.create({
    organizationId,
    sessionId,
    authorId,
    body: normalizedBody,
  });

  const usersById = await loadUsersById([authorId]);
  return {
    _id: row._id,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: usersById.get(String(authorId)) || null,
    authorId: row.authorId,
  };
}

module.exports = {
  listSessionNotes,
  createSessionNote,
};
