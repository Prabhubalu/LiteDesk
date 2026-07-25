'use strict';

/**
 * Arivu Connector Agent — entry point.
 *
 * Modes:
 *   node src/index.js              run service loop
 *   node src/index.js --console    same, foreground logs
 *   node src/index.js --pair       interactive device-code pairing
 *   node src/index.js --discover   scan Tally ports 9000–9010
 */

const {
  AGENT_VERSION,
  loadConfig,
  ensureDataDir,
  writeConfigTemplate,
} = require('./config');
const { discoverTally } = require('./discovery');
const {
  buildExportMastersEnvelope,
  buildImportVoucherEnvelope,
  postXml,
} = require('./xmlClient');
const { OfflineQueue } = require('./offlineQueue');
const { sendHeartbeat, pollJobs, ackJob } = require('./heartbeat');
const { runPairingCli } = require('./pairing');
const { maybeUpdate } = require('./updater');

async function handleJob(cfg, job, queue) {
  const type = job.type || job.method || '';
  const params = job.params || job.payload || {};

  if (type === 'discover' || type === 'discoverTally') {
    const discovery = await discoverTally({
      host: cfg.tallyHost,
      portMin: cfg.tallyPortMin,
      portMax: cfg.tallyPortMax,
    });
    if (discovery.tallyPort) cfg.tallyPort = discovery.tallyPort;
    return { ok: true, result: discovery };
  }

  if (type === 'executeXml' || type === 'exportMasters') {
    const port = cfg.tallyPort || params.port;
    if (!port) throw new Error('No Tally port configured; run discover first');
    const xml =
      params.xml ||
      buildExportMastersEnvelope(params.masterType || 'Ledger', params.company || null);
    try {
      const res = await postXml({ host: cfg.tallyHost, port, xml });
      return { ok: res.ok, result: { statusCode: res.statusCode, body: res.body } };
    } catch (err) {
      queue.enqueue('executeXml', { xml, port, company: params.company });
      throw err;
    }
  }

  if (type === 'importVoucher') {
    const port = cfg.tallyPort || params.port;
    if (!port) throw new Error('No Tally port configured');
    const xml = params.xml || buildImportVoucherEnvelope(params);
    try {
      const res = await postXml({ host: cfg.tallyHost, port, xml });
      return { ok: res.ok, result: { statusCode: res.statusCode, body: res.body } };
    } catch (err) {
      queue.enqueue('importVoucher', { xml, port });
      throw err;
    }
  }

  return { ok: false, error: `Unknown job type: ${type}` };
}

async function flushOfflineQueue(cfg, queue) {
  if (!cfg.tallyPort) return { flushed: 0, failed: 0 };
  return queue.flush(async (item) => {
    if (item.type === 'executeXml' || item.type === 'importVoucher') {
      const res = await postXml({
        host: cfg.tallyHost,
        port: item.payload.port || cfg.tallyPort,
        xml: item.payload.xml,
      });
      return res.ok;
    }
    return false;
  });
}

async function runLoop(cfg) {
  ensureDataDir(cfg);
  writeConfigTemplate(cfg.configPath);
  const queue = new OfflineQueue(cfg.dataDir);

  console.log(`[agent] Arivu Connector Agent v${AGENT_VERSION}`);
  console.log(`[agent] dataDir=${cfg.dataDir}`);
  console.log(`[agent] apiBase=${cfg.apiBase}`);

  // Initial discovery
  try {
    const discovery = await discoverTally({
      host: cfg.tallyHost,
      portMin: cfg.tallyPortMin,
      portMax: cfg.tallyPortMax,
    });
    if (discovery.tallyPort) {
      cfg.tallyPort = discovery.tallyPort;
      console.log(`[agent] Tally detected on port ${cfg.tallyPort}`);
    } else {
      console.warn('[agent] Tally not detected on ports', cfg.tallyPortMin, '-', cfg.tallyPortMax);
    }
  } catch (err) {
    console.warn('[agent] discovery error:', err.message);
  }

  let lastUpdateCheck = 0;

  const tickHeartbeat = async () => {
    if (!cfg.agentToken || !cfg.connectionId) {
      console.warn('[agent] not paired — skipping heartbeat (run with --pair)');
      return;
    }
    try {
      const res = await sendHeartbeat(cfg, { queueLength: queue.length(), tallyPort: cfg.tallyPort });
      if (!res.ok) console.warn('[agent] heartbeat failed', res.statusCode, res.data);
    } catch (err) {
      console.warn('[agent] heartbeat offline:', err.message);
    }
  };

  const tickPoll = async () => {
    if (!cfg.agentToken || !cfg.connectionId) return;
    try {
      const res = await pollJobs(cfg);
      if (!res.ok) return;
      const jobs = res.data?.data?.jobs || res.data?.jobs || [];
      for (const job of jobs) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await handleJob(cfg, job, queue);
          // eslint-disable-next-line no-await-in-loop
          await ackJob(cfg, {
            jobId: job.id || job.jobId,
            status: result.ok ? 'completed' : 'failed',
            result,
          });
        } catch (err) {
          // eslint-disable-next-line no-await-in-loop
          await ackJob(cfg, {
            jobId: job.id || job.jobId,
            status: 'failed',
            error: err.message,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[agent] poll offline:', err.message);
    }
  };

  const tickQueue = async () => {
    try {
      const result = await flushOfflineQueue(cfg, queue);
      if (result.flushed) console.log(`[agent] flushed ${result.flushed} queued item(s)`);
    } catch (err) {
      console.warn('[agent] queue flush error:', err.message);
    }
  };

  const tickUpdate = async () => {
    const now = Date.now();
    if (now - lastUpdateCheck < (cfg.updateCheckIntervalMs || 21600000)) return;
    lastUpdateCheck = now;
    const result = await maybeUpdate(cfg);
    if (result.updateAvailable) {
      console.log('[agent] update available:', result);
    }
  };

  await tickHeartbeat();
  await tickPoll();

  setInterval(tickHeartbeat, cfg.heartbeatIntervalMs || 30_000);
  setInterval(tickPoll, cfg.pollIntervalMs || 5_000);
  setInterval(tickQueue, cfg.queueFlushIntervalMs || 10_000);
  setInterval(tickUpdate, Math.min(cfg.updateCheckIntervalMs || 21600000, 60 * 60 * 1000));
}

async function main() {
  const args = process.argv.slice(2);
  const cfg = loadConfig();

  if (args.includes('--discover')) {
    const discovery = await discoverTally({
      host: cfg.tallyHost,
      portMin: cfg.tallyPortMin,
      portMax: cfg.tallyPortMax,
    });
    console.log(JSON.stringify(discovery, null, 2));
    return;
  }

  ensureDataDir(cfg);

  if (args.includes('--pair')) {
    await runPairingCli(cfg);
    return;
  }

  await runLoop(cfg);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[agent] fatal:', err);
    process.exit(1);
  });
}

module.exports = { main, handleJob, runLoop };
