'use strict';

const {
  findEventByManageToken,
  loadBookingConfig,
  publicManagePayload,
  getRescheduleSlots,
  rescheduleAppointment,
  cancelAppointmentByGuest
} = require('../services/appointmentManageService');
const { isEventInOpenLifecycle } = require('../domain/events/eventStatus');

async function resolveManageContext(token) {
  const event = await findEventByManageToken(token);
  if (!event) return { error: 'Appointment not found.', status: 404 };
  const config = await loadBookingConfig(event);
  if (!config) return { error: 'Booking page is no longer available.', status: 404 };
  return { event, config };
}

exports.getManagePage = async (req, res) => {
  try {
    const ctx = await resolveManageContext(req.params.token);
    if (ctx.error) {
      return res.status(ctx.status).json({ success: false, message: ctx.error });
    }
    res.status(200).json({
      success: true,
      data: publicManagePayload(ctx.event, ctx.config)
    });
  } catch (error) {
    console.error('[publicAppointmentManage] getManagePage:', error);
    res.status(500).json({ success: false, message: 'Unable to load appointment.' });
  }
};

exports.getRescheduleSlots = async (req, res) => {
  try {
    const { date, timezone } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });
    }

    const ctx = await resolveManageContext(req.params.token);
    if (ctx.error) {
      return res.status(ctx.status).json({ success: false, message: ctx.error });
    }
    if (!ctx.event.appointment?.manageToken || !isEventInOpenLifecycle(ctx.event)) {
      return res.status(400).json({ success: false, message: 'This appointment cannot be rescheduled.' });
    }

    const slots = await getRescheduleSlots(ctx.event, ctx.config, date);
    res.status(200).json({
      success: true,
      data: {
        date,
        timezone: timezone || ctx.config.workingHours?.timezone || 'UTC',
        slots
      }
    });
  } catch (error) {
    console.error('[publicAppointmentManage] getRescheduleSlots:', error);
    res.status(400).json({ success: false, message: error.message || 'Invalid request' });
  }
};

exports.reschedule = async (req, res) => {
  try {
    const { start } = req.body;
    if (!start) {
      return res.status(400).json({ success: false, message: 'start is required (ISO datetime).' });
    }

    const ctx = await resolveManageContext(req.params.token);
    if (ctx.error) {
      return res.status(ctx.status).json({ success: false, message: ctx.error });
    }

    const event = await rescheduleAppointment(ctx.event, ctx.config, start);
    res.status(200).json({
      success: true,
      data: publicManagePayload(event, ctx.config)
    });
  } catch (error) {
    console.error('[publicAppointmentManage] reschedule:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Reschedule failed.',
      code: error.code
    });
  }
};

exports.cancel = async (req, res) => {
  try {
    const ctx = await resolveManageContext(req.params.token);
    if (ctx.error) {
      return res.status(ctx.status).json({ success: false, message: ctx.error });
    }

    const event = await cancelAppointmentByGuest(ctx.event, req.body?.reason);
    res.status(200).json({
      success: true,
      data: publicManagePayload(event, ctx.config)
    });
  } catch (error) {
    console.error('[publicAppointmentManage] cancel:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Cancellation failed.' });
  }
};
