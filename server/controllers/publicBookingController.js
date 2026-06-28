const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
const User = require('../models/User');
const { getSlotsForDate } = require('../services/appointmentAvailabilityService');
const { resolveScheduleForBookingConfig, getDisplayTimezone } = require('../services/appointmentBusinessHoursService');
const { describeDayAvailability } = require('../services/businessHoursEngine');
const { getTeamSlotsForDate, loadTeamMembersPublic, pickTeamAssignee } = require('../services/appointmentTeamService');
const { bookAppointment } = require('../services/appointmentBookingService');
const { buildManageUrl } = require('../utils/appointmentManageToken');
const {
  findPublicBookingConfigBySlug,
  withPublicBookingTenantContext
} = require('../services/appointmentBookingPublicService');

function publicConfigPayload(config, host, extras = {}) {
  return {
    slug: config.slug,
    displayName: config.displayName,
    enabled: config.enabled,
    ownerType: config.ownerType || 'user',
    slotDurationMinutes: config.slotDurationMinutes,
    bufferMinutes: config.bufferMinutes,
    appointmentTypes: config.appointmentTypes || ['consultation'],
    customFields: (config.customFields || []).map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options
    })),
    branding: config.branding,
    workingHours: config.workingHours,
    availableDays: config.availableDays,
    host: host
      ? {
          name: host.displayName || `${host.firstName || ''} ${host.lastName || ''}`.trim(),
          avatar: host.avatar || null
        }
      : null,
    ...extras
  };
}

async function resolvePublicBookingConfig(slug) {
  const match = await findPublicBookingConfigBySlug(slug);
  if (!match) return null;

  return withPublicBookingTenantContext(match, () =>
    AppointmentBookingConfig.findOne({
      _id: match._id,
      organizationId: match.organizationId,
      slug: String(slug).trim().toLowerCase(),
      enabled: true
    })
  );
}

exports.getPublicPage = async (req, res) => {
  try {
    const config = await resolvePublicBookingConfig(req.params.slug);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Booking page not found.' });
    }

    const lean = config.toObject ? config.toObject() : config;

    if (lean.ownerType === 'team') {
      const members = await loadTeamMembersPublic(lean.memberUserIds);
      return res.status(200).json({
        success: true,
        data: publicConfigPayload(lean, null, {
          isTeam: true,
          members,
          assignmentStrategy: lean.assignmentStrategy
        })
      });
    }

    const host = await User.findById(lean.assignedTo)
      .select('firstName lastName username avatar')
      .lean();

    res.status(200).json({
      success: true,
      data: publicConfigPayload(lean, host, { isTeam: false })
    });
  } catch (error) {
    console.error('[publicBooking] getPublicPage:', error);
    res.status(500).json({ success: false, message: 'Unable to load booking page.' });
  }
};

exports.getPublicSlots = async (req, res) => {
  try {
    const { date, timezone } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });
    }

    const config = await resolvePublicBookingConfig(req.params.slug);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Booking page not found.' });
    }

    const lean = config.toObject ? config.toObject() : config;
    let slots;
    let scheduleTimezone = timezone || lean.workingHours?.timezone || 'UTC';
    let dayMeta = null;

    if (lean.ownerType === 'team') {
      slots = await getTeamSlotsForDate(lean, date);
      const resolved = await resolveScheduleForBookingConfig(
        lean,
        lean.organizationId,
        lean.assignedTo
      );
      scheduleTimezone = getDisplayTimezone(lean, resolved);
      dayMeta = describeDayAvailability(resolved.schedule, date);
    } else {
      const result = await getSlotsForDate(
        lean,
        date,
        lean.assignedTo,
        lean.organizationId
      );
      slots = result.slots;
      scheduleTimezone = result.timezone || scheduleTimezone;
      dayMeta = result.dayMeta;
    }

    res.status(200).json({
      success: true,
      data: {
        date,
        timezone: scheduleTimezone,
        visitorTimezone: timezone || null,
        dayClosed: Boolean(dayMeta?.closed),
        dayClosedReason: dayMeta?.closed ? dayMeta.reason : null,
        slots
      }
    });
  } catch (error) {
    console.error('[publicBooking] getPublicSlots:', error);
    res.status(400).json({ success: false, message: error.message || 'Invalid request' });
  }
};

exports.submitBooking = async (req, res) => {
  try {
    const config = await resolvePublicBookingConfig(req.params.slug);
    if (!config) {
      return res.status(404).json({ success: false, message: 'Booking page not found.' });
    }

    const {
      start,
      appointmentType,
      customerTimezone,
      guest,
      formResponses
    } = req.body;

    if (!start || !guest?.email || !guest?.firstName) {
      return res.status(400).json({
        success: false,
        message: 'start, guest.email, and guest.firstName are required.'
      });
    }

    for (const field of config.customFields || []) {
      if (field.required && !formResponses?.[field.key]) {
        return res.status(400).json({
          success: false,
          message: `${field.label} is required.`
        });
      }
    }

    let assigneeUserId = null;
    if (config.ownerType === 'team') {
      assigneeUserId = await pickTeamAssignee(config, start);
    }

    const { event } = await bookAppointment({
      config,
      startISO: start,
      guest,
      appointmentType: appointmentType || 'consultation',
      customerTimezone,
      formResponses,
      assigneeUserId
    });

    const manageUrl = event.appointment?.manageToken
      ? buildManageUrl(event.appointment.manageToken)
      : null;

    res.status(201).json({
      success: true,
      data: {
        eventId: event.eventId || event._id,
        eventName: event.eventName,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        manageUrl,
        message: 'Your appointment is confirmed.'
      }
    });
  } catch (error) {
    console.error('[publicBooking] submitBooking:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Booking failed.',
      code: error.code
    });
  }
};
