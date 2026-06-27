'use strict';

const {
  listPortalResponses,
  getPortalResponseById
} = require('../services/portalResponseService');

async function listPortalResponsesHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const limit = parseInt(req.query.limit, 10);
    const skip = parseInt(req.query.skip, 10);
    const { rows, total } = await listPortalResponses(organizationId, req.user, { limit, skip });

    return res.json({
      success: true,
      data: rows,
      total
    });
  } catch (error) {
    console.error('[portalResponseController] listPortalResponses', error);
    return res.status(500).json({ success: false, message: 'Failed to load responses' });
  }
}

async function getPortalResponseHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const row = await getPortalResponseById(organizationId, req.params.id, req.user);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Response not found' });
    }

    return res.json({ success: true, data: row });
  } catch (error) {
    console.error('[portalResponseController] getPortalResponse', error);
    return res.status(500).json({ success: false, message: 'Failed to load response' });
  }
}

module.exports = {
  listPortalResponsesHandler,
  getPortalResponseHandler
};
