'use strict';

const mongoose = require('mongoose');
const Campaign = require('../../models/Campaign');
const MarketingAudience = require('../../models/MarketingAudience');
const Communication = require('../../models/Communication');

const ACTIVE_CAMPAIGN_STATUSES = ['draft', 'scheduled', 'running', 'paused'];
const COMPLETED_CAMPAIGN_STATUSES = ['completed', 'failed', 'cancelled', 'archived'];

/**
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function toRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num <= 1 ? num : num / 100;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function loadCampaignStatusCounts(organizationId) {
  const rows = await Campaign.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(String(organizationId)) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  /** @type {Record<string, number>} */
  const counts = {
    total: 0,
    draft: 0,
    scheduled: 0,
    running: 0,
    paused: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    archived: 0,
    active: 0
  };

  for (const row of rows) {
    const status = String(row._id || 'draft');
    const count = toNumber(row.count);
    counts.total += count;
    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] = count;
    }
  }

  counts.active = ACTIVE_CAMPAIGN_STATUSES.reduce(
    (sum, status) => sum + toNumber(counts[status]),
    0
  );

  return counts;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function loadEngagementTotals(organizationId) {
  const [aggregate] = await Campaign.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(String(organizationId)),
        status: { $in: ['completed', 'running', 'paused', 'failed'] }
      }
    },
    {
      $group: {
        _id: null,
        totalRecipients: { $sum: '$stats.totalRecipients' },
        delivered: { $sum: '$stats.delivered' },
        uniqueOpens: { $sum: '$stats.uniqueOpens' },
        uniqueClicks: { $sum: '$stats.uniqueClicks' },
        totalOpens: { $sum: '$stats.totalOpens' },
        totalClicks: { $sum: '$stats.totalClicks' },
        campaignsWithStats: {
          $sum: {
            $cond: [{ $gt: ['$stats.totalRecipients', 0] }, 1, 0]
          }
        },
        openRateSum: { $sum: '$stats.openRate' },
        clickRateSum: { $sum: '$stats.clickRate' }
      }
    }
  ]);

  const totals = aggregate || {};
  const campaignsWithStats = toNumber(totals.campaignsWithStats);
  const totalRecipients = toNumber(totals.totalRecipients);
  const delivered = toNumber(totals.delivered);
  const uniqueOpens = toNumber(totals.uniqueOpens);
  const uniqueClicks = toNumber(totals.uniqueClicks);

  return {
    totalRecipients,
    delivered,
    uniqueOpens,
    uniqueClicks,
    totalOpens: toNumber(totals.totalOpens),
    totalClicks: toNumber(totals.totalClicks),
    avgOpenRate:
      campaignsWithStats > 0
        ? toRate(totals.openRateSum) / campaignsWithStats
        : totalRecipients > 0
          ? uniqueOpens / totalRecipients
          : 0,
    avgClickRate:
      campaignsWithStats > 0
        ? toRate(totals.clickRateSum) / campaignsWithStats
        : totalRecipients > 0
          ? uniqueClicks / totalRecipients
          : 0,
    deliveryRate: totalRecipients > 0 ? delivered / totalRecipients : 0
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} days
 */
async function loadAudienceMetrics(organizationId, days = 30) {
  const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [audienceAgg, recentAudiences] = await Promise.all([
    MarketingAudience.aggregate([
      { $match: { organizationId: orgObjectId } },
      {
        $group: {
          _id: null,
          totalAudiences: { $sum: 1 },
          totalMembers: { $sum: '$memberCount' }
        }
      }
    ]),
    MarketingAudience.countDocuments({
      organizationId: orgObjectId,
      createdAt: { $gte: since }
    })
  ]);

  const totals = audienceAgg[0] || {};

  const growthRows = await MarketingAudience.aggregate([
    { $match: { organizationId: orgObjectId, createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        audiences: { $sum: 1 },
        members: { $sum: '$memberCount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return {
    totalAudiences: toNumber(totals.totalAudiences),
    totalMembers: toNumber(totals.totalMembers),
    newAudiencesLast30Days: recentAudiences,
    growthTrend: growthRows.map((row) => ({
      date: row._id,
      audiences: toNumber(row.audiences),
      members: toNumber(row.members)
    }))
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} limit
 */
async function loadRecentCampaigns(organizationId, limit = 5) {
  const rows = await Campaign.find({ organizationId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('name subject status updatedAt scheduledAt stats.totalRecipients stats.openRate stats.clickRate stats.sendCompletedAt')
    .lean();

  return rows.map((row) => ({
    _id: row._id,
    name: row.name,
    subject: row.subject || '',
    status: row.status,
    updatedAt: row.updatedAt,
    scheduledAt: row.scheduledAt || null,
    totalRecipients: toNumber(row.stats?.totalRecipients),
    openRate: toRate(row.stats?.openRate),
    clickRate: toRate(row.stats?.clickRate),
    sendCompletedAt: row.stats?.sendCompletedAt || null
  }));
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} limit
 */
async function loadTopCampaigns(organizationId, limit = 5) {
  const rows = await Campaign.find({
    organizationId,
    status: { $in: ['completed', 'running', 'paused'] },
    'stats.totalRecipients': { $gt: 0 }
  })
    .sort({ 'stats.uniqueOpens': -1, 'stats.openRate': -1, updatedAt: -1 })
    .limit(limit)
    .select('name status stats.totalRecipients stats.delivered stats.uniqueOpens stats.uniqueClicks stats.openRate stats.clickRate stats.sendCompletedAt')
    .lean();

  return rows.map((row) => ({
    _id: row._id,
    name: row.name,
    status: row.status,
    totalRecipients: toNumber(row.stats?.totalRecipients),
    delivered: toNumber(row.stats?.delivered),
    uniqueOpens: toNumber(row.stats?.uniqueOpens),
    uniqueClicks: toNumber(row.stats?.uniqueClicks),
    openRate: toRate(row.stats?.openRate),
    clickRate: toRate(row.stats?.clickRate),
    sendCompletedAt: row.stats?.sendCompletedAt || null
  }));
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} limit
 */
async function loadLinkPerformance(organizationId, limit = 10) {
  const rows = await Communication.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(String(organizationId)),
        'relatedTo.moduleKey': 'campaigns',
        $or: [
          { 'metadata.clickCount': { $gt: 0 } },
          { 'metadata.clickedUrl': { $nin: [null, ''] } }
        ]
      }
    },
    {
      $group: {
        _id: {
          url: {
            $cond: [
              {
                $and: [
                  { $ne: ['$metadata.clickedUrl', null] },
                  { $ne: ['$metadata.clickedUrl', ''] }
                ]
              },
              '$metadata.clickedUrl',
              'unknown'
            ]
          },
          campaignId: '$relatedTo.recordId'
        },
        clicks: { $sum: { $ifNull: ['$metadata.clickCount', 0] } },
        uniqueRecipients: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.url',
        clicks: { $sum: '$clicks' },
        uniqueRecipients: { $sum: '$uniqueRecipients' },
        campaignIds: { $addToSet: '$_id.campaignId' }
      }
    },
    { $sort: { clicks: -1 } },
    { $limit: limit }
  ]);

  return rows.map((row) => ({
    url: row._id === 'unknown' ? null : row._id,
    clicks: toNumber(row.clicks),
    uniqueRecipients: toNumber(row.uniqueRecipients),
    campaignCount: Array.isArray(row.campaignIds) ? row.campaignIds.length : 0
  }));
}

/**
 * @param {Array<object>} recentCampaigns
 */
function buildRecentActivity(recentCampaigns) {
  return recentCampaigns
    .map((campaign) => {
      const timestamp = campaign.sendCompletedAt || campaign.scheduledAt || campaign.updatedAt;
      let type = 'updated';
      let messageKey = 'dashboardActivityUpdated';

      if (campaign.sendCompletedAt) {
        type = 'sent';
        messageKey = 'dashboardActivitySent';
      } else if (campaign.status === 'scheduled' && campaign.scheduledAt) {
        type = 'scheduled';
        messageKey = 'dashboardActivityScheduled';
      } else if (campaign.status === 'draft') {
        type = 'draft';
        messageKey = 'dashboardActivityDraft';
      }

      return {
        id: String(campaign._id),
        type,
        messageKey,
        campaignId: String(campaign._id),
        campaignName: campaign.name,
        status: campaign.status,
        timestamp
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {{ days?: number }} [options]
 */
async function buildMarketingDashboardPayload(organizationId, options = {}) {
  const days = Math.min(90, Math.max(7, parseInt(String(options.days || 30), 10) || 30));

  const [campaignCounts, engagement, audiences, recentCampaigns, topCampaigns, linkPerformance] =
    await Promise.all([
      loadCampaignStatusCounts(organizationId),
      loadEngagementTotals(organizationId),
      loadAudienceMetrics(organizationId, days),
      loadRecentCampaigns(organizationId, 8),
      loadTopCampaigns(organizationId, 5),
      loadLinkPerformance(organizationId, 8)
    ]);

  return {
    generatedAt: new Date().toISOString(),
    periodDays: days,
    kpis: {
      campaigns: campaignCounts,
      engagement,
      audiences
    },
    recentCampaigns: recentCampaigns.slice(0, 5),
    recentActivity: buildRecentActivity(recentCampaigns),
    topCampaigns,
    linkPerformance
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string[]} campaignIds
 */
async function compareCampaigns(organizationId, campaignIds) {
  const uniqueIds = [...new Set(campaignIds.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new Error('At least one campaign id is required');
  }
  if (uniqueIds.length > 5) {
    throw new Error('Compare up to 5 campaigns at a time');
  }

  const objectIds = uniqueIds.map((id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid campaign id: ${id}`);
    }
    return new mongoose.Types.ObjectId(id);
  });

  const rows = await Campaign.find({
    organizationId,
    _id: { $in: objectIds }
  })
    .select(
      'name subject status stats.totalRecipients stats.delivered stats.uniqueOpens stats.uniqueClicks stats.openRate stats.clickRate stats.sendCompletedAt updatedAt'
    )
    .lean();

  const byId = new Map(rows.map((row) => [String(row._id), row]));

  return uniqueIds.map((id) => {
    const row = byId.get(id);
    if (!row) {
      return { _id: id, found: false };
    }

    return {
      _id: row._id,
      found: true,
      name: row.name,
      subject: row.subject || '',
      status: row.status,
      updatedAt: row.updatedAt,
      stats: {
        totalRecipients: toNumber(row.stats?.totalRecipients),
        delivered: toNumber(row.stats?.delivered),
        uniqueOpens: toNumber(row.stats?.uniqueOpens),
        uniqueClicks: toNumber(row.stats?.uniqueClicks),
        openRate: toRate(row.stats?.openRate),
        clickRate: toRate(row.stats?.clickRate),
        sendCompletedAt: row.stats?.sendCompletedAt || null
      }
    };
  });
}

module.exports = {
  buildMarketingDashboardPayload,
  compareCampaigns,
  buildRecentActivity,
  loadCampaignStatusCounts,
  loadEngagementTotals,
  loadAudienceMetrics,
  loadLinkPerformance,
  ACTIVE_CAMPAIGN_STATUSES,
  COMPLETED_CAMPAIGN_STATUSES
};
