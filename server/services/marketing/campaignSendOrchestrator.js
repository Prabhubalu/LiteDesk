'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Campaign = require('../../models/Campaign');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { processCampaignSendChunk } = require('./campaignSendChunkWorker');
const { sendCampaignAbTestPhase, sendCampaignAbTestFromSnapshot } = require('./marketingAbTestService');
const {
  CAMPAIGN_SEND_INLINE_MAX,
  CAMPAIGN_SEND_CHUNK_SIZE
} = require('./campaignSendConstants');
const {
  snapshotCampaignRecipients,
  countTotalCampaignRecipients,
  countPendingCampaignRecipients,
  loadCampaignRecipientChunk,
  hasCampaignRecipientSnapshot,
  buildCampaignSnapshotResumeState
} = require('./campaignRecipientSnapshotService');
const {
  buildCampaignCreditPrecheckChecks
} = require('./marketingCampaignCreditPrecheckService');
const { computeCampaignSubmitPacing } = require('./campaignSubmitPacing');
const {
  refreshOrgEmailThroughput,
  getOrgEmailPolicy
} = require('../orgEmailPolicyService');
const {
  reserveCampaignSendCredits,
  releaseCampaignSendCredits,
  finalizeCampaignSendCredits
} = require('./campaignSendCreditService');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {object} patch
 */
async function updateCampaignSendState(organizationId, campaignId, patch) {
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));
  return runWithOrganizationTenantContext(organizationId, async () =>
    Campaign.updateOne(
      { _id: campaignObjectId, organizationId },
      { $set: patch }
    )
  );
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} recipientCount
 */
async function assertCampaignSendPolicy(organizationId, recipientCount) {
  const precheck = await buildCampaignCreditPrecheckChecks(organizationId, recipientCount);
  const blocking = (precheck.checks || []).filter((check) => check.status === 'error');
  if (blocking.length > 0) {
    throw new Error(blocking[0].message || 'Campaign send precheck failed');
  }
}

/**
 * @param {object} payload
 */
async function runCampaignSendFromSnapshot(payload) {
  const organizationId = payload.organizationId;
  const campaignId = payload.campaignId;
  const jobId = payload.jobId || null;

  const existingSnapshot = await hasCampaignRecipientSnapshot(organizationId, campaignId);
  let resumeState = existingSnapshot
    ? await buildCampaignSnapshotResumeState(organizationId, campaignId)
    : null;
  const isResume = Boolean(
    payload.resume === true || (resumeState?.isResume && payload.forceSnapshot !== true)
  );

  let totalRecipients = 0;

  if (!payload.skipSnapshot && !isResume) {
    await updateCampaignSendState(organizationId, campaignId, {
      'sendState.phase': 'resolving',
      'sendState.recipientSource': 'snapshot',
      'sendState.error': null
    });

    const snapshot = await snapshotCampaignRecipients({
      organizationId,
      campaignId,
      audienceId: payload.audienceId,
      inlineRecipients: payload.recipients
    });

    totalRecipients = snapshot.total;
    if (totalRecipients === 0) {
      throw new Error('No mailable recipients found for this campaign');
    }

    await updateCampaignSendState(organizationId, campaignId, {
      'sendState.resolvedCount': totalRecipients,
      'sendState.preparedCount': 0,
      'sendState.lastChunkIndex': 0
    });
    resumeState = null;
  } else {
    totalRecipients =
      resumeState?.resolvedCount
      || resumeState?.totalRecipients
      || (await countTotalCampaignRecipients(organizationId, campaignId));
    if (totalRecipients === 0) {
      throw new Error('Campaign recipient snapshot is empty');
    }
  }

  if (isResume && resumeState) {
    const pendingCount = await countPendingCampaignRecipients(organizationId, campaignId);
    if (pendingCount === 0) {
      const campaignDoc = await runWithOrganizationTenantContext(organizationId, async () =>
        Campaign.findOne({ _id: campaignId, organizationId })
          .select('status stats.sendError stats.queued')
          .lean()
      );
      if (campaignDoc?.status === 'failed' || campaignDoc?.stats?.sendError) {
        throw new Error(campaignDoc.stats?.sendError || 'Campaign send failed');
      }
      if ((campaignDoc?.stats?.queued || 0) <= 0 && campaignDoc?.status !== 'completed') {
        throw new Error('Campaign send did not complete successfully');
      }
      await updateCampaignSendState(organizationId, campaignId, {
        'sendState.phase': 'completed',
        'sendState.error': null
      });
      return {
        accepted: resumeState.initialQueued || 0,
        rejected: 0,
        skippedUnsubscribed: 0,
        communicationIds: []
      };
    }
  }

  await assertCampaignSendPolicy(organizationId, totalRecipients);

  let creditsReservedAmount = 0;
  try {
    const reservation = await reserveCampaignSendCredits(
      organizationId,
      campaignId,
      totalRecipients
    );
    creditsReservedAmount = reservation.reserved;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateCampaignSendState(organizationId, campaignId, {
      'sendState.phase': 'failed',
      'sendState.error': message
    });
    throw err;
  }

  await updateCampaignSendState(organizationId, campaignId, {
    'sendState.phase': 'running',
    'sendState.jobId': jobId,
    'sendState.resolvedCount': totalRecipients,
    'sendState.error': null,
    ...(isResume ? {} : { 'stats.sendStartedAt': new Date() })
  });

  let preparedCount = isResume && resumeState ? resumeState.preparedCount : 0;
  let chunkIndex = isResume && resumeState ? resumeState.lastChunkIndex : 0;
  const initialQueued = isResume && resumeState ? resumeState.initialQueued : 0;
  /** @type {{ accepted: number, rejected: number, skippedUnsubscribed: number, communicationIds: import('mongoose').Types.ObjectId[] }} */
  const aggregate = {
    accepted: 0,
    rejected: 0,
    skippedUnsubscribed: 0,
    communicationIds: []
  };

  try {
    await refreshOrgEmailThroughput(organizationId);
    const sendPacing = computeCampaignSubmitPacing(await getOrgEmailPolicy(organizationId));

    while (true) {
      const chunk = await loadCampaignRecipientChunk(
        organizationId,
        campaignId,
        CAMPAIGN_SEND_CHUNK_SIZE
      );
      if (chunk.length === 0) break;

      const appendStats = chunkIndex > 0 || preparedCount > 0;

      const result = await processCampaignSendChunk({
        organizationId,
        campaignId,
        recipients: chunk,
        from: payload.from,
        subject: payload.subject,
        content: payload.content,
        trackOpens: payload.trackOpens,
        trackClicks: payload.trackClicks,
        skipAlreadySentGuard: appendStats,
        appendStats,
        skipPolicyChecks: true,
        finalizeStatus: 'running',
        markSuppressedRecipients: true
      });

      aggregate.accepted += result.accepted || 0;
      aggregate.rejected += result.rejected || 0;
      aggregate.skippedUnsubscribed += result.skippedUnsubscribed || 0;
      if (Array.isArray(result.communicationIds)) {
        aggregate.communicationIds.push(...result.communicationIds);
      }

      preparedCount += chunk.length;
      chunkIndex += 1;

      const pendingAfterChunk = await countPendingCampaignRecipients(organizationId, campaignId);
      if (pendingAfterChunk > 0 && sendPacing.submitBatchDelayMs > 0) {
        await sleep(sendPacing.submitBatchDelayMs);
      }

      await runWithOrganizationTenantContext(organizationId, async () => {
        await Campaign.updateOne(
          { _id: campaignId, organizationId },
          {
            $set: {
              'sendState.preparedCount': preparedCount,
              'sendState.lastChunkIndex': chunkIndex
            },
            $inc: {
              'stats.prepared': chunk.length
            }
          }
        );
      });
    }

    const totalAccepted = initialQueued + aggregate.accepted;

    const campaignDoc = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: campaignId, organizationId })
        .select('status stats.sendError')
        .lean()
    );
    if (campaignDoc?.status === 'failed' || campaignDoc?.stats?.sendError) {
      throw new Error(campaignDoc.stats?.sendError || 'Campaign send failed');
    }
    if (totalAccepted <= 0 && totalRecipients > 0) {
      throw new Error('No recipients were accepted by the mail service');
    }

    await finalizeCampaignSendCredits(organizationId, campaignId, {
      reserved: creditsReservedAmount,
      accepted: totalAccepted
    });

    await runWithOrganizationTenantContext(organizationId, async () => {
      await Campaign.updateOne(
        { _id: campaignId, organizationId },
        {
          $set: {
            scheduledAt: null,
            scheduledRecipients: [],
            status: 'completed',
            'sendState.phase': 'completed',
            'sendState.preparedCount': preparedCount,
            'sendState.error': null,
            'stats.sendCompletedAt': new Date()
          }
        }
      );
    });

    return {
      ...aggregate,
      accepted: totalAccepted
    };
  } catch (err) {
    const hasPartialProgress = preparedCount > 0 || chunkIndex > 0;
    if (!hasPartialProgress && creditsReservedAmount > 0) {
      await releaseCampaignSendCredits(organizationId, campaignId, creditsReservedAmount).catch(
        (releaseErr) => {
          console.warn(
            '[campaignSendOrchestrator] credit release failed:',
            releaseErr?.message || releaseErr
          );
        }
      );
    } else {
      await updateCampaignSendState(organizationId, campaignId, {
        'sendState.phase': 'failed',
        'sendState.preparedCount': preparedCount,
        'sendState.lastChunkIndex': chunkIndex,
        'sendState.error': err instanceof Error ? err.message : String(err)
      });
    }
    throw err;
  }
}

/**
 * @param {object} payload
 */
async function runCampaignSendJob(payload) {
  const organizationId = payload.organizationId;
  const campaignId = payload.campaignId;
  const jobId = payload.jobId || null;

  if (payload.useSnapshot && payload.abTestEnabled) {
    try {
      return await sendCampaignAbTestFromSnapshot(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateCampaignSendState(organizationId, campaignId, {
        'sendState.phase': 'failed',
        'sendState.error': message
      });
      throw err;
    }
  }

  if (payload.useSnapshot && !payload.abTestEnabled) {
    try {
      return await runCampaignSendFromSnapshot(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateCampaignSendState(organizationId, campaignId, {
        'sendState.phase': 'failed',
        'sendState.error': message
      });
      throw err;
    }
  }

  const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
  const recipientCount = recipients.length;

  await assertCampaignSendPolicy(organizationId, recipientCount);

  let creditsReservedAmount = 0;
  try {
    const reservation = await reserveCampaignSendCredits(
      organizationId,
      campaignId,
      recipientCount
    );
    creditsReservedAmount = reservation.reserved;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateCampaignSendState(organizationId, campaignId, {
      'sendState.phase': 'failed',
      'sendState.error': message
    });
    throw err;
  }

  await updateCampaignSendState(organizationId, campaignId, {
    'sendState.phase': 'running',
    'sendState.jobId': jobId,
    'sendState.resolvedCount': recipientCount,
    'sendState.error': null,
    'stats.sendStartedAt': new Date()
  });

  try {
    const result = payload.abTestEnabled
      ? await sendCampaignAbTestPhase({
          organizationId,
          campaignId,
          recipients,
          from: payload.from,
          content: payload.content,
          trackOpens: payload.trackOpens,
          trackClicks: payload.trackClicks
        })
      : await processCampaignSendChunk({
          organizationId,
          campaignId,
          recipients,
          from: payload.from,
          subject: payload.subject,
          content: payload.content,
          trackOpens: payload.trackOpens,
          trackClicks: payload.trackClicks,
          markSuppressedRecipients: false
        });

    await runWithOrganizationTenantContext(organizationId, async () => {
      await Campaign.updateOne(
        { _id: campaignId, organizationId },
        {
          $set: {
            scheduledAt: null,
            scheduledRecipients: [],
            'sendState.phase': 'completed',
            'sendState.preparedCount': recipientCount,
            'sendState.error': null
          }
        }
      );
    });

    await finalizeCampaignSendCredits(organizationId, campaignId, {
      reserved: creditsReservedAmount,
      accepted: result.accepted || 0
    });

    return result;
  } catch (err) {
    if (creditsReservedAmount > 0) {
      await releaseCampaignSendCredits(organizationId, campaignId, creditsReservedAmount).catch(
        (releaseErr) => {
          console.warn(
            '[campaignSendOrchestrator] credit release failed:',
            releaseErr?.message || releaseErr
          );
        }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    await updateCampaignSendState(organizationId, campaignId, {
      'sendState.phase': 'failed',
      'sendState.error': message
    });
    throw err;
  }
}

/**
 * @param {number} recipientCount
 */
function shouldRunCampaignSendInline(recipientCount) {
  const count = Math.max(0, Number(recipientCount) || 0);
  return count <= CAMPAIGN_SEND_INLINE_MAX;
}

/**
 * @param {object} payload
 * @returns {Promise<{ mode: string, jobId: string, phase: string, recipientCount: number }>}
 */
async function enqueueCampaignSend(payload) {
  const organizationId = payload.organizationId;
  const campaignId = payload.campaignId;
  const recipientCount = payload.useSnapshot
    ? Math.max(0, Number(payload.recipientCount) || 0)
    : Array.isArray(payload.recipients)
      ? payload.recipients.length
      : 0;
  const jobId = `campaign-send-${String(campaignId)}-${crypto.randomBytes(6).toString('hex')}`;

  const recipientSource = payload.useSnapshot
    ? 'snapshot'
    : (payload.recipientSource || 'inline');

  const resumeState =
    payload.useSnapshot && payload.forceSnapshot !== true
      ? await buildCampaignSnapshotResumeState(organizationId, campaignId)
      : null;
  const isResume = Boolean(payload.resume === true || resumeState?.isResume);

  await updateCampaignSendState(organizationId, campaignId, {
    'sendState.phase': 'queued',
    'sendState.jobId': jobId,
    'sendState.recipientSource': recipientSource,
    'sendState.resolvedCount': isResume
      ? (resumeState?.resolvedCount || recipientCount)
      : recipientCount,
    ...(isResume
      ? {}
      : {
          'sendState.preparedCount': 0,
          'sendState.lastChunkIndex': 0
        }),
    'sendState.error': null,
    ...(payload.audienceId ? { 'sendState.audienceId': payload.audienceId } : {})
  });

  const jobPayload = {
    ...payload,
    jobId,
    resume: isResume,
    skipSnapshot: isResume ? true : payload.skipSnapshot,
    forceSnapshot: payload.forceSnapshot === true
  };
  const { enqueueCampaignSendJob } = require('./campaignSendQueueService');
  const queueResult = enqueueCampaignSendJob(jobPayload, {
    recipientCount,
    forceQueue: Boolean(payload.useSnapshot)
  });

  return {
    mode: queueResult.mode,
    jobId,
    phase: 'queued',
    recipientCount
  };
}

module.exports = {
  runCampaignSendJob,
  enqueueCampaignSend,
  shouldRunCampaignSendInline,
  updateCampaignSendState,
  assertCampaignSendPolicy,
  runCampaignSendFromSnapshot
};
