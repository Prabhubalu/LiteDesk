'use strict';

const { getAmdsClient } = require('../config/amds');
const {
  buildMarketingReportsSummary,
  exportCampaignPerformanceCsv,
  exportCampaignPerformanceXlsx,
  exportCampaignPerformancePdf
} = require('../services/marketing/marketingReportsService');

function sendExport(res, payload) {
  res.setHeader('Content-Type', payload.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
  return res.send(payload.body);
}

exports.getReportsSummary = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const data = await buildMarketingReportsSummary(organizationId, req.query);

    /** @type {Record<string, unknown>|null} */
    let amdsAnalytics = null;
    const client = getAmdsClient();
    if (client) {
      try {
        const summary = await client.getAnalyticsSummary({
          tenant_id: String(organizationId),
          from: data.range.from,
          to: data.range.to
        });
        amdsAnalytics = {
          reputation: summary.reputation || null,
          campaignHealth: summary.campaign_health || null,
          complaintRate: summary.rates?.complaint_rate ?? null,
          hardBounceRate: summary.rates?.hard_bounce_rate ?? null,
          softBounceRate: summary.rates?.soft_bounce_rate ?? null,
          counts: summary.counts || null
        };
      } catch {
        amdsAnalytics = null;
      }
    }

    return res.json({
      success: true,
      data: {
        ...data,
        ...(amdsAnalytics ? { amdsAnalytics } : {})
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.exportCampaignPerformanceCsv = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const payload = await exportCampaignPerformanceCsv(organizationId, req.query);
    return sendExport(res, payload);
  } catch (err) {
    return next(err);
  }
};

exports.exportCampaignPerformanceXlsx = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const payload = await exportCampaignPerformanceXlsx(organizationId, req.query);
    return sendExport(res, payload);
  } catch (err) {
    return next(err);
  }
};

exports.exportCampaignPerformancePdf = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const payload = await exportCampaignPerformancePdf(organizationId, req.query);
    return sendExport(res, payload);
  } catch (err) {
    return next(err);
  }
};
