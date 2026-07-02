'use strict';

const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const {
  buildMarketingDashboardPayload,
  compareCampaigns
} = require('../services/marketing/marketingDashboardService');

/**
 * GET /api/marketing/dashboard
 */
exports.getMarketingDashboard = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const days = parseInt(String(req.query.days || '30'), 10) || 30;

    const data = await runWithOrganizationTenantContext(organizationId, async () =>
      buildMarketingDashboardPayload(organizationId, { days })
    );

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/marketing/dashboard/compare?ids=id1,id2
 */
exports.compareMarketingCampaigns = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const raw = String(req.query.ids || '').trim();
    const campaignIds = raw ? raw.split(',').map((part) => part.trim()).filter(Boolean) : [];

    const data = await runWithOrganizationTenantContext(organizationId, async () =>
      compareCampaigns(organizationId, campaignIds)
    );

    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof Error && /required|invalid|compare up to/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};
