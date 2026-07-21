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
const { summarizeCase, draftCaseReply } = require('../services/ai/aiAssistService');
const { summarizeRecord } = require('../services/ai/aiRecordSummaryService');
const { askKnowledge } = require('../services/ai/aiKnowledgeService');
const { recordAiFeedback } = require('../services/ai/aiFeedbackService');
const { draftDealQuote, briefOverdueInvoices } = require('../services/ai/aiCommercialService');
const { askWorkGraph, researchRecord } = require('../services/ai/aiWorkGraphService');
const {
  listTenantAgents,
  createTenantAgent,
  updateTenantAgent,
  deleteTenantAgent,
  routeTenantAgent,
  runTenantAgentAsk,
  suggestTenantAgentTriggers,
  synthesizeAndCreateTenantAgent,
  isAgentEligibleForPage,
} = require('../services/ai/aiTenantAgentService');
const { applyAstraMutation } = require('../services/ai/aiAstraMutationService');
const {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
} = require('../services/ai/aiConversationService');
const {
  extractFields,
  suggestPeopleDuplicates,
  suggestOrganizationDuplicates,
} = require('../services/ai/aiExtractService');
const { classifyText } = require('../services/ai/aiClassifyService');
const {
  suggestCasePolicyActions,
  proposeInboxTriage,
  proposeCaseResolution,
} = require('../services/ai/aiAgentService');
const {
  assistCampaignSubject,
  assistCampaignBody,
  summarizeCampaign,
} = require('../services/ai/aiMarketingService');
const { suggestImportColumnMapping } = require('../services/ai/aiImportMappingService');
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

    const organizationId = getOrganizationId(req);
    const payload = await updateAiSettings({
      organizationId,
      userId: req.user._id,
      patch: req.body || {},
    });

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

/**
 * Never surface an upstream provider auth/authorization status (401/403) as our
 * own HTTP status: the shared API client treats 401/403 as an expired session
 * and force-logs-out the user. Upstream failures are gateway errors (502).
 */
function resolveAiHttpStatus(error, isProvider) {
  if (error?.code === 'AI_CREDITS_EXHAUSTED') return 402;
  const upstream = error.statusCode;
  if (isProvider) {
    // Provider billing/quota — keep 402 for the client, never 401/403 (session logout).
    if (upstream === 402 || upstream === 429) return upstream === 429 ? 429 : 402;
    if (!upstream || upstream === 401 || upstream === 403) return 502;
    return upstream;
  }
  return upstream || 500;
}

function assistErrorResponse(res, error, fallbackCode) {
  const isConfig = error instanceof AiConfigurationError;
  const isProvider = error instanceof AiProviderError;
  const code = error.code || fallbackCode;
  let message = error.message || 'AI assist request failed';
  if (code === 'AI_CREDITS_EXHAUSTED') {
    message = 'AI credits are exhausted. Add credits in Settings → AI, or switch to Bring Your Own Key.';
  } else if (isProvider && (error.statusCode === 402 || error.statusCode === 429)) {
    message = 'AI provider quota or billing blocked this request. Check your provider plan, or use platform credits / BYOK in Settings → AI.';
  }
  return res.status(resolveAiHttpStatus(error, isProvider)).json({
    success: false,
    code,
    message,
    notConfigured: isConfig,
    ...(error.details && typeof error.details === 'object' ? { details: error.details } : {}),
  });
}

async function summarizeCaseAi(req, res) {
  try {
    const caseId = String(req.params.caseId || req.body?.caseId || '').trim();
    if (!caseId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CASE_ID_REQUIRED',
        message: 'caseId is required',
      });
    }

    const result = await summarizeCase({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      caseId,
      forceRefresh: Boolean(req.body?.forceRefresh),
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.summarizeCaseAi] error:', error);
    return assistErrorResponse(res, error, 'AI_SUMMARIZE_FAILED');
  }
}

async function summarizeDealAi(req, res) {
  try {
    const dealId = String(req.params.dealId || req.body?.dealId || '').trim();
    if (!dealId) {
      return res.status(400).json({
        success: false,
        code: 'AI_DEAL_ID_REQUIRED',
        message: 'dealId is required',
      });
    }

    const result = await summarizeRecord({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      sourceType: 'deal',
      recordId: dealId,
      forceRefresh: Boolean(req.body?.forceRefresh),
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.summarizeDealAi] error:', error);
    return assistErrorResponse(res, error, 'AI_SUMMARIZE_FAILED');
  }
}

async function summarizePeopleAi(req, res) {
  try {
    const peopleId = String(req.params.peopleId || req.body?.peopleId || '').trim();
    if (!peopleId) {
      return res.status(400).json({
        success: false,
        code: 'AI_PEOPLE_ID_REQUIRED',
        message: 'peopleId is required',
      });
    }

    const result = await summarizeRecord({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      sourceType: 'people',
      recordId: peopleId,
      forceRefresh: Boolean(req.body?.forceRefresh),
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.summarizePeopleAi] error:', error);
    return assistErrorResponse(res, error, 'AI_SUMMARIZE_FAILED');
  }
}

async function draftCaseReplyAi(req, res) {
  try {
    const caseId = String(req.params.caseId || req.body?.caseId || '').trim();
    if (!caseId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CASE_ID_REQUIRED',
        message: 'caseId is required',
      });
    }

    const result = await draftCaseReply({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      caseId,
      tone: req.body?.tone,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.draftCaseReplyAi] error:', error);
    return assistErrorResponse(res, error, 'AI_DRAFT_REPLY_FAILED');
  }
}

async function askKnowledgeAi(req, res) {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({
        success: false,
        code: 'AI_QUESTION_REQUIRED',
        message: 'question is required',
      });
    }

    const result = await askKnowledge({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      question,
      topK: req.body?.topK,
      sourceType: req.body?.sourceType || null,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.askKnowledgeAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASK_FAILED');
  }
}

async function submitAiFeedback(req, res) {
  try {
    const result = await recordAiFeedback({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      rating: req.body?.rating,
      targetAbilityKey: req.body?.targetAbilityKey || req.body?.abilityKey,
      provider: req.body?.provider,
      model: req.body?.model,
      keyMode: req.body?.keyMode,
      contextRefs: Array.isArray(req.body?.contextRefs) ? req.body.contextRefs : [],
      comment: req.body?.comment,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.submitAiFeedback] error:', error);
    return assistErrorResponse(res, error, 'AI_FEEDBACK_FAILED');
  }
}

async function draftDealQuoteAi(req, res) {
  try {
    const dealId = String(req.params.dealId || req.body?.dealId || '').trim();
    if (!dealId) {
      return res.status(400).json({
        success: false,
        code: 'AI_DEAL_ID_REQUIRED',
        message: 'dealId is required',
      });
    }
    const result = await draftDealQuote({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      dealId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.draftDealQuoteAi] error:', error);
    return assistErrorResponse(res, error, 'AI_DEAL_QUOTE_DRAFT_FAILED');
  }
}

async function briefOverdueInvoicesAi(req, res) {
  try {
    const result = await briefOverdueInvoices({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      limit: req.body?.limit,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.briefOverdueInvoicesAi] error:', error);
    return assistErrorResponse(res, error, 'AI_INVOICE_BRIEF_FAILED');
  }
}

async function askWorkGraphAi(req, res) {
  try {
    const result = await askWorkGraph({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      appKey: req.body?.appKey || req.appKey || 'SALES',
      moduleKey: req.body?.moduleKey,
      recordId: req.body?.recordId,
      question: req.body?.question,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.askWorkGraphAi] error:', error);
    return assistErrorResponse(res, error, 'AI_WORK_GRAPH_ASK_FAILED');
  }
}

async function listAiConversations(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'User required' });
    }
    const conversations = await listConversations(organizationId, userId, {
      limit: req.query?.limit,
    });
    return res.json({ success: true, conversations });
  } catch (error) {
    console.error('[aiController.listAiConversations] error:', error);
    return assistErrorResponse(res, error, 'AI_CONVERSATION_LIST_FAILED');
  }
}

async function getAiConversation(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    const conversationId = String(req.params.conversationId || '').trim();
    if (!userId) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'User required' });
    }
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CONVERSATION_ID_REQUIRED',
        message: 'conversationId is required',
      });
    }
    const conversation = await getConversation(organizationId, userId, conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'AI_CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }
    return res.json({ success: true, conversation });
  } catch (error) {
    console.error('[aiController.getAiConversation] error:', error);
    return assistErrorResponse(res, error, 'AI_CONVERSATION_GET_FAILED');
  }
}

async function createAiConversation(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'User required' });
    }
    const body = req.body || {};
    const conversation = await createConversation({
      organizationId,
      userId,
      title: body.title,
      messages: body.messages,
      moduleKey: body.moduleKey,
      recordId: body.recordId,
      contextLabel: body.contextLabel,
      appKey: req.appContext?.appKey || body.appKey,
    });
    return res.status(201).json({ success: true, conversation });
  } catch (error) {
    console.error('[aiController.createAiConversation] error:', error);
    return assistErrorResponse(res, error, 'AI_CONVERSATION_CREATE_FAILED');
  }
}

async function updateAiConversation(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    const conversationId = String(req.params.conversationId || '').trim();
    if (!userId) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'User required' });
    }
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CONVERSATION_ID_REQUIRED',
        message: 'conversationId is required',
      });
    }
    const body = req.body || {};
    const conversation = await updateConversation({
      organizationId,
      userId,
      conversationId,
      title: body.title,
      messages: body.messages,
      moduleKey: body.moduleKey,
      recordId: body.recordId,
      contextLabel: body.contextLabel,
    });
    return res.json({ success: true, conversation });
  } catch (error) {
    if (error?.code === 'AI_CONVERSATION_NOT_FOUND' || error?.statusCode === 404) {
      return res.status(404).json({
        success: false,
        code: 'AI_CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }
    console.error('[aiController.updateAiConversation] error:', error);
    return assistErrorResponse(res, error, 'AI_CONVERSATION_UPDATE_FAILED');
  }
}

async function deleteAiConversation(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    const conversationId = String(req.params.conversationId || '').trim();
    if (!userId) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'User required' });
    }
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CONVERSATION_ID_REQUIRED',
        message: 'conversationId is required',
      });
    }
    const deleted = await deleteConversation(organizationId, userId, conversationId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        code: 'AI_CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('[aiController.deleteAiConversation] error:', error);
    return assistErrorResponse(res, error, 'AI_CONVERSATION_DELETE_FAILED');
  }
}

async function listTenantAgentsAi(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const { ensureProcessDesignerAgent } = require('../services/ai/aiProcessDesignerService');
    await ensureProcessDesignerAgent({
      organizationId,
      userId: req.user?._id,
    });
    const agents = await listTenantAgents(organizationId, {
      includeDisabled: String(req.query?.includeDisabled || 'true') !== 'false',
    });
    return res.json({ success: true, agents });
  } catch (error) {
    console.error('[aiController.listTenantAgentsAi] error:', error);
    return assistErrorResponse(res, error, 'AI_TENANT_AGENT_LIST_FAILED');
  }
}

async function createTenantAgentAi(req, res) {
  try {
    const agent = await createTenantAgent({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      body: req.body || {},
    });
    return res.status(201).json({ success: true, agent });
  } catch (error) {
    console.error('[aiController.createTenantAgentAi] error:', error);
    return assistErrorResponse(res, error, 'AI_TENANT_AGENT_CREATE_FAILED');
  }
}

async function updateTenantAgentAi(req, res) {
  try {
    const agentId = String(req.params.agentId || '').trim();
    if (!agentId) {
      return res.status(400).json({
        success: false,
        code: 'AI_AGENT_ID_REQUIRED',
        message: 'agentId is required',
      });
    }
    const agent = await updateTenantAgent({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      agentId,
      body: req.body || {},
    });
    return res.json({ success: true, agent });
  } catch (error) {
    console.error('[aiController.updateTenantAgentAi] error:', error);
    return assistErrorResponse(res, error, 'AI_TENANT_AGENT_UPDATE_FAILED');
  }
}

async function deleteTenantAgentAi(req, res) {
  try {
    const agentId = String(req.params.agentId || '').trim();
    if (!agentId) {
      return res.status(400).json({
        success: false,
        code: 'AI_AGENT_ID_REQUIRED',
        message: 'agentId is required',
      });
    }
    await deleteTenantAgent({
      organizationId: getOrganizationId(req),
      agentId,
    });
    return res.json({ success: true, deleted: true });
  } catch (error) {
    console.error('[aiController.deleteTenantAgentAi] error:', error);
    return assistErrorResponse(res, error, 'AI_TENANT_AGENT_DELETE_FAILED');
  }
}

/**
 * Route (and optionally run) a tenant specialist agent from the user question.
 * If no agent matches, returns { matched: false } without falling back to work-graph.
 * Set body.stream=true for SSE progress + partial + done events.
 */
async function askTenantAgentAi(req, res) {
  const wantsStream = Boolean(req.body?.stream)
    || String(req.headers.accept || '').includes('text/event-stream');

  const sendSse = (event, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') {
      try { res.flush(); } catch (_) { /* ignore */ }
    }
  };

  try {
    const organizationId = getOrganizationId(req);
    let question = String(req.body?.question || '').trim();
    if (!question) {
      if (wantsStream) {
        res.status(400);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        sendSse('error', { code: 'AI_QUESTION_REQUIRED', message: 'question is required' });
        return res.end();
      }
      return res.status(400).json({
        success: false,
        code: 'AI_QUESTION_REQUIRED',
        message: 'question is required',
      });
    }

    if (wantsStream) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      sendSse('progress', { step: 'routing' });
    }

    const appKey = req.body?.appKey || req.appKey || 'SALES';
    const moduleKey = String(req.body?.moduleKey || '').trim();
    const recordId = String(req.body?.recordId || '').trim();
    let agentId = String(req.body?.agentId || '').trim();
    let routeScore = null;
    let mentionResolved = false;

    if (!agentId) {
      try {
        const { resolveAgentMention, isSuperAgentsEnabled } = require('../services/ai/astraSuperAgentService');
        if (isSuperAgentsEnabled()) {
          const agents = await listTenantAgents(organizationId, { includeDisabled: false });
          const mentioned = resolveAgentMention(question, agents);
          if (mentioned?.agent?._id) {
            agentId = String(mentioned.agent._id);
            question = mentioned.question;
            mentionResolved = true;
            if (wantsStream) {
              sendSse('progress', {
                step: 'routing',
                detail: `mentioned @${mentioned.agent.name}`,
              });
            }
          }
        }
      } catch (_) { /* non-fatal — fall through to normal routing */ }
    }

    if (agentId && moduleKey && !mentionResolved) {
      const agents = await listTenantAgents(organizationId, { includeDisabled: false });
      const forced = agents.find((a) => String(a._id) === agentId);
      if (!forced || !isAgentEligibleForPage(forced, moduleKey)) {
        agentId = '';
      }
    }

    let agentAutoCreated = false;
    if (!agentId) {
      if (wantsStream) sendSse('progress', { step: 'routing', detail: 'matching specialist' });
      const routed = await routeTenantAgent({
        organizationId,
        question,
        moduleKey,
      });
      if (routed?.agent?._id) {
        agentId = routed.agent._id;
        routeScore = routed.score;
      } else {
        if (wantsStream) sendSse('progress', { step: 'routing', detail: 'creating specialist' });
        const synthesized = await synthesizeAndCreateTenantAgent({
          organizationId,
          userId: req.user?._id,
          question,
          moduleKey,
        });
        agentId = synthesized._id;
        agentAutoCreated = true;
        routeScore = null;
      }
    }

    const result = await runTenantAgentAsk({
      organizationId,
      userId: req.user?._id,
      user: req.user,
      agentId,
      question,
      appKey,
      moduleKey,
      recordId,
      history: Array.isArray(req.body?.history) ? req.body.history : [],
      llmModel: String(req.body?.llmModel || req.body?.model || '').trim(),
      preferStream: wantsStream,
      onProgress: wantsStream
        ? (p) => sendSse('progress', p)
        : null,
      onPartialResult: wantsStream
        ? (partial) => sendSse('partial', {
          success: true,
          matched: true,
          routeScore,
          agentAutoCreated,
          ...partial,
          agent: {
            ...(partial.agent || {}),
            autoCreated: agentAutoCreated || Boolean(partial.agent?.autoCreated),
          },
        })
        : null,
    });

    const chosenModel = String(req.body?.llmModel || req.body?.model || '').trim();
    if (chosenModel) {
      try {
        const { upsertUserMemory } = require('../services/ai/aiUserMemoryService');
        await upsertUserMemory({
          organizationId,
          userId: req.user?._id,
          patch: { preferredLlmModel: chosenModel },
        });
      } catch (_) { /* non-fatal */ }
    }

    const payload = {
      success: true,
      matched: true,
      routeScore,
      agentAutoCreated,
      mentionResolved,
      ...result,
      agent: {
        ...(result.agent || {}),
        autoCreated: agentAutoCreated || Boolean(result.agent?.autoCreated),
      },
    };

    if (wantsStream) {
      sendSse('done', payload);
      return res.end();
    }
    return res.json(payload);
  } catch (error) {
    console.error('[aiController.askTenantAgentAi] error:', error);
    if (wantsStream && !res.headersSent) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
    }
    if (wantsStream && !res.writableEnded) {
      sendSse('error', {
        code: error.code || 'AI_TENANT_AGENT_ASK_FAILED',
        message: error.message || 'Ask failed',
      });
      return res.end();
    }
    return assistErrorResponse(res, error, 'AI_TENANT_AGENT_ASK_FAILED');
  }
}

async function applyAstraMutationAi(req, res) {
  try {
    const result = await applyAstraMutation({
      organizationId: getOrganizationId(req),
      user: req.user,
      op: req.body?.op,
      moduleKey: req.body?.moduleKey,
      recordId: req.body?.recordId,
      fields: req.body?.fields,
      appKey: req.body?.appKey || req.appKey || 'SALES',
      pageModuleKey: req.body?.pageModuleKey || req.body?.moduleKey || '',
      pageRecordId: req.body?.pageRecordId || '',
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.applyAstraMutationAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_MUTATION_FAILED');
  }
}

async function verifyAstraMutationAi(req, res) {
  try {
    const { verifyMutationOutcome } = require('../services/ai/aiAstraMutationVerifyService');
    const { writeAiAuditLog } = require('../services/ai/aiAuditLogService');
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    const verify = await verifyMutationOutcome({
      organizationId,
      op: String(req.body?.op || 'update'),
      moduleKey: String(req.body?.moduleKey || '').trim(),
      recordId: String(req.body?.recordId || '').trim(),
      expectedFields: req.body?.fields && typeof req.body.fields === 'object' ? req.body.fields : {},
    });
    const outcomeNote = [verify.summary, verify.nextHint].filter(Boolean).join(' ');
    try {
      await writeAiAuditLog({
        organizationId,
        userId,
        abilityKey: 'astra_mutation_verify',
        provider: 'none',
        model: 'none',
        keyMode: 'platform',
        status: verify.verified ? 'success' : 'failed',
        promptVersion: 'astra_verify_v1',
        latencyMs: verify.latencyMs || 0,
        metadata: {
          outcomeVerified: Boolean(verify.verified),
          verifyMismatches: verify.mismatches || [],
          moduleKey: verify.moduleKey,
          recordId: verify.recordId,
        },
      });
    } catch (_) { /* non-fatal */ }
    return res.json({ success: true, verify, outcomeNote });
  } catch (error) {
    console.error('[aiController.verifyAstraMutationAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_VERIFY_FAILED');
  }
}

async function getAstraUserMemoryAi(req, res) {
  try {
    const { getUserMemory } = require('../services/ai/aiUserMemoryService');
    const memory = await getUserMemory({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
    });
    return res.json({ success: true, memory });
  } catch (error) {
    console.error('[aiController.getAstraUserMemoryAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_MEMORY_FAILED');
  }
}

async function putAstraUserMemoryAi(req, res) {
  try {
    const { upsertUserMemory } = require('../services/ai/aiUserMemoryService');
    const memory = await upsertUserMemory({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      patch: req.body?.memory && typeof req.body.memory === 'object'
        ? req.body.memory
        : (req.body || {}),
    });
    return res.json({ success: true, memory });
  } catch (error) {
    console.error('[aiController.putAstraUserMemoryAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_MEMORY_UPDATE_FAILED');
  }
}

async function listAstraSkillsAi(req, res) {
  try {
    const { listAstraSkills, isSkillsEnabled } = require('../services/ai/aiAstraSkillsRegistry');
    const skills = listAstraSkills({
      moduleKey: String(req.query?.moduleKey || '').trim(),
    });
    return res.json({ success: true, enabled: isSkillsEnabled(), skills });
  } catch (error) {
    console.error('[aiController.listAstraSkillsAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_SKILLS_FAILED');
  }
}

async function runAstraSkillAi(req, res) {
  try {
    const { getAstraSkill, isSkillsEnabled } = require('../services/ai/aiAstraSkillsRegistry');
    if (!isSkillsEnabled()) {
      return res.status(404).json({
        success: false,
        code: 'ASTRA_SKILLS_DISABLED',
        message: 'Astra Skills are disabled',
      });
    }
    const skillId = String(req.params?.skillId || req.body?.skillId || '').trim();
    const skill = getAstraSkill(skillId);
    if (!skill) {
      return res.status(404).json({
        success: false,
        code: 'ASTRA_SKILL_NOT_FOUND',
        message: 'Skill not found',
      });
    }
    return res.json({
      success: true,
      skill: {
        id: skill.id,
        label: skill.label,
        description: skill.description,
        seedQuestion: skill.seedQuestion,
        moduleKeys: skill.moduleKeys,
      },
    });
  } catch (error) {
    console.error('[aiController.runAstraSkillAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_SKILL_RUN_FAILED');
  }
}

async function listAstraChatModelsAi(req, res) {
  try {
    const { getPublicAiSettings, listAvailableLlmModels } = require('../services/ai/aiSettingsService');
    const organizationId = getOrganizationId(req);
    const settings = await getPublicAiSettings(organizationId);
    const provider = settings?.llmProvider || 'openai';
    let models = [];
    try {
      const listed = await listAvailableLlmModels({ organizationId, provider });
      models = Array.isArray(listed?.models) ? listed.models : [];
    } catch (_) {
      models = settings?.llmModel ? [settings.llmModel] : [];
    }
    const { getUserMemory } = require('../services/ai/aiUserMemoryService');
    const memory = await getUserMemory({ organizationId, userId: req.user?._id });
    return res.json({
      success: true,
      enabled: String(process.env.ASTRA_MODEL_PICKER_V1 || 'true').toLowerCase() !== 'false',
      provider,
      models: models.map((m) => (typeof m === 'string' ? m : String(m?.id || m?.name || m))).filter(Boolean),
      selected: memory.preferredLlmModel || settings?.llmModel || '',
    });
  } catch (error) {
    console.error('[aiController.listAstraChatModelsAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_MODELS_FAILED');
  }
}

async function listAstraSuperAgentsAi(req, res) {
  try {
    const {
      isSuperAgentsEnabled,
      ensureBuiltinSuperAgents,
      listMentionableAgents,
    } = require('../services/ai/astraSuperAgentService');
    const { listSuperAgentCatalog } = require('../services/ai/aiAstraSuperAgentsCatalog');
    const organizationId = getOrganizationId(req);
    const enabled = isSuperAgentsEnabled();
    if (!enabled) {
      return res.json({
        success: true,
        enabled: false,
        agents: [],
        catalog: listSuperAgentCatalog(),
      });
    }
    const seeded = await ensureBuiltinSuperAgents({
      organizationId,
      userId: req.user?._id,
    });
    const agents = seeded.agents?.length
      ? seeded.agents
      : await listMentionableAgents(organizationId);
    return res.json({
      success: true,
      enabled: true,
      seeded: { created: seeded.created, updated: seeded.updated },
      agents,
      catalog: listSuperAgentCatalog(),
    });
  } catch (error) {
    console.error('[aiController.listAstraSuperAgentsAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_SUPER_AGENTS_FAILED');
  }
}

async function getAstraNextBestActionsAi(req, res) {
  try {
    const { buildNextBestActions } = require('../services/ai/aiAstraNextBestActionService');
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    const actions = await buildNextBestActions({
      organizationId,
      userId,
      moduleKey: String(req.query?.moduleKey || req.body?.moduleKey || '').trim(),
      recordId: String(req.query?.recordId || req.body?.recordId || '').trim(),
      recordTitle: String(req.query?.recordTitle || req.body?.recordTitle || '').trim(),
      limit: 3,
    });
    return res.json({
      success: true,
      actions,
      nbaMode: actions.length > 0,
    });
  } catch (error) {
    console.error('[aiController.getAstraNextBestActionsAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_NBA_FAILED');
  }
}

async function listAstraAutopilotProposalsAi(req, res) {
  try {
    const {
      isAutopilotEnabled,
      listProposalsForUser,
      scanUserAutopilot,
    } = require('../services/ai/astraAutopilotService');
    if (!isAutopilotEnabled()) {
      return res.json({ success: true, enabled: false, proposals: [] });
    }
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    const refresh = String(req.query?.refresh || '').toLowerCase() === 'true'
      || String(req.query?.refresh || '') === '1';
    if (refresh) {
      await scanUserAutopilot({ organizationId, userId });
    }
    const proposals = await listProposalsForUser({
      organizationId,
      userId,
      status: 'proposed',
      limit: 10,
    });
    return res.json({ success: true, enabled: true, proposals });
  } catch (error) {
    console.error('[aiController.listAstraAutopilotProposalsAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_AUTOPILOT_LIST_FAILED');
  }
}

async function acceptAstraAutopilotProposalAi(req, res) {
  try {
    const {
      isAutopilotEnabled,
      acceptProposal,
    } = require('../services/ai/astraAutopilotService');
    if (!isAutopilotEnabled()) {
      return res.status(404).json({
        success: false,
        code: 'ASTRA_AUTOPILOT_DISABLED',
        message: 'Astra Autopilot is disabled',
      });
    }
    const proposalId = String(req.params?.proposalId || req.body?.proposalId || '').trim();
    if (!proposalId) {
      return res.status(400).json({
        success: false,
        code: 'ASTRA_PROPOSAL_ID_REQUIRED',
        message: 'proposalId is required',
      });
    }
    const result = await acceptProposal({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      proposalId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.acceptAstraAutopilotProposalAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_AUTOPILOT_ACCEPT_FAILED');
  }
}

async function dismissAstraAutopilotProposalAi(req, res) {
  try {
    const {
      isAutopilotEnabled,
      dismissProposal,
    } = require('../services/ai/astraAutopilotService');
    if (!isAutopilotEnabled()) {
      return res.status(404).json({
        success: false,
        code: 'ASTRA_AUTOPILOT_DISABLED',
        message: 'Astra Autopilot is disabled',
      });
    }
    const proposalId = String(req.params?.proposalId || req.body?.proposalId || '').trim();
    if (!proposalId) {
      return res.status(400).json({
        success: false,
        code: 'ASTRA_PROPOSAL_ID_REQUIRED',
        message: 'proposalId is required',
      });
    }
    const proposal = await dismissProposal({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      proposalId,
    });
    return res.json({ success: true, proposal });
  } catch (error) {
    console.error('[aiController.dismissAstraAutopilotProposalAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_AUTOPILOT_DISMISS_FAILED');
  }
}

async function refreshAstraAutopilotAi(req, res) {
  try {
    const {
      isAutopilotEnabled,
      scanUserAutopilot,
      listProposalsForUser,
    } = require('../services/ai/astraAutopilotService');
    if (!isAutopilotEnabled()) {
      return res.json({ success: true, enabled: false, proposals: [], created: 0 });
    }
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;
    const scan = await scanUserAutopilot({ organizationId, userId });
    const proposals = await listProposalsForUser({
      organizationId,
      userId,
      status: 'proposed',
      limit: 10,
    });
    return res.json({
      success: true,
      enabled: true,
      created: scan.created,
      refreshed: scan.refreshed,
      proposals,
    });
  } catch (error) {
    console.error('[aiController.refreshAstraAutopilotAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ASTRA_AUTOPILOT_REFRESH_FAILED');
  }
}

async function suggestTenantAgentTriggersAi(req, res) {
  try {
    const result = await suggestTenantAgentTriggers({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      name: req.body?.name,
      description: req.body?.description,
      systemPrompt: req.body?.systemPrompt,
      moduleKeys: Array.isArray(req.body?.moduleKeys)
        ? req.body.moduleKeys
        : String(req.body?.moduleKeysText || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.suggestTenantAgentTriggersAi] error:', error);
    return assistErrorResponse(res, error, 'AI_TENANT_AGENT_TRIGGERS_FAILED');
  }
}

async function researchRecordAi(req, res) {
  try {
    const result = await researchRecord({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      appKey: req.body?.appKey || req.appKey || 'SALES',
      moduleKey: req.body?.moduleKey || req.params.moduleKey,
      recordId: req.body?.recordId || req.params.recordId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.researchRecordAi] error:', error);
    return assistErrorResponse(res, error, 'AI_RECORD_RESEARCH_FAILED');
  }
}

async function extractFieldsAi(req, res) {
  try {
    const result = await extractFields({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      moduleKey: req.body?.moduleKey || 'people',
      recordId: req.body?.recordId || null,
      text: req.body?.text,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.extractFieldsAi] error:', error);
    return assistErrorResponse(res, error, 'AI_EXTRACT_FAILED');
  }
}

async function suggestPeopleDuplicatesAi(req, res) {
  try {
    const peopleId = String(req.params.peopleId || req.body?.peopleId || '').trim();
    if (!peopleId) {
      return res.status(400).json({
        success: false,
        code: 'AI_PEOPLE_ID_REQUIRED',
        message: 'peopleId is required',
      });
    }
    const result = await suggestPeopleDuplicates({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      peopleId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.suggestPeopleDuplicatesAi] error:', error);
    return assistErrorResponse(res, error, 'AI_DUPLICATE_SUGGEST_FAILED');
  }
}

async function classifyTextAi(req, res) {
  try {
    const result = await classifyText({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      labels: req.body?.labels,
      fallbackLabel: req.body?.fallbackLabel || null,
      text: req.body?.text,
      sourceType: req.body?.sourceType || 'text',
      sourceId: req.body?.sourceId || null,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.classifyTextAi] error:', error);
    return assistErrorResponse(res, error, 'AI_CLASSIFY_FAILED');
  }
}

async function suggestCasePolicyAi(req, res) {
  try {
    const caseId = String(req.params.caseId || req.body?.caseId || '').trim();
    if (!caseId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CASE_ID_REQUIRED',
        message: 'caseId is required',
      });
    }
    const result = await suggestCasePolicyActions({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      caseId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.suggestCasePolicyAi] error:', error);
    return assistErrorResponse(res, error, 'AI_POLICY_SUGGEST_FAILED');
  }
}

async function proposeInboxTriageAi(req, res) {
  try {
    const result = await proposeInboxTriage({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      text: req.body?.text,
      subject: req.body?.subject,
      fromAddress: req.body?.fromAddress,
      sourceType: req.body?.sourceType || 'mailroom',
      sourceId: req.body?.sourceId || null,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.proposeInboxTriageAi] error:', error);
    return assistErrorResponse(res, error, 'AI_INBOX_TRIAGE_FAILED');
  }
}

async function proposeCaseResolutionAi(req, res) {
  try {
    const caseId = String(req.params.caseId || req.body?.caseId || '').trim();
    if (!caseId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CASE_ID_REQUIRED',
        message: 'caseId is required',
      });
    }
    const result = await proposeCaseResolution({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      caseId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.proposeCaseResolutionAi] error:', error);
    return assistErrorResponse(res, error, 'AI_CASE_RESOLUTION_FAILED');
  }
}

async function suggestOrganizationDuplicatesAi(req, res) {
  try {
    const organizationRefId = String(
      req.params.organizationRefId || req.body?.organizationRefId || ''
    ).trim();
    if (!organizationRefId) {
      return res.status(400).json({
        success: false,
        code: 'AI_ORG_ID_REQUIRED',
        message: 'organizationRefId is required',
      });
    }
    const result = await suggestOrganizationDuplicates({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      organizationRefId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.suggestOrganizationDuplicatesAi] error:', error);
    return assistErrorResponse(res, error, 'AI_DUPLICATE_SUGGEST_FAILED');
  }
}

async function assistCampaignSubjectAi(req, res) {
  try {
    const result = await assistCampaignSubject({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      campaignName: req.body?.campaignName,
      audienceHint: req.body?.audienceHint,
      tone: req.body?.tone,
      existingSubject: req.body?.existingSubject,
      count: req.body?.count,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.assistCampaignSubjectAi] error:', error);
    return assistErrorResponse(res, error, 'AI_MARKETING_SUBJECT_FAILED');
  }
}

async function assistCampaignBodyAi(req, res) {
  try {
    const result = await assistCampaignBody({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      campaignName: req.body?.campaignName,
      subject: req.body?.subject,
      goal: req.body?.goal,
      tone: req.body?.tone,
      existingBody: req.body?.existingBody,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.assistCampaignBodyAi] error:', error);
    return assistErrorResponse(res, error, 'AI_MARKETING_BODY_FAILED');
  }
}

async function summarizeCampaignAi(req, res) {
  try {
    const campaignId = String(req.params.campaignId || req.body?.campaignId || '').trim();
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        code: 'AI_CAMPAIGN_ID_REQUIRED',
        message: 'campaignId is required',
      });
    }
    const result = await summarizeCampaign({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      campaignId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.summarizeCampaignAi] error:', error);
    return assistErrorResponse(res, error, 'AI_MARKETING_SUMMARY_FAILED');
  }
}

async function suggestAnalyticsIntentAi(req, res) {
  try {
    const { suggestAnalyticsIntent } = require('../services/ai/aiAnalyticsIntentService');
    const result = await suggestAnalyticsIntent({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      user: req.user,
      question: req.body?.question,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.suggestAnalyticsIntentAi] error:', error);
    return assistErrorResponse(res, error, 'AI_ANALYTICS_INTENT_FAILED');
  }
}

async function previewLiveChatFaqAi(req, res) {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({
        success: false,
        code: 'AI_QUESTION_REQUIRED',
        message: 'question is required',
      });
    }
    const { answerLiveChatFaq } = require('../services/ai/aiLiveChatBotService');
    const result = await answerLiveChatFaq({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      question,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.previewLiveChatFaqAi] error:', error);
    return assistErrorResponse(res, error, 'AI_LIVE_CHAT_FAQ_FAILED');
  }
}

async function draftAuditNarrativeAi(req, res) {
  try {
    const responseId = String(req.params.responseId || req.body?.responseId || '').trim();
    if (!responseId) {
      return res.status(400).json({
        success: false,
        code: 'AI_AUDIT_RESPONSE_ID_REQUIRED',
        message: 'responseId is required',
      });
    }
    const { draftAuditNarrative } = require('../services/ai/aiAuditNarrativeService');
    const result = await draftAuditNarrative({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      responseId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.draftAuditNarrativeAi] error:', error);
    return assistErrorResponse(res, error, 'AI_AUDIT_NARRATIVE_FAILED');
  }
}

async function previewDigestBriefAi(req, res) {
  try {
    const { generateDigestBrief } = require('../services/ai/aiDigestBriefService');
    const result = await generateDigestBrief({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      appKey: req.body?.appKey || req.appKey || 'SALES',
      window: req.body?.window || 'daily',
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.previewDigestBriefAi] error:', error);
    return assistErrorResponse(res, error, 'AI_SCHEDULED_DIGEST_FAILED');
  }
}

async function proposeCommercialAgentAi(req, res) {
  try {
    const dealId = String(req.params.dealId || req.body?.dealId || '').trim();
    if (!dealId) {
      return res.status(400).json({
        success: false,
        code: 'AI_DEAL_ID_REQUIRED',
        message: 'dealId is required',
      });
    }
    const { proposeCommercialNextSteps } = require('../services/ai/aiCommercialAgentService');
    const result = await proposeCommercialNextSteps({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      dealId,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.proposeCommercialAgentAi] error:', error);
    return assistErrorResponse(res, error, 'AI_COMMERCIAL_AGENT_FAILED');
  }
}

async function proposeCollectionAgentAi(req, res) {
  try {
    const { proposeCollectionNextSteps } = require('../services/ai/aiCommercialAgentService');
    const result = await proposeCollectionNextSteps({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      limit: req.body?.limit,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.proposeCollectionAgentAi] error:', error);
    return assistErrorResponse(res, error, 'AI_COLLECTION_AGENT_FAILED');
  }
}

async function suggestImportMappingAi(req, res) {
  try {
    const result = await suggestImportColumnMapping({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      moduleKey: req.body?.moduleKey || req.body?.module,
      headers: req.body?.headers,
      fields: req.body?.fields,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.suggestImportMappingAi] error:', error);
    return assistErrorResponse(res, error, 'AI_IMPORT_MAPPING_FAILED');
  }
}

async function generateProcessDesignerAi(req, res) {
  try {
    const { generateProcessDraft } = require('../services/ai/aiProcessDesignerService');
    const result = await generateProcessDraft({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      brief: req.body?.brief || req.body?.description,
      appKey: req.body?.appKey,
      entityType: req.body?.entityType,
      coreTrigger: req.body?.coreTrigger,
      name: req.body?.name,
      updateWatchField: req.body?.updateWatchField,
      schedule: req.body?.schedule,
      triggerBehaviour: req.body?.triggerBehaviour,
      includeClosedRecords: req.body?.includeClosedRecords === true,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[aiController.generateProcessDesignerAi] error:', error);
    return assistErrorResponse(res, error, 'AI_PROCESS_DESIGNER_FAILED');
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
  summarizeCaseAi,
  summarizeDealAi,
  summarizePeopleAi,
  draftCaseReplyAi,
  askKnowledgeAi,
  submitAiFeedback,
  draftDealQuoteAi,
  briefOverdueInvoicesAi,
  askWorkGraphAi,
  researchRecordAi,
  extractFieldsAi,
  classifyTextAi,
  suggestCasePolicyAi,
  proposeInboxTriageAi,
  proposeCaseResolutionAi,
  suggestPeopleDuplicatesAi,
  suggestOrganizationDuplicatesAi,
  assistCampaignSubjectAi,
  assistCampaignBodyAi,
  summarizeCampaignAi,
  suggestImportMappingAi,
  suggestAnalyticsIntentAi,
  previewLiveChatFaqAi,
  draftAuditNarrativeAi,
  previewDigestBriefAi,
  proposeCommercialAgentAi,
  proposeCollectionAgentAi,
  generateProcessDesignerAi,
  listTenantAgentsAi,
  createTenantAgentAi,
  updateTenantAgentAi,
  deleteTenantAgentAi,
  askTenantAgentAi,
  applyAstraMutationAi,
  verifyAstraMutationAi,
  getAstraUserMemoryAi,
  putAstraUserMemoryAi,
  listAstraSkillsAi,
  runAstraSkillAi,
  listAstraChatModelsAi,
  listAstraSuperAgentsAi,
  getAstraNextBestActionsAi,
  listAstraAutopilotProposalsAi,
  acceptAstraAutopilotProposalAi,
  dismissAstraAutopilotProposalAi,
  refreshAstraAutopilotAi,
  suggestTenantAgentTriggersAi,
  listAiConversations,
  getAiConversation,
  createAiConversation,
  updateAiConversation,
  deleteAiConversation,
};
