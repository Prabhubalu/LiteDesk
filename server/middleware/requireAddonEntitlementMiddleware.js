const { normalizeAddonKey, isValidAddonKey } = require('../constants/addonKeys');
const { isAddonEntitledForOrg } = require('../utils/addonAccessUtils');

/**
 * Require an installable addon entitlement for the current tenant.
 *
 * Usage:
 *   router.use(requireAddonEntitlement('live_chat'));
 *   router.get('/sessions', requireAddonEntitlement('live_chat'), handler);
 */
function requireAddonEntitlement(addonKeyParam) {
  return async (req, res, next) => {
    try {
      const addonKey = normalizeAddonKey(addonKeyParam || req.params.addonKey || req.body?.addonKey);
      if (!isValidAddonKey(addonKey)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid addon key',
          code: 'INVALID_ADDON',
        });
      }

      const organizationId = req.user?.organizationId || req.organizationId || req.organization?._id;
      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: 'Organization context required',
          code: 'ORGANIZATION_REQUIRED',
        });
      }

      const entitled = await isAddonEntitledForOrg(organizationId, addonKey);
      if (!entitled) {
        return res.status(403).json({
          success: false,
          message: `Addon ${addonKey} is not installed or active for this organization`,
          code: 'ADDON_NOT_ENTITLED',
          addonKey,
        });
      }

      req.addonKey = addonKey;
      return next();
    } catch (error) {
      console.error('[requireAddonEntitlement] error', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify addon entitlement',
      });
    }
  };
}

module.exports = {
  requireAddonEntitlement,
};
