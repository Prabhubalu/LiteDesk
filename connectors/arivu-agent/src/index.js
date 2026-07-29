'use strict';

/**
 * Arivu Connector Agent — entry point.
 *
 * Modes:
 *   node src/index.js              run service loop
 *   node src/index.js --console    same, foreground logs
 *   node src/index.js --tray       system tray + local pairing UI (customers)
 *   node src/index.js --pair       CLI pairing (support/debug only)
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
  buildExportEnvelope,
  buildImportVoucherEnvelope,
  postXml,
} = require('./xmlClient');
const {
  resolveCollectionId,
  collectionExport,
  ARIVU_TDL_PACK_VERSION,
  ARIVU_COLLECTIONS,
} = require('./arivuTdlXml');
const { discoverLiveMetadataObjects, parseMasterRecordsFromXml, enrichLedgerRecord } = require('./metadataDiscover');
const { OfflineQueue } = require('./offlineQueue');
const { sendHeartbeat, pollJobs, ackJob } = require('./heartbeat');
const { runPairingCli } = require('./pairing');
const { maybeUpdate } = require('./updater');
const { runTray } = require('./tray');

/** Single-flight XML write sequencer — one in-flight write per company GUID (ATIP). */
const companyWriteLocks = new Map();

async function withCompanyWriteLock(companyKey, fn) {
  const key = String(companyKey || '_default');
  const prev = companyWriteLocks.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const next = prev.then(() => gate);
  companyWriteLocks.set(key, next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (companyWriteLocks.get(key) === next) companyWriteLocks.delete(key);
  }
}

async function runDiscoverAndHealth(cfg) {
  const discovery = await discoverTally({
    host: cfg.tallyHost,
    portMin: cfg.tallyPortMin,
    portMax: cfg.tallyPortMax,
  });
  if (discovery.tallyPort) cfg.tallyPort = discovery.tallyPort;
  const companies = Array.isArray(discovery.companies) ? discovery.companies : [];
  const checks = {
    internet: true,
    tallyRunning: Boolean(discovery.tallyRunning),
    xmlEnabled: Boolean(discovery.tallyPort),
    companyAvailable: companies.length > 0,
    financialYear: companies.some((c) => Boolean(c.financialYear)),
    tdlLoaded: Boolean(discovery.tdlLoaded),
  };
  return {
    ok: Boolean(discovery.tallyRunning),
    result: {
      discovery,
      companies,
      checks,
      tallyVersion: discovery.tallyVersion,
      tdlPackVersion: discovery.tdlPackVersion || ARIVU_TDL_PACK_VERSION,
      tdlLoaded: Boolean(discovery.tdlLoaded),
      hint: discovery.hint || null,
      stats: {
        companies: companies.length,
        parties: 0,
        items: 0,
        vouchers: 0,
        openPorts: discovery.openPorts || [],
        tallyPort: discovery.tallyPort || null,
        tdlLoaded: Boolean(discovery.tdlLoaded),
      },
    },
  };
}

async function handleJob(cfg, job, queue) {
  const type = job.type || job.method || job.jobType || '';
  const params = job.params || job.payload || {};

  if (type === 'discover' || type === 'discoverTally' || type === 'dry_run') {
    const out = await runDiscoverAndHealth(cfg);
    if (type === 'dry_run' || job.jobType === 'dry_run') {
      out.result.dryRun = true;
    }
    return out;
  }

  // ATIP 1B — live collection probes → structured catalogue (no invented fields)
  if (type === 'discover_metadata') {
    const out = await runDiscoverAndHealth(cfg);
    const port = cfg.tallyPort || params.port || out.result.discovery?.tallyPort;
    const company =
      params.company ||
      out.result.discovery?.companies?.[0]?.name ||
      null;

    let live = { objects: [], errors: [], reachable: false };
    if (port) {
      live = await discoverLiveMetadataObjects({
        host: cfg.tallyHost,
        port,
        company,
      });
    } else {
      out.result.metadataProbeError = 'Tally port not available';
    }

    if (live.errors?.length) {
      out.result.metadataProbeErrors = live.errors;
    }

    out.result.metadata = {
      tallyVersion: out.result.tallyVersion || out.result.discovery?.tallyVersion || null,
      tdlPackVersion: ARIVU_TDL_PACK_VERSION,
      tdlFingerprint: ARIVU_TDL_PACK_VERSION,
      financialYear: out.result.discovery?.companies?.[0]?.financialYear || null,
      features: {
        gst: true,
        inventory: true,
        multiCurrency: Boolean(out.result.discovery?.multiCurrency),
        payroll: Boolean(out.result.discovery?.payroll),
      },
      objects: live.objects || [],
      probeErrors: live.errors || [],
    };
    out.result.objects = out.result.metadata.objects;
    out.result.tdlPackVersion = ARIVU_TDL_PACK_VERSION;
    return out;
  }

  // Full ledger dump — all field values (incl. User Space / UDF) into structured records
  if (type === 'dump_ledgers') {
    const out = await runDiscoverAndHealth(cfg);
    const port = cfg.tallyPort || params.port || out.result.discovery?.tallyPort;
    const company =
      params.company ||
      out.result.discovery?.companies?.[0]?.name ||
      null;
    if (!port) {
      return { ok: false, error: 'Tally port not available', result: out.result };
    }
    const natives = [
      '*',
      '*.*',
      '*.*.*',
      'Address.*',
      'GSTDetails.*',
      'HSNDetails.*',
      // Exact TDL method names (Masters.tdl) — wrong names are ignored by Tally
      'Name',
      'Parent',
      'GUID',
      'MasterID',
      'AlterID',
      'MailingName',
      'Address',
      'CountryName',
      'CountryOfResidence',
      'LedStateName',
      'StateName',
      'StateCode',
      'Pincode',
      'LedgerPhone',
      'Phone',
      'Fax',
      'LedgerMobile',
      'Mobile',
      'PartyGSTIN',
      'GSTIN',
      'IncomeTaxNumber',
      'CreditLimit',
      'BillCreditPeriod',
      'ClosingBalance',
      'OpeningBalance',
      'Email',
      'EmailCC',
      'Website',
      'Narration',
      'Description',
      'GSTDetails',
      'GSTRegistrationType',
    ];
    const xml = collectionExport(ARIVU_COLLECTIONS.LEDGERS, {
      company,
      extraNative: natives,
      explode: true,
    });
    const res = await postXml({
      host: cfg.tallyHost,
      port,
      xml,
      timeoutMs: params.timeoutMs || 120_000,
    });
    const ledgers = parseMasterRecordsFromXml(res.body || '', 'LEDGER').map(enrichLedgerRecord);
    return {
      ok: res.ok,
      result: {
        ...out.result,
        statusCode: res.statusCode,
        masterType: 'Ledger',
        exportId: 'Ledger',
        fullFields: true,
        ledgers,
        count: ledgers.length,
        // Prefer structured records; keep a short sample for debug
        body: String(res.body || '').slice(0, 4_000),
        tdlPackVersion: ARIVU_TDL_PACK_VERSION,
        stats: { exported: ledgers.length, fullFields: true },
      },
    };
  }

  // Sync / outbox jobs: execute XML payloads built by cloud mappers
  if (
    type === 'sync' ||
    type === 'incremental' ||
    type === 'full' ||
    type === 'push_master' ||
    type === 'push_voucher' ||
    type === 'pull_masters' ||
    type === 'pull_vouchers' ||
    type === 'outbox'
  ) {
    const port = cfg.tallyPort || params.port;
    if (!port && (params.xml || params.exportId)) {
      const discovered = await runDiscoverAndHealth(cfg);
      if (!cfg.tallyPort) {
        return {
          ok: false,
          error: 'Tally not running',
          result: discovered.result,
        };
      }
    }

    const xmlPort = cfg.tallyPort || params.port;
    if (params.xml && xmlPort) {
      const companyKey = params.companyGuid || params.company || params.companyName || '_default';
      try {
        const res = await withCompanyWriteLock(companyKey, () =>
          postXml({
            host: cfg.tallyHost,
            port: xmlPort,
            xml: params.xml,
            company: params.company || params.companyName || null,
          })
        );
        return {
          ok: res.ok,
          result: {
            statusCode: res.statusCode,
            body: res.body?.slice?.(0, 50_000) || res.body,
            stats: params.statsHint || { xmlPosted: 1 },
          },
        };
      } catch (err) {
        queue.enqueue('executeXml', { xml: params.xml, port: xmlPort, companyGuid: companyKey });
        throw err;
      }
    }

    if (params.exportId && xmlPort) {
      let xml = params.xml || null;
      if (!xml) {
        const collectionId =
          resolveCollectionId(params.exportId) ||
          resolveCollectionId(params.masterType) ||
          null;
        if (collectionId) {
          xml = collectionExport(collectionId, {
            company: params.company || null,
            fromDate: params.fromDate || null,
            toDate: params.toDate || null,
            sinceAlterId: params.sinceAlterId || params.incrementalFilter?.sinceAlterId || null,
          });
        } else if (params.masterType) {
          xml = buildExportMastersEnvelope(params.masterType, params.company || null);
        } else {
          xml = buildExportEnvelope({
            id: params.exportId,
            company: params.company || null,
          });
        }
      }
      const res = await postXml({ host: cfg.tallyHost, port: xmlPort, xml });
      return {
        ok: res.ok,
        result: {
          statusCode: res.statusCode,
          body: res.body?.slice?.(0, 200_000) || res.body,
          exportId: params.exportId || params.masterType,
          collection: params.masterType || params.exportId,
          tdlPackVersion: ARIVU_TDL_PACK_VERSION,
          sinceAlterId: params.sinceAlterId || null,
          stats: { exported: 1, incremental: Boolean(params.sinceAlterId || params.incremental) },
        },
      };
    }

    // No XML payload — discover + health (dry progress for empty sync)
    const out = await runDiscoverAndHealth(cfg);
    out.result.stats = { ...(out.result.stats || {}), note: 'no_xml_payload' };
    return out;
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
  let lastDiscovery = null;
  try {
    lastDiscovery = await discoverTally({
      host: cfg.tallyHost,
      portMin: cfg.tallyPortMin,
      portMax: cfg.tallyPortMax,
    });
    if (lastDiscovery.tallyPort) {
      cfg.tallyPort = lastDiscovery.tallyPort;
      console.log(`[agent] Tally detected on port ${cfg.tallyPort}`);
    } else {
      console.warn('[agent] Tally not detected on ports', cfg.tallyPortMin, '-', cfg.tallyPortMax);
    }
    console.log(
      `[agent] TDL pack loaded=${Boolean(lastDiscovery.tdlLoaded)} version=${lastDiscovery.tdlPackVersion || 'n/a'}`
    );
  } catch (err) {
    console.warn('[agent] discovery error:', err.message);
  }

  let lastUpdateCheck = 0;
  let lastDiscoverAt = 0;
  let tallyOnline = Boolean(lastDiscovery?.tallyPort || cfg.tallyPort);

  const refreshDiscovery = async (force = false) => {
    const interval = tallyOnline
      ? cfg.tallyOnlineDiscoverMs || 60_000
      : cfg.tallyOfflineDiscoverMs || 15_000;
    const now = Date.now();
    if (!force && now - lastDiscoverAt < interval) return lastDiscovery;
    lastDiscoverAt = now;
    try {
      const next = await discoverTally({
        host: cfg.tallyHost,
        portMin: cfg.tallyPortMin,
        portMax: cfg.tallyPortMax,
      });
      const wasOnline = tallyOnline;
      tallyOnline = Boolean(next.tallyPort);
      lastDiscovery = next;
      if (tallyOnline) {
        cfg.tallyPort = next.tallyPort;
        if (!wasOnline) {
          console.log(`[agent] Tally came online on port ${cfg.tallyPort}`);
        }
      } else {
        if (wasOnline) console.warn('[agent] Tally went offline — will keep probing');
        cfg.tallyPort = null;
      }
    } catch (_) {
      /* keep lastDiscovery */
    }
    return lastDiscovery;
  };

  const tickHeartbeat = async () => {
    if (!cfg.agentToken || !cfg.connectionId) {
      console.warn('[agent] not paired — open tray UI (--tray) to paste pairing code');
      return;
    }
    try {
      await refreshDiscovery(false);
      const res = await sendHeartbeat(cfg, {
        queueLength: queue.length(),
        tallyPort: cfg.tallyPort || lastDiscovery?.tallyPort || null,
        tdlLoaded: Boolean(lastDiscovery?.tdlLoaded),
        tdlPackVersion: lastDiscovery?.tdlPackVersion || ARIVU_TDL_PACK_VERSION,
        companyCount: Array.isArray(lastDiscovery?.companies) ? lastDiscovery.companies.length : 0,
        lastHealth: {
          ok: Boolean(lastDiscovery?.tallyRunning || cfg.tallyPort),
          mode: 'live',
          tdlLoaded: Boolean(lastDiscovery?.tdlLoaded),
          tdlPackVersion: lastDiscovery?.tdlPackVersion || ARIVU_TDL_PACK_VERSION,
          tallyPort: lastDiscovery?.tallyPort || cfg.tallyPort || null,
          hint: lastDiscovery?.hint || null,
          checks: {
            internet: true,
            tallyRunning: Boolean(lastDiscovery?.tallyRunning || cfg.tallyPort),
            xmlEnabled: Boolean(lastDiscovery?.tallyPort || cfg.tallyPort),
            companyAvailable: (lastDiscovery?.companies || []).length > 0,
            tdlLoaded: Boolean(lastDiscovery?.tdlLoaded),
          },
          updatedAt: new Date().toISOString(),
        },
      });
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

  // Dedicated Tally watchdog — faster cadence while offline so opening Tally is detected
  setInterval(() => {
    refreshDiscovery(false).catch(() => {});
  }, Math.min(cfg.tallyOfflineDiscoverMs || 15_000, 15_000));

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

  if (args.includes('--tray') || args.includes('--ui')) {
    await runTray(cfg);
    return;
  }

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
