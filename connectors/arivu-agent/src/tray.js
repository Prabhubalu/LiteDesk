'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  startLocalUi,
  openInBrowser,
  integrationCenterUrl,
  DEFAULT_PORT,
} = require('./localUi');
const { discoverTally } = require('./discovery');
const { AGENT_VERSION, saveConfig, ensureDataDir } = require('./config');

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
 * Tray icon is best-effort; UI + browser are the reliable path.
 */
async function runTray(cfg) {
  appendLog(cfg, `tray start v${AGENT_VERSION}`);
  console.log(`[tray] Arivu Connector UI v${AGENT_VERSION}`);

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

  let discovery = null;
  try {
    discovery = await discoverTally({
      host: cfg.tallyHost,
      portMin: cfg.tallyPortMin,
      portMax: cfg.tallyPortMax,
    });
    if (discovery.tallyPort) {
      cfg.tallyPort = discovery.tallyPort;
      saveConfig(cfg);
    }
  } catch (err) {
    appendLog(cfg, `discover: ${err.message}`);
  }

  const ready = await waitForUi(ui.url);
  appendLog(cfg, `ui ready=${ready}`);
  if (!ready) {
    console.error('[tray] UI did not become ready on', ui.url);
    console.error('[tray] Check', path.join(cfg.dataDir, 'logs', 'tray.log'));
  } else {
    console.log('[tray] UI is ready — opening browser');
    openInBrowser(ui.url);
  }

  // Optional tray icon — never let native tray crash kill the UI server
  setImmediate(() => {
    tryStartTrayIcon(cfg, ui, discovery).catch((err) => {
      appendLog(cfg, `tray icon skipped: ${err.message}`);
      console.warn('[tray] Tray icon unavailable (UI still works):', err.message);
    });
  });

  console.log('[tray] Keep this process running. Pairing page:', ui.url);
  console.log(`[tray] Default port ${DEFAULT_PORT}. Log: ${path.join(cfg.dataDir, 'logs', 'tray.log')}`);
  await keepAliveForever();
}

async function tryStartTrayIcon(cfg, ui, discovery) {
  // Disabled by default in packaged EXE — systray2 native often crashes pkg builds.
  // Set ARIVU_ENABLE_TRAY_ICON=1 to attempt.
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
    if (!cfg.agentToken || !cfg.connectionId) return 'Not paired';
    if (discovery && !discovery.tallyRunning) return 'Paired · Tally offline';
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
