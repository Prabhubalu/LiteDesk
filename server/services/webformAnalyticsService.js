'use strict';

const mongoose = require('mongoose');
const Webform = require('../models/Webform');
const WebformSubmission = require('../models/WebformSubmission');

function parseDateRange(query = {}) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);

  const from = query.from ? new Date(String(query.from)) : defaultFrom;
  const to = query.to ? new Date(String(query.to)) : now;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { from: defaultFrom, to: now };
  }

  if (from > to) {
    return { from: to, to: from };
  }

  return { from, to };
}

function computeConversionRate(views, submissions) {
  if (!views || views <= 0) return 0;
  return Math.round((submissions / views) * 1000) / 10;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} webformId
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {{ from?: string, to?: string }} [query]
 */
async function getWebformAnalytics(webformId, organizationId, query = {}) {
  const webform = await Webform.findOne({
    _id: webformId,
    organizationId
  }).select('totalSubmissions totalViews lastSubmissionAt publishedAt auditLog').lean();

  if (!webform) {
    return null;
  }

  const { from, to } = parseDateRange(query);
  const objectId = new mongoose.Types.ObjectId(String(webformId));
  const orgId = new mongoose.Types.ObjectId(String(organizationId));

  const match = {
    webformId: objectId,
    organizationId: orgId,
    createdAt: { $gte: from, $lte: to }
  };

  const [statusRows, trendRows, dedupHits, crmCreated, crmUpdated, crmFailed, duplicateRejected, rangeTotal] =
    await Promise.all([
      WebformSubmission.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      WebformSubmission.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            submissions: { $sum: 1 },
            dedupHits: {
              $sum: {
                $cond: [{ $eq: ['$dedupOutcome.matched', true] }, 1, 0]
              }
            },
            failed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      WebformSubmission.countDocuments({ ...match, 'dedupOutcome.matched': true }),
      WebformSubmission.countDocuments({ ...match, 'crmOutcome.action': 'created' }),
      WebformSubmission.countDocuments({ ...match, 'crmOutcome.action': 'updated' }),
      WebformSubmission.countDocuments({ ...match, status: 'failed' }),
      WebformSubmission.countDocuments({ ...match, status: 'duplicate_rejected' }),
      WebformSubmission.countDocuments(match)
    ]);

  const statusBreakdown = {};
  for (const row of statusRows) {
    statusBreakdown[row._id || 'unknown'] = row.count;
  }

  const totalViews = Number(webform.totalViews) || 0;
  const totalSubmissions = Number(webform.totalSubmissions) || 0;

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString()
    },
    summary: {
      totalViews,
      totalSubmissions,
      rangeSubmissions: rangeTotal,
      conversionRate: computeConversionRate(totalViews, totalSubmissions),
      dedupHits,
      crmCreated,
      crmUpdated,
      crmFailed,
      duplicateRejected,
      lastSubmissionAt: webform.lastSubmissionAt || null,
      publishedAt: webform.publishedAt || null
    },
    statusBreakdown,
    trend: trendRows.map((row) => ({
      date: row._id,
      submissions: row.submissions,
      dedupHits: row.dedupHits,
      failed: row.failed
    })),
    recentAudit: Array.isArray(webform.auditLog)
      ? webform.auditLog.slice(0, 10)
      : []
  };
}

module.exports = {
  getWebformAnalytics,
  parseDateRange,
  computeConversionRate
};
