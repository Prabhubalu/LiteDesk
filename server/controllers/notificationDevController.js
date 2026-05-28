const {
  isSimulationEnabled,
  SIMULATABLE_EVENTS,
  simulateHelpdeskNotification
} = require('../services/notificationDevSimulator');

/**
 * POST /api/notifications/dev/simulate
 * Dev-only: trigger helpdesk notification (self = direct to you, pipeline = real rules).
 */
exports.simulateHelpdesk = async (req, res) => {
  if (!isSimulationEnabled()) {
    return res.status(403).json({
      success: false,
      message: 'Notification simulation is disabled. Set NODE_ENV=development or ENABLE_NOTIFICATION_SIMULATE=true.'
    });
  }

  const eventType = String(req.body?.eventType || '').trim();
  const mode = String(req.body?.mode || 'self').trim().toLowerCase();
  const caseId = req.body?.caseId ? String(req.body.caseId).trim() : null;

  if (!eventType) {
    return res.status(400).json({
      success: false,
      message: 'eventType is required',
      allowed: SIMULATABLE_EVENTS
    });
  }

  if (!['self', 'pipeline'].includes(mode)) {
    return res.status(400).json({
      success: false,
      message: 'mode must be "self" or "pipeline"'
    });
  }

  try {
    const result = await simulateHelpdeskNotification({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      eventType,
      mode,
      caseId,
      triggeredBy: req.user._id
    });

    return res.json({
      success: true,
      message: `Simulated ${eventType} (${result.mode})`,
      result,
      hint: mode === 'self'
        ? 'Open /helpdesk/ in the app with the notification bell connected. You should see badge, toast, and sound.'
        : 'Pipeline mode uses real recipient rules — you may not receive it if you are not a target.'
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Simulation failed'
    });
  }
};

exports.simulateHelpdeskMeta = async (_req, res) => {
  if (!isSimulationEnabled()) {
    return res.status(403).json({ success: false, enabled: false });
  }
  return res.json({
    success: true,
    enabled: true,
    events: SIMULATABLE_EVENTS,
    modes: ['self', 'pipeline']
  });
};
