const AnalyticsSchedule = require('../models/AnalyticsSchedule');
const AnalyticsSnapshot = require('../models/AnalyticsSnapshot');
const AnalyticsReport = require('../models/AnalyticsReport');
const AnalyticsDashboard = require('../models/AnalyticsDashboard');
const {
  buildCronExpression,
  ANALYTICS_SCHEDULE_FREQUENCIES,
  ANALYTICS_SCHEDULE_STATUSES,
  ANALYTICS_SCHEDULE_EXPORT_FORMATS,
} = require('../constants/analyticsSchedule');
const {
  registerRepeatableSchedule,
  removeRepeatableForSchedule,
} = require('./analytics/analyticsScheduleQueueService');
const { normalizeRecipients } = require('./analytics/analyticsScheduleRunner');

function parseSchedulePayload(body = {}) {
  const frequency = String(body.frequency || 'weekly').toLowerCase();
  if (!ANALYTICS_SCHEDULE_FREQUENCIES.includes(frequency)) {
    const err = new Error(`frequency must be one of: ${ANALYTICS_SCHEDULE_FREQUENCIES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const recipients = normalizeRecipients(body.recipients);
  if (!recipients.length) {
    const err = new Error('At least one recipient email is required');
    err.statusCode = 400;
    throw err;
  }

  const assetType = String(body.assetType || 'report').toLowerCase();
  if (!['report', 'dashboard'].includes(assetType)) {
    const err = new Error('assetType must be report or dashboard');
    err.statusCode = 400;
    throw err;
  }

  const exportFormat = String(body.exportFormat || 'csv').toLowerCase();
  if (!ANALYTICS_SCHEDULE_EXPORT_FORMATS.includes(exportFormat)) {
    const err = new Error(`exportFormat must be one of: ${ANALYTICS_SCHEDULE_EXPORT_FORMATS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  return {
    name: String(body.name || '').trim(),
    assetType,
    reportId: body.reportId || null,
    dashboardId: body.dashboardId || null,
    frequency,
    timezone: String(body.timezone || 'UTC').trim() || 'UTC',
    hour: Math.min(Math.max(Number(body.hour ?? 9), 0), 23),
    minute: Math.min(Math.max(Number(body.minute ?? 0), 0), 59),
    dayOfWeek: Math.min(Math.max(Number(body.dayOfWeek ?? 1), 0), 6),
    dayOfMonth: Math.min(Math.max(Number(body.dayOfMonth ?? 1), 1), 28),
    recipients,
    exportFormat,
    emailSubject: body.emailSubject ? String(body.emailSubject).trim() : null,
    status: body.status && ANALYTICS_SCHEDULE_STATUSES.includes(body.status) ? body.status : 'active',
  };
}

async function ensurePublishedDashboard(dashboardId, organizationId) {
  const dashboard = await AnalyticsDashboard.findOne({
    _id: dashboardId,
    organizationId,
    status: 'published',
  })
    .select('_id name apiName status')
    .lean();

  if (!dashboard) {
    const err = new Error('Published dashboard not found');
    err.statusCode = 404;
    throw err;
  }
  return dashboard;
}

async function ensurePublishedReport(reportId, organizationId) {
  const report = await AnalyticsReport.findOne({
    _id: reportId,
    organizationId,
    status: 'published',
  })
    .select('_id name apiName status')
    .lean();

  if (!report) {
    const err = new Error('Published report not found');
    err.statusCode = 404;
    throw err;
  }
  return report;
}

async function syncScheduleRepeatJob(schedule) {
  const cronExpression = buildCronExpression(schedule);
  schedule.cronExpression = cronExpression;
  await schedule.save();

  if (schedule.status === 'active') {
    await registerRepeatableSchedule(schedule);
  } else {
    await removeRepeatableForSchedule(schedule);
  }
}

async function listSchedules(organizationId, filters = {}) {
  const query = { organizationId, status: { $ne: 'archived' } };
  if (filters.reportId) query.reportId = filters.reportId;
  if (filters.status) query.status = filters.status;

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 50, 100);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    AnalyticsSchedule.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reportId', 'name apiName status type primaryModule')
      .populate('dashboardId', 'name apiName status category')
      .populate('ownerId', 'firstName lastName email')
      .lean(),
    AnalyticsSchedule.countDocuments(query),
  ]);

  return {
    data,
    meta: { page, perPage: limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getScheduleById(scheduleId, organizationId) {
  return AnalyticsSchedule.findOne({ _id: scheduleId, organizationId })
    .populate('reportId', 'name apiName status type primaryModule version')
    .populate('dashboardId', 'name apiName status category')
    .populate('ownerId', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .lean();
}

async function createSchedule(organizationId, user, body) {
  const payload = parseSchedulePayload(body);
  if (!payload.name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }

  if (payload.assetType === 'dashboard') {
    if (!payload.dashboardId) {
      const err = new Error('dashboardId is required for dashboard schedules');
      err.statusCode = 400;
      throw err;
    }
    await ensurePublishedDashboard(payload.dashboardId, organizationId);
    payload.reportId = null;
  } else {
    if (!payload.reportId) {
      const err = new Error('reportId is required for report schedules');
      err.statusCode = 400;
      throw err;
    }
    await ensurePublishedReport(payload.reportId, organizationId);
    payload.dashboardId = null;
  }

  const schedule = await AnalyticsSchedule.create({
    ...payload,
    organizationId,
    ownerId: user._id,
    createdBy: user._id,
    updatedBy: user._id,
    cronExpression: buildCronExpression(payload),
  });

  await syncScheduleRepeatJob(schedule);
  return getScheduleById(schedule._id, organizationId);
}

async function updateSchedule(scheduleId, organizationId, user, body) {
  const schedule = await AnalyticsSchedule.findOne({ _id: scheduleId, organizationId });
  if (!schedule) {
    const err = new Error('Schedule not found');
    err.statusCode = 404;
    throw err;
  }

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) {
      const err = new Error('name is required');
      err.statusCode = 400;
      throw err;
    }
    schedule.name = name;
  }

  if (body.reportId !== undefined) {
    await ensurePublishedReport(body.reportId, organizationId);
    schedule.reportId = body.reportId;
    schedule.assetType = 'report';
    schedule.dashboardId = null;
  }

  if (body.dashboardId !== undefined) {
    await ensurePublishedDashboard(body.dashboardId, organizationId);
    schedule.dashboardId = body.dashboardId;
    schedule.assetType = 'dashboard';
    schedule.reportId = null;
  }

  if (body.assetType !== undefined) {
    schedule.assetType = String(body.assetType).toLowerCase();
  }

  if (body.exportFormat !== undefined) {
    const exportFormat = String(body.exportFormat).toLowerCase();
    if (!ANALYTICS_SCHEDULE_EXPORT_FORMATS.includes(exportFormat)) {
      const err = new Error(`exportFormat must be one of: ${ANALYTICS_SCHEDULE_EXPORT_FORMATS.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    schedule.exportFormat = exportFormat;
  }

  if (body.frequency !== undefined) {
    const frequency = String(body.frequency).toLowerCase();
    if (!ANALYTICS_SCHEDULE_FREQUENCIES.includes(frequency)) {
      const err = new Error(`frequency must be one of: ${ANALYTICS_SCHEDULE_FREQUENCIES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    schedule.frequency = frequency;
  }

  if (body.timezone !== undefined) schedule.timezone = String(body.timezone || 'UTC').trim() || 'UTC';
  if (body.hour !== undefined) schedule.hour = Math.min(Math.max(Number(body.hour), 0), 23);
  if (body.minute !== undefined) schedule.minute = Math.min(Math.max(Number(body.minute), 0), 59);
  if (body.dayOfWeek !== undefined) schedule.dayOfWeek = Math.min(Math.max(Number(body.dayOfWeek), 0), 6);
  if (body.dayOfMonth !== undefined) schedule.dayOfMonth = Math.min(Math.max(Number(body.dayOfMonth), 1), 28);

  if (body.recipients !== undefined) {
    const recipients = normalizeRecipients(body.recipients);
    if (!recipients.length) {
      const err = new Error('At least one recipient email is required');
      err.statusCode = 400;
      throw err;
    }
    schedule.recipients = recipients;
  }

  if (body.emailSubject !== undefined) {
    schedule.emailSubject = body.emailSubject ? String(body.emailSubject).trim() : null;
  }

  if (body.status !== undefined) {
    if (!ANALYTICS_SCHEDULE_STATUSES.includes(body.status)) {
      const err = new Error('Invalid schedule status');
      err.statusCode = 400;
      throw err;
    }
    schedule.status = body.status;
  }

  schedule.updatedBy = user._id;
  await syncScheduleRepeatJob(schedule);
  return getScheduleById(schedule._id, organizationId);
}

async function pauseSchedule(scheduleId, organizationId, user) {
  return updateSchedule(scheduleId, organizationId, user, { status: 'paused' });
}

async function resumeSchedule(scheduleId, organizationId, user) {
  return updateSchedule(scheduleId, organizationId, user, { status: 'active' });
}

async function archiveSchedule(scheduleId, organizationId, user) {
  const schedule = await AnalyticsSchedule.findOne({ _id: scheduleId, organizationId });
  if (!schedule) {
    const err = new Error('Schedule not found');
    err.statusCode = 404;
    throw err;
  }

  schedule.status = 'archived';
  schedule.updatedBy = user._id;
  await removeRepeatableForSchedule(schedule);
  await schedule.save();
  return { success: true };
}

async function listSnapshots(organizationId, filters = {}) {
  const query = { organizationId };
  if (filters.scheduleId) query.scheduleId = filters.scheduleId;
  if (filters.reportId) query.reportId = filters.reportId;
  if (filters.status) query.status = filters.status;

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 25, 100);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    AnalyticsSnapshot.find(query)
      .sort({ capturedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-result.rows')
      .populate('scheduleId', 'name frequency status')
      .populate('reportId', 'name apiName type')
      .populate('triggeredBy', 'firstName lastName email')
      .lean(),
    AnalyticsSnapshot.countDocuments(query),
  ]);

  return {
    data,
    meta: { page, perPage: limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getSnapshotById(snapshotId, organizationId) {
  return AnalyticsSnapshot.findOne({ _id: snapshotId, organizationId })
    .populate('scheduleId', 'name frequency status recipients')
    .populate('reportId', 'name apiName type primaryModule version')
    .populate('triggeredBy', 'firstName lastName email')
    .lean();
}

module.exports = {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  pauseSchedule,
  resumeSchedule,
  archiveSchedule,
  listSnapshots,
  getSnapshotById,
};
