const { isAiSuiteEntitledForOrg } = require('../utils/addonAccessUtils');

/**
 * Require the unified Arivu AI suite entitlement (`ai` addon, or legacy ai_* aliases).
 */
function requireAiSuiteEntitlement() {
  return async (req, res, next) => {
    try {
      const organizationId = req.user?.organizationId || req.organizationId || req.organization?._id;
      if (!organizationId) {
        return res.status(403).json({
          success: false,
          message: 'Organization context required',
          code: 'ORGANIZATION_REQUIRED',
        });
      }

      const entitled = await isAiSuiteEntitledForOrg(organizationId);
      if (!entitled) {
        return res.status(403).json({
          success: false,
          message: 'Arivu AI is not installed or active for this organization',
          code: 'AI_SUITE_NOT_ENTITLED',
          addonKey: 'ai',
        });
      }

      req.addonKey = 'ai';
      return next();
    } catch (error) {
      console.error('[requireAiSuiteEntitlement] error', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify AI entitlement',
      });
    }
  };
}

module.exports = {
  requireAiSuiteEntitlement,
};
