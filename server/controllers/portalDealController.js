'use strict';

const {
  listPortalDeals,
  getPortalDealById,
  shapePortalDealDetail
} = require('../services/portalDealService');

async function listPortalDealsHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const limit = parseInt(req.query.limit, 10);
    const skip = parseInt(req.query.skip, 10);
    const { rows, total } = await listPortalDeals(organizationId, req.user, { limit, skip });

    return res.json({
      success: true,
      data: rows,
      total
    });
  } catch (error) {
    console.error('[portalDealController] listPortalDeals', error);
    return res.status(500).json({ success: false, message: 'Failed to load deals' });
  }
}

async function getPortalDealHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const row = await getPortalDealById(organizationId, req.params.id, req.user);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    return res.json({ success: true, data: shapePortalDealDetail(row) });
  } catch (error) {
    console.error('[portalDealController] getPortalDeal', error);
    return res.status(500).json({ success: false, message: 'Failed to load deal' });
  }
}

module.exports = {
  listPortalDealsHandler,
  getPortalDealHandler
};
