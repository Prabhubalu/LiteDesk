const express = require('express');
const { resolveEmbedChatInstance } = require('../middleware/embedChatContextMiddleware');
const {
  createSession,
  postMessage,
  listMessages,
  setSessionTyping,
  streamMessages
} = require('../controllers/embedChatController');

const router = express.Router();

// Public widget needs cross-origin access from customer websites.
router.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Instance-Key, X-Chat-Session-Secret');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

// Resolve tenant context from instanceKey for all embed chat routes.
router.use(resolveEmbedChatInstance);

router.post('/sessions', createSession);
router.get('/sessions/:sessionId/messages', listMessages);
router.post('/sessions/:sessionId/messages', postMessage);
router.post('/sessions/:sessionId/typing', setSessionTyping);
router.get('/sessions/:sessionId/stream', streamMessages);

module.exports = router;

