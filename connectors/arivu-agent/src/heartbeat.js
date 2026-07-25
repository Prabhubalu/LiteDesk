'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { AGENT_VERSION } = require('./config');

function requestJson(method, urlString, { body, token, timeoutMs = 20_000 } = {}) {
  const url = new URL(urlString);
  const lib = url.protocol === 'https:' ? https : http;
  const payload = body != null ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'User-Agent': `ArivuConnectorAgent/${AGENT_VERSION}`,
          'X-Arivu-Agent-Version': AGENT_VERSION,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch (_) {
            data = { raw };
          }
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            data,
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP timeout ${method} ${urlString}`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function agentUrl(cfg, suffix) {
  const base = String(cfg.apiBase || '').replace(/\/$/, '');
  return `${base}/api/connectors/tally/agent${suffix}`;
}

/**
 * POST heartbeat to Arivu cloud.
 * Path: POST /api/connectors/tally/agent/heartbeat
 */
async function sendHeartbeat(cfg, metadata = {}) {
  const body = {
    connectionId: cfg.connectionId,
    agentDeviceId: cfg.agentDeviceId,
    agentVersion: AGENT_VERSION,
    metadata: {
      hostname: require('os').hostname(),
      platform: process.platform,
      tallyPort: cfg.tallyPort,
      queueLength: metadata.queueLength ?? null,
      ...metadata,
    },
  };

  return requestJson('POST', agentUrl(cfg, '/heartbeat'), {
    body,
    token: cfg.agentToken,
  });
}

/**
 * Poll cloud for RPC / jobs the agent should execute locally.
 * Path: POST /api/connectors/tally/agent/poll
 */
async function pollJobs(cfg) {
  const body = {
    connectionId: cfg.connectionId,
    agentDeviceId: cfg.agentDeviceId,
    agentVersion: AGENT_VERSION,
  };
  return requestJson('POST', agentUrl(cfg, '/poll'), {
    body,
    token: cfg.agentToken,
  });
}

/**
 * Acknowledge a completed/failed job.
 * Path: POST /api/connectors/tally/agent/ack
 */
async function ackJob(cfg, { jobId, status, result, error }) {
  return requestJson('POST', agentUrl(cfg, '/ack'), {
    body: {
      connectionId: cfg.connectionId,
      agentDeviceId: cfg.agentDeviceId,
      jobId,
      status: status || 'acked',
      result: result || null,
      error: error || null,
    },
    token: cfg.agentToken,
  });
}

/**
 * Generic agent RPC (cloud-side handler mirror).
 * Path: POST /api/connectors/tally/agent/rpc
 */
async function callRpc(cfg, message) {
  return requestJson('POST', agentUrl(cfg, '/rpc'), {
    body: {
      ...message,
      connectionId: cfg.connectionId || message.connectionId,
      organizationId: cfg.organizationId || message.organizationId,
    },
    token: cfg.agentToken,
  });
}

module.exports = {
  requestJson,
  agentUrl,
  sendHeartbeat,
  pollJobs,
  ackJob,
  callRpc,
};
