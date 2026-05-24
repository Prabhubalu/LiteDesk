'use strict';

const {
  getAdminInboundParserConfig,
  updateAdminInboundParserConfig,
  testParserConnection
} = require('../services/inboundParserConfigService');

async function getConfig(req, res) {
  try {
    const data = await getAdminInboundParserConfig();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[platformInboundParser] getConfig:', err);
    return res.status(500).json({ success: false, message: 'Failed to load inbound parser configuration' });
  }
}

async function updateConfig(req, res) {
  try {
    const {
      enabled,
      parserApiBaseUrl,
      crmPublicApiBaseUrl,
      parserApiKey,
      webhookSecret
    } = req.body || {};

    const data = await updateAdminInboundParserConfig({
      enabled,
      parserApiBaseUrl,
      crmPublicApiBaseUrl,
      parserApiKey,
      webhookSecret,
      updatedByUserId: req.user?._id
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[platformInboundParser] updateConfig:', err);
    return res.status(500).json({ success: false, message: 'Failed to save inbound parser configuration' });
  }
}

async function testConnection(req, res) {
  try {
    const result = await testParserConnection();
    return res.json({ success: result.ok, data: result });
  } catch (err) {
    console.error('[platformInboundParser] testConnection:', err);
    return res.status(500).json({ success: false, message: 'Connection test failed' });
  }
}

module.exports = {
  getConfig,
  updateConfig,
  testConnection
};
