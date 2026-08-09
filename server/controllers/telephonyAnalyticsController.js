'use strict';

const analyticsService = require('../services/telephony/analyticsService');
const { enqueueTelephonyJob } = require('../services/telephony/telephonyQueueService');

exports.getDashboard = async (req, res) => {
  try {
    const data = await analyticsService.getDashboardMetrics(req.user.organizationId, {
      days: Number(req.query.days) || 7,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyAnalyticsController] getDashboard', err);
    return res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
};

exports.getReports = async (req, res) => {
  try {
    const data = await analyticsService.getReports(req.user.organizationId, {
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyAnalyticsController] getReports', err);
    return res.status(500).json({ success: false, message: 'Failed to load reports' });
  }
};

exports.rollup = async (req, res) => {
  try {
    const bucket = req.body?.bucket === 'hourly' ? 'hourly' : 'daily';
    enqueueTelephonyJob('rollupAnalytics', {
      organizationId: String(req.user.organizationId),
      bucket,
      at: req.body?.at || null,
    });
    return res.json({ success: true, data: { queued: true, bucket } });
  } catch (err) {
    console.error('[telephonyAnalyticsController] rollup', err);
    return res.status(500).json({ success: false, message: 'Failed to enqueue rollup' });
  }
};
