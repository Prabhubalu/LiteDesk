'use strict';

const crypto = require('crypto');
const Campaign = require('../../models/Campaign');
const { sendCampaignBatch } = require('./sendCampaignBatch');
const { processCampaignSendChunk } = require('./campaignSendChunkWorker');
const { CAMPAIGN_SEND_CHUNK_SIZE } = require('./campaignSendConstants');
const {
  snapshotCampaignRecipients,
  loadAllCampaignSnapshotRecipients,
  markCampaignRecipientsHeldBack,
  hasCampaignRecipientSnapshot
} = require('./campaignRecipientSnapshotService');

/**
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function toRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num > 1 ? num / 100 : num;
}

/**
 * @param {object} campaign
 */
function validateAbTestConfig(campaign) {
  if (!campaign?.abTest?.enabled) {
    return { valid: true };
  }

  const variants = Array.isArray(campaign.variants) ? campaign.variants : [];
  if (variants.length < 2) {
    return { valid: false, error: 'A/B tests require at least two variants' };
  }

  const splitTotal = variants.reduce((sum, variant) => sum + toNumber(variant.splitPercent), 0);
  if (Math.abs(splitTotal - 100) > 0.01) {
    return { valid: false, error: 'Variant split percentages must total 100%' };
  }

  for (const variant of variants) {
    const subject = String(variant.subject || '').trim();
    if (!subject) {
      return { valid: false, error: `Variant ${variant.key || variant.label || '?'} requires a subject line` };
    }
  }

  const samplePercent = toNumber(campaign.abTest.samplePercent);
  if (samplePercent < 5 || samplePercent > 50) {
    return { valid: false, error: 'A/B sample size must be between 5% and 50%' };
  }

  return { valid: true };
}

/**
 * Fisher–Yates shuffle (in-place copy).
 * @template T
 * @param {T[]} list
 * @returns {T[]}
 */
function shuffleList(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * @param {{ email: string, name?: string, recipientId: string }[]} recipients
 * @param {object[]} variants
 * @param {number} samplePercent
 */
function partitionAbRecipients(recipients, variants, samplePercent) {
  const shuffled = shuffleList(recipients);
  const sampleSize = Math.max(
    Math.min(shuffled.length, Math.max(2, Math.ceil(shuffled.length * (samplePercent / 100)))),
    shuffled.length <= 2 ? shuffled.length : 2
  );

  const testPool = shuffled.slice(0, sampleSize);
  const heldBack = shuffled.slice(sampleSize);

  /** @type {Array<{ email: string, name?: string, recipientId: string, subject: string, variantKey: string }>} */
  const assigned = [];
  let cursor = 0;

  for (const variant of variants) {
    const count = Math.round(testPool.length * (toNumber(variant.splitPercent) / 100));
    const slice = testPool.slice(cursor, cursor + count);
    cursor += count;
    for (const recipient of slice) {
      assigned.push({
        ...recipient,
        subject: String(variant.subject || '').trim(),
        variantKey: String(variant.key || '').trim()
      });
    }
  }

  while (cursor < testPool.length) {
    const recipient = testPool[cursor];
    const fallbackVariant = variants[variants.length - 1];
    assigned.push({
      ...recipient,
      subject: String(fallbackVariant.subject || '').trim(),
      variantKey: String(fallbackVariant.key || '').trim()
    });
    cursor += 1;
  }

  return { testRecipients: assigned, heldBackRecipients: heldBack };
}

/**
 * @param {object} variant
 * @param {'open_rate'|'click_rate'} metric
 */
function variantScore(variant, metric) {
  const stats = variant.stats || {};
  const recipients = toNumber(stats.totalRecipients);
  if (recipients <= 0) return 0;
  if (metric === 'click_rate') {
    return toNumber(stats.uniqueClicks) / recipients;
  }
  return toNumber(stats.uniqueOpens) / recipients;
}

/**
 * @param {object} campaign
 */
function pickAbWinner(campaign) {
  const metric = campaign.abTest?.winnerMetric === 'click_rate' ? 'click_rate' : 'open_rate';
  const variants = Array.isArray(campaign.variants) ? campaign.variants : [];
  if (variants.length === 0) {
    throw new Error('No variants configured');
  }

  let winner = variants[0];
  let bestScore = variantScore(winner, metric);

  for (let i = 1; i < variants.length; i += 1) {
    const score = variantScore(variants[i], metric);
    if (score > bestScore) {
      winner = variants[i];
      bestScore = score;
    }
  }

  return {
    variantKey: String(winner.key || '').trim(),
    variant: winner,
    metric,
    score: bestScore
  };
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.campaignId
 * @param {{ email: string, name?: string, recipientId: string }[]} params.recipients
 * @param {object} [params.from]
 * @param {{ html: string, text?: string }} [params.content]
 * @param {boolean} [params.trackOpens]
 * @param {boolean} [params.trackClicks]
 */
async function sendCampaignAbTestPhase({
  organizationId,
  campaignId,
  recipients,
  from,
  content,
  trackOpens,
  trackClicks
}) {
  const campaign = await Campaign.findOne({ _id: campaignId, organizationId });
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const validation = validateAbTestConfig(campaign);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid A/B test configuration');
  }

  const variants = campaign.variants || [];
  const { testRecipients, heldBackRecipients } = partitionAbRecipients(
    recipients,
    variants,
    toNumber(campaign.abTest?.samplePercent)
  );

  const result = await sendCampaignBatch({
    organizationId,
    campaignId,
    recipients: testRecipients,
    from,
    content,
    trackOpens,
    trackClicks,
    finalizeStatus: 'running',
    skipAlreadySentGuard: false
  });

  await Campaign.updateOne(
    { _id: campaignId, organizationId },
    {
      $set: {
        campaignType: 'ab_test',
        'abTest.status': 'testing',
        'abTest.testStartedAt': new Date(),
        'abTest.winnerVariantKey': null,
        'abTest.winnerSelectedAt': null,
        heldBackRecipients: heldBackRecipients.map((row) => ({
          email: row.email,
          name: row.name || '',
          recipientId: row.recipientId
        }))
      }
    }
  );

  for (const variant of variants) {
    const sentCount = testRecipients.filter((row) => row.variantKey === variant.key).length;
    await Campaign.updateOne(
      { _id: campaignId, organizationId, 'variants.key': variant.key },
      {
        $set: {
          'variants.$.stats.totalRecipients': sentCount,
          'variants.$.stats.sendStartedAt': new Date()
        }
      }
    );
  }

  return {
    ...result,
    phase: 'test',
    testRecipients: testRecipients.length,
    heldBackRecipients: heldBackRecipients.length
  };
}

/**
 * A/B test send using a frozen recipient snapshot and the chunk worker pipeline.
 * @param {object} params
 */
async function sendCampaignAbTestFromSnapshot(params) {
  const organizationId = params.organizationId;
  const campaignId = params.campaignId;

  const campaign = await Campaign.findOne({ _id: campaignId, organizationId });
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const validation = validateAbTestConfig(campaign);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid A/B test configuration');
  }

  const existingSnapshot = await hasCampaignRecipientSnapshot(organizationId, campaignId);
  if (!params.skipSnapshot && !params.resume) {
    if (!params.audienceId && (!Array.isArray(params.recipients) || params.recipients.length === 0)) {
      throw new Error('Audience or recipients are required to snapshot A/B test recipients');
    }
    const snapshot = await snapshotCampaignRecipients({
      organizationId,
      campaignId,
      audienceId: params.audienceId,
      inlineRecipients: params.recipients
    });
    if (snapshot.total === 0) {
      throw new Error('No mailable recipients found for this A/B test');
    }
    await Campaign.updateOne(
      { _id: campaignId, organizationId },
      {
        $set: {
          'sendState.resolvedCount': snapshot.total,
          'sendState.preparedCount': 0,
          'sendState.lastChunkIndex': 0
        }
      }
    );
  } else if (!existingSnapshot) {
    throw new Error('Campaign recipient snapshot is empty');
  }

  const allRecipients = await loadAllCampaignSnapshotRecipients(organizationId, campaignId);
  if (allRecipients.length === 0) {
    throw new Error('No pending recipients remain for this A/B test');
  }

  const variants = campaign.variants || [];
  const { testRecipients, heldBackRecipients } = partitionAbRecipients(
    allRecipients,
    variants,
    toNumber(campaign.abTest?.samplePercent)
  );

  await markCampaignRecipientsHeldBack(
    organizationId,
    campaignId,
    heldBackRecipients.map((row) => row.recipientId)
  );

  let accepted = 0;
  let rejected = 0;
  let skippedUnsubscribed = 0;
  /** @type {import('mongoose').Types.ObjectId[]} */
  const communicationIds = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < testRecipients.length) {
    const chunk = testRecipients.slice(offset, offset + CAMPAIGN_SEND_CHUNK_SIZE);
    offset += chunk.length;

    const result = await processCampaignSendChunk({
      organizationId,
      campaignId,
      recipients: chunk,
      from: params.from,
      content: params.content,
      trackOpens: params.trackOpens,
      trackClicks: params.trackClicks,
      skipAlreadySentGuard: chunkIndex > 0,
      appendStats: chunkIndex > 0,
      skipPolicyChecks: true,
      finalizeStatus: 'running',
      markSuppressedRecipients: true
    });

    accepted += result.accepted || 0;
    rejected += result.rejected || 0;
    skippedUnsubscribed += result.skippedUnsubscribed || 0;
    if (Array.isArray(result.communicationIds)) {
      communicationIds.push(...result.communicationIds);
    }
    chunkIndex += 1;
  }

  await Campaign.updateOne(
    { _id: campaignId, organizationId },
    {
      $set: {
        campaignType: 'ab_test',
        status: 'running',
        'abTest.status': 'testing',
        'abTest.testStartedAt': new Date(),
        'abTest.winnerVariantKey': null,
        'abTest.winnerSelectedAt': null,
        heldBackRecipients: heldBackRecipients.map((row) => ({
          email: row.email,
          name: row.name || '',
          recipientId: row.recipientId
        })),
        'sendState.phase': 'running',
        'sendState.preparedCount': testRecipients.length,
        'sendState.lastChunkIndex': Math.ceil(testRecipients.length / CAMPAIGN_SEND_CHUNK_SIZE)
      }
    }
  );

  for (const variant of variants) {
    const sentCount = testRecipients.filter((row) => row.variantKey === variant.key).length;
    await Campaign.updateOne(
      { _id: campaignId, organizationId, 'variants.key': variant.key },
      {
        $set: {
          'variants.$.stats.totalRecipients': sentCount,
          'variants.$.stats.sendStartedAt': new Date()
        }
      }
    );
  }

  return {
    accepted,
    rejected,
    skippedUnsubscribed,
    communicationIds,
    phase: 'test',
    testRecipients: testRecipients.length,
    heldBackRecipients: heldBackRecipients.length
  };
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.campaignId
 * @param {string} [params.variantKey] — manual override; auto-picks when omitted
 */
async function finalizeAbTestWinner({ organizationId, campaignId, variantKey }) {
  const campaign = await Campaign.findOne({ _id: campaignId, organizationId });
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  if (campaign.abTest?.status !== 'testing') {
    throw new Error('Campaign is not in A/B testing phase');
  }

  let winnerSubject;
  let winnerKey;

  if (variantKey) {
    const match = (campaign.variants || []).find((row) => String(row.key) === String(variantKey));
    if (!match) {
      throw new Error('Unknown variant key');
    }
    winnerKey = String(match.key);
    winnerSubject = String(match.subject || '').trim();
  } else {
    const picked = pickAbWinner(campaign);
    winnerKey = picked.variantKey;
    winnerSubject = String(picked.variant.subject || '').trim();
  }

  const heldBack = Array.isArray(campaign.heldBackRecipients) ? campaign.heldBackRecipients : [];
  /** @type {object|null} */
  let rolloutResult = null;

  if (heldBack.length > 0) {
    const rolloutRecipients = heldBack.map((row) => ({
      email: row.email,
      name: row.name || '',
      recipientId: row.recipientId,
      subject: winnerSubject,
      variantKey: winnerKey
    }));

    rolloutResult = await sendCampaignBatch({
      organizationId,
      campaignId,
      recipients: rolloutRecipients,
      finalizeStatus: 'completed',
      skipAlreadySentGuard: true,
      appendStats: true
    });
  } else {
    await Campaign.updateOne(
      { _id: campaignId, organizationId },
      { $set: { status: 'completed', 'stats.sendCompletedAt': new Date() } }
    );
  }

  await Campaign.updateOne(
    { _id: campaignId, organizationId },
    {
      $set: {
        subject: winnerSubject,
        'abTest.status': 'completed',
        'abTest.winnerVariantKey': winnerKey,
        'abTest.winnerSelectedAt': new Date(),
        heldBackRecipients: []
      }
    }
  );

  return {
    winnerVariantKey: winnerKey,
    winnerSubject,
    rolloutRecipients: heldBack.length,
    rolloutResult
  };
}

/**
 * Process campaigns whose A/B test window has elapsed.
 */
async function processDueAbTests() {
  const now = new Date();
  const campaigns = await Campaign.find({
    'abTest.enabled': true,
    'abTest.status': 'testing',
    'abTest.testStartedAt': { $ne: null }
  })
    .select('_id organizationId abTest.testStartedAt abTest.testDurationHours')
    .lean();

  let processed = 0;
  let finalized = 0;
  let failed = 0;

  for (const row of campaigns) {
    const startedAt = row.abTest?.testStartedAt ? new Date(row.abTest.testStartedAt) : null;
    const hours = toNumber(row.abTest?.testDurationHours) || 4;
    if (!startedAt) continue;

    const dueAt = startedAt.getTime() + hours * 60 * 60 * 1000;
    if (dueAt > now.getTime()) continue;

    processed += 1;
    try {
      await finalizeAbTestWinner({
        organizationId: row.organizationId,
        campaignId: row._id
      });
      finalized += 1;
    } catch (err) {
      failed += 1;
      console.error('[marketingAbTest] finalize failed:', row._id, err instanceof Error ? err.message : err);
    }
  }

  return { processed, finalized, failed };
}

/**
 * @param {object} campaign
 */
function buildAbResultsPayload(campaign) {
  const variants = Array.isArray(campaign.variants) ? campaign.variants : [];
  return {
    enabled: campaign.abTest?.enabled === true,
    status: campaign.abTest?.status || 'none',
    winnerMetric: campaign.abTest?.winnerMetric || 'open_rate',
    samplePercent: toNumber(campaign.abTest?.samplePercent),
    testDurationHours: toNumber(campaign.abTest?.testDurationHours),
    testStartedAt: campaign.abTest?.testStartedAt || null,
    winnerVariantKey: campaign.abTest?.winnerVariantKey || null,
    winnerSelectedAt: campaign.abTest?.winnerSelectedAt || null,
    heldBackCount: Array.isArray(campaign.heldBackRecipients) ? campaign.heldBackRecipients.length : 0,
    variants: variants.map((variant) => ({
      key: variant.key,
      label: variant.label || variant.key,
      subject: variant.subject || '',
      splitPercent: toNumber(variant.splitPercent),
      stats: {
        totalRecipients: toNumber(variant.stats?.totalRecipients),
        delivered: toNumber(variant.stats?.delivered),
        uniqueOpens: toNumber(variant.stats?.uniqueOpens),
        uniqueClicks: toNumber(variant.stats?.uniqueClicks),
        openRate: toRate(variant.stats?.openRate),
        clickRate: toRate(variant.stats?.clickRate)
      }
    }))
  };
}

module.exports = {
  validateAbTestConfig,
  partitionAbRecipients,
  pickAbWinner,
  sendCampaignAbTestPhase,
  sendCampaignAbTestFromSnapshot,
  finalizeAbTestWinner,
  processDueAbTests,
  buildAbResultsPayload
};
