'use strict';

/**
 * Load test campaign send scale (snapshot + merge prep + optional live send).
 *
 * Usage:
 *   node scripts/load-test-campaign-send-scale.js --orgId=<id> --recipients=100 --phase=send
 *   node scripts/load-test-campaign-send-scale.js --orgId=<id> --recipients=50000
 *   node scripts/load-test-campaign-send-scale.js --orgId=<id> --recipients=500000 --phase=snapshot
 *   node scripts/load-test-campaign-send-scale.js --orgId=<id> --recipients=5000 --phase=merge --chunk-size=500
 *
 * Phases:
 *   snapshot  Bulk insert CampaignRecipient rows (default)
 *   merge     Hydrate merge scopes for pending snapshot chunks (no AMDS)
 *   all       snapshot then merge (no mail)
 *   send      snapshot + full campaign send via AMDS; reports prep duration
 *
 * Send options:
 *   --to=user@example.com     Deliver all recipients to one inbox (uses +tags: user+scale0@…)
 *   --from=noreply@localhost.test
 *   --mailpit                 After send, count messages in Mailpit (local dev)
 *   --keep-warmup             Skip disabling AMDS warmup (send may hit rate limits)
 *   --keep                    Do not delete the test campaign when finished
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Campaign = require('../models/Campaign');
const CampaignRecipient = require('../models/CampaignRecipient');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { snapshotFromInlineRecipients } = require('../services/marketing/campaignRecipientSnapshotService');
const { hydrateRecipientMergeScopes } = require('../services/marketing/campaignMergeScopeService');
const { CAMPAIGN_SEND_CHUNK_SIZE } = require('../services/marketing/campaignSendConstants');
const { getCampaignSendMetricsSnapshot } = require('../services/marketing/campaignSendMetrics');
const { runCampaignSendFromSnapshot } = require('../services/marketing/campaignSendOrchestrator');
const { isAmdsEnvConfigured, getAmdsClient } = require('../config/amds');
const OrgEmailPolicy = require('../models/org-email-policy');
const { syncOrgPolicyToAmds } = require('../services/amds/amds-policy-sync');
const { getEmailPolicyDefaultsForPlan } = require('../constants/emailPolicyDefaults');

const MAILPIT_API = String(process.env.MAILPIT_API_URL || 'http://localhost:8025').replace(/\/$/, '');
const RATE_LIMIT_RETRY_WAIT_MS = Number(process.env.AMDS_RATE_LIMIT_RETRY_WAIT_MS) || 65_000;
const RATE_LIMIT_MAX_RETRIES = Number(process.env.AMDS_RATE_LIMIT_MAX_RETRIES) || 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  /** @type {Record<string, string|number|boolean>} */
  const options = {
    recipients: 10_000,
    phase: 'snapshot',
    chunkSize: CAMPAIGN_SEND_CHUNK_SIZE,
    cleanup: true,
    mailpit: false,
    keepWarmup: false,
    to: '',
    from: process.env.DEFAULT_FROM_EMAIL || 'noreply@localhost.test'
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--orgId=')) options.orgId = arg.slice('--orgId='.length);
    else if (arg.startsWith('--recipients=')) options.recipients = Number(arg.slice('--recipients='.length));
    else if (arg.startsWith('--phase=')) options.phase = String(arg.slice('--phase='.length));
    else if (arg.startsWith('--chunk-size=')) options.chunkSize = Number(arg.slice('--chunk-size='.length));
    else if (arg.startsWith('--to=')) options.to = String(arg.slice('--to='.length)).trim();
    else if (arg.startsWith('--from=')) options.from = String(arg.slice('--from='.length)).trim();
    else if (arg === '--keep') options.cleanup = false;
    else if (arg === '--mailpit') options.mailpit = true;
    else if (arg === '--keep-warmup') options.keepWarmup = true;
    else if (mongoose.Types.ObjectId.isValid(arg)) options.orgId = arg;
  }

  return options;
}

function formatMs(ms) {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function memorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssMb: Math.round(usage.rss / (1024 * 1024)),
    heapUsedMb: Math.round(usage.heapUsed / (1024 * 1024)),
    externalMb: Math.round(usage.external / (1024 * 1024))
  };
}

async function resolveOrganizationId(orgIdArg) {
  if (orgIdArg && mongoose.Types.ObjectId.isValid(String(orgIdArg))) {
    return new mongoose.Types.ObjectId(String(orgIdArg));
  }
  const org = await Organization.findOne({ isTenant: true, isActive: true }).select('_id').lean();
  if (!org?._id) throw new Error('Pass --orgId=<organizationId>');
  return org._id;
}

function buildSyntheticRecipients(count, options = {}) {
  /** @type {{ email: string, name: string, recipientId: string }[]} */
  const rows = [];
  const deliverTo = String(options.to || '').trim();

  for (let i = 0; i < count; i += 1) {
    let email;
    if (deliverTo) {
      const at = deliverTo.indexOf('@');
      if (at <= 0) {
        throw new Error('--to must be a valid email address');
      }
      const local = deliverTo.slice(0, at);
      const domain = deliverTo.slice(at + 1);
      email = `${local}+scale${i}@${domain}`;
    } else {
      email = `scale-test-${i}@example.com`;
    }

    rows.push({
      email,
      name: `Load Test ${i}`,
      recipientId: `scale-recipient-${i}`
    });
  }
  return rows;
}

async function createLoadTestCampaign(organizationId, fromEmail) {
  return runWithOrganizationTenantContext(organizationId, async () => {
    const campaign = await Campaign.create({
      organizationId,
      name: `Scale load test ${new Date().toISOString()}`,
      subject: 'Scale load test {{People.first_name}}',
      fromEmail,
      bodyHtml: '<p>Hello {{People.first_name}}</p><p>Load test message.</p>',
      bodyText: 'Hello load test',
      status: 'draft',
      approvalStatus: 'approved',
      trackOpens: false,
      trackClicks: false
    });
    return campaign;
  });
}

async function runSnapshotPhase(organizationId, campaignId, recipients) {
  const startedAt = Date.now();
  const before = memorySnapshot();
  const result = await snapshotFromInlineRecipients(organizationId, campaignId, recipients);
  const durationMs = Date.now() - startedAt;
  return {
    phase: 'snapshot',
    durationMs,
    inserted: result.total,
    duplicates: result.duplicates,
    skippedInvalid: result.skippedInvalid,
    memoryBefore: before,
    memoryAfter: memorySnapshot(),
    ratePerSec: durationMs > 0 ? Math.round((result.total / durationMs) * 1000) : result.total
  };
}

async function runMergePhase(organizationId, campaignId, chunkSize) {
  const startedAt = Date.now();
  const before = memorySnapshot();
  /** @type {number[]} */
  const chunkDurations = [];
  let processed = 0;

  while (true) {
    const rows = await runWithOrganizationTenantContext(organizationId, async () =>
      CampaignRecipient.find({
        organizationId,
        campaignId,
        status: 'pending'
      })
        .sort({ _id: 1 })
        .limit(chunkSize)
        .lean()
    );
    if (rows.length === 0) break;

    const recipients = rows.map((row) => ({
      email: row.email,
      name: row.name || undefined,
      recipientId: row.recipientId,
      mergeData: row.personId ? { personId: String(row.personId) } : undefined
    }));

    const chunkStartedAt = Date.now();
    await hydrateRecipientMergeScopes({
      organizationId,
      recipients,
      subject: 'Hello {{People.first_name}}',
      html: '<p>Hello {{People.first_name}}</p>',
      text: 'Hello {{People.first_name}}'
    });
    chunkDurations.push(Date.now() - chunkStartedAt);
    processed += rows.length;
  }

  const durationMs = Date.now() - startedAt;
  const sorted = [...chunkDurations].sort((a, b) => a - b);
  const p95Index = sorted.length ? Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1) : 0;

  return {
    phase: 'merge',
    durationMs,
    processed,
    chunks: chunkDurations.length,
    p95ChunkMs: sorted[p95Index] || 0,
    maxChunkMs: sorted.length ? sorted[sorted.length - 1] : 0,
    memoryBefore: before,
    memoryAfter: memorySnapshot(),
    ratePerSec: durationMs > 0 ? Math.round((processed / durationMs) * 1000) : processed
  };
}

function isRateLimitError(err) {
  const message = err instanceof Error ? err.message : String(err || '');
  return /Sending limit reached|rate_limit|burst_limit|hourly_limit|daily_limit|429/i.test(message);
}

async function prepareDevSendPolicy(organizationId) {
  const enterprise = getEmailPolicyDefaultsForPlan('ENTERPRISE');
  const existing = await OrgEmailPolicy.findOne({ organizationId });
  if (!existing) {
    throw new Error(`OrgEmailPolicy not found for ${organizationId}`);
  }

  await OrgEmailPolicy.findOneAndUpdate(
    { organizationId },
    {
      $set: {
        status: 'active',
        warmupEnabled: false,
        dailySendLimit: enterprise.dailySendLimit,
        maxHourlyRate: enterprise.maxHourlyRate,
        burstRatePerMin: enterprise.burstRatePerMin,
        maxCampaignSize: enterprise.maxCampaignSize,
        creditsRemaining: Math.max(existing.creditsRemaining ?? 0, enterprise.emailCredits)
      }
    }
  );

  await syncOrgPolicyToAmds(organizationId);

  const client = getAmdsClient();
  if (client) {
    try {
      const throughput = await client.getTenantThroughput(String(organizationId));
      const burstRate = Math.max(1, Number(throughput.effective_burst_rate) || 60);
      const submitBatchSize = Math.max(1, Math.min(50, burstRate - 5));
      process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE = String(submitBatchSize);
      if (!process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS) {
        process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS = String(Math.ceil((60_000 / burstRate) * submitBatchSize));
      }

      console.log('[load-test-campaign-send-scale] policy prepared', {
        warmupEnabled: false,
        effectiveBurstRate: throughput.effective_burst_rate,
        effectiveHourlyRate: throughput.effective_hourly_rate,
        amdsSubmitBatchSize: submitBatchSize,
        amdsSubmitBatchDelayMs: Number(process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS)
      });
    } catch (err) {
      console.log('[load-test-campaign-send-scale] policy prepared (throughput poll skipped)', err?.message || err);
    }
  }
}

async function loadCampaignSendSummary(organizationId, campaignId) {
  return runWithOrganizationTenantContext(organizationId, async () =>
    Campaign.findOne({ _id: campaignId, organizationId }).select('status sendState stats').lean()
  );
}

async function runSendPhase(organizationId, campaignId, recipients, options = {}) {
  if (!isAmdsEnvConfigured()) {
    throw new Error('AMDS is not configured (AMDS_BASE_URL + AMDS_API_KEY required for --phase=send)');
  }

  if (!options.keepWarmup) {
    await prepareDevSendPolicy(organizationId);
  }

  const snapshotStartedAt = Date.now();
  const snapshotResult = await snapshotFromInlineRecipients(organizationId, campaignId, recipients);
  const snapshotMs = Date.now() - snapshotStartedAt;

  const sendStartedAt = Date.now();
  /** @type {object|null} */
  let sendResult = null;
  let attempt = 0;

  while (attempt <= RATE_LIMIT_MAX_RETRIES) {
    try {
      sendResult = await runCampaignSendFromSnapshot({
        organizationId,
        campaignId,
        skipSnapshot: true,
        resume: attempt > 0
      });
      break;
    } catch (err) {
      const summary = await loadCampaignSendSummary(organizationId, campaignId);
      console.warn('[load-test-campaign-send-scale] send attempt failed', {
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : String(err),
        queued: summary?.stats?.queued ?? 0,
        preparedCount: summary?.sendState?.preparedCount ?? 0,
        sendPhase: summary?.sendState?.phase ?? null
      });

      if (!isRateLimitError(err) || attempt >= RATE_LIMIT_MAX_RETRIES) {
        throw err;
      }

      attempt += 1;
      console.log(
        `[load-test-campaign-send-scale] rate limited — waiting ${Math.round(RATE_LIMIT_RETRY_WAIT_MS / 1000)}s before resume (attempt ${attempt}/${RATE_LIMIT_MAX_RETRIES})`
      );
      await sleep(RATE_LIMIT_RETRY_WAIT_MS);
    }
  }

  const sendMs = Date.now() - sendStartedAt;
  const campaign = await loadCampaignSendSummary(organizationId, campaignId);

  const totalMs = snapshotMs + sendMs;
  const queued = campaign?.stats?.queued ?? sendResult?.accepted ?? 0;
  const rejected = campaign?.stats?.rejected ?? sendResult?.rejected ?? 0;

  return {
    phase: 'send',
    durationMs: totalMs,
    snapshotMs,
    sendMs,
    inserted: snapshotResult.total,
    queued,
    rejected,
    skippedUnsubscribed: sendResult?.skippedUnsubscribed ?? campaign?.stats?.skippedUnsubscribed ?? 0,
    campaignStatus: campaign?.status || null,
    sendPhase: campaign?.sendState?.phase || null,
    recipientsPerSec: sendMs > 0 ? Number((snapshotResult.total / (sendMs / 1000)).toFixed(1)) : snapshotResult.total,
    memoryAfter: memorySnapshot()
  };
}

async function countMailpitMessagesMatching(prefix) {
  const listRes = await fetch(`${MAILPIT_API}/api/v1/messages?limit=200`);
  if (!listRes.ok) {
    throw new Error(`Mailpit list failed (${listRes.status})`);
  }
  const list = await listRes.json();
  const messages = Array.isArray(list?.messages) ? list.messages : [];
  return messages.filter((message) => {
    const recipients = Array.isArray(message.To) ? message.To : [];
    return recipients.some((to) => {
      const address = String(to?.Address || to || '').toLowerCase();
      return address.includes('+scale') || address.includes('scale-test-');
    });
  }).length;
}

async function cleanupLoadTest(organizationId, campaignId) {
  await runWithOrganizationTenantContext(organizationId, async () => {
    await CampaignRecipient.deleteMany({ organizationId, campaignId });
    await Campaign.deleteOne({ _id: campaignId, organizationId });
  });
}

async function main() {
  const options = parseArgs(process.argv);
  const recipientCount = Math.max(1, Number(options.recipients) || 10_000);
  const phase = String(options.phase || 'snapshot');
  const chunkSize = Math.max(100, Number(options.chunkSize) || CAMPAIGN_SEND_CHUNK_SIZE);

  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const organizationId = await resolveOrganizationId(options.orgId);
  const campaign = await createLoadTestCampaign(organizationId, options.from);
  const campaignId = campaign._id;
  const recipients = buildSyntheticRecipients(recipientCount, { to: options.to });

  console.log('[load-test-campaign-send-scale] starting', {
    organizationId: String(organizationId),
    campaignId: String(campaignId),
    recipients: recipientCount,
    phase,
    chunkSize,
    from: options.from,
    sampleRecipient: recipients[0]?.email || null
  });

  /** @type {object[]} */
  const results = [];
  let succeeded = false;

  try {
    if (phase === 'snapshot' || phase === 'all') {
      results.push(await runSnapshotPhase(organizationId, campaignId, recipients));
    }
    if (phase === 'merge' || phase === 'all') {
      if (phase === 'merge') {
        results.push(await runSnapshotPhase(organizationId, campaignId, recipients));
      }
      results.push(await runMergePhase(organizationId, campaignId, chunkSize));
    }
    if (phase === 'send') {
      results.push(await runSendPhase(organizationId, campaignId, recipients, options));
    }

    for (const result of results) {
      if (result.phase === 'send') {
        console.log('[load-test-campaign-send-scale] send timing', {
          total: formatMs(result.durationMs),
          snapshot: formatMs(result.snapshotMs),
          prepAndSubmit: formatMs(result.sendMs),
          queued: result.queued,
          rejected: result.rejected,
          skippedUnsubscribed: result.skippedUnsubscribed,
          recipientsPerSec: result.recipientsPerSec,
          campaignStatus: result.campaignStatus,
          sendPhase: result.sendPhase
        });
      } else {
        console.log(`[load-test-campaign-send-scale] ${result.phase}`, {
          duration: formatMs(result.durationMs),
          ratePerSec: result.ratePerSec,
          p95ChunkMs: result.p95ChunkMs || null,
          maxChunkMs: result.maxChunkMs || null,
          memory: result.memoryAfter
        });
      }
    }

    if (phase === 'send' && options.mailpit) {
      await sleep(2000);
      const mailpitCount = await countMailpitMessagesMatching('scale');
      console.log('[load-test-campaign-send-scale] mailpit', {
        messagesMatchingTest: mailpitCount,
        expected: recipientCount,
        mailpitUrl: MAILPIT_API
      });
    }

    console.log('[load-test-campaign-send-scale] metrics', getCampaignSendMetricsSnapshot().chunk);
    succeeded = true;
  } catch (err) {
    const summary = await loadCampaignSendSummary(organizationId, campaignId);
    console.error('[load-test-campaign-send-scale] failed:', err instanceof Error ? err.message : String(err));
    if (summary) {
      console.error('[load-test-campaign-send-scale] partial progress', {
        campaignId: String(campaignId),
        status: summary.status,
        sendPhase: summary.sendState?.phase ?? null,
        preparedCount: summary.sendState?.preparedCount ?? 0,
        queued: summary.stats?.queued ?? 0,
        rejected: summary.stats?.rejected ?? 0,
        error: summary.sendState?.error ?? summary.stats?.sendError ?? null
      });
    }
    if (/Sending limit reached|rate_limit/i.test(String(err?.message || err))) {
      console.error(
        '[load-test-campaign-send-scale] tip: ensure AMDS is running and run from server/: node scripts/restore-amds-credits-and-validate.js',
        String(organizationId),
        '--restore-only'
      );
    }
    throw err;
  } finally {
    if (options.cleanup && succeeded) {
      await cleanupLoadTest(organizationId, campaignId);
      console.log('[load-test-campaign-send-scale] cleaned up test campaign');
    } else if (!succeeded) {
      console.log('[load-test-campaign-send-scale] kept campaign after failure', String(campaignId));
    } else {
      console.log('[load-test-campaign-send-scale] kept campaign', String(campaignId));
    }
    await mongoose.disconnect();
  }
}

main().catch(() => {
  process.exit(1);
});
