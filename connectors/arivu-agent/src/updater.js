'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { AGENT_VERSION } = require('./config');
const { requestJson, agentUrl } = require('./heartbeat');

/**
 * Check cloud update endpoint.
 * Path: GET /api/connectors/tally/agent/update?version=...
 */
async function checkForUpdate(cfg) {
  const url = `${agentUrl(cfg, '/update')}?version=${encodeURIComponent(AGENT_VERSION)}&platform=win-x64`;
  return requestJson('GET', url, { token: cfg.agentToken });
}

/**
 * Download a file to destPath (scaffold — CI wires real signed EXE URLs).
 */
function downloadFile(urlString, destPath) {
  const url = new URL(urlString);
  const lib = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    const req = lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(res.headers.location, destPath).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`Download failed HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destPath));
      });
    });
    req.on('error', (err) => {
      try {
        file.close();
        fs.unlinkSync(destPath);
      } catch (_) {
        /* ignore */
      }
      reject(err);
    });
  });
}

/**
 * Apply update if cloud reports a newer version.
 * Does not restart the Windows service here — installer / service wrapper handles that.
 */
async function maybeUpdate(cfg) {
  try {
    const res = await checkForUpdate(cfg);
    if (!res.ok) {
      return { checked: true, updateAvailable: false, reason: `HTTP ${res.statusCode}` };
    }
    const data = res.data?.data || res.data || {};
    if (!data.updateAvailable && !data.downloadUrl) {
      return { checked: true, updateAvailable: false, current: AGENT_VERSION };
    }

    const downloadUrl = data.downloadUrl;
    if (!downloadUrl) {
      return {
        checked: true,
        updateAvailable: true,
        version: data.version,
        reason: 'no downloadUrl',
      };
    }

    const dest = path.join(cfg.dataDir, 'updates', `arivu-connector-agent-${data.version || 'next'}.exe`);
    await downloadFile(downloadUrl, dest);
    return {
      checked: true,
      updateAvailable: true,
      version: data.version,
      downloadedTo: dest,
      // Service restart / replace left to installer post-update hook.
      applyPending: true,
    };
  } catch (err) {
    return { checked: false, error: err.message };
  }
}

module.exports = {
  checkForUpdate,
  downloadFile,
  maybeUpdate,
};
