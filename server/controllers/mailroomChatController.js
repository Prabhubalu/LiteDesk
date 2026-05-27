const mailroomConfigService = require('../services/mailroomConfigService');
const {
  processNormalizedInboundThroughMailroom
} = require('../platform/mailroom/pipeline/genericInboundPipeline');
const { buildChatMailroomMessage } = require('../platform/mailroom/connectors/chat/chatMessageBuilder');

async function assertChatConnectorEnabled(organizationId) {
  const config = await mailroomConfigService.getOrCreateConfig(organizationId);
  if (!config?.enabled || !config?.connectors?.chat?.enabled) {
    const err = new Error('Mailroom chat connector is disabled');
    err.statusCode = 403;
    throw err;
  }
  return config;
}

/**
 * POST /api/mailroom/chat/ingest
 * Auth: standard Bearer session (protect middleware).
 *
 * Body:
 * {
 *   "sessionId": "optional",
 *   "message": {
 *     "externalMessageId": "...",
 *     "participants": { "from": "...", "to": [...] },
 *     "body": "...",
 *     "metadata": { ... }
 *   }
 * }
 */
async function ingestChatMessage(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    await assertChatConnectorEnabled(organizationId);

    const sessionId = req.body?.sessionId || req.body?.message?.metadata?.chatSessionId || null;
    const normalized = await buildChatMailroomMessage(req.body?.message || {}, {
      sessionId,
      subjectFallback: 'Live chat'
    });

    const result = await processNormalizedInboundThroughMailroom({
      organizationId,
      connectorType: 'chat',
      source: 'chat',
      jsonPayload: req.body || {},
      message: normalized
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        errors: error.validationErrors || undefined
      });
    }
    console.error('[mailroomChatController] ingestChatMessage', error);
    return res.status(500).json({ success: false, message: 'Failed to ingest chat message' });
  }
}

module.exports = {
  ingestChatMessage
};

