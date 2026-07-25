'use strict';

const fs = require('fs');
const path = require('path');
const {
  startLocalUi,
  openInBrowser,
  integrationCenterUrl,
} = require('./localUi');
const { discoverTally } = require('./discovery');
const { AGENT_VERSION, saveConfig } = require('./config');

/** Minimal 16x16 teal PNG (base64) for tray fallback. */
const TRAY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAPElEQVQ4T2NkYGD4z0ABYBzVMKoBBgZGRkZGBgoGRkbG/wz4AAMDw38GBsb/DFQzgPGogVEDRg0YNWDUAAYGBgYGABqmAxF7b0bZAAAAAElFTkSuQmCC';

function ensureTrayIcon(dataDir) {
  const iconPath = path.join(dataDir, 'tray.png');
  if (!fs.existsSync(iconPath)) {
    fs.writeFileSync(iconPath, Buffer.from(TRAY_PNG_B64, 'base64'));
  }
  return iconPath;
}

function statusLabel(cfg, discovery) {
  if (!cfg.agentToken || !cfg.connectionId) return 'Not paired';
  if (discovery && !discovery.tallyRunning) return 'Paired · Tally offline';
  if (cfg.tallyPort || discovery?.tallyPort) return 'Connected';
  return 'Paired';
}

/**
 * Run tray companion: localhost UI + system tray (when systray2 available).
 * Does not run the sync loop — Windows service owns heartbeat/poll.
 */
async function runTray(cfg) {
  const ui = startLocalUi(cfg);
  console.log(`[tray] Arivu Connector UI v${AGENT_VERSION}`);
  console.log(`[tray] Open ${ui.url}`);

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
  } catch (_) {
    /* ignore */
  }

  openInBrowser(ui.url);

  let SysTray;
  try {
    // Optional native tray — may be absent on non-Windows or if not installed.
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    SysTray = require('systray2').default || require('systray2');
  } catch (err) {
    console.warn('[tray] systray2 not available — UI-only mode:', err.message);
    console.warn('[tray] Keep this window open. Use the browser UI to pair.');
    // Keep process alive
    await new Promise(() => {});
    return;
  }

  const iconPath = ensureTrayIcon(cfg.dataDir);
  const iconB64 = fs.readFileSync(iconPath).toString('base64');

  const buildMenu = () => ({
    icon: iconB64,
    title: 'Arivu',
    tooltip: `Arivu Connector — ${statusLabel(cfg, discovery)}`,
    items: [
      {
        title: statusLabel(cfg, discovery),
        enabled: false,
        checked: false,
      },
      { title: 'Open Connector UI', enabled: true },
      { title: 'Open Arivu Integration Center', enabled: true },
      { title: 'Discover Tally', enabled: true },
      { title: 'Quit tray', enabled: true },
    ],
  });

  const systray = new SysTray({
    menu: buildMenu(),
    copyDir: true,
  });

  systray.onClick((action) => {
    const title = action?.item?.title;
    if (title === 'Open Connector UI') {
      openInBrowser(ui.url);
      return;
    }
    if (title === 'Open Arivu Integration Center') {
      openInBrowser(integrationCenterUrl(cfg));
      return;
    }
    if (title === 'Discover Tally') {
      discoverTally({
        host: cfg.tallyHost,
        portMin: cfg.tallyPortMin,
        portMax: cfg.tallyPortMax,
      })
        .then((d) => {
          discovery = d;
          if (d.tallyPort) {
            cfg.tallyPort = d.tallyPort;
            saveConfig(cfg);
          }
          return systray.sendAction({
            type: 'update-menu',
            menu: buildMenu(),
          });
        })
        .catch((err) => console.warn('[tray] discover failed', err.message));
      return;
    }
    if (title === 'Quit tray') {
      systray.kill(false);
      try {
        ui.server.close();
      } catch (_) {
        /* ignore */
      }
      process.exit(0);
    }
  });

  // Refresh tooltip periodically
  setInterval(() => {
    try {
      ui.reloadConfig();
      systray.sendAction({ type: 'update-menu', menu: buildMenu() });
    } catch (_) {
      /* ignore */
    }
  }, 15_000);

  console.log('[tray] System tray started');
}

module.exports = { runTray };
