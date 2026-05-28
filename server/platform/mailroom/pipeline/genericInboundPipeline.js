const mailroomConfigService = require('../../../services/mailroomConfigService');
const { buildNormalizedMessage } = require('../domain/normalizedMessage');
const { evaluate, evaluatePipeline } = require('../policies/policyEngine');
const { storeRawPayload, markRawPayloadProcessed, markRawPayloadFailed } = require('../services/rawPayloadService');
const { buildCandidatesForMessage, buildEmailCandidates } = require('../services/candidatesService');
const { persistInboundConversationMessage } = require('../services/conversationPersistenceService');
const { executeMailroomCaseLink } = require('../adapters/casesAdapter');
const { runWithOrganizationTenantContext } = require('../../../utils/organizationTenantContext');
const {
  publishMailroomProcessingEvents,
  publishProcessingFailedEvent
} = require('../events/publisher');
const { runInstrumentedPipeline } = require('./pipelineInstrumentation');
const { resolveMailroomIngestActionType } = require('./ingestActionResolver');

async function runMailroomGenericCore({
  organizationId,
  normalizedMessage,
  rawPayloadId,
  policies,
  connectorType
}) {
  const runStages = async () => {
    const ingestEvaluation = evaluate('ingest', {
      message: normalizedMessage,
      policies: policies || {}
    });
    const classificationPreview = evaluate('classification', {
      message: normalizedMessage,
      policies: policies || {}
    });
    const ingestActionType = resolveMailroomIngestActionType(
      ingestEvaluation,
      classificationPreview,
      policies?.classification || {}
    );

    if (ingestActionType === 'ignore') {
      return {
        policyEvaluation: {
          ingest: ingestEvaluation,
          threading: null,
          dedup: null,
          caseLink: null,
          classification: null,
          dispatch: null
        },
        caseResult: {
          executed: false,
          action: classificationPreview?.suggestions?.spam
            ? 'ignored_by_classification_spam'
            : 'ignored_by_ingest_policy',
          reason: classificationPreview?.suggestions?.spam ? 'classification_spam' : 'ingest_ignore',
          caseId: null
        },
        conversationResult: null,
        eventsResult: { published: [] }
      };
    }

    const candidates = normalizedMessage.channel === 'email'
      ? await buildEmailCandidates(organizationId, normalizedMessage)
      : await buildCandidatesForMessage(organizationId, normalizedMessage);

    const policyEvaluation = evaluatePipeline({
      message: normalizedMessage,
      candidates,
      policies: policies || {},
      ingestEvaluation
    });
    policyEvaluation.ingest = ingestEvaluation;

    let caseResult = null;
    if (ingestActionType === 'route_to_case_flow') {
      caseResult = await executeMailroomCaseLink({
        organizationId,
        normalizedMessage,
        policyEvaluation
      });
    } else {
      caseResult = {
        executed: false,
        action: ingestActionType === 'workspace_only' ? 'workspace_only' : 'manual_review',
        reason: 'ingest_policy',
        caseId: null
      };
    }

    const conversationResult = await persistInboundConversationMessage({
      organizationId,
      normalizedMessage,
      threadingEvaluation: policyEvaluation.threading,
      rawPayloadId,
      linkedCommunicationId: null,
      linkedCaseId: caseResult?.caseId || null
    });

    if (caseResult?.caseId && conversationResult?.message?._id) {
      const { syncCaseActivityMailroomMetadata } = require('../services/caseActivityAttachmentService');
      await syncCaseActivityMailroomMetadata({
        organizationId,
        caseId: caseResult.caseId,
        mailroomMessageId: conversationResult.message._id,
        attachmentIds: conversationResult.message.attachmentIds || []
      });
    }

    const eventsResult = await publishMailroomProcessingEvents({
      organizationId,
      normalizedMessage,
      policies: policies || {},
      policyEvaluation,
      caseResult,
      conversationResult,
      rawPayloadId
    });

    return {
      policyEvaluation,
      caseResult,
      conversationResult,
      eventsResult
    };
  };

  if (organizationId) {
    return runWithOrganizationTenantContext(organizationId, runStages);
  }
  return runStages();
}

async function handleMailroomProcessingError({
  err,
  rawPayload,
  organizationId,
  connectorType,
  channel,
  policies = {}
}) {
  if (rawPayload?._id) {
    await markRawPayloadFailed(rawPayload._id, err.message);
    if (organizationId) {
      const { recordProcessingFailure } = require('../services/processingFailureService');
      await recordProcessingFailure({
        organizationId,
        rawPayloadId: rawPayload._id,
        connectorType: connectorType || rawPayload.connectorType,
        errorMessage: err.message,
        errorStack: err.stack
      });
      await publishProcessingFailedEvent({
        organizationId,
        rawPayloadId: rawPayload._id,
        channel: channel || 'api',
        errorMessage: err.message,
        policies
      });
    }
  }
}

async function processNormalizedInboundThroughMailroom({
  organizationId,
  connectorType = 'public_api',
  source = 'mailroom-public-api',
  jsonPayload = null,
  message = null,
  existingRawPayloadId = null
}) {
  if (!organizationId) {
    const err = new Error('organizationId is required');
    err.statusCode = 400;
    throw err;
  }

  const config = await mailroomConfigService.getOrCreateConfig(organizationId);
  if (!config.enabled) {
    const err = new Error('Mailroom is disabled for this organization');
    err.statusCode = 409;
    throw err;
  }

  let rawPayload = null;
  try {
    const MailroomMessage = require('../../../models/MailroomMessage');
    const externalId = String(message?.externalMessageId || message?.messageId || '').trim();
    if (externalId) {
      const existing = await MailroomMessage.findOne({
        organizationId,
        externalMessageId: externalId
      }).select('_id conversationId linkedCaseId createdAt').lean();
      if (existing) {
        // Idempotency: do not re-run case linking or emit duplicate events.
        return {
          mailroom: true,
          rawPayloadId: existingRawPayloadId || null,
          idempotent: true,
          messageId: existing._id,
          conversationId: existing.conversationId,
          linkedCaseId: existing.linkedCaseId || null,
          createdAt: existing.createdAt
        };
      }
    }

    rawPayload = existingRawPayloadId
      ? null
      : await storeRawPayload({
        organizationId,
        connectorType,
        jsonPayload: jsonPayload || { source, message },
        externalReference: message?.externalMessageId || message?.messageId || null,
        headers: { source }
      });

    const rawPayloadId = existingRawPayloadId || rawPayload?._id || null;
    const normalizedMessage = buildNormalizedMessage({
      ...(message || {}),
      metadata: {
        ...(message?.metadata || {}),
        source
      }
    });

    const result = await runInstrumentedPipeline({
      organizationId,
      channel: normalizedMessage.channel || connectorType,
      connectorType,
      rawPayloadId,
      normalizedMessage,
      runCore: () =>
        runMailroomGenericCore({
          organizationId,
          normalizedMessage,
          rawPayloadId,
          policies: config.policies || {},
          connectorType
        })
    });

    if (rawPayloadId) {
      await markRawPayloadProcessed(rawPayloadId, {
        processingMeta: {
          source,
          connectorType,
          channel: normalizedMessage.channel
        }
      });
      const { markFailureResolved } = require('../services/processingFailureService');
      await markFailureResolved(rawPayloadId);
    }

    return {
      mailroom: true,
      rawPayloadId,
      policyEvaluation: result.policyEvaluation,
      caseLink: result.caseResult,
      conversation: result.conversationResult,
      events: result.eventsResult
        ? {
          published: result.eventsResult.published?.length || 0,
          types: (result.eventsResult.published || []).map((e) => e.eventType)
        }
        : null
    };
  } catch (err) {
    await handleMailroomProcessingError({
      err,
      rawPayload,
      organizationId,
      connectorType,
      channel: message?.channel,
      policies: (await mailroomConfigService.getOrCreateConfig(organizationId)).policies || {}
    });
    throw err;
  }
}

module.exports = {
  processNormalizedInboundThroughMailroom
};

