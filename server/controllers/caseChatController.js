const mongoose = require('mongoose');
const Case = require('../models/Case');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const caseExecutionService = require('../services/caseExecutionService');
const { setTyping, getTypingState } = require('../services/chatTypingService');

function requireObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid case id');
    err.statusCode = 400;
    throw err;
  }
  return id;
}

async function loadSessionByCaseRecordId(caseRecordId) {
  return await ChatSession.findOne({ caseRecordId }).sort({ createdAt: -1 }).lean();
}

exports.getCaseChatSession = async (req, res) => {
  try {
    const caseRecordId = requireObjectId(req.params.id);
    const session = await loadSessionByCaseRecordId(caseRecordId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'No chat session linked to this case' });
    }
    return res.json({
      success: true,
      data: {
        sessionId: session._id,
        status: session.status,
        lastMessageAt: session.lastMessageAt || null,
        visitor: session.visitor || {}
      }
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[caseChatController] getCaseChatSession', err);
    return res.status(500).json({ success: false, message: 'Failed to load chat session' });
  }
};

exports.listCaseChatMessages = async (req, res) => {
  try {
    const caseRecordId = requireObjectId(req.params.id);
    const session = await loadSessionByCaseRecordId(caseRecordId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'No chat session linked to this case' });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const rows = await ChatMessage.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, data: rows, meta: { sessionId: session._id } });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[caseChatController] listCaseChatMessages', err);
    return res.status(500).json({ success: false, message: 'Failed to list chat messages' });
  }
};

exports.sendCaseChatMessage = async (req, res) => {
  try {
    const caseRecordId = requireObjectId(req.params.id);
    const session = await loadSessionByCaseRecordId(caseRecordId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'No chat session linked to this case' });
    }
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ success: false, message: 'body is required' });

    const authorName =
      [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim() ||
      req.user?.username ||
      req.user?.email ||
      'Agent';

    const msg = await ChatMessage.create({
      organizationId: req.user?.organizationId || null,
      sessionId: session._id,
      direction: 'outbound',
      authorType: 'agent',
      authorName,
      body
    });

    await ChatSession.updateOne({ _id: session._id }, { $set: { lastMessageAt: new Date() } });

    // Mirror agent reply into the case timeline.
    const row = await Case.findOne({
      _id: caseRecordId,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (row) {
      row.activities = Array.isArray(row.activities) ? row.activities : [];
      row.activities.push({
        activityType: 'agent_message',
        message: body,
        channel: 'Live Chat',
        internal: false,
        metadata: {
          chatSessionId: String(session._id),
          chatMessageId: String(msg._id)
        },
        actorId: req.user._id,
        actorName: authorName,
        createdAt: new Date()
      });
      row.updatedBy = req.user._id;
      await row.save();
      await caseExecutionService.onCaseActivityLogged({
        caseRecord: row,
        actorId: req.user._id,
        activityType: 'agent_message'
      });
    }
    return res.status(201).json({ success: true, data: msg, meta: { sessionId: session._id } });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[caseChatController] sendCaseChatMessage', err);
    return res.status(500).json({ success: false, message: 'Failed to send chat message' });
  }
};

exports.setCaseChatTyping = async (req, res) => {
  try {
    const caseRecordId = requireObjectId(req.params.id);
    const session = await loadSessionByCaseRecordId(caseRecordId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'No chat session linked to this case' });
    }
    const authorName =
      [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim() ||
      req.user?.username ||
      req.user?.email ||
      'Agent';

    setTyping({
      sessionId: session._id,
      authorType: 'agent',
      authorName
    });
    return res.status(204).end();
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[caseChatController] setCaseChatTyping', err);
    return res.status(500).json({ success: false, message: 'Failed to set typing' });
  }
};

/**
 * SSE stream for agents in the case UI.
 * Sends all new messages (inbound + outbound) for the linked session.
 */
exports.streamCaseChatMessages = async (req, res) => {
  try {
    const caseRecordId = requireObjectId(req.params.id);
    const session = await loadSessionByCaseRecordId(caseRecordId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'No chat session linked to this case' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const startedAt = Date.now();
    let after = Number(req.query.after) || startedAt;
    let lastTypingHash = '';
    const timer = setInterval(async () => {
      try {
        const rows = await ChatMessage.find({
          sessionId: session._id,
          createdAt: { $gt: new Date(after) }
        })
          .sort({ createdAt: 1 })
          .limit(200)
          .lean();

        if (rows.length) {
          after = rows[rows.length - 1].createdAt.getTime();
          res.write(`event: messages\n`);
          res.write(`data: ${JSON.stringify(rows)}\n\n`);
        }

        const typing = getTypingState(session._id);
        const typingHash = typing ? JSON.stringify(typing) : '';
        // Emit typing periodically while active (more resilient to reconnects/missed first event).
        if (typing) {
          lastTypingHash = typingHash;
          res.write(`event: typing\n`);
          res.write(`data: ${JSON.stringify(typing)}\n\n`);
        } else if (typingHash !== lastTypingHash) {
          lastTypingHash = typingHash;
          res.write(`event: typing\n`);
          res.write(`data: {}\n\n`);
        }

        if (!rows.length) {
          res.write(`event: ping\n`);
          res.write(`data: {}\n\n`);
        }
      } catch (e) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message: 'stream error' })}\n\n`);
      }
    }, 1500);

    req.on('close', () => clearInterval(timer));
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[caseChatController] streamCaseChatMessages', err);
    return res.status(500).json({ success: false, message: 'Failed to open stream' });
  }
};

