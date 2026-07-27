'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  startLocalUi,
  openInBrowser,
  integrationCenterUrl,
  setUiHooks,
  DEFAULT_PORT,
} = require('./localUi');
const { discoverTally } = require('./discovery');
const { AGENT_VERSION, saveConfig, ensureDataDir, loadConfig } = require('./config');

function appendLog(cfg, line) {
  try {
    ensureDataDir(cfg);
    const logPath = path.join(cfg.dataDir, 'logs', 'tray.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`, 'utf8');
  } catch (_) {
    /* ignore */
  }
}

function waitForUi(url, attempts = 20) {
  const statusUrl = `${String(url).replace(/\/$/, '')}/api/status`;
  return new Promise((resolve) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(statusUrl, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.setTimeout(800, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      left -= 1;
      if (left <= 0) {
        resolve(false);
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

function keepAliveForever() {
  return new Promise(() => {
    /* never resolves — keeps tray/UI process alive */
  });
}

/**
 * User-session companion: hosts pairing UI on 127.0.0.1:17932.
 * Always watches for Tally coming online — no restart / no admin required.
 */
async function runTray(cfg) {
  appendLog(cfg, `tray start v${AGENT_VERSION}`);
  console.log(`[tray] Arivu Connector UI v${AGENT_VERSION}`);
  console.log('[tray] Runs as your Windows user — do not "Run as administrator".');

  let syncLoopStarted = false;
  let discovery = null;
  let discoverInFlight = false;

  async function probeTally(reason = 'watchdog') {
    if (discoverInFlight) return discovery;
    discoverInFlight = true;
    try {
      const next = await discoverTally({
        host: cfg.tallyHost,
        portMin: cfg.tallyPortMin,
        portMax: cfg.tallyPortMax,
      });
      const wasOffline = !cfg.tallyPort;
      const nowOnline = Boolean(next.tallyPort);
      discovery = next;
      if (nowOnline) {
        cfg.tallyPort = next.tallyPort;
        saveConfig(cfg);
        if (wasOffline) {
          appendLog(cfg, `Tally detected on port ${next.tallyPort} (${reason})`);
          console.log(`[tray] Tally detected on port ${next.tallyPort} — no restart needed`);
        }
      } else if (cfg.tallyPort) {
        appendLog(cfg, `Tally went offline (${reason})`);
        console.warn('[tray] Tally XML port not reachable — will keep checking');
        cfg.tallyPort = null;
        saveConfig(cfg);
      }
      return discovery;
    } catch (err) {
      appendLog(cfg, `discover failed: ${err.message}`);
      return discovery;
    } finally {
      discoverInFlight = false;
    }
  }

  function startSyncLoop(reason = 'paired') {
    if (syncLoopStarted) return;
    if (!cfg.agentToken || !cfg.connectionId) return;
    syncLoopStarted = true;
    setImmediate(() => {
      try {
        // eslint-disable-next-line global-require
        const { runLoop } = require('./index');
        appendLog(cfg, `starting user-session sync loop (${reason})`);
        console.log(`[tray] Starting sync loop (${reason}) — keep this process running`);
        runLoop(cfg).catch((err) => {
          syncLoopStarted = false;
          appendLog(cfg, `runLoop failed: ${err.message}`);
          console.warn('[tray] sync loop error:', err.message);
        });
      } catch (err) {
        syncLoopStarted = false;
        appendLog(cfg, `runLoop require failed: ${err.message}`);
      }
    });
  }

  setUiHooks({
    onPaired: async (pairedCfg) => {
      Object.assign(cfg, pairedCfg);
      appendLog(cfg, 'paired — starting sync without service restart');
      console.log('[tray] Paired successfully. Sync starts now (no admin / no restart).');
      await probeTally('after-pair');
      startSyncLoop('after-pair');
    },
    onUnpaired: async () => {
      appendLog(cfg, 'unpaired');
      console.log('[tray] Unpaired. Sync loop will idle until you pair again.');
    },
    onDiscovery: (d) => {
      discovery = d;
    },
  });

  let ui;
  try {
    ui = await startLocalUi(cfg);
  } catch (err) {
    appendLog(cfg, `startLocalUi threw: ${err.message}`);
    console.error('[tray] Failed to start local UI:', err.message);
    console.error(`[tray] Open Start Menu → Arivu Connector again, or check logs in ${cfg.dataDir}\\logs\\tray.log`);
    await keepAliveForever();
    return;
  }

  appendLog(cfg, `ui url=${ui.url} alreadyRunning=${Boolean(ui.alreadyRunning)} error=${ui.error || ''}`);
  console.log(`[tray] Local UI: ${ui.url}${ui.alreadyRunning ? ' (already running)' : ''}`);

  if (ui.error && !ui.alreadyRunning) {
    console.error(`[tray] Bind error: ${ui.error}`);
    console.error('[tray] Is another Arivu Connector already running? Check Task Manager for arivu-connector-agent.exe');
  }

  await probeTally('startup');

  const ready = await waitForUi(ui.url);
  appendLog(cfg, `ui ready=${ready}`);
  if (!ready) {
    console.error('[tray] UI did not become ready on', ui.url);
    console.error('[tray] Check', path.join(cfg.dataDir, 'logs', 'tray.log'));
  } else {
    console.log('[tray] UI is ready — opening browser');
    openInBrowser(ui.url);
  }

  // Continuous Tally watch: fast while offline so opening Tally is picked up automatically
  const scheduleNextDiscover = () => {
    const online = Boolean(cfg.tallyPort);
    const ms = online
      ? cfg.tallyOnlineDiscoverMs || 60_000
      : cfg.tallyOfflineDiscoverMs || 15_000;
    setTimeout(async () => {
      await probeTally('watchdog');
      // Reload pairing from disk (another window may have paired)
      try {
        const fresh = loadConfig(cfg.configPath);
        if (fresh.agentToken && fresh.connectionId && !cfg.agentToken) {
          Object.assign(cfg, fresh);
          startSyncLoop('config-reload');
        } else if (fresh.agentToken) {
          cfg.agentToken = fresh.agentToken;
          cfg.connectionId = fresh.connectionId;
        }
      } catch (_) {
        /* ignore */
      }
      if (cfg.agentToken && cfg.connectionId && !syncLoopStarted) {
        startSyncLoop('watchdog-paired');
      }
      scheduleNextDiscover();
    }, ms);
  };
  scheduleNextDiscover();

  setImmediate(() => {
    tryStartTrayIcon(cfg, ui, () => discovery).catch((err) => {
      appendLog(cfg, `tray icon skipped: ${err.message}`);
      console.warn('[tray] Tray icon unavailable (UI still works):', err.message);
    });
  });

  console.log('[tray] Keep this process running. Pairing page:', ui.url);
  console.log(`[tray] Default port ${DEFAULT_PORT}. Log: ${path.join(cfg.dataDir, 'logs', 'tray.log')}`);

  if (cfg.agentToken && cfg.connectionId) {
    startSyncLoop('already-paired');
  } else {
    console.log('[tray] Not paired yet — paste the pairing code in the UI. No restart after pairing.');
  }

  await keepAliveForever();
}

async function tryStartTrayIcon(cfg, ui, getDiscovery) {
  if (String(process.env.ARIVU_ENABLE_TRAY_ICON || '').trim() !== '1') {
    appendLog(cfg, 'tray icon disabled (set ARIVU_ENABLE_TRAY_ICON=1 to enable)');
    return;
  }

  let SysTray;
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  SysTray = require('systray2').default || require('systray2');

  const iconPath = path.join(cfg.dataDir, 'tray.png');
  if (!fs.existsSync(iconPath)) {
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAPElEQVQ4T2NkYGD4z0ABYBzVMKoBBgZGRkZGBgoGRkbG/wz4AAMDw38GBsb/DFQzgPGogVEDRg0YNWDUAAYGBgYGABqmAxF7b0bZAAAAAElFTkSuQmCC';
    fs.writeFileSync(iconPath, Buffer.from(b64, 'base64'));
  }
  const iconB64 = fs.readFileSync(iconPath).toString('base64');

  const label = () => {
    const discovery = typeof getDiscovery === 'function' ? getDiscovery() : getDiscovery;
    if (!cfg.agentToken || !cfg.connectionId) return 'Not paired';
    if (discovery && !discovery.tallyRunning && !cfg.tallyPort) return 'Paired · Waiting for Tally';
    if (cfg.tallyPort || discovery?.tallyPort) return 'Connected';
    return 'Paired';
  };

  const buildMenu = () => ({
    icon: iconB64,
    title: 'Arivu',
    tooltip: `Arivu Connector — ${label()}`,
    items: [
      { title: label(), enabled: false, checked: false },
      { title: 'Open Connector UI', enabled: true },
      { title: 'Open Arivu Integration Center', enabled: true },
      { title: 'Quit tray', enabled: true },
    ],
  });

  const systray = new SysTray({ menu: buildMenu(), copyDir: true });
  systray.onClick((action) => {
    const title = action?.item?.title;
    if (title === 'Open Connector UI') openInBrowser(ui.url);
    else if (title === 'Open Arivu Integration Center') openInBrowser(integrationCenterUrl(cfg));
    else if (title === 'Quit tray') {
      try {
        systray.kill(false);
      } catch (_) {
        /* ignore */
      }
      process.exit(0);
    }
  });
  appendLog(cfg, 'tray icon started');
}

module.exports = { runTray };
