'use strict';

const { AmdsClient } = require('../services/amds/amds-client');

/** @type {AmdsClient|null} */
let cachedClient = null;

function isAmdsEnvConfigured() {
  return !!(String(process.env.AMDS_BASE_URL || '').trim() && String(process.env.AMDS_API_KEY || '').trim());
}

function getAmdsWebhookSecret() {
  return String(process.env.AMDS_WEBHOOK_SECRET || '').trim();
}

function getAmdsWebhookPath() {
  return String(process.env.AMDS_WEBHOOK_PATH || '/api/internal/webhooks/amds').trim();
}

/**
 * Lazy AMDS client — returns null when env is not configured (no boot crash).
 * @returns {AmdsClient|null}
 */
function getAmdsClient() {
  if (!isAmdsEnvConfigured()) return null;
  if (!cachedClient) {
    cachedClient = new AmdsClient(
      String(process.env.AMDS_BASE_URL).trim(),
      String(process.env.AMDS_API_KEY).trim()
    );
  }
  return cachedClient;
}

/** Test helper — reset singleton between tests. */
function resetAmdsClientForTests() {
  cachedClient = null;
}

module.exports = {
  isAmdsEnvConfigured,
  getAmdsWebhookSecret,
  getAmdsWebhookPath,
  getAmdsClient,
  resetAmdsClientForTests
};
