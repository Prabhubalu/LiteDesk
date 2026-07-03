const mongoose = require('mongoose');
const AnalyticsReport = require('../../models/AnalyticsReport');
const AnalyticsWidget = require('../../models/AnalyticsWidget');
const AnalyticsDashboard = require('../../models/AnalyticsDashboard');

const MAX_UNIQUE_VIEWERS = 500;

function viewerUpdate(userId) {
  const update = {
    $set: { lastViewedAt: new Date() },
    $inc: { viewCount: 1 },
  };

  if (userId) {
    update.$addToSet = { uniqueViewerIds: new mongoose.Types.ObjectId(String(userId)) };
  }

  return update;
}

async function trimUniqueViewers(Model, docId, organizationId) {
  const doc = await Model.findOne({ _id: docId, organizationId }).select('uniqueViewerIds').lean();
  const count = doc?.uniqueViewerIds?.length || 0;
  if (count <= MAX_UNIQUE_VIEWERS) return;
  const trimmed = doc.uniqueViewerIds.slice(count - MAX_UNIQUE_VIEWERS);
  await Model.updateOne({ _id: docId, organizationId }, { $set: { uniqueViewerIds: trimmed } });
}

async function recordReportView(reportId, organizationId, userId) {
  if (!reportId || !organizationId) return;
  await AnalyticsReport.updateOne({ _id: reportId, organizationId }, viewerUpdate(userId));
  if (userId) await trimUniqueViewers(AnalyticsReport, reportId, organizationId);
}

async function recordWidgetView(widgetId, organizationId, userId) {
  if (!widgetId || !organizationId) return;
  await AnalyticsWidget.updateOne({ _id: widgetId, organizationId }, viewerUpdate(userId));
  if (userId) await trimUniqueViewers(AnalyticsWidget, widgetId, organizationId);
}

async function recordDashboardView(dashboardId, organizationId, userId) {
  if (!dashboardId || !organizationId) return;
  await AnalyticsDashboard.updateOne({ _id: dashboardId, organizationId }, viewerUpdate(userId));
  if (userId) await trimUniqueViewers(AnalyticsDashboard, dashboardId, organizationId);
}

module.exports = {
  recordReportView,
  recordWidgetView,
  recordDashboardView,
};
