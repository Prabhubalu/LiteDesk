const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const {
  normalizeCannedResponses,
  filterCannedResponsesForChannel
} = require('../services/caseCannedResponseService');

/**
 * GET /api/helpdesk/cases/canned-responses
 * List tenant canned responses for case composers (cases.view).
 */
exports.listCaseCannedResponses = async (req, res) => {
  try {
    const channel = String(req.query.channel || 'email').trim().toLowerCase();
    const config = await TenantAppConfiguration.findOne({
      organizationId: req.user.organizationId,
      appKey: 'HELPDESK'
    })
      .select('settings.helpdeskExecution.cannedResponses')
      .lean();

    const saved = config?.settings?.helpdeskExecution?.cannedResponses;
    const all = normalizeCannedResponses(saved, {
      useDefaultsWhenMissing: saved == null
    });
    const responses = filterCannedResponsesForChannel(all, channel);
    const includeAll = String(req.query.includeAll || '').toLowerCase() === 'true';

    return res.json({
      success: true,
      data: {
        responses: includeAll ? all : responses,
        channel,
        total: all.length
      }
    });
  } catch (error) {
    console.error('[caseCannedResponseController] listCaseCannedResponses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load canned responses'
    });
  }
};
