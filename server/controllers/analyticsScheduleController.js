const {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  pauseSchedule,
  resumeSchedule,
  archiveSchedule,
  listSnapshots,
  getSnapshotById,
} = require('../services/analyticsScheduleService');
const {
  enqueueScheduleRun,
} = require('../services/analytics/analyticsScheduleQueueService');
const { runAnalyticsSchedule } = require('../services/analytics/analyticsScheduleRunner');

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

async function listAnalyticsSchedules(req, res) {
  try {
    const result = await listSchedules(req.user.organizationId, {
      reportId: req.query.reportId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics schedules');
  }
}

async function getAnalyticsSchedule(req, res) {
  try {
    const schedule = await getScheduleById(req.params.id, req.user.organizationId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }
    return res.json({ success: true, data: schedule });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics schedule');
  }
}

async function createAnalyticsSchedule(req, res) {
  try {
    const schedule = await createSchedule(req.user.organizationId, req.user, req.body || {});
    return res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    return handleError(res, error, 'Error creating analytics schedule');
  }
}

async function updateAnalyticsSchedule(req, res) {
  try {
    const schedule = await updateSchedule(
      req.params.id,
      req.user.organizationId,
      req.user,
      req.body || {}
    );
    return res.json({ success: true, data: schedule });
  } catch (error) {
    return handleError(res, error, 'Error updating analytics schedule');
  }
}

async function deleteAnalyticsSchedule(req, res) {
  try {
    await archiveSchedule(req.params.id, req.user.organizationId, req.user);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Error deleting analytics schedule');
  }
}

async function pauseAnalyticsSchedule(req, res) {
  try {
    const schedule = await pauseSchedule(req.params.id, req.user.organizationId, req.user);
    return res.json({ success: true, data: schedule });
  } catch (error) {
    return handleError(res, error, 'Error pausing analytics schedule');
  }
}

async function resumeAnalyticsSchedule(req, res) {
  try {
    const schedule = await resumeSchedule(req.params.id, req.user.organizationId, req.user);
    return res.json({ success: true, data: schedule });
  } catch (error) {
    return handleError(res, error, 'Error resuming analytics schedule');
  }
}

async function runAnalyticsScheduleNow(req, res) {
  try {
    const schedule = await getScheduleById(req.params.id, req.user.organizationId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const enqueueResult = await enqueueScheduleRun({
      scheduleId: schedule._id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      manual: true,
    });

    if (enqueueResult.mode === 'queued') {
      return res.status(202).json({
        success: true,
        data: { status: 'running', mode: 'queued' },
      });
    }

    const result = await runAnalyticsSchedule({
      scheduleId: schedule._id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      manual: true,
    });

    return res.json({
      success: true,
      data: { status: 'completed', mode: 'inline-fallback', ...result },
    });
  } catch (error) {
    return handleError(res, error, 'Error running analytics schedule');
  }
}

async function listAnalyticsSnapshots(req, res) {
  try {
    const result = await listSnapshots(req.user.organizationId, {
      scheduleId: req.query.scheduleId,
      reportId: req.query.reportId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics snapshots');
  }
}

async function getAnalyticsSnapshot(req, res) {
  try {
    const snapshot = await getSnapshotById(req.params.id, req.user.organizationId);
    if (!snapshot) {
      return res.status(404).json({ success: false, message: 'Snapshot not found' });
    }
    return res.json({ success: true, data: snapshot });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics snapshot');
  }
}

module.exports = {
  listAnalyticsSchedules,
  getAnalyticsSchedule,
  createAnalyticsSchedule,
  updateAnalyticsSchedule,
  deleteAnalyticsSchedule,
  pauseAnalyticsSchedule,
  resumeAnalyticsSchedule,
  runAnalyticsScheduleNow,
  listAnalyticsSnapshots,
  getAnalyticsSnapshot,
};
