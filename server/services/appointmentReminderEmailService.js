'use strict';

const Event = require('../models/Event');
const {
  APPOINTMENT_TYPE_LABELS,
  escapeHtml,
  formatWhen,
  buildEmailShell,
  loadEmailContext,
  sendMailSafe
} = require('../utils/appointmentEmailUtils');
const { buildIcsAttachment } = require('../utils/appointmentEmailUtils');
const { buildManageUrl } = require('../utils/appointmentManageToken');
const { isEventInOpenLifecycle } = require('../domain/events/eventStatus');

function buildGuestReminderContent({
  guestName,
  eventName,
  when,
  hostName,
  meetingLink,
  hoursBefore,
  manageUrl
}) {
  const lead =
    hoursBefore >= 2
      ? `Your appointment is in about ${Math.round(hoursBefore)} hours.`
      : 'Your appointment is coming up soon.';
  const subject = `Reminder: ${eventName}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(guestName)}, ${lead}
    </p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#18181b;">${escapeHtml(eventName)}</p>
    <p style="margin:0 0 4px;font-size:15px;color:#18181b;">${escapeHtml(when.dateLine)}</p>
    <p style="margin:0 0 16px;font-size:15px;color:#52525b;">${escapeHtml(when.timeLine)}</p>
    <p style="margin:0 0 8px;font-size:14px;color:#52525b;">With ${escapeHtml(hostName)}</p>
    ${
      meetingLink
        ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(meetingLink)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Join meeting</a></p>`
        : ''
    }
    ${
      manageUrl
        ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(manageUrl)}" style="font-size:14px;color:#4f46e5;">Reschedule or cancel</a></p>`
        : ''
    }`;

  const text = [
    `Hi ${guestName},`,
    '',
    lead,
    '',
    eventName,
    when.dateLine,
    when.timeLine,
    `With: ${hostName}`,
    meetingLink ? `Join: ${meetingLink}` : null,
    manageUrl ? `Manage: ${manageUrl}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    text,
    html: buildEmailShell({ title: 'Appointment reminder', bodyHtml, accentColor: '#4f46e5' })
  };
}

function buildHostReminderContent({ hostName, guestName, eventName, when, hoursBefore }) {
  const lead =
    hoursBefore >= 2
      ? `You have an appointment in about ${Math.round(hoursBefore)} hours.`
      : 'You have an appointment coming up soon.';
  const subject = `Reminder: ${eventName}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${hostName}, ${lead}
    </p>
    <p style="margin:0;font-size:15px;color:#18181b;"><strong>${eventName}</strong> with ${guestName}</p>
    <p style="margin:8px 0 0;font-size:14px;color:#52525b;">${when.dateLine} · ${when.timeLine}</p>`;

  const text = [lead, '', eventName, `With ${guestName}`, when.dateLine, when.timeLine].join('\n');
  return {
    subject,
    text,
    html: buildEmailShell({ title: 'Upcoming appointment', bodyHtml })
  };
}

/**
 * Send reminder email(s) for one appointment event.
 * @returns {Promise<{ sent: boolean, skipped?: string, error?: string }>}
 */
async function sendAppointmentReminderEmail(event, { hoursBefore = 24 } = {}) {
  const appt = event.appointment;
  const guestEmail = appt?.bookedByEmail;
  if (!guestEmail) return { sent: false, skipped: 'no_guest_email' };
  if (appt.reminderEmailSentAt) return { sent: false, skipped: 'already_sent' };
  if (!isEventInOpenLifecycle(event)) return { sent: false, skipped: 'not_planned' };

  const organizationId = event.organizationId;
  const timezone = appt.customerTimezone || 'UTC';
  const { orgName, hostName, hostEmail } = await loadEmailContext(
    organizationId,
    event.assignedTo
  );
  const when = formatWhen(event.startDateTime, event.endDateTime, timezone);
  const guestName = appt.bookedByName || guestEmail;
  const meetingLink = appt.meetingLink || event.location || '';
  const appointmentTypeLabel =
    APPOINTMENT_TYPE_LABELS[appt.appointmentType] || 'Meeting';

  const manageUrl = appt.manageToken ? buildManageUrl(appt.manageToken) : null;

  const guestContent = buildGuestReminderContent({
    guestName,
    eventName: event.eventName || appointmentTypeLabel,
    when,
    hostName: orgName ? `${hostName} (${orgName})` : hostName,
    meetingLink: meetingLink || null,
    hoursBefore,
    manageUrl
  });

  const ics = buildIcsAttachment({
    event,
    hostName,
    guestEmail,
    meetingLink,
    timezone
  });

  let guestResult = await sendMailSafe({
    organizationId,
    to: guestEmail,
    ...guestContent,
    replyTo: hostEmail || undefined,
    attachments: [ics]
  });
  if (!guestResult.success && !guestResult.skipped && guestResult.error) {
    guestResult = await sendMailSafe({
      organizationId,
      to: guestEmail,
      ...guestContent,
      replyTo: hostEmail || undefined
    });
  }

  if (!guestResult.success) {
    return {
      sent: false,
      skipped: guestResult.skipped,
      error: guestResult.error || 'guest_send_failed'
    };
  }

  const notifyHost = process.env.APPOINTMENT_REMINDER_NOTIFY_HOST !== 'false';
  if (
    notifyHost &&
    hostEmail &&
    hostEmail.toLowerCase() !== String(guestEmail).toLowerCase()
  ) {
    const hostContent = buildHostReminderContent({
      hostName,
      guestName,
      eventName: event.eventName || appointmentTypeLabel,
      when,
      hoursBefore
    });
    await sendMailSafe({
      organizationId,
      to: hostEmail,
      ...hostContent,
      replyTo: guestEmail
    });
  }

  await Event.updateOne(
    { _id: event._id, organizationId },
    {
      $set: {
        'appointment.reminderEmailSentAt': new Date(),
        'appointment.reminderStatus': 'sent'
      }
    }
  );

  return { sent: true };
}

module.exports = {
  sendAppointmentReminderEmail,
  buildGuestReminderContent
};
