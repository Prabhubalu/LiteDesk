const { getWidgetSettings } = require('../services/liveChatWidgetService');

/**
 * Bootstrap for the in-product support hub (authenticated users).
 * Returns public embed key when the tenant widget is enabled — no agent permission required.
 */
async function getInAppSupportBootstrap(req, res) {
  try {
    const organizationId = req.user?.organizationId || req.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Organization context required',
        code: 'ORGANIZATION_REQUIRED',
      });
    }

    const widget = await getWidgetSettings(organizationId);
    if (!widget.widgetEnabled || !widget.publicKey) {
      return res.json({
        success: true,
        data: { enabled: false },
      });
    }

    return res.json({
      success: true,
      data: {
        enabled: true,
        publicKey: widget.publicKey,
        welcomeMessage: widget.welcomeMessage,
        consentRequired: widget.consentRequired !== false,
        consentMessage: widget.consentMessage || '',
        privacyPolicyUrl: widget.privacyPolicyUrl || '',
        termsUrl: widget.termsUrl || '',
      },
    });
  } catch (error) {
    console.error('[liveChatInAppSupportController] getInAppSupportBootstrap', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load in-app support',
    });
  }
}

module.exports = {
  getInAppSupportBootstrap,
};
