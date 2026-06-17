'use strict';

const crypto = require('crypto');

function isWebformFileScanEnabled() {
  if (process.env.WEBFORM_FILE_SCAN_ENABLED === 'true') return true;
  return Boolean(String(process.env.WEBFORM_SCAN_WEBHOOK_URL || '').trim());
}

/**
 * Scan provider — noop by default; webhook when WEBFORM_SCAN_WEBHOOK_URL is set.
 */
async function scanWebformUploadBuffer({ buffer, mimeType, fileName }) {
  const webhookUrl = String(process.env.WEBFORM_SCAN_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    return { status: 'skipped', provider: 'noop', detail: 'scan_disabled' };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: fileName || 'upload',
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: buffer?.length || 0,
      sha256: buffer ? crypto.createHash('sha256').update(buffer).digest('hex') : null,
      source: 'webform'
    })
  });

  if (!response.ok) {
    return { status: 'failed', provider: 'webhook', detail: `HTTP ${response.status}` };
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  const verdict = String(json?.status || json?.verdict || '').toLowerCase();
  if (verdict === 'infected' || verdict === 'malware' || json?.infected === true) {
    return { status: 'infected', provider: 'webhook', detail: json?.detail || 'infected' };
  }
  if (verdict === 'clean' || verdict === 'ok' || json?.clean === true) {
    return { status: 'clean', provider: 'webhook', detail: json?.detail || 'clean' };
  }
  return { status: 'failed', provider: 'webhook', detail: 'unrecognized_verdict' };
}

module.exports = {
  isWebformFileScanEnabled,
  scanWebformUploadBuffer
};
