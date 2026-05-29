const {
  getQuoteOrgSettings,
  updateQuoteOrgSettings
} = require('../services/quoteOrgSettingsService');

function requireOrgAdmin(req, res) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin' || req.user?.isPlatformAdmin) return true;
  res.status(403).json({ success: false, message: 'Admin access required' });
  return false;
}

/**
 * GET /api/settings/quotes
 */
exports.getQuoteSettings = async (req, res) => {
  try {
    const settings = await getQuoteOrgSettings(req.user.organizationId);
    return res.json({ success: true, settings });
  } catch (error) {
    console.error('[quoteSettingsController] getQuoteSettings', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load quote settings'
    });
  }
};

/**
 * PUT /api/settings/quotes
 * Body: { requireApprovalBeforeSend?, requireCustomerAgreement?, customerAgreementText? }
 */
exports.updateQuoteSettings = async (req, res) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    const settings = await updateQuoteOrgSettings(req.user.organizationId, {
      requireApprovalBeforeSend: req.body?.requireApprovalBeforeSend,
      requireCustomerAgreement: req.body?.requireCustomerAgreement,
      requireTypedSignature: req.body?.requireTypedSignature,
      customerAgreementText: req.body?.customerAgreementText,
      pdfFooterText: req.body?.pdfFooterText,
      emailSignature: req.body?.emailSignature,
      brandColor: req.body?.brandColor,
      documentTitle: req.body?.documentTitle
    });

    return res.json({ success: true, settings });
  } catch (error) {
    const status = error?.code === 'NOT_FOUND' ? 404 : 500;
    console.error('[quoteSettingsController] updateQuoteSettings', error);
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to update quote settings'
    });
  }
};
