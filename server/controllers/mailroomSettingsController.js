const mailroomConfigService = require('../services/mailroomConfigService');
const { buildNormalizedMessage } = require('../platform/mailroom/domain/normalizedMessage');
const { evaluate, evaluatePipeline } = require('../platform/mailroom/policies/policyEngine');
const { buildEmailCandidates } = require('../platform/mailroom/services/candidatesService');
const {
  listConversations,
  getConversationWithMessages,
  listThreadingLogs
} = require('../platform/mailroom/services/conversationPersistenceService');
const {
  listProcessingFailures,
  replayRawPayload
} = require('../platform/mailroom/services/processingFailureService');
const { MAILROOM_THREADING_SIGNALS } = require('../constants/mailroomPolicies');

async function getMailroomSettings(req, res) {
  try {
    const config = await mailroomConfigService.getOrCreateConfig(req.user.organizationId);
    const templates = mailroomConfigService.listTemplates();
    return res.json({
      success: true,
      data: config,
      meta: { templates }
    });
  } catch (error) {
    console.error('[mailroomSettingsController] getMailroomSettings', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load Mailroom settings'
    });
  }
}

async function updateMailroomSettings(req, res) {
  try {
    const row = await mailroomConfigService.upsertConfig(
      req.user.organizationId,
      req.user._id,
      req.body || {}
    );
    return res.json({
      success: true,
      data: {
        organizationId: row.organizationId,
        enabled: row.enabled === true,
        activeTemplateId: row.activeTemplateId,
        schemaVersion: row.schemaVersion,
        policies: row.policies,
        connectors: row.connectors,
        updatedAt: row.updatedAt
      }
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        errors: error.validationErrors || undefined
      });
    }
    console.error('[mailroomSettingsController] updateMailroomSettings', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Mailroom settings'
    });
  }
}

async function listMailroomTemplates(req, res) {
  try {
    return res.json({
      success: true,
      data: mailroomConfigService.listTemplates()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to list templates' });
  }
}

/**
 * Policy simulation — no Cases/DB side effects (M0 exit criteria).
 */
async function evaluateMailroomPolicies(req, res) {
  try {
    const config = await mailroomConfigService.getOrCreateConfig(req.user.organizationId);
    const policies = req.body?.policies || config.policies;
    const message = buildNormalizedMessage(req.body?.message || {});
    const candidates = req.body?.candidates
      || (await buildEmailCandidates(req.user.organizationId, message));

    const policyType = req.body?.policyType;
    let result;
    if (policyType) {
      result = evaluate(policyType, { message, candidates, policies });
    } else {
      result = evaluatePipeline({ message, candidates, policies });
    }

    return res.json({
      success: true,
      data: result,
      meta: { candidatesLoaded: !req.body?.candidates }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Policy evaluation failed'
    });
  }
}

async function listMailroomConversations(req, res) {
  try {
    const rows = await listConversations(req.user.organizationId, {
      limit: req.query.limit,
      channel: req.query.channel
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[mailroomSettingsController] listMailroomConversations', error);
    return res.status(500).json({ success: false, message: 'Failed to list conversations' });
  }
}

async function getMailroomConversation(req, res) {
  try {
    const row = await getConversationWithMessages(req.user.organizationId, req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error('[mailroomSettingsController] getMailroomConversation', error);
    return res.status(500).json({ success: false, message: 'Failed to load conversation' });
  }
}

async function listMailroomThreadingLogs(req, res) {
  try {
    const rows = await listThreadingLogs(req.user.organizationId, {
      limit: req.query.limit,
      conversationId: req.query.conversationId || null
    });
    return res.json({
      success: true,
      data: rows,
      meta: { signals: MAILROOM_THREADING_SIGNALS }
    });
  } catch (error) {
    console.error('[mailroomSettingsController] listMailroomThreadingLogs', error);
    return res.status(500).json({ success: false, message: 'Failed to list threading logs' });
  }
}

async function listMailroomProcessingFailures(req, res) {
  try {
    const rows = await listProcessingFailures(req.user.organizationId, {
      limit: req.query.limit,
      status: req.query.status || 'open'
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[mailroomSettingsController] listMailroomProcessingFailures', error);
    return res.status(500).json({ success: false, message: 'Failed to list processing failures' });
  }
}

async function replayMailroomProcessingFailure(req, res) {
  try {
    const rawPayloadId = req.params.rawPayloadId;
    const result = await replayRawPayload(req.user.organizationId, rawPayloadId);
    return res.json({
      success: true,
      data: result.result,
      message: 'Payload replayed successfully'
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[mailroomSettingsController] replayMailroomProcessingFailure', error);
    return res.status(500).json({ success: false, message: 'Failed to replay payload' });
  }
}

module.exports = {
  getMailroomSettings,
  updateMailroomSettings,
  listMailroomTemplates,
  evaluateMailroomPolicies,
  listMailroomConversations,
  getMailroomConversation,
  listMailroomThreadingLogs,
  listMailroomProcessingFailures,
  replayMailroomProcessingFailure
};
