const { buildPortalDashboardPayload } = require('../services/portalDashboardService');

/**
 * GET /portal/dashboard
 * Role-aware portal home summary scoped to the signed-in external user.
 */
async function getPortalDashboard(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const data = await buildPortalDashboardPayload(organizationId, req.user);

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[portalDashboardController] getPortalDashboard', error);
    return res.status(500).json({ success: false, message: 'Failed to load portal dashboard' });
  }
}

module.exports = {
  getPortalDashboard
};
