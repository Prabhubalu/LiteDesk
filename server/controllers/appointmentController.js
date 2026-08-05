const Event = require('../models/Event');
const { emitAppointmentDomainEvent } = require('../services/appointmentDomainEvents');
const { buildManageUrl, generateManageToken } = require('../utils/appointmentManageToken');
const {
  resolveEventBookingConfig,
  getRescheduleSlots,
  rescheduleAppointment
} = require('../services/appointmentManageService');
const { isEventInOpenLifecycle } = require('../domain/events/eventStatus');

async function findAppointmentEvent(req) {
  return Event.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
    'appointment.isAppointment': true,
    deletedAt: null
  });
}

function pushStatusAudit(event, actorUserId, from, to, metadata = {}) {
  event.auditHistory = event.auditHistory || [];
  event.auditHistory.push({
    timestamp: new Date(),
    actorUserId,
    action: 'status_changed',
    from,
    to,
    metadata
  });
}

exports.getAppointmentStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { startDate, endDate } = req.query;
    const match = {
      organizationId,
      deletedAt: null,
      'appointment.isAppointment': true
    };
    if (startDate || endDate) {
      match.startDateTime = {};
      if (startDate) match.startDateTime.$gte = new Date(startDate);
      if (endDate) match.startDateTime.$lte = new Date(endDate);
    }

    const now = new Date();
    const [total, completed, cancelled, byType, explicitNoShow, implicitNoShow] = await Promise.all([
      Event.countDocuments(match),
      Event.countDocuments({ ...match, status: 'Completed' }),
      Event.countDocuments({ ...match, status: 'Cancelled' }),
      Event.aggregate([
        { $match: match },
        { $group: { _id: '$appointment.appointmentType', count: { $sum: 1 } } }
      ]),
      Event.countDocuments({ ...match, 'appointment.noShow': true }),
      Event.countDocuments({
        ...match,
        status: 'Planned',
        'appointment.noShow': { $ne: true },
        endDateTime: { $lt: now }
      })
    ]);

    const noShowCount = explicitNoShow + implicitNoShow;

    res.status(200).json({
      success: true,
      data: {
        totalAppointments: total,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShowCount,
        noShowRate: total > 0 ? Math.round((noShowCount / total) * 100) : 0,
        byType: byType.reduce((acc, row) => {
          acc[row._id || 'other'] = row.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const event = await findAppointmentEvent(req);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (!isEventInOpenLifecycle(event)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an appointment with status "${event.status}".`
      });
    }

    const previousStatus = event.status;
    event.status = 'Cancelled';
    event.cancelledAt = new Date();
    event.cancelledBy = req.user._id;
    event.cancellationReason = req.body?.reason || 'Cancelled';
    event.modifiedBy = req.user._id;
    event.modifiedTime = new Date();
    if (event.appointment) {
      event.appointment.cancellationSource = req.body?.source === 'customer' ? 'customer' : 'user';
      event.appointment.reminderStatus = 'none';
    }
    pushStatusAudit(event, req.user._id, previousStatus, 'Cancelled', {
      reason: event.cancellationReason
    });

    try {
      const { syncExternalCalendarOnCancel } = require('../services/appointmentCalendarSyncService');
      await syncExternalCalendarOnCancel(event);
    } catch (err) {
      console.warn('[appointmentController] external calendar cancel sync failed:', err.message);
    }

    await event.save();

    try {
      emitAppointmentDomainEvent('appointment.cancelled', event, {
        triggeredBy: req.user._id,
        previousState: { status: previousStatus },
        appKey: 'SALES'
      });
    } catch (err) {
      console.warn('[appointmentController] domain event emit failed:', err.message);
    }

    try {
      const {
        sendAppointmentCancellationEmail
      } = require('../services/appointmentConfirmationEmailService');
      await sendAppointmentCancellationEmail({
        event,
        reason: event.cancellationReason
      });
    } catch (err) {
      console.warn('[appointmentController] cancellation email failed:', err.message);
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeAppointment = async (req, res) => {
  try {
    const event = await findAppointmentEvent(req);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (!isEventInOpenLifecycle(event)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete an appointment with status "${event.status}".`
      });
    }

    if (event.appointment?.noShow) {
      return res.status(400).json({
        success: false,
        message: 'This appointment was marked as a no-show. Clear that state before completing.'
      });
    }

    const previousStatus = event.status;
    const now = new Date();
    event.status = 'Completed';
    event.completedAt = event.completedAt || now;
    event.modifiedBy = req.user._id;
    event.modifiedTime = now;
    pushStatusAudit(event, req.user._id, previousStatus, 'Completed', {
      source: 'appointment_complete'
    });

    await event.save();

    try {
      emitAppointmentDomainEvent('appointment.completed', event, {
        triggeredBy: req.user._id,
        previousState: { status: previousStatus },
        appKey: 'SALES'
      });
    } catch (err) {
      console.warn('[appointmentController] domain event emit failed:', err.message);
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAppointmentNoShow = async (req, res) => {
  try {
    const event = await findAppointmentEvent(req);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (!isEventInOpenLifecycle(event)) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark no-show when status is "${event.status}".`
      });
    }

    if (event.appointment?.noShow) {
      return res.status(400).json({ success: false, message: 'Already marked as no-show.' });
    }

    const now = new Date();
    if (!event.appointment) {
      event.appointment = { isAppointment: true };
    }
    const prevStatus = event.status;
    event.appointment.noShow = true;
    event.appointment.noShowMarkedAt = now;
    event.status = 'No Show';
    event.statusCategory = 'CANCELLED';
    event.cancelledAt = now;
    event.cancelledBy = req.user._id;
    event.modifiedBy = req.user._id;
    event.modifiedTime = now;
    pushStatusAudit(event, req.user._id, prevStatus, 'No Show', {
      action: 'no_show',
      reason: req.body?.reason || 'Marked as no-show'
    });

    await event.save();

    try {
      emitAppointmentDomainEvent('appointment.no_show', event, {
        triggeredBy: req.user._id,
        previousState: { status: prevStatus, noShow: false },
        appKey: 'SALES'
      });
    } catch (err) {
      console.warn('[appointmentController] domain event emit failed:', err.message);
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Guest self-service link (for hosts to share with bookers). */
exports.getGuestManageLink = async (req, res) => {
  try {
    const event = await findAppointmentEvent(req);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    let token = event.appointment?.manageToken;
    if (!token) {
      if (!event.appointment) event.appointment = { isAppointment: true };
      token = generateManageToken();
      event.appointment.manageToken = token;
      event.markModified('appointment');
      await event.save();
    }
    if (!isEventInOpenLifecycle(event)) {
      return res.status(400).json({
        success: false,
        message: 'Manage link is only available for planned appointments.'
      });
    }
    res.status(200).json({
      success: true,
      data: {
        manageUrl: buildManageUrl(token),
        bookedByEmail: event.appointment?.bookedByEmail || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Available slots for host reschedule (same rules as guest self-service). */
exports.getEventRescheduleSlots = async (req, res) => {
  try {
    const event = await findAppointmentEvent(req);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (!isEventInOpenLifecycle(event) || event.appointment?.noShow) {
      return res.status(400).json({
        success: false,
        message: 'Only planned appointments can be rescheduled.'
      });
    }

    const date = req.query.date;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param is required (YYYY-MM-DD).' });
    }

    const config = await resolveEventBookingConfig(event);
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Booking configuration not found for this appointment.'
      });
    }

    const slots = await getRescheduleSlots(event, config, date);
    res.status(200).json({
      success: true,
      data: {
        slots,
        timezone: config.workingHours?.timezone || 'UTC',
        slotDurationMinutes: config.slotDurationMinutes || 30
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Host reschedule from CRM event record. */
exports.rescheduleEvent = async (req, res) => {
  try {
    const { start, notifyGuest } = req.body;
    if (!start) {
      return res.status(400).json({ success: false, message: 'start is required (ISO datetime).' });
    }

    const event = await findAppointmentEvent(req);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const config = await resolveEventBookingConfig(event);
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Booking configuration not found for this appointment.'
      });
    }

    const updated = await rescheduleAppointment(event, config, start, {
      actorUserId: req.user._id,
      source: 'host_record',
      notifyGuest: notifyGuest !== false
    });

    res.status(200).json({
      success: true,
      data: {
        _id: updated._id,
        eventId: updated.eventId || updated._id,
        startDateTime: updated.startDateTime,
        endDateTime: updated.endDateTime,
        status: updated.status
      }
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Reschedule failed.',
      code: error.code
    });
  }
};
