'use strict';

const MailroomRawPayload = require('../../../models/MailroomRawPayload');
const MailroomProcessingFailure = require('../../../models/MailroomProcessingFailure');
const {
  processRawMimeThroughMailroom,
  processParserEventThroughMailroom
} = require('../pipeline/emailInboundPipeline');

const MAX_REPLAY_ATTEMPTS = 5;

async function recordProcessingFailure({
  organizationId,
  rawPayloadId,
  connectorType,
  errorMessage,
  errorStack = '',
  stage = 'pipeline',
  metadata = {}
}) {
  if (!rawPayloadId || !organizationId) return null;

  const doc = await MailroomProcessingFailure.findOneAndUpdate(
    { rawPayloadId },
    {
      $set: {
        organizationId,
        connectorType,
        stage,
        errorMessage: String(errorMessage || '').slice(0, 2000),
        errorStack: String(errorStack || '').slice(0, 8000),
        status: 'open',
        metadata
      },
      $inc: { retryCount: 0 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}

async function listProcessingFailures(organizationId, { limit = 25, status = 'open' } = {}) {
  const query = { organizationId };
  if (status && status !== 'all') {
    query.status = status;
  }

  return MailroomProcessingFailure.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 25, 1), 100))
    .populate('rawPayloadId', 'connectorType externalReference status lastError createdAt byteSize')
    .lean();
}

async function markFailureResolved(rawPayloadId) {
  if (!rawPayloadId) return;
  await MailroomProcessingFailure.updateOne(
    { rawPayloadId },
    { $set: { status: 'resolved', resolvedAt: new Date() } }
  );
}

async function markFailureRetrying(rawPayloadId) {
  if (!rawPayloadId) return;
  await MailroomProcessingFailure.updateOne(
    { rawPayloadId },
    {
      $set: { status: 'retrying', lastRetryAt: new Date() },
      $inc: { retryCount: 1 }
    }
  );
}

async function replayRawPayload(organizationId, rawPayloadId) {
  const failure = await MailroomProcessingFailure.findOne({
    organizationId,
    rawPayloadId
  }).lean();

  if (failure && failure.retryCount >= MAX_REPLAY_ATTEMPTS) {
    const err = new Error(`Maximum replay attempts (${MAX_REPLAY_ATTEMPTS}) exceeded`);
    err.statusCode = 409;
    throw err;
  }

  const payload = await MailroomRawPayload.findOne({
    _id: rawPayloadId,
    organizationId
  }).select('+payloadBase64');

  if (!payload) {
    const err = new Error('Raw payload not found');
    err.statusCode = 404;
    throw err;
  }

  if (!payload.payloadBase64) {
    const err = new Error('Payload too large or not stored inline — replay not available');
    err.statusCode = 422;
    throw err;
  }

  await markFailureRetrying(rawPayloadId);
  await MailroomRawPayload.updateOne(
    { _id: rawPayloadId },
    { $set: { status: 'received', lastError: '' } }
  );

  try {
    let result;
    const buffer = Buffer.from(payload.payloadBase64, 'base64');

    if (payload.connectorType === 'raw_mime_webhook') {
      result = await processRawMimeThroughMailroom({
        rawMime: buffer,
        headerOrganizationId: organizationId,
        source: 'mailroom-replay',
        existingRawPayloadId: rawPayloadId
      });
    } else if (payload.connectorType === 'arivu_parser') {
      const meta = JSON.parse(buffer.toString('utf8'));
      const eventDoc = {
        parserMessageId: meta.parserMessageId || payload.externalReference,
        parserTenantId: meta.parserTenantId,
        parserMailboxId: meta.parserMailboxId,
        parserThreadId: meta.parserThreadId || null,
        receivedAt: meta.receivedAt || payload.createdAt
      };

      const { fetchParserMessage } = require('../../../services/inboundParserMessageService');
      const { processParserInboundEventLegacy } = require('../../../services/inboundParserMessageService');
      let injectedMessage = null;
      try {
        injectedMessage = await fetchParserMessage(eventDoc.parserMessageId);
      } catch {
        injectedMessage = null;
      }

      if (injectedMessage) {
        result = await processParserEventThroughMailroom(eventDoc, {
          existingRawPayloadId: rawPayloadId,
          injectedMessage,
          processLegacy: (caseResult) =>
            processParserInboundEventLegacy(eventDoc, {
              injectedMessage,
              mailroomCaseResult: caseResult
            })
        });
      } else {
        const err = new Error('Cannot replay parser payload — message unavailable from parser API');
        err.statusCode = 422;
        throw err;
      }
    } else {
      const err = new Error(`Replay not supported for connector: ${payload.connectorType}`);
      err.statusCode = 422;
      throw err;
    }

    return { success: true, result };
  } catch (error) {
    await recordProcessingFailure({
      organizationId,
      rawPayloadId,
      connectorType: payload.connectorType,
      errorMessage: error.message,
      errorStack: error.stack,
      stage: 'replay'
    });
    throw error;
  }
}

module.exports = {
  MAX_REPLAY_ATTEMPTS,
  recordProcessingFailure,
  listProcessingFailures,
  markFailureResolved,
  replayRawPayload
};
