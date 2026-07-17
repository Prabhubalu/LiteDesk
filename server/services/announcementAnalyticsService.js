'use strict';

const Announcement = require('../models/Announcement');
const AnnouncementEvent = require('../models/AnnouncementEvent');
const AnnouncementUserState = require('../models/AnnouncementUserState');

function isInActiveWindow(doc, now = new Date()) {
  if (doc.status !== 'published') return false;
  const start = doc.schedule?.startAt ? new Date(doc.schedule.startAt) : null;
  const end = doc.schedule?.endAt ? new Date(doc.schedule.endAt) : null;
  if (start && start > now) return false;
  if (end && end <= now) return false;
  return true;
}

function rate(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

async function writeEvent({
  organizationId,
  announcementId,
  userId,
  type,
  ctaId = null,
  surface = 'web_app',
  deviceType = null,
  platform = null,
}) {
  try {
    await AnnouncementEvent.create({
      organizationId,
      announcementId,
      userId,
      type,
      ctaId,
      surface: ['web_app', 'portal', 'mobile'].includes(surface) ? surface : 'web_app',
      deviceType: deviceType ? String(deviceType).slice(0, 40) : null,
      platform: platform ? String(platform).slice(0, 40) : null,
      at: new Date(),
    });
  } catch (error) {
    console.error('[announcementAnalytics] writeEvent failed', error.message);
  }
}

async function getAnnouncementAnalytics(organizationId, announcementId) {
  const doc = await Announcement.findOne({ _id: announcementId, organizationId }).lean();
  if (!doc) return null;

  const [eventFacet, uniqueViewers, reachStates] = await Promise.all([
    AnnouncementEvent.aggregate([
      { $match: { organizationId, announcementId: doc._id } },
      {
        $facet: {
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } },
          ],
          bySurface: [
            { $group: { _id: '$surface', count: { $sum: 1 } } },
          ],
          byDevice: [
            { $match: { deviceType: { $ne: null } } },
            { $group: { _id: '$deviceType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          ctaClicks: [
            { $match: { type: 'cta_click' } },
            { $group: { _id: '$ctaId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          last7Days: [
            {
              $match: {
                at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$at' },
                },
                views: {
                  $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] },
                },
                ctaClicks: {
                  $sum: { $cond: [{ $eq: ['$type', 'cta_click'] }, 1, 0] },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]),
    AnnouncementEvent.distinct('userId', {
      organizationId,
      announcementId: doc._id,
      type: 'view',
    }),
    AnnouncementUserState.countDocuments({ organizationId, announcementId: doc._id }),
  ]);

  const facet = eventFacet[0] || {};
  const byType = Object.fromEntries((facet.byType || []).map((r) => [r._id, r.count]));
  const views = byType.view || doc.stats?.views || 0;
  const dismissals = byType.dismiss || doc.stats?.dismissals || 0;
  const acknowledgements = byType.acknowledge || doc.stats?.acknowledgements || 0;
  const ctaClicks = byType.cta_click || doc.stats?.ctaClicks || 0;

  const ctaBreakdown = (facet.ctaClicks || []).map((row) => {
    const cta = (doc.ctas || []).find((c) => c.id === row._id);
    return {
      ctaId: row._id,
      label: cta?.label || row._id || 'CTA',
      clicks: row.count,
    };
  });

  return {
    announcement: {
      id: String(doc._id),
      title: doc.title,
      displayType: doc.displayType,
      status: doc.status,
      effectiveStatus: isInActiveWindow(doc) ? 'active' : doc.status,
      priority: doc.priority,
      publishedAt: doc.publishedAt,
    },
    metrics: {
      views,
      uniqueViewers: uniqueViewers.length,
      reachedUsers: reachStates,
      dismissals,
      acknowledgements,
      ctaClicks,
      clickRate: rate(ctaClicks, views),
      dismissRate: rate(dismissals, views),
      ackRate: rate(acknowledgements, views),
    },
    bySurface: (facet.bySurface || []).map((r) => ({ surface: r._id || 'web_app', count: r.count })),
    byDevice: (facet.byDevice || []).map((r) => ({ deviceType: r._id, count: r.count })),
    ctaBreakdown,
    trend7d: (facet.last7Days || []).map((r) => ({
      date: r._id,
      views: r.views,
      ctaClicks: r.ctaClicks,
    })),
    counters: doc.stats || {},
  };
}

async function getAnalyticsSummary(organizationId) {
  const now = new Date();
  const [rows, eventTotals, activeCount, expiredCount] = await Promise.all([
    Announcement.find({ organizationId })
      .select('title displayType status priority schedule stats publishedAt createdAt')
      .sort({ 'stats.views': -1, updatedAt: -1 })
      .limit(50)
      .lean(),
    AnnouncementEvent.aggregate([
      { $match: { organizationId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    Announcement.countDocuments({
      organizationId,
      status: 'published',
      'schedule.startAt': { $lte: now },
      $or: [{ 'schedule.endAt': null }, { 'schedule.endAt': { $gt: now } }],
    }),
    Announcement.countDocuments({
      organizationId,
      status: { $in: ['expired', 'archived'] },
    }),
  ]);

  const byType = Object.fromEntries(eventTotals.map((r) => [r._id, r.count]));
  const totalViews = byType.view || rows.reduce((sum, r) => sum + (r.stats?.views || 0), 0);
  const totalCta = byType.cta_click || rows.reduce((sum, r) => sum + (r.stats?.ctaClicks || 0), 0);
  const totalDismiss = byType.dismiss || rows.reduce((sum, r) => sum + (r.stats?.dismissals || 0), 0);
  const totalAck = byType.acknowledge || rows.reduce((sum, r) => sum + (r.stats?.acknowledgements || 0), 0);

  return {
    summary: {
      activeAnnouncements: activeCount,
      expiredAnnouncements: expiredCount,
      totalViews,
      totalDismissals: totalDismiss,
      totalAcknowledgements: totalAck,
      totalCtaClicks: totalCta,
      clickRate: rate(totalCta, totalViews),
      dismissRate: rate(totalDismiss, totalViews),
      ackRate: rate(totalAck, totalViews),
    },
    top: rows.slice(0, 10).map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      displayType: doc.displayType,
      status: doc.status,
      effectiveStatus: isInActiveWindow(doc) ? 'active' : doc.status,
      priority: doc.priority,
      views: doc.stats?.views || 0,
      ctaClicks: doc.stats?.ctaClicks || 0,
      dismissals: doc.stats?.dismissals || 0,
      acknowledgements: doc.stats?.acknowledgements || 0,
      clickRate: rate(doc.stats?.ctaClicks || 0, doc.stats?.views || 0),
    })),
  };
}

module.exports = {
  writeEvent,
  getAnnouncementAnalytics,
  getAnalyticsSummary,
};
