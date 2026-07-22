const { AI_KEY_MODES } = require('../constants/aiProviders');
const { getLlmAdapter } = require('../services/ai/providerRegistry');
const { resolveAiRequestConfig } = require('../services/ai/aiSettingsResolver');
const {
  getPublicAiSettings,
  updateAiSettings,
  listAvailableLlmModels,
} = require('../services/ai/aiSettingsService');
const { assertCreditsAvailable, debitCredits } = require('../services/ai/aiCreditService');
const { writeAiAuditLog, listAiAuditLogs } = require('../services/ai/aiAuditLogService');
const { redactMessages } = require('../services/ai/piiRedaction');
const { enqueueDocumentEmbed, enqueueContentDocumentEmbed } = require('../services/ai/aiEmbedQueueService');
const { AiConfigurationError, AiProviderError } = require('../services/ai/errors');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');
const { getPrompt } = require('../services/ai/prompts/promptRegistry');

function getOrganizationId(req) {
  return req.organization?._id || req.user?.organizationId;
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function listAiAuditLogsHandler(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const query = req.query || {};
    const summaryDays = Math.min(Math.max(Number(query.summaryDays) || 30, 1), 365);
    const days = Math.min(Math.max(Number(query.days) || summaryDays, 1), 365);
    const from = query.from
      || new Date(Date.now() - days * 86400000).toISOString();

    const payload = await listAiAuditLogs({
      organizationId,
      page: query.page,
      limit: query.limit,
      abilityKey: query.abilityKey || null,
      status: query.status || null,
      userId: query.userId || null,
      from,
      to: query.to || null,
      includeSummary: query.includeSummary !== 'false',
      summaryDays,
    });

    return res.json({
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('[aiController.listAiAuditLogs] error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'AI_AUDIT_LOG_FAILED',
      message: error.message || 'Failed to load AI audit log',
    });
  }
}

async function getAiStatus(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const payload = await getPublicAiSettings(organizationId);
    return res.json({
      success: true,
      status: payload.settings,
      supported: payload.supported,
    });
  } catch (error) {
    console.error('[aiController.getAiStatus] error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'AI_STATUS_FAILED',
      message: error.message || 'Failed to load AI status',
    });
  }
}

async function getAiSettings(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const payload = await getPublicAiSettings(organizationId);
    return res.json({
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('[aiController.getAiSettings] error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'AI_SETTINGS_FAILED',
      message: error.message || 'Failed to load AI settings',
    });
  }
}

async function getAiModels(req, res) {
  try {
    const payload = await listAvailableLlmModels({
      organizationId: getOrganizationId(req),
      provider: req.query?.provider,
    });
    return res.json({ success: true, ...payload });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      code: error.code || 'AI_MODEL_LOOKUP_FAILED',
      message: error.message || 'Failed to load provider models',
    });
  }
}

async function putAiSettings(req, res) {
  try {
    if (!isTenantPrivilegedUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'AI_SETTINGS_FORBIDDEN',
        message: 'Only organization owners or admins can update AI settings',
      });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');

    const organizationId = getOrganizationId(req);
    let before = null;
    try {
      before = cloneForAudit(await getPublicAiSettings(organizationId));
    } catch {
      before = {};
    }

    const patch = req.body || {};
    const payload = await updateAiSettings({
      organizationId,
      userId: req.user._id,
      patch,
    });

    attachSettingsAuditDiff(res, before, cloneForAudit(payload?.settings || payload), { body: patch });

    return res.json({
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('[aiController.putAiSettings] error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'AI_SETTINGS_UPDATE_FAILED',
      message: error.message || 'Failed to update AI settings',
    });
  }
}

/**
 * Never surface an upstream provider auth/authorization status (401/403) as our
 * own HTTP status: the shared API client treats 401/403 as an expired session
 * and force-logs-out the user. Upstream failures are gateway errors (502).
 */
function resolveAiHttpStatus(error, isProvider) {
  if (error?.code === 'AI_CREDITS_EXHAUSTED') return 402;
  const upstream = error.statusCode;
  if (isProvider) {
    if (upstream === 402 || upstream === 429) return upstream === 429 ? 429 : 402;
    if (!upstream || upstream === 401 || upstream === 403) return 502;
    return upstream;
  }
  return upstream || 500;
}

async function runEchoCompletion({ organizationId, userId, message }) {
  const startedAt = Date.now();
  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'echo',
    provider: 'unknown',
    model: 'unknown',
    keyMode: AI_KEY_MODES.PLATFORM,
  };

  const config = await resolveAiRequestConfig({
    organizationId,
    abilityKey: 'echo',
  });

  auditBase = {
    ...auditBase,
    provider: config.provider,
    model: config.model,
    keyMode: config.keyMode,
  };

  assertCreditsAvailable({
    keyMode: config.keyMode,
    creditsBalance: config.creditsBalance,
  });

  const adapter = getLlmAdapter(config.provider);
  const echoSystem = getPrompt('echo_system');
  const messages = redactMessages([
    {
      role: 'system',
      content: echoSystem.text,
    },
    {
      role: 'user',
      content: message,
    },
  ]);

  const completion = await adapter.complete({
    apiKey: config.apiKey,
    model: config.model,
    messages,
    temperature: 0.2,
    maxTokens: 300,
    providerOptions: config.providerOptions,
  });

  const creditsDebited = await debitCredits({
    organizationId,
    keyMode: config.keyMode,
    usage: completion.usage,
  });

  await writeAiAuditLog({
    ...auditBase,
    status: 'success',
    promptVersion: echoSystem.version,
    usage: completion.usage,
    creditsDebited,
    latencyMs: Date.now() - startedAt,
  });

  return {
    provider: config.provider,
    model: config.model,
    keyMode: config.keyMode,
    creditsDebited,
    text: completion.text,
    usage: completion.usage,
  };
}

async function echoAi(req, res) {
  const organizationId = getOrganizationId(req);
  const userId = req.user?._id;
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({
        success: false,
        code: 'AI_MESSAGE_REQUIRED',
        message: 'message is required',
      });
    }

    const result = await runEchoCompletion({ organizationId, userId, message });
    return res.json({ success: true, ...result });
  } catch (error) {
    const isConfig = error instanceof AiConfigurationError;
    const isProvider = error instanceof AiProviderError;
    await writeAiAuditLog({
      organizationId,
      userId,
      abilityKey: 'echo',
      provider: 'unknown',
      model: 'unknown',
      keyMode: AI_KEY_MODES.PLATFORM,
      status: isConfig ? 'not_configured' : 'failed',
      errorCode: error.code || 'AI_ECHO_FAILED',
      errorMessage: error.message,
    });

    return res.status(resolveAiHttpStatus(error, isProvider)).json({
      success: false,
      code: error.code || 'AI_ECHO_FAILED',
      message: error.message || 'AI request failed',
    });
  }
}

async function echoAiStream(req, res) {
  const startedAt = Date.now();
  const organizationId = getOrganizationId(req);
  const userId = req.user?._id;
  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'echo',
    provider: 'unknown',
    model: 'unknown',
    keyMode: AI_KEY_MODES.PLATFORM,
  };

  try {
    const message = String(req.body?.message || req.query?.message || '').trim();
    if (!message) {
      return res.status(400).json({
        success: false,
        code: 'AI_MESSAGE_REQUIRED',
        message: 'message is required',
      });
    }

    const config = await resolveAiRequestConfig({
      organizationId,
      abilityKey: 'echo',
    });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };

    assertCreditsAvailable({
      keyMode: config.keyMode,
      creditsBalance: config.creditsBalance,
    });

    const adapter = getLlmAdapter(config.provider);
    if (typeof adapter.stream !== 'function') {
      throw new AiConfigurationError(
        'Streaming is not available for the selected provider',
        'AI_STREAM_NOT_SUPPORTED'
      );
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    writeSse(res, 'connected', {
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    });

    const messages = redactMessages([
      {
        role: 'system',
        content: getPrompt('echo_system').text,
      },
      {
        role: 'user',
        content: message,
      },
    ]);

    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for await (const event of adapter.stream({
      apiKey: config.apiKey,
      model: config.model,
      messages,
      temperature: 0.2,
      maxTokens: 300,
      providerOptions: config.providerOptions,
    })) {
      if (event.type === 'delta') {
        writeSse(res, 'delta', { text: event.text });
      } else if (event.type === 'done') {
        usage = event.usage || usage;
      }
    }

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: getPrompt('echo_system').version,
      usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    writeSse(res, 'done', {
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage,
    });
    res.end();
  } catch (error) {
    const isConfig = error instanceof AiConfigurationError;
    const isProvider = error instanceof AiProviderError;
    await writeAiAuditLog({
      ...auditBase,
      status: isConfig ? 'not_configured' : 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_ECHO_STREAM_FAILED',
      errorMessage: error.message,
    });

    if (res.headersSent) {
      writeSse(res, 'error', {
        code: error.code || 'AI_ECHO_STREAM_FAILED',
        message: error.message || 'AI stream failed',
      });
      res.end();
      return;
    }

    return res.status(resolveAiHttpStatus(error, isProvider)).json({
      success: false,
      code: error.code || 'AI_ECHO_STREAM_FAILED',
      message: error.message || 'AI stream failed',
    });
  }
}

async function enqueueDocumentEmbedJob(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const documentId = String(req.params.documentId || req.body?.documentId || '').trim();
    if (!documentId) {
      return res.status(400).json({
        success: false,
        code: 'AI_DOCUMENT_ID_REQUIRED',
        message: 'documentId is required',
      });
    }

    const queueResult = enqueueDocumentEmbed({
      organizationId,
      documentId,
      userId: req.user?._id,
    });

    return res.status(202).json({
      success: true,
      documentId,
      ...queueResult,
    });
  } catch (error) {
    console.error('[aiController.enqueueDocumentEmbedJob] error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'AI_EMBED_ENQUEUE_FAILED',
      message: error.message || 'Failed to enqueue document embed',
    });
  }
}

async function enqueueContentDocumentEmbedJob(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const contentDocumentId = String(
      req.params.contentDocumentId || req.body?.contentDocumentId || ''
    ).trim();
    if (!contentDocumentId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CONTENT_DOCUMENT_ID_REQUIRED',
        message: 'contentDocumentId is required',
      });
    }

    const queueResult = enqueueContentDocumentEmbed({
      organizationId,
      contentDocumentId,
      userId: req.user?._id,
    });

    return res.status(202).json({
      success: true,
      contentDocumentId,
      ...queueResult,
    });
  } catch (error) {
    console.error('[aiController.enqueueContentDocumentEmbedJob] error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'AI_CONTENT_EMBED_ENQUEUE_FAILED',
      message: error.message || 'Failed to enqueue content document embed',
    });
  }
}

module.exports = {
  listAiAuditLogsHandler,
  getAiStatus,
  getAiSettings,
  getAiModels,
  putAiSettings,
  echoAi,
  echoAiStream,
  enqueueDocumentEmbedJob,
  enqueueContentDocumentEmbedJob,
};
