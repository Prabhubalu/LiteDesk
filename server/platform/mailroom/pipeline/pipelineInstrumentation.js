'use strict';

const { recordIngest } = require('../observability/mailroomMetrics');
const { recordRoutingOutcome } = require('../services/routingLogService');

async function runInstrumentedPipeline({
  organizationId,
  channel,
  connectorType,
  rawPayloadId,
  normalizedMessage,
  runCore
}) {
  const started = Date.now();
  let success = false;
  let duplicate = false;
  let reopened = false;
  let authRejected = false;
  let quarantined = false;

  try {
    const core = await runCore();
    success = true;

    const dedup = core.policyEvaluation?.dedup;
    duplicate = dedup?.isDuplicate === true;
    const action = core.caseResult?.action || '';
    reopened = action.includes('reopen');

    if (core.caseResult) {
      await recordRoutingOutcome({
        organizationId,
        rawPayloadId,
        messageId: core.conversationResult?.message?._id || null,
        conversationId: core.conversationResult?.conversation?._id || null,
        channel: normalizedMessage?.channel || channel,
        connectorType,
        caseResult: core.caseResult,
        durationMs: Date.now() - started,
        metadata: {
          ingestAction: core.policyEvaluation?.ingest?.action?.type || null,
          emailAuth: normalizedMessage?.metadata?.emailAuthDecision || null
        }
      });
    }

    return core;
  } catch (err) {
    if (err.code === 'MAILROOM_EMAIL_AUTH_FAILED') authRejected = true;
    throw err;
  } finally {
    const meta = normalizedMessage?.metadata || {};
    if (meta.emailAuthDecision?.action === 'quarantine') quarantined = true;

    recordIngest({
      channel: normalizedMessage?.channel || channel,
      connectorType,
      success,
      durationMs: Date.now() - started,
      duplicate,
      reopened,
      authRejected,
      quarantined
    });
  }
}

module.exports = {
  runInstrumentedPipeline
};
