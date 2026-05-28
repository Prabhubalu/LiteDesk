const crypto = require('crypto');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const { handleChannelInteractionForHelpdesk } = require('../services/helpdeskChannelIngestionService');
const { setTyping, getTypingState } = require('../services/chatTypingService');

function secret() {
  return crypto.randomBytes(24).toString('hex');
}

function buildLiveChatSubject(session) {
  const name = String(session?.visitor?.name || '').trim();
  const email = String(session?.visitor?.email || '').trim();
  if (name && email) return `Live chat from ${name} (${email})`;
  if (name) return `Live chat from ${name}`;
  if (email) return `Live chat from ${email}`;
  return 'Live chat';
}

async function createSession(req, res) {
  try {
    const instancePublicKey =
      String(req.query?.instanceKey || req.body?.instanceKey || req.headers['x-instance-key'] || '').trim();

    const visitor = req.body?.visitor && typeof req.body.visitor === 'object' ? req.body.visitor : {};
    const pageUrl = String(req.body?.pageUrl || '').trim();

    const row = await ChatSession.create({
      organizationId: req.organization?._id || null,
      instancePublicKey,
      sessionSecret: secret(),
      visitor: {
        name: String(visitor.name || '').trim(),
        email: String(visitor.email || '').trim(),
        externalId: String(visitor.externalId || '').trim(),
      },
      pageUrl,
      userAgent: String(req.headers['user-agent'] || ''),
      ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    });

    return res.json({
      success: true,
      data: {
        sessionId: row._id,
        sessionSecret: row.sessionSecret
      }
    });
  } catch (err) {
    console.error('[embedChatController] createSession', err);
    return res.status(500).json({ success: false, message: 'Failed to create chat session' });
  }
}

async function assertSessionSecret(req, session) {
  const provided = String(req.headers['x-chat-session-secret'] || req.query?.sessionSecret || '').trim();
  if (!provided || provided !== String(session.sessionSecret)) {
    const err = new Error('Invalid session secret');
    err.statusCode = 403;
    throw err;
  }
}

async function postMessage(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ success: false, message: 'body is required' });

    const msg = await ChatMessage.create({
      organizationId: req.organization?._id || null,
      sessionId: session._id,
      direction: 'inbound',
      authorType: 'visitor',
      authorName: String(req.body?.authorName || session.visitor?.name || '').trim(),
      body
    });

    const now = new Date();

    // Auto-create/link a Helpdesk Case on first inbound message.
    let caseRecordId = session.caseRecordId || null;
    if (!caseRecordId && req.organization?._id) {
      try {
        const result = await handleChannelInteractionForHelpdesk({
          organizationId: req.organization._id,
          actorId: null,
          channel: 'Live Chat',
          explicitCaseId: null,
          externalReference: String(session._id),
          subject: buildLiveChatSubject(session),
          message: body,
          links: {},
          metadata: {
            chatSessionId: String(session._id),
            pageUrl: session.pageUrl || null
          }
        });
        caseRecordId = result?.caseRecord?._id || null;
      } catch (e) {
        // Don't block chat delivery if helpdesk case creation fails.
        console.error('[embedChatController] postMessage case create failed', e);
      }
    }

    // For follow-up inbound messages, append to the linked case timeline explicitly (avoid duplicate-handling surprises).
    if (caseRecordId && req.organization?._id) {
      try {
        await handleChannelInteractionForHelpdesk({
          organizationId: req.organization._id,
          actorId: null,
          channel: 'Live Chat',
          explicitCaseId: caseRecordId,
          externalReference: String(session._id),
          subject: buildLiveChatSubject(session),
          message: body,
          links: {},
          metadata: {
            chatSessionId: String(session._id),
            pageUrl: session.pageUrl || null
          }
        });
      } catch (e) {
        console.error('[embedChatController] postMessage case append failed', e);
      }
    }

    await ChatSession.updateOne(
      { _id: session._id },
      { $set: { lastMessageAt: now, ...(caseRecordId ? { caseRecordId } : {}) } }
    );

    return res.json({ success: true, data: msg });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] postMessage', err);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
}

async function listMessages(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const rows = await ChatMessage.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] listMessages', err);
    return res.status(500).json({ success: false, message: 'Failed to list messages' });
  }
}

async function setSessionTyping(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    setTyping({
      sessionId: session._id,
      authorType: 'visitor',
      authorName: String(req.body?.authorName || session.visitor?.name || '').trim()
    });
    return res.status(204).end();
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] setSessionTyping', err);
    return res.status(500).json({ success: false, message: 'Failed to set typing' });
  }
}

/**
 * SSE stream (simple polling) to avoid WebSocket infra initially.
 * Client provides ?after=<timestamp-ms> to get only newer messages.
 */
async function streamMessages(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

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
          .limit(100)
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

    req.on('close', () => {
      clearInterval(timer);
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] streamMessages', err);
    return res.status(500).json({ success: false, message: 'Failed to open stream' });
  }
}

module.exports = {
  createSession,
  postMessage,
  listMessages,
  setSessionTyping,
  streamMessages
};

