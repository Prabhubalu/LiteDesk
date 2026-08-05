const eventStatusService = require('../services/eventStatusService');

/**
 * GET /api/settings/core-modules/events/status-lifecycle
 * Resolved lifecycle status configs for all event types.
 */
exports.getEventStatusLifecycle = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const configs = await eventStatusService.getAllResolvedStatusConfigs(organizationId);
    res.json({
      success: true,
      data: {
        configs,
        categories: ['OPEN', 'DONE', 'CANCELLED'],
      },
    });
  } catch (error) {
    console.error('[getEventStatusLifecycle]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load event status lifecycle',
      error: error.message,
    });
  }
};

/**
 * PUT /api/settings/core-modules/events/status-lifecycle/:eventTypeKey
 * Update status vocabulary for a non-audit event type.
 * Body: { values: StatusValue[] }
 */
exports.updateEventStatusLifecycle = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const eventTypeKey = req.params.eventTypeKey;
    const values = req.body?.values;

    const result = await eventStatusService.updateStatusConfig(
      organizationId,
      eventTypeKey,
      values,
      req.user._id
    );

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.message,
        inUseCount: result.inUseCount,
      });
    }

    res.json({
      success: true,
      message: 'Event status lifecycle updated',
      data: result.config,
    });
  } catch (error) {
    console.error('[updateEventStatusLifecycle]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event status lifecycle',
      error: error.message,
    });
  }
};
