const {
  getReportOverview,
  getAgentMetrics,
} = require('../services/liveChatReportingService');

exports.getOverview = async (req, res) => {
  try {
    const data = await getReportOverview(req.user.organizationId, {
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatReportController] getOverview', err);
    return res.status(500).json({ success: false, message: 'Failed to load live chat report' });
  }
};

exports.getAgentMetrics = async (req, res) => {
  try {
    const data = await getAgentMetrics(req.user.organizationId, {
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatReportController] getAgentMetrics', err);
    return res.status(500).json({ success: false, message: 'Failed to load agent metrics' });
  }
};
