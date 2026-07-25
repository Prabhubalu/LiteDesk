'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { AGENT_VERSION, saveConfig, loadConfig } = require('./config');
const { completePairing } = require('./pairing');
const { discoverTally } = require('./discovery');

const DEFAULT_PORT = 17932;

function integrationCenterUrl(cfg) {
  const api = String(cfg.apiBase || '').replace(/\/$/, '');
  // api.arivusystems.com → app host heuristic
  if (api.includes('api.arivusystems.com')) {
    return 'https://app.arivusystems.com/integrations/tally';
  }
  if (api.includes('localhost') || api.includes('127.0.0.1')) {
    return 'http://localhost:5173/integrations/tally';
  }
  return `${api.replace('://api.', '://app.')}/integrations/tally`;
}

function restartWindowsService() {
  if (process.platform !== 'win32') {
    return Promise.resolve({ ok: false, skipped: true });
  }
  return new Promise((resolve) => {
    const ps = spawn('sc.exe', ['stop', 'ArivuConnectorAgent'], { windowsHide: true });
    ps.on('close', () => {
      const start = spawn('sc.exe', ['start', 'ArivuConnectorAgent'], { windowsHide: true });
      start.on('close', (code) => resolve({ ok: code === 0, code }));
      start.on('error', (err) => resolve({ ok: false, error: err.message }));
    });
    ps.on('error', (err) => resolve({ ok: false, error: err.message }));
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

function uiHtmlPath() {
  // pkg-friendly: prefer next to this file, then next to EXE, then cwd
  const candidates = [
    path.join(__dirname, 'ui', 'index.html'),
    path.join(path.dirname(process.execPath), 'ui', 'index.html'),
    path.join(process.cwd(), 'src', 'ui', 'index.html'),
    path.join(process.cwd(), 'ui', 'index.html'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

function loadUiHtml() {
  const p = uiHtmlPath();
  if (p) {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (_) {
      /* fall through */
    }
  }
  // eslint-disable-next-line global-require
  return require('./uiHtmlEmbedded');
}

/**
 * Start localhost-only connector UI. Mutates cfg in place on pair/discover/repair.
 * @returns {Promise<{ server: import('http').Server|null, port: number, url: string, alreadyRunning?: boolean }>}
 */
function startLocalUi(cfg, opts = {}) {
  const preferred = Number(opts.port || process.env.ARIVU_LOCAL_UI_PORT || DEFAULT_PORT);
  let lastDiscovery = null;

  function writeUiUrlFile(url) {
    try {
      const dir = cfg.dataDir || path.dirname(cfg.configPath || '');
      if (dir) {
        fs.writeFileSync(path.join(dir, 'ui.url'), `${url}\n`, 'utf8');
      }
    } catch (_) {
      /* ignore */
    }
  }

  function attachHandlers(server, port) {
    server.on('request', async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

        if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
          const html = loadUiHtml();
          return sendHtml(res, html);
        }

        if (req.method === 'GET' && url.pathname === '/api/status') {
          // Reload config so service+tray share pairing state from disk
          try {
            const fresh = loadConfig(cfg.configPath);
            Object.assign(cfg, fresh);
          } catch (_) {
            /* ignore */
          }
          return sendJson(res, 200, {
            success: true,
            data: {
              paired: Boolean(cfg.agentToken && cfg.connectionId),
              agentVersion: AGENT_VERSION,
              agentDeviceId: cfg.agentDeviceId,
              connectionId: cfg.connectionId || null,
              apiBase: cfg.apiBase,
              tallyHost: cfg.tallyHost,
              tallyPort: cfg.tallyPort || lastDiscovery?.tallyPort || null,
              tallyRunning: Boolean(cfg.tallyPort || lastDiscovery?.tallyRunning),
              companies: lastDiscovery?.companies || [],
              integrationCenterUrl: integrationCenterUrl(cfg),
            },
          });
        }

        if (req.method === 'POST' && url.pathname === '/api/pair') {
          const body = await readBody(req);
          const code = String(body.pairingCode || '').trim();
          if (!code) {
            return sendJson(res, 400, { success: false, message: 'pairingCode required' });
          }
          const result = await completePairing(cfg, code);
          const restart = await restartWindowsService();
          return sendJson(res, 200, {
            success: true,
            data: { ...result, serviceRestart: restart },
          });
        }

        if (req.method === 'POST' && url.pathname === '/api/discover') {
          const discovery = await discoverTally({
            host: cfg.tallyHost,
            portMin: cfg.tallyPortMin,
            portMax: cfg.tallyPortMax,
          });
          lastDiscovery = discovery;
          if (discovery.tallyPort) {
            cfg.tallyPort = discovery.tallyPort;
            saveConfig(cfg);
          }
          return sendJson(res, 200, { success: true, data: discovery });
        }

        if (req.method === 'POST' && url.pathname === '/api/repair') {
          cfg.agentToken = null;
          cfg.connectionId = null;
          cfg.organizationId = null;
          saveConfig(cfg);
          await restartWindowsService();
          return sendJson(res, 200, { success: true, data: { unpaired: true } });
        }

        return sendJson(res, 404, { success: false, message: 'Not found' });
      } catch (err) {
        console.error('[localUi]', err);
        return sendJson(res, 500, { success: false, message: err.message || 'Server error' });
      }
    });
  }

  function tryListen(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      attachHandlers(server, port);

      const onError = (err) => {
        server.removeListener('listening', onListening);
        if (err.code === 'EADDRINUSE') {
          resolve({
            server: null,
            port,
            url: `http://127.0.0.1:${port}/`,
            alreadyRunning: true,
          });
          return;
        }
        console.error('[localUi] listen failed:', err.message);
        resolve({
          server: null,
          port,
          url: `http://127.0.0.1:${port}/`,
          error: err.message,
        });
      };

      const onListening = () => {
        server.removeListener('error', onError);
        const url = `http://127.0.0.1:${port}/`;
        writeUiUrlFile(url);
        console.log(`[localUi] listening on ${url}`);
        resolve({
          server,
          port,
          url,
          reloadConfig() {
            const fresh = loadConfig(cfg.configPath);
            Object.assign(cfg, fresh);
          },
        });
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1');
    });
  }

  return tryListen(preferred);
}

function openInBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { windowsHide: true, detached: true }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true }).unref();
    }
  } catch (err) {
    console.warn('[localUi] could not open browser:', err.message);
  }
}

module.exports = {
  DEFAULT_PORT,
  startLocalUi,
  openInBrowser,
  integrationCenterUrl,
  restartWindowsService,
};
