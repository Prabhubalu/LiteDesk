'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Campaign = require('../../models/Campaign');
const CampaignRecipient = require('../../models/CampaignRecipient');
const Communication = require('../../models/Communication');
const MarketingAudience = require('../../models/MarketingAudience');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { buildIdempotencyKey } = require('../../utils/arivuMetadata');
const { normalizeEmail } = require('./marketingEmailUtils');
const { loadAudience } = require('./marketingAudienceService');
const { loadSegment } = require('./marketingSegmentQueryService');
const {
  streamPeopleForSend,
  mapPersonToSendRecipient
} = require('./marketingAudienceQueryCompiler');
const { CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE } = require('./campaignSendConstants');

const RECIPIENT_CHUNK_PENDING_STATUSES = ['pending', 'prepared'];

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
async function clearCampaignRecipients(organizationId, campaignId) {
  return runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.deleteMany({
      organizationId,
      campaignId: new mongoose.Types.ObjectId(String(campaignId))
    })
  );
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {object[]} rows
 * @param {Set<string>} seenEmails
 */
async function bulkInsertRecipientRows(organizationId, campaignId, rows, seenEmails) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { inserted: 0, duplicates: 0, skippedInvalid: 0 };
  }

  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));
  const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
  /** @type {object[]} */
  const docs = [];
  let duplicates = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) {
      skippedInvalid += 1;
      continue;
    }
    if (seenEmails.has(email)) {
      duplicates += 1;
      continue;
    }
    seenEmails.add(email);

    const recipientId = String(row.recipientId || row.personId || email).trim();
    const idempotencyKey = buildIdempotencyKey(
      'marketing',
      String(organizationId),
      String(campaignId),
      recipientId
    );
    const idempotencyKeyHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');

    docs.push({
      organizationId: orgObjectId,
      campaignId: campaignObjectId,
      personId: row.personId || null,
      email,
      name: row.name ? String(row.name).trim() : '',
      recipientId,
      status: 'pending',
      chunkIndex: 0,
      variantKey: row.variantKey || null,
      idempotencyKeyHash
    });
  }

  if (docs.length === 0) {
    return { inserted: 0, duplicates, skippedInvalid };
  }

  let inserted = 0;
  await runWithOrganizationTenantContext(organizationId, async () => {
    for (let i = 0; i < docs.length; i += CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE) {
      const slice = docs.slice(i, i + CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE);
      try {
        const result = await CampaignRecipient.insertMany(slice, { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err?.code === 11000 && Array.isArray(err?.insertedDocs)) {
          inserted += err.insertedDocs.length;
          duplicates += slice.length - err.insertedDocs.length;
        } else if (err?.writeErrors?.length) {
          inserted += slice.length - err.writeErrors.length;
          duplicates += err.writeErrors.length;
        } else {
          throw err;
        }
      }
    }
  });

  return { inserted, duplicates, skippedInvalid };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {{ email: string, name?: string, recipientId: string, mergeData?: object }[]} recipients
 */
async function snapshotFromInlineRecipients(organizationId, campaignId, recipients) {
  await clearCampaignRecipients(organizationId, campaignId);
  const seenEmails = new Set();
  /** @type {{ inserted: number, duplicates: number, skippedInvalid: number }} */
  let totals = { inserted: 0, duplicates: 0, skippedInvalid: 0 };

  for (let i = 0; i < recipients.length; i += CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE) {
    const slice = recipients.slice(i, i + CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE);
    const rows = slice.map((recipient) => {
      const email = normalizeEmail(recipient.email);
      if (!email) return null;
      const recipientId = String(recipient.recipientId || email).trim();
      const personId =
        recipient.mergeData?.personId && mongoose.Types.ObjectId.isValid(recipient.mergeData.personId)
          ? new mongoose.Types.ObjectId(String(recipient.mergeData.personId))
          : mongoose.Types.ObjectId.isValid(recipientId)
            ? new mongoose.Types.ObjectId(String(recipientId))
            : null;
      return {
        email,
        name: recipient.name,
        recipientId,
        personId
      };
    }).filter(Boolean);

    const batchResult = await bulkInsertRecipientRows(organizationId, campaignId, rows, seenEmails);
    totals = {
      inserted: totals.inserted + batchResult.inserted,
      duplicates: totals.duplicates + batchResult.duplicates,
      skippedInvalid: totals.skippedInvalid + batchResult.skippedInvalid
    };
  }

  return {
    total: totals.inserted,
    duplicates: totals.duplicates,
    skippedInvalid: totals.skippedInvalid
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {import('mongoose').Types.ObjectId|string} segmentId
 * @param {object|null} filterQuery
 */
async function snapshotFromSegmentFilter(organizationId, campaignId, segmentId, filterQuery) {
  await clearCampaignRecipients(organizationId, campaignId);
  const seenEmails = new Set();
  /** @type {{ inserted: number, duplicates: number, skippedInvalid: number }} */
  let totals = { inserted: 0, duplicates: 0, skippedInvalid: 0 };

  await streamPeopleForSend(
    organizationId,
    filterQuery,
    async (peopleBatch) => {
      const rows = peopleBatch
        .map((person) => mapPersonToSendRecipient(person))
        .filter(Boolean);
      const batchResult = await bulkInsertRecipientRows(organizationId, campaignId, rows, seenEmails);
      totals = {
        inserted: totals.inserted + batchResult.inserted,
        duplicates: totals.duplicates + batchResult.duplicates,
        skippedInvalid: totals.skippedInvalid + batchResult.skippedInvalid
      };
    },
    { segmentId: String(segmentId) }
  );

  return {
    total: totals.inserted,
    duplicates: totals.duplicates,
    skippedInvalid: totals.skippedInvalid
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {import('mongoose').Document|object} audience
 */
async function snapshotFromStaticAudience(organizationId, campaignId, audience) {
  await clearCampaignRecipients(organizationId, campaignId);
  const seenEmails = new Set();
  /** @type {{ inserted: number, duplicates: number, skippedInvalid: number }} */
  let totals = { inserted: 0, duplicates: 0, skippedInvalid: 0 };
  const members = Array.isArray(audience.members) ? audience.members : [];

  for (let i = 0; i < members.length; i += CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE) {
    const slice = members.slice(i, i + CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE);
    const rows = slice.map((member) => {
      const email = normalizeEmail(member.email);
      if (!email) return null;
      const personId = member.personId || null;
      return {
        email,
        name: member.name ? String(member.name).trim() : undefined,
        recipientId: personId ? String(personId) : email,
        personId
      };
    }).filter(Boolean);

    const batchResult = await bulkInsertRecipientRows(organizationId, campaignId, rows, seenEmails);
    totals = {
      inserted: totals.inserted + batchResult.inserted,
      duplicates: totals.duplicates + batchResult.duplicates,
      skippedInvalid: totals.skippedInvalid + batchResult.skippedInvalid
    };
  }

  return {
    total: totals.inserted,
    duplicates: totals.duplicates,
    skippedInvalid: totals.skippedInvalid
  };
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.campaignId
 * @param {import('mongoose').Types.ObjectId|string} [params.audienceId]
 * @param {{ email: string, name?: string, recipientId: string, mergeData?: object }[]} [params.inlineRecipients]
 */
async function snapshotCampaignRecipients({
  organizationId,
  campaignId,
  audienceId,
  inlineRecipients
}) {
  if (audienceId) {
    const audience = await loadAudience(organizationId, audienceId);
    if (!audience) {
      throw new Error('Audience not found');
    }

    if (audience.type === 'dynamic') {
      if (!audience.segmentId) {
        throw new Error('Dynamic audience has no segment configured.');
      }
      const segment = await loadSegment(organizationId, audience.segmentId);
      if (!segment) {
        throw new Error('Segment not found');
      }
      return snapshotFromSegmentFilter(
        organizationId,
        campaignId,
        audience.segmentId,
        segment.filterQuery
      );
    }

    return snapshotFromStaticAudience(organizationId, campaignId, audience);
  }

  if (Array.isArray(inlineRecipients) && inlineRecipients.length > 0) {
    return snapshotFromInlineRecipients(organizationId, campaignId, inlineRecipients);
  }

  throw new Error('At least one recipient source is required to snapshot campaign recipients');
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
async function countTotalCampaignRecipients(organizationId, campaignId) {
  return runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.countDocuments({
      organizationId,
      campaignId: new mongoose.Types.ObjectId(String(campaignId))
    })
  );
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
async function countPendingCampaignRecipients(organizationId, campaignId) {
  return runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.countDocuments({
      organizationId,
      campaignId: new mongoose.Types.ObjectId(String(campaignId)),
      status: { $in: RECIPIENT_CHUNK_PENDING_STATUSES }
    })
  );
}

/** @deprecated Use countPendingCampaignRecipients for remaining work */
async function countCampaignRecipients(organizationId, campaignId) {
  return countPendingCampaignRecipients(organizationId, campaignId);
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {number} limit
 */
async function loadCampaignRecipientChunk(organizationId, campaignId, limit) {
  const rows = await runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.find({
      organizationId,
      campaignId: new mongoose.Types.ObjectId(String(campaignId)),
      status: { $in: RECIPIENT_CHUNK_PENDING_STATUSES }
    })
      .sort({ _id: 1 })
      .limit(Math.max(1, limit))
      .lean()
  );

  return rows.map((row) => ({
    email: row.email,
    name: row.name || undefined,
    recipientId: row.recipientId,
    mergeData: row.personId ? { personId: String(row.personId) } : undefined,
    variantKey: row.variantKey || undefined
  }));
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
async function hasCampaignRecipientSnapshot(organizationId, campaignId) {
  const count = await runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.countDocuments({
      organizationId,
      campaignId: new mongoose.Types.ObjectId(String(campaignId))
    }).limit(1)
  );
  return count > 0;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
async function loadAllCampaignSnapshotRecipients(organizationId, campaignId) {
  const rows = await runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.find({
      organizationId,
      campaignId: new mongoose.Types.ObjectId(String(campaignId)),
      status: 'pending'
    })
      .sort({ _id: 1 })
      .select('email name recipientId personId variantKey')
      .lean()
  );

  return rows.map((row) => ({
    email: row.email,
    name: row.name || undefined,
    recipientId: row.recipientId,
    mergeData: row.personId ? { personId: String(row.personId) } : undefined,
    variantKey: row.variantKey || undefined
  }));
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {string[]} recipientIds
 */
async function markCampaignRecipientsHeldBack(organizationId, campaignId, recipientIds) {
  const ids = [...new Set((recipientIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) return;

  await runWithOrganizationTenantContext(organizationId, async () =>
    CampaignRecipient.updateMany(
      {
        organizationId,
        campaignId: new mongoose.Types.ObjectId(String(campaignId)),
        recipientId: { $in: ids }
      },
      { $set: { status: 'skipped', errorCode: 'ab_held_back' } }
    )
  );
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.campaignId
 * @param {object} [params.sendState]
 * @param {number} [params.totalRecipients]
 * @param {number} [params.pendingCount]
 * @param {number} [params.initialQueued]
 */
function buildCampaignSnapshotResumePlan(params) {
  const sendState = params.sendState || {};
  const totalRecipients = Math.max(0, Number(params.totalRecipients) || 0);
  const pendingCount = Math.max(0, Number(params.pendingCount) || 0);
  const processedCount = Math.max(0, totalRecipients - pendingCount);
  const phase = String(sendState.phase || 'idle');
  const lastChunkIndex = Math.max(0, Number(sendState.lastChunkIndex) || 0);

  const isResume =
    processedCount > 0
    || lastChunkIndex > 0
    || (['running', 'failed'].includes(phase) && pendingCount > 0 && totalRecipients > 0);

  return {
    isResume,
    totalRecipients,
    pendingCount,
    processedCount,
    lastChunkIndex,
    resolvedCount: Math.max(0, Number(sendState.resolvedCount) || totalRecipients),
    preparedCount: Math.max(processedCount, Number(sendState.preparedCount) || 0),
    initialQueued: Math.max(0, Number(params.initialQueued) || 0),
    creditsReserved: Math.max(0, Number(sendState.creditsReserved) || 0)
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
async function buildCampaignSnapshotResumeState(organizationId, campaignId) {
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));

  return runWithOrganizationTenantContext(organizationId, async () => {
    const campaign = await Campaign.findOne({ _id: campaignObjectId, organizationId })
      .select('sendState stats')
      .lean();
    const totalRecipients = await CampaignRecipient.countDocuments({
      organizationId,
      campaignId: campaignObjectId
    });
    const pendingCount = await countPendingCampaignRecipients(organizationId, campaignId);

    return buildCampaignSnapshotResumePlan({
      sendState: campaign?.sendState,
      totalRecipients,
      pendingCount,
      initialQueued: campaign?.stats?.queued
    });
  });
}

/**
 * Reset a failed send so the campaign can be retried from its existing snapshot.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
async function resetFailedCampaignForResend(organizationId, campaignId) {
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));

  return runWithOrganizationTenantContext(organizationId, async () => {
    await CampaignRecipient.updateMany(
      {
        organizationId,
        campaignId: campaignObjectId,
        status: { $in: ['prepared', 'queued'] }
      },
      { $set: { status: 'pending', errorCode: null, communicationId: null } }
    );

    await Communication.updateMany(
      {
        organizationId,
        'relatedTo.moduleKey': 'campaigns',
        'relatedTo.recordId': campaignObjectId,
        status: 'sending',
        'metadata.amdsMessageId': null
      },
      {
        $set: {
          status: 'failed',
          'metadata.sendErrorCode': 'send_retry_reset'
        }
      }
    );

    await Campaign.updateOne(
      { _id: campaignObjectId, organizationId },
      {
        $set: {
          status: 'draft',
          'sendState.phase': 'idle',
          'sendState.error': null,
          'sendState.preparedCount': 0,
          'sendState.lastChunkIndex': 0,
          'stats.sendError': null,
          'stats.queued': 0,
          'stats.rejected': 0,
          'stats.totalRecipients': 0,
          'stats.prepared': 0
        }
      }
    );
  });
}

module.exports = {
  clearCampaignRecipients,
  snapshotCampaignRecipients,
  snapshotFromInlineRecipients,
  snapshotFromSegmentFilter,
  snapshotFromStaticAudience,
  countCampaignRecipients,
  countTotalCampaignRecipients,
  countPendingCampaignRecipients,
  loadCampaignRecipientChunk,
  loadAllCampaignSnapshotRecipients,
  markCampaignRecipientsHeldBack,
  hasCampaignRecipientSnapshot,
  buildCampaignSnapshotResumePlan,
  buildCampaignSnapshotResumeState,
  resetFailedCampaignForResend
};
