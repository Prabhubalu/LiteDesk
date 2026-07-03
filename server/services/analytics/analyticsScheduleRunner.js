const AnalyticsSchedule = require('../../models/AnalyticsSchedule');
const AnalyticsSnapshot = require('../../models/AnalyticsSnapshot');
const AnalyticsReport = require('../../models/AnalyticsReport');
const AnalyticsDashboard = require('../../models/AnalyticsDashboard');
const AnalyticsWidget = require('../../models/AnalyticsWidget');
const User = require('../../models/User');
const emailService = require('../emailService');
const {
  resultToCsv,
  resultToXlsxBuffer,
  resultToXlsxWorkbook,
  resultToPdfBuffer,
  fileExtensionForFormat,
} = require('./analyticsExportService');
const { runAnalyticsReportWithLogging } = require('./analyticsExecutionService');
const { materializeRuntimePermissionsOnUser } = require('../runtimePermissionResolver');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');

function normalizeRecipients(recipients) {
  if (!Array.isArray(recipients)) return [];
  return recipients
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry) => entry.includes('@'));
}

async function sendScheduleEmail({ schedule, assetName, attachment, filename, contentType, organizationId }) {
  const recipients = normalizeRecipients(schedule.recipients);
  if (!recipients.length) {
    return { sent: false, reason: 'no_recipients' };
  }

  const subject =
    String(schedule.emailSubject || '').trim() || `Scheduled delivery: ${assetName}`;
  const formatLabel = String(schedule.exportFormat || 'csv').toUpperCase();

  const sendResult = await emailService.sendSystemEmail({
    organizationId,
    to: recipients,
    subject,
    text: `Your scheduled analytics delivery "${assetName}" is attached (${formatLabel}).`,
    html: `<p>Your scheduled analytics delivery <strong>${assetName}</strong> is attached (${formatLabel}).</p>`,
    attachments: [
      {
        filename,
        content: attachment,
        contentType,
      },
    ],
    moduleKey: 'reports',
    tags: ['analytics', 'schedule'],
  });

  if (!sendResult?.success) {
    throw new Error(sendResult?.error || 'Failed to send schedule email');
  }

  return { sent: true, recipients };
}

async function resolveWidgetReport(widget, organizationId) {
  const query = {
    _id: widget.reportId,
    organizationId,
    status: 'published',
  };
  if (widget.reportVersion) query.version = widget.reportVersion;
  return AnalyticsReport.findOne(query).lean();
}

async function executeDashboardWidgetResults(dashboard, user, organizationId) {
  const layout = Array.isArray(dashboard.layout) ? dashboard.layout : [];
  const widgetIds = layout.map((item) => item.widgetId).filter(Boolean);
  const widgets = await AnalyticsWidget.find({
    _id: { $in: widgetIds },
    organizationId,
    status: 'published',
  }).lean();

  const widgetMap = new Map(widgets.map((widget) => [String(widget._id), widget]));
  const results = [];

  for (const item of layout) {
    const widget = widgetMap.get(String(item.widgetId));
    if (!widget) continue;
    const report = await resolveWidgetReport(widget, organizationId);
    if (!report) continue;
    const { result } = await runAnalyticsReportWithLogging(report, {
      organizationId,
      user,
      preview: false,
    });
    results.push({ widget, result });
  }

  return results;
}

async function buildScheduleAttachment({ schedule, assetName, result, widgetResults = [] }) {
  const format = String(schedule.exportFormat || 'csv').toLowerCase();
  const safeName = String(assetName || 'analytics')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);
  const ext = fileExtensionForFormat(format);
  const filename = `${safeName}_${Date.now()}.${ext}`;

  if (format === 'xlsx' && widgetResults.length) {
    const buffer = await resultToXlsxWorkbook(
      widgetResults.map(({ widget, result: widgetResult }) => ({
        sheetName: widget.name || widget.apiName || 'Widget',
        result: widgetResult,
      }))
    );
    return {
      attachment: Buffer.from(buffer),
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  if (format === 'xlsx') {
    const buffer = await resultToXlsxBuffer(result, assetName);
    return {
      attachment: Buffer.from(buffer),
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  if (format === 'pdf') {
    const pdfSource = widgetResults[0]?.result || result;
    const buffer = await resultToPdfBuffer(pdfSource, assetName);
    return {
      attachment: buffer,
      filename,
      contentType: 'application/pdf',
    };
  }

  const csvSource = widgetResults[0]?.result || result;
  return {
    attachment: Buffer.from(resultToCsv(csvSource), 'utf8'),
    filename,
    contentType: 'text/csv',
  };
}

/**
 * Execute a schedule: run report or dashboard, materialize snapshot, optional email delivery.
 */
async function runAnalyticsSchedule({
  scheduleId,
  organizationId,
  userId,
  manual = false,
}) {
  return runWithOrganizationTenantContext(organizationId, async () => {
    const schedule = await AnalyticsSchedule.findOne({
      _id: scheduleId,
      organizationId,
    });

    if (!schedule) {
      const err = new Error('Schedule not found');
      err.statusCode = 404;
      throw err;
    }

    if (!manual && schedule.status !== 'active') {
      await AnalyticsSchedule.updateOne(
        { _id: schedule._id, organizationId },
        {
          $set: {
            lastRunAt: new Date(),
            lastRunStatus: 'skipped',
            lastError: null,
          },
        }
      );
      return { skipped: true, reason: 'not_active' };
    }

    const actorId = userId || schedule.ownerId;
    const user = await User.findById(actorId);
    if (!user) {
      const err = new Error('Schedule owner not found');
      err.statusCode = 400;
      throw err;
    }
    await materializeRuntimePermissionsOnUser(user);

    const assetType = String(schedule.assetType || 'report').toLowerCase();
    let report = null;
    let dashboard = null;

    if (assetType === 'dashboard') {
      dashboard = await AnalyticsDashboard.findOne({
        _id: schedule.dashboardId,
        organizationId,
        status: 'published',
      }).lean();
    } else {
      report = await AnalyticsReport.findOne({
        _id: schedule.reportId,
        organizationId,
        status: 'published',
      }).lean();
    }

    if (!report && !dashboard) {
      const errorMessage =
        assetType === 'dashboard'
          ? 'Dashboard not found or not published'
          : 'Report not found or not published';

      await AnalyticsSchedule.updateOne(
        { _id: schedule._id, organizationId },
        {
          $set: {
            lastRunAt: new Date(),
            lastRunStatus: 'failed',
            lastError: errorMessage,
          },
        }
      );

      await AnalyticsSnapshot.create({
        organizationId,
        scheduleId: schedule._id,
        reportId: schedule.reportId,
        status: 'failed',
        error: errorMessage,
        capturedAt: new Date(),
        manual: Boolean(manual),
        triggeredBy: actorId,
        emailRecipients: normalizeRecipients(schedule.recipients),
      });

      const err = new Error(errorMessage);
      err.statusCode = 400;
      throw err;
    }

    let executionId = null;
    let result = null;
    let widgetResults = [];
    let emailSent = false;
    let emailRecipients = [];
    const assetName = dashboard?.name || report?.name || 'Analytics';

    try {
      if (dashboard) {
        widgetResults = await executeDashboardWidgetResults(dashboard, user, organizationId);
        result = widgetResults[0]?.result || { columns: [], rows: [], meta: { totalRows: 0 } };
      } else {
        const runResult = await runAnalyticsReportWithLogging(report, {
          organizationId,
          user,
          preview: false,
        });
        executionId = runResult.executionId;
        result = runResult.result;
      }

      const snapshot = await AnalyticsSnapshot.create({
        organizationId,
        scheduleId: schedule._id,
        reportId: report?._id || schedule.reportId || null,
        reportVersion: report?.version || null,
        executionId,
        status: 'success',
        result,
        rowCount: result?.meta?.totalRows ?? result?.rows?.length ?? 0,
        capturedAt: new Date(),
        manual: Boolean(manual),
        triggeredBy: actorId,
        emailRecipients: normalizeRecipients(schedule.recipients),
      });

      const attachmentPayload = await buildScheduleAttachment({
        schedule,
        assetName,
        result,
        widgetResults,
      });

      const emailResult = await sendScheduleEmail({
        schedule,
        assetName,
        attachment: attachmentPayload.attachment,
        filename: attachmentPayload.filename,
        contentType: attachmentPayload.contentType,
        organizationId,
      });
      emailSent = emailResult.sent === true;
      emailRecipients = emailResult.recipients || [];

      if (emailSent) {
        await AnalyticsSnapshot.updateOne(
          { _id: snapshot._id, organizationId },
          { $set: { emailSent: true, emailRecipients } }
        );
      }

      await AnalyticsSchedule.updateOne(
        { _id: schedule._id, organizationId },
        {
          $set: {
            lastRunAt: new Date(),
            lastRunStatus: 'success',
            lastError: null,
            lastSnapshotId: snapshot._id,
          },
        }
      );

      return {
        scheduleId: schedule._id,
        snapshotId: snapshot._id,
        executionId,
        emailSent,
        rowCount: snapshot.rowCount,
      };
    } catch (error) {
      await AnalyticsSnapshot.create({
        organizationId,
        scheduleId: schedule._id,
        reportId: report?._id || schedule.reportId || null,
        reportVersion: report?.version || null,
        executionId,
        status: 'failed',
        error: error.message,
        capturedAt: new Date(),
        manual: Boolean(manual),
        triggeredBy: actorId,
        emailRecipients: normalizeRecipients(schedule.recipients),
      });

      await AnalyticsSchedule.updateOne(
        { _id: schedule._id, organizationId },
        {
          $set: {
            lastRunAt: new Date(),
            lastRunStatus: 'failed',
            lastError: error.message,
          },
        }
      );

      throw error;
    }
  });
}

module.exports = {
  runAnalyticsSchedule,
  normalizeRecipients,
};
