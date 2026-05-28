const { parseRawMime } = require('../../communication/inbound/inboundParser');
const { processRawInbound } = require('../../communication/inbound/inboundDispatcher');
const { getOrCreateConfig } = require('../../../services/mailroomConfigService');
const { evaluate, evaluatePipeline } = require('../policies/policyEngine');
const { mapParsedMimeToNormalized, mapParserApiMessageToNormalized } = require('../domain/parsedMessageMappers');
const MailroomRawPayload = require('../../../models/MailroomRawPayload');
const { storeRawPayload, markRawPayloadProcessed, markRawPayloadFailed } = require('../services/rawPayloadService');
const { buildEmailCandidates } = require('../services/candidatesService');
const { persistInboundConversationMessage } = require('../services/conversationPersistenceService');
const { executeMailroomCaseLink } = require('../adapters/casesAdapter');
const { isMailroomEmailEnabledForOrganization } = require('../services/mailroomEnablement');
const { runWithOrganizationTenantContext } = require('../../../utils/organizationTenantContext');
const {
  publishMailroomProcessingEvents,
  publishProcessingFailedEvent
} = require('../events/publisher');
const {
  recordProcessingFailure,
  markFailureResolved
} = require('../services/processingFailureService');
const { applyInboundEmailSecurity } = require('../security/emailAuthValidator');
const { runInstrumentedPipeline } = require('./pipelineInstrumentation');
const { resolveMailroomIngestActionType } = require('./ingestActionResolver');

async function linkCommunicationToCaseActivities(organizationId, caseId, communicationId) {
  if (!caseId || !communicationId) return;
  const Case = require('../../../models/Case');
  const caseRecord = await Case.findOne({ _id: caseId, organizationId }).select('activities');
  if (!caseRecord?.activities?.length) return;

  for (let i = caseRecord.activities.length - 1; i >= 0; i -= 1) {
    const act = caseRecord.activities[i];
    if (
      (act.activityType === 'email_received' || act.activityType === 'case_created')
      && !act.metadata?.communicationId
    ) {
      act.metadata = { ...(act.metadata || {}), communicationId: String(communicationId) };
      await caseRecord.save();
      return;
    }
  }
}

async function runMailroomEmailCore({
  organizationId,
  normalizedMessage,
  rawPayloadId,
  policies,
  legacyHandler,
  forceIngestAction = null
}) {
  const runStages = async () => {
    const ingestEvaluation = forceIngestAction
      ? {
        matched: true,
        action: { type: forceIngestAction },
        trace: ['forced_by_email_auth_policy']
      }
      : evaluate('ingest', {
        message: normalizedMessage,
        policies: policies || {}
      });
    const classificationPreview = evaluate('classification', {
      message: normalizedMessage,
      policies: policies || {}
    });
    let ingestActionType = resolveMailroomIngestActionType(
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
        legacyResult: null,
        conversationResult: null,
        eventsResult: { published: [] }
      };
    }

    const candidates = await buildEmailCandidates(organizationId, normalizedMessage);
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

    const legacyResult = await legacyHandler(caseResult, {
      forceWorkspaceOnly: ingestActionType === 'workspace_only',
      markManualReview: ingestActionType === 'manual_review'
    });

    if (caseResult?.caseId && legacyResult?.communicationId) {
      await linkCommunicationToCaseActivities(
        organizationId,
        caseResult.caseId,
        legacyResult.communicationId
      );
    }

    const conversationResult = await persistInboundConversationMessage({
      organizationId,
      normalizedMessage,
      threadingEvaluation: policyEvaluation.threading,
      rawPayloadId,
      linkedCommunicationId: legacyResult?.communicationId || null,
      linkedCaseId: caseResult?.caseId || legacyResult?.helpdesk?.caseId || null
    });

    const linkedCaseId = caseResult?.caseId || legacyResult?.helpdesk?.caseId || null;
    if (linkedCaseId && conversationResult?.message?._id) {
      const { syncCaseActivityMailroomMetadata } = require('../services/caseActivityAttachmentService');
      await syncCaseActivityMailroomMetadata({
        organizationId,
        caseId: linkedCaseId,
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
      legacyResult,
      conversationResult,
      eventsResult
    };
  };

  if (organizationId) {
    return runWithOrganizationTenantContext(organizationId, runStages);
  }
  return runStages();
}

function buildMailroomReturnPayload({
  rawPayloadId,
  policyEvaluation,
  caseResult,
  legacyResult,
  conversationResult,
  eventsResult = null
}) {
  return {
    mailroom: true,
    rawPayloadId,
    policyEvaluation,
    caseLink: caseResult
      ? {
        executed: caseResult.executed,
        action: caseResult.action,
        caseId: caseResult.caseId,
        reason: caseResult.reason
      }
      : null,
    conversation: conversationResult,
    events: eventsResult
      ? {
        published: eventsResult.published?.length || 0,
        types: (eventsResult.published || []).map((e) => e.eventType)
      }
      : null,
    communicationId: legacyResult?.communicationId || null,
    helpdesk: caseResult?.caseId
      ? { caseId: caseResult.caseId, action: caseResult.action }
      : legacyResult?.helpdesk || null,
    ...(legacyResult?.threadId ? { threadId: legacyResult.threadId } : {}),
    ...(legacyResult?.threadStrategy ? { threadStrategy: legacyResult.threadStrategy } : {})
  };
}

async function handleMailroomProcessingError({
  err,
  rawPayload,
  organizationId,
  connectorType,
  policies = {}
}) {
  if (rawPayload?._id) {
    await markRawPayloadFailed(rawPayload._id, err.message);
    if (organizationId) {
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
        channel: 'email',
        errorMessage: err.message,
        policies
      });
    }
  }
}

/**
 * M1–M3 strangler: raw → policies → case adapter → legacy comm → conversation.
 */
async function processRawMimeThroughMailroom({
  rawMime,
  headerOrganizationId = null,
  source = 'mailroom-raw-mime',
  existingRawPayloadId = null
}) {
  const rawBuffer = Buffer.isBuffer(rawMime) ? rawMime : Buffer.from(String(rawMime || ''));

  let organizationId = headerOrganizationId || null;
  let rawPayload = null;
  let policies = {};

  try {
    if (existingRawPayloadId) {
      rawPayload = await MailroomRawPayload.findById(existingRawPayloadId);
      if (!rawPayload) throw new Error('Raw payload not found for replay');
      organizationId = organizationId || rawPayload.organizationId;
      await MailroomRawPayload.updateOne(
        { _id: rawPayload._id },
        { $set: { status: 'processing', lastError: '' } }
      );
    } else {
      rawPayload = await storeRawPayload({
        organizationId,
        connectorType: 'raw_mime_webhook',
        buffer: rawBuffer,
        externalReference: null,
        headers: { source }
      });
    }

    const parseResult = await parseRawMime(rawBuffer);
    if (!parseResult.ok) {
      throw new Error(parseResult.error || 'mime_parse_failed');
    }

    const normalized = mapParsedMimeToNormalized(parseResult.value);

    if (!organizationId) {
      const { tryResolveInboundOrganizationId } = require('../../communication/inbound/inboundDispatcher');
      organizationId = await tryResolveInboundOrganizationId(rawBuffer);
    }

    if (organizationId && String(rawPayload.organizationId) !== String(organizationId)) {
      await MailroomRawPayload.updateOne(
        { _id: rawPayload._id },
        { $set: { organizationId } }
      );
    }

    if (!organizationId) {
      throw new Error('Could not resolve organization for inbound email');
    }

    const config = await getOrCreateConfig(organizationId);
    policies = config.policies || {};
    const secured = applyInboundEmailSecurity({
      rawMime: rawBuffer,
      normalizedMessage: normalized,
      securityConfig: config.security || {}
    });
    normalized = secured.normalizedMessage;

    const core = await runInstrumentedPipeline({
      organizationId,
      channel: 'email',
      connectorType: 'raw_mime_webhook',
      rawPayloadId: rawPayload._id,
      normalizedMessage: normalized,
      runCore: () =>
        runMailroomEmailCore({
          organizationId,
          normalizedMessage: normalized,
          rawPayloadId: rawPayload._id,
          policies,
          forceIngestAction: secured.forceIngestAction,
          legacyHandler: (caseResult) =>
            processRawInbound({
              rawMime: rawBuffer,
              headerOrganizationId: organizationId,
              source,
              mailroomPrelinkedCase: caseResult?.caseId
                ? { caseId: caseResult.caseId, action: caseResult.action }
                : null
            })
        })
    });

    await markRawPayloadProcessed(rawPayload._id, {
      communicationId: core.legacyResult?.communicationId || null,
      processingMeta: {
        mailroomPhase: 'M4',
        policyEvaluation: core.policyEvaluation,
        caseLink: core.caseResult,
        conversation: {
          conversationId: core.conversationResult?.conversation?._id || null,
          messageId: core.conversationResult?.message?._id || null,
          threadingLogId: core.conversationResult?.threadingLog?._id || null
        },
        events: core.eventsResult?.published || [],
        legacy: core.legacyResult || null
      }
    });

    if (existingRawPayloadId) {
      await markFailureResolved(rawPayload._id);
    }

    return buildMailroomReturnPayload({
      rawPayloadId: rawPayload._id,
      ...core
    });
  } catch (err) {
    await handleMailroomProcessingError({
      err,
      rawPayload,
      organizationId,
      connectorType: 'raw_mime_webhook',
      policies
    });
    throw err;
  }
}

async function processParserEventThroughMailroom(eventDoc, {
  processLegacy,
  injectedMessage = null,
  existingRawPayloadId = null
}) {
  const { resolveParserEventIds } = require('../../../utils/parserIdCodec');
  const resolved = await resolveParserEventIds(
    eventDoc.parserTenantId,
    eventDoc.parserMailboxId
  );
  if (!resolved) {
    throw new Error(
      `Unknown parser mailbox: ${eventDoc.parserTenantId} / ${eventDoc.parserMailboxId}`
    );
  }

  const organizationId = resolved.organizationId;
  let rawPayload = null;
  let policies = {};

  try {
    if (existingRawPayloadId) {
      rawPayload = await MailroomRawPayload.findById(existingRawPayloadId);
      if (!rawPayload) throw new Error('Raw payload not found for replay');
      await MailroomRawPayload.updateOne(
        { _id: rawPayload._id },
        { $set: { status: 'processing', lastError: '' } }
      );
    } else {
      rawPayload = await storeRawPayload({
        organizationId,
        connectorType: 'arivu_parser',
        jsonPayload: {
          event: 'email.received',
          parserMessageId: eventDoc.parserMessageId,
          parserTenantId: eventDoc.parserTenantId,
          parserMailboxId: eventDoc.parserMailboxId,
          parserThreadId: eventDoc.parserThreadId,
          receivedAt: eventDoc.receivedAt
        },
        externalReference: eventDoc.parserMessageId,
        headers: { source: 'arivu-parser-webhook' }
      });
    }

    const { fetchParserMessage } = require('../../../services/inboundParserMessageService');
    const msg = injectedMessage || (await fetchParserMessage(eventDoc.parserMessageId));
    const normalized = mapParserApiMessageToNormalized(msg, eventDoc);
    if (!normalized.metadata) normalized.metadata = {};
    const Mailbox = require('../../../models/Mailbox');
    const mailbox = await Mailbox.findOne({
      _id: resolved.mailboxId,
      organizationId
    })
      .select('kind')
      .lean();
    normalized.metadata.mailboxKind = mailbox?.kind || null;

    const config = await getOrCreateConfig(organizationId);
    policies = config.policies || {};
    const core = await runInstrumentedPipeline({
      organizationId,
      channel: 'email',
      connectorType: 'arivu_parser',
      rawPayloadId: rawPayload._id,
      normalizedMessage: normalized,
      runCore: () =>
        runMailroomEmailCore({
          organizationId,
          normalizedMessage: normalized,
          rawPayloadId: rawPayload._id,
          policies,
          legacyHandler: (caseResult, executionHints = {}) => processLegacy(caseResult, executionHints)
        })
    });

    await markRawPayloadProcessed(rawPayload._id, {
      communicationId: core.legacyResult?.communicationId || null,
      processingMeta: {
        mailroomPhase: 'M4',
        policyEvaluation: core.policyEvaluation,
        caseLink: core.caseResult,
        conversation: {
          conversationId: core.conversationResult?.conversation?._id || null,
          messageId: core.conversationResult?.message?._id || null,
          threadingLogId: core.conversationResult?.threadingLog?._id || null
        },
        events: core.eventsResult?.published || [],
        legacy: core.legacyResult || null
      }
    });

    if (existingRawPayloadId) {
      await markFailureResolved(rawPayload._id);
    }

    return buildMailroomReturnPayload({
      rawPayloadId: rawPayload._id,
      ...core
    });
  } catch (err) {
    await handleMailroomProcessingError({
      err,
      rawPayload,
      organizationId,
      connectorType: 'arivu_parser',
      policies
    });
    throw err;
  }
}

async function shouldUseMailroomForOrganization(organizationId) {
  return isMailroomEmailEnabledForOrganization(organizationId);
}

module.exports = {
  processRawMimeThroughMailroom,
  processParserEventThroughMailroom,
  shouldUseMailroomForOrganization,
  runMailroomEmailCore
};
