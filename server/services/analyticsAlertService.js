const mongoose = require('mongoose');
const AnalyticsAlert = require('../models/AnalyticsAlert');
const AnalyticsWidget = require('../models/AnalyticsWidget');
const {
  ANALYTICS_ALERT_STATUSES,
  ANALYTICS_ALERT_OPERATORS,
} = require('../constants/analyticsAlert');

function parseAlertPayload(body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Alert name is required');
    err.statusCode = 400;
    throw err;
  }

  if (!body.widgetId || !mongoose.Types.ObjectId.isValid(body.widgetId)) {
    const err = new Error('Valid widgetId is required');
    err.statusCode = 400;
    throw err;
  }

  const operator = String(body.operator || 'lt').toLowerCase();
  if (!ANALYTICS_ALERT_OPERATORS.includes(operator)) {
    const err = new Error(`operator must be one of: ${ANALYTICS_ALERT_OPERATORS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const threshold = Number(body.threshold);
  if (!Number.isFinite(threshold)) {
    const err = new Error('threshold must be a number');
    err.statusCode = 400;
    throw err;
  }

  const recipientUserIds = Array.isArray(body.recipientUserIds)
    ? body.recipientUserIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
    : [];

  const status =
    body.status && ANALYTICS_ALERT_STATUSES.includes(body.status) ? body.status : 'active';

  return {
    name,
    widgetId: body.widgetId,
    metricField: body.metricField ? String(body.metricField).trim() : null,
    operator,
    threshold,
    status,
    notifyInApp: body.notifyInApp !== false,
    notifyEmail: body.notifyEmail === true,
    recipientUserIds,
  };
}

async function ensurePublishedWidget(widgetId, organizationId) {
  const widget = await AnalyticsWidget.findOne({
    _id: widgetId,
    organizationId,
    status: 'published',
  })
    .select('_id name apiName status ownerId')
    .lean();

  if (!widget) {
    const err = new Error('Published widget not found');
    err.statusCode = 404;
    throw err;
  }
  return widget;
}

function assertCanManageAlert(user, alert) {
  if (!user || !alert) return;
  if (user.isOwner) return;
  const ownerId = alert.ownerId?._id || alert.ownerId;
  if (ownerId && String(ownerId) === String(user._id)) return;
  const err = new Error('You do not have permission to manage this alert');
  err.statusCode = 403;
  throw err;
}

async function listAlerts(organizationId, filters = {}) {
  const query = { organizationId };
  if (filters.widgetId) query.widgetId = filters.widgetId;
  if (filters.status) query.status = filters.status;

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 50, 200);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    AnalyticsAlert.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('widgetId', 'name apiName chartType status')
      .populate('ownerId', 'firstName lastName email')
      .populate('recipientUserIds', 'firstName lastName email')
      .lean(),
    AnalyticsAlert.countDocuments(query),
  ]);

  return {
    data,
    meta: { page, perPage: limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getAlertById(id, organizationId) {
  return AnalyticsAlert.findOne({ _id: id, organizationId })
    .populate('widgetId', 'name apiName chartType status reportId')
    .populate('ownerId', 'firstName lastName email')
    .populate('recipientUserIds', 'firstName lastName email')
    .lean();
}

async function createAlert(organizationId, user, body) {
  const payload = parseAlertPayload(body);
  await ensurePublishedWidget(payload.widgetId, organizationId);

  const recipients =
    payload.recipientUserIds.length > 0 ? payload.recipientUserIds : [user._id];

  const alert = await AnalyticsAlert.create({
    organizationId,
    ...payload,
    recipientUserIds: recipients,
    ownerId: user._id,
    createdBy: user._id,
    updatedBy: user._id,
  });

  return getAlertById(alert._id, organizationId);
}

async function updateAlert(id, organizationId, user, body) {
  const alert = await AnalyticsAlert.findOne({ _id: id, organizationId });
  if (!alert) {
    const err = new Error('Alert not found');
    err.statusCode = 404;
    throw err;
  }
  assertCanManageAlert(user, alert);

  const payload = parseAlertPayload({ ...alert.toObject(), ...body, widgetId: body.widgetId || alert.widgetId });
  if (body.widgetId && String(body.widgetId) !== String(alert.widgetId)) {
    await ensurePublishedWidget(payload.widgetId, organizationId);
  }

  alert.name = payload.name;
  alert.widgetId = payload.widgetId;
  alert.metricField = payload.metricField;
  alert.operator = payload.operator;
  alert.threshold = payload.threshold;
  alert.notifyInApp = payload.notifyInApp;
  alert.notifyEmail = payload.notifyEmail;
  if (payload.recipientUserIds.length) {
    alert.recipientUserIds = payload.recipientUserIds;
  }
  if (body.status && ANALYTICS_ALERT_STATUSES.includes(body.status)) {
    alert.status = body.status;
  }
  alert.updatedBy = user._id;
  await alert.save();

  return getAlertById(alert._id, organizationId);
}

async function deleteAlert(id, organizationId, user) {
  const alert = await AnalyticsAlert.findOne({ _id: id, organizationId });
  if (!alert) {
    const err = new Error('Alert not found');
    err.statusCode = 404;
    throw err;
  }
  assertCanManageAlert(user, alert);
  await AnalyticsAlert.deleteOne({ _id: alert._id });
}

async function pauseAlert(id, organizationId, user) {
  return updateAlert(id, organizationId, user, { status: 'paused' });
}

async function resumeAlert(id, organizationId, user) {
  return updateAlert(id, organizationId, user, { status: 'active' });
}

module.exports = {
  listAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  deleteAlert,
  pauseAlert,
  resumeAlert,
};
