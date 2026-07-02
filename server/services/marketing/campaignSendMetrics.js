'use strict';

const counters = new Map();
const histograms = new Map();

/** @type {{ type: string, message: string, at: string, details?: Record<string, unknown> }[]} */
let recentAlerts = [];

function counterKey(name, labels = {}) {
  const parts = Object.keys(labels)
    .sort()
    .map((key) => `${key}="${String(labels[key]).replace(/"/g, '\\"')}"`);
  return `${name}{${parts.join(',')}}`;
}

function incCounter(name, labels = {}, delta = 1) {
  const key = counterKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + delta);
}

function observeHistogram(name, valueMs, labels = {}) {
  const key = counterKey(name, labels);
  const bucket = histograms.get(key) || { count: 0, sumMs: 0, maxMs: 0, values: [] };
  bucket.count += 1;
  bucket.sumMs += valueMs;
  bucket.maxMs = Math.max(bucket.maxMs, valueMs);
  bucket.values.push(valueMs);
  if (bucket.values.length > 500) {
    bucket.values.shift();
  }
  histograms.set(key, bucket);
}

/**
 * @param {number[]} values
 * @param {number} percentile
 */
function percentile(values, percentileValue) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

/**
 * @param {number} durationMs
 * @param {{ organizationId?: string }} [labels]
 */
function recordCampaignSendChunkDuration(durationMs, labels = {}) {
  observeHistogram('marketing_campaign_send_chunk_duration_ms', durationMs, labels);
}

/**
 * @param {number} durationMs
 * @param {{ organizationId?: string }} [labels]
 */
function recordCampaignSendMergeDuration(durationMs, labels = {}) {
  observeHistogram('marketing_campaign_send_merge_duration_ms', durationMs, labels);
}

/**
 * @param {{ accepted: number, rejected: number, durationMs: number, organizationId?: string }} params
 */
function recordCampaignSendAmdsSubmit(params) {
  const labels = { organizationId: String(params.organizationId || 'unknown') };
  incCounter('marketing_campaign_send_amds_accepted_total', labels, Math.max(0, params.accepted || 0));
  incCounter('marketing_campaign_send_amds_rejected_total', labels, Math.max(0, params.rejected || 0));
  observeHistogram('marketing_campaign_send_amds_submit_duration_ms', params.durationMs || 0, labels);
}

/**
 * @param {number} lagMs
 */
function recordCampaignSendQueueLag(lagMs) {
  observeHistogram('marketing_campaign_send_queue_lag_ms', lagMs, {});
}

/**
 * @param {{ type: string, message: string, details?: Record<string, unknown> }} alert
 */
function pushCampaignSendAlert(alert) {
  recentAlerts.unshift({
    type: alert.type,
    message: alert.message,
    details: alert.details || {},
    at: new Date().toISOString()
  });
  recentAlerts = recentAlerts.slice(0, 50);
  console.warn(`[campaignSendAlert] ${alert.type}: ${alert.message}`);
}

function getCampaignSendMetricsSnapshot() {
  const chunkBuckets = [...histograms.entries()].filter(([key]) =>
    key.startsWith('marketing_campaign_send_chunk_duration_ms')
  );
  const chunkValues = chunkBuckets.flatMap(([, bucket]) => bucket.values || []);
  const mergeBuckets = [...histograms.entries()].filter(([key]) =>
    key.startsWith('marketing_campaign_send_merge_duration_ms')
  );
  const mergeValues = mergeBuckets.flatMap(([, bucket]) => bucket.values || []);

  const accepted = [...counters.entries()]
    .filter(([key]) => key.startsWith('marketing_campaign_send_amds_accepted_total'))
    .reduce((sum, [, value]) => sum + value, 0);
  const rejected = [...counters.entries()]
    .filter(([key]) => key.startsWith('marketing_campaign_send_amds_rejected_total'))
    .reduce((sum, [, value]) => sum + value, 0);
  const submitTotal = accepted + rejected;

  return {
    processUptimeSec: Math.round(process.uptime()),
    chunk: {
      count: chunkValues.length,
      p95Ms: percentile(chunkValues, 95),
      maxMs: chunkValues.length ? Math.max(...chunkValues) : 0
    },
    merge: {
      count: mergeValues.length,
      p95Ms: percentile(mergeValues, 95),
      maxMs: mergeValues.length ? Math.max(...mergeValues) : 0
    },
    amds: {
      accepted,
      rejected,
      acceptRate: submitTotal > 0 ? Number(((accepted / submitTotal) * 100).toFixed(2)) : null
    },
    counters: Object.fromEntries(counters),
    histograms: Object.fromEntries(
      [...histograms.entries()].map(([key, bucket]) => [
        key,
        {
          count: bucket.count,
          sumMs: bucket.sumMs,
          maxMs: bucket.maxMs,
          p95Ms: percentile(bucket.values || [], 95)
        }
      ])
    ),
    alerts: recentAlerts
  };
}

function renderCampaignSendPrometheusMetrics() {
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

module.exports = {
  recordCampaignSendChunkDuration,
  recordCampaignSendMergeDuration,
  recordCampaignSendAmdsSubmit,
  recordCampaignSendQueueLag,
  pushCampaignSendAlert,
  getCampaignSendMetricsSnapshot,
  renderCampaignSendPrometheusMetrics
};
