'use strict';

const counters = new Map();
const histograms = new Map();

function counterKey(name, labels = {}) {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${String(labels[k]).replace(/"/g, '\\"')}"`);
  return `${name}{${parts.join(',')}}`;
}

function incCounter(name, labels = {}, delta = 1) {
  const key = counterKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + delta);
}

function observeHistogram(name, valueMs, labels = {}) {
  const key = counterKey(name, labels);
  const bucket = histograms.get(key) || { count: 0, sumMs: 0, maxMs: 0 };
  bucket.count += 1;
  bucket.sumMs += valueMs;
  bucket.maxMs = Math.max(bucket.maxMs, valueMs);
  histograms.set(key, bucket);
}

function recordIngest({
  channel = 'unknown',
  connectorType = 'unknown',
  success = true,
  durationMs = 0,
  duplicate = false,
  reopened = false,
  authRejected = false,
  quarantined = false
} = {}) {
  const base = { channel, connector: connectorType };
  incCounter('mailroom_ingest_total', { ...base, result: success ? 'success' : 'failure' });
  if (!success) incCounter('mailroom_ingest_failures_total', base);
  if (duplicate) incCounter('mailroom_duplicate_total', base);
  if (reopened) incCounter('mailroom_reopen_total', base);
  if (authRejected) incCounter('mailroom_email_auth_rejected_total', base);
  if (quarantined) incCounter('mailroom_email_auth_quarantine_total', base);
  observeHistogram('mailroom_processing_duration_ms', durationMs, base);
}

function renderPrometheus() {
  const lines = [];
  for (const [key, value] of counters.entries()) {
    const name = key.split('{')[0];
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${key} ${value}`);
  }
  for (const [key, bucket] of histograms.entries()) {
    const name = key.split('{')[0];
    lines.push(`# TYPE ${name} summary`);
    lines.push(`${key}_count ${bucket.count}`);
    lines.push(`${key}_sum ${(bucket.sumMs / 1000).toFixed(6)}`);
    lines.push(`${key}_max ${(bucket.maxMs / 1000).toFixed(6)}`);
  }
  return `${lines.join('\n')}\n`;
}

function getSnapshot() {
  const ingestTotal = [...counters.entries()]
    .filter(([k]) => k.startsWith('mailroom_ingest_total'))
    .reduce((sum, [, v]) => sum + v, 0);
  const ingestFailures = [...counters.entries()]
    .filter(([k]) => k.startsWith('mailroom_ingest_failures_total'))
    .reduce((sum, [, v]) => sum + v, 0);
  const duplicates = [...counters.entries()]
    .filter(([k]) => k.startsWith('mailroom_duplicate_total'))
    .reduce((sum, [, v]) => sum + v, 0);
  const reopens = [...counters.entries()]
    .filter(([k]) => k.startsWith('mailroom_reopen_total'))
    .reduce((sum, [, v]) => sum + v, 0);

  const durations = [...histograms.values()];
  const avgLatencyMs = durations.length
    ? Math.round(durations.reduce((s, b) => s + b.sumMs, 0) / Math.max(1, durations.reduce((s, b) => s + b.count, 0)))
    : 0;

  const duplicateRate = ingestTotal > 0
    ? Number(((duplicates / ingestTotal) * 100).toFixed(2))
    : 0;

  return {
    processUptimeSec: Math.round(process.uptime()),
    ingestTotal,
    ingestFailures,
    duplicateTotal: duplicates,
    reopenTotal: reopens,
    duplicateRatePercent: duplicateRate,
    avgProcessingLatencyMs: avgLatencyMs,
    counters: Object.fromEntries(counters),
    histograms: Object.fromEntries(histograms)
  };
}

async function buildOperationalMetrics(organizationId) {
  const MailroomProcessingFailure = require('../../../models/MailroomProcessingFailure');
  const MailroomMessage = require('../../../models/MailroomMessage');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    openFailures,
    recentMessages,
    inboundEmailQueueService
  ] = await Promise.all([
    MailroomProcessingFailure.countDocuments({
      organizationId,
      status: { $in: ['open', 'retrying'] }
    }),
    MailroomMessage.countDocuments({
      organizationId,
      createdAt: { $gte: since }
    }),
    Promise.resolve().then(() => require('../../../services/inboundEmailQueueService'))
  ]);

  let queue = {
    queueAvailable: false,
    waiting: 0,
    failed: 0
  };
  try {
    queue = await inboundEmailQueueService.getQueueStats();
  } catch {
    /* optional */
  }

  const runtime = getSnapshot();
  const messagesPerMinute = recentMessages > 0
    ? Number((recentMessages / (24 * 60)).toFixed(2))
    : 0;

  return {
    window: '24h',
    runtime,
    tenant: {
      messagesLast24h: recentMessages,
      messagesPerMinuteEstimate: messagesPerMinute,
      openProcessingFailures: openFailures
    },
    queue: {
      inboundEmail: queue
    }
  };
}

module.exports = {
  incCounter,
  observeHistogram,
  recordIngest,
  renderPrometheus,
  getSnapshot,
  buildOperationalMetrics
};
