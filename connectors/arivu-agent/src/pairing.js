'use strict';

const os = require('os');
const readline = require('readline');
const { AGENT_VERSION, saveConfig } = require('./config');
const { requestJson } = require('./heartbeat');

/**
 * Device-code style pairing.
 * Cloud minting of codes happens in Integration Center (pair/start).
 * Agent completes pairing with user-entered code.
 *
 * Paths used:
 *   POST /api/connectors/tally/agent/pair   (preferred agent auth path)
 *   fallback conceptually mirrors pair/complete
 */
async function completePairing(cfg, pairingCode) {
  const body = {
    pairingCode: String(pairingCode || '').trim().toUpperCase(),
    agentDeviceId: cfg.agentDeviceId,
    agentVersion: AGENT_VERSION,
    agentHostname: os.hostname(),
  };

  const url = `${String(cfg.apiBase).replace(/\/$/, '')}/api/connectors/tally/agent/pair`;
  const res = await requestJson('POST', url, { body, token: null });

  if (!res.ok) {
    const msg = res.data?.message || res.data?.error || `HTTP ${res.statusCode}`;
    const err = new Error(msg);
    err.code = res.data?.code || 'PAIRING_FAILED';
    err.response = res;
    throw err;
  }

  const data = res.data?.data || res.data || {};
  cfg.connectionId = data.connectionId || cfg.connectionId;
  cfg.agentToken = data.agentToken || cfg.agentToken;
  if (data.organizationId) cfg.organizationId = data.organizationId;
  saveConfig(cfg);
  return { connectionId: cfg.connectionId, status: data.status || 'paired' };
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || '').trim());
    });
  });
}

/**
 * Interactive pairing UX for --pair CLI mode.
 */
async function runPairingCli(cfg) {
  console.log('Arivu Connector Agent — Pairing');
  console.log(`Device ID: ${cfg.agentDeviceId}`);
  console.log(`API:       ${cfg.apiBase}`);
  console.log('');
  console.log('Enter the pairing code shown in Arivu Integration Center.');
  const code = await prompt('Pairing code: ');
  if (!code) {
    throw new Error('Pairing code required');
  }
  const result = await completePairing(cfg, code);
  console.log(`Paired. connectionId=${result.connectionId}`);
  return result;
}

module.exports = {
  completePairing,
  runPairingCli,
};
