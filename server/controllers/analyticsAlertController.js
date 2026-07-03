const {
  listAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  deleteAlert,
  pauseAlert,
  resumeAlert,
} = require('../services/analyticsAlertService');

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

async function listAnalyticsAlerts(req, res) {
  try {
    const result = await listAlerts(req.user.organizationId, {
      widgetId: req.query.widgetId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics alerts');
  }
}

async function getAnalyticsAlert(req, res) {
  try {
    const alert = await getAlertById(req.params.id, req.user.organizationId);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    return res.json({ success: true, data: alert });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics alert');
  }
}

async function createAnalyticsAlert(req, res) {
  try {
    const alert = await createAlert(req.user.organizationId, req.user, req.body || {});
    return res.status(201).json({ success: true, data: alert });
  } catch (error) {
    return handleError(res, error, 'Error creating analytics alert');
  }
}

async function updateAnalyticsAlert(req, res) {
  try {
    const alert = await updateAlert(
      req.params.id,
      req.user.organizationId,
      req.user,
      req.body || {}
    );
    return res.json({ success: true, data: alert });
  } catch (error) {
    return handleError(res, error, 'Error updating analytics alert');
  }
}

async function deleteAnalyticsAlert(req, res) {
  try {
    await deleteAlert(req.params.id, req.user.organizationId, req.user);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Error deleting analytics alert');
  }
}

async function pauseAnalyticsAlert(req, res) {
  try {
    const alert = await pauseAlert(req.params.id, req.user.organizationId, req.user);
    return res.json({ success: true, data: alert });
  } catch (error) {
    return handleError(res, error, 'Error pausing analytics alert');
  }
}

async function resumeAnalyticsAlert(req, res) {
  try {
    const alert = await resumeAlert(req.params.id, req.user.organizationId, req.user);
    return res.json({ success: true, data: alert });
  } catch (error) {
    return handleError(res, error, 'Error resuming analytics alert');
  }
}

module.exports = {
  listAnalyticsAlerts,
  getAnalyticsAlert,
  createAnalyticsAlert,
  updateAnalyticsAlert,
  deleteAnalyticsAlert,
  pauseAnalyticsAlert,
  resumeAnalyticsAlert,
};
