'use strict';

const User = require('../models/User');
const Organization = require('../models/Organization');
const emailProviderGateway = require('../platform/communication/providers/emailProviderGateway');

const APPOINTMENT_TYPE_LABELS = {
  demo: 'Demo',
  support: 'Support',
  consultation: 'Consultation',
  other: 'Meeting'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhen(startDateTime, endDateTime, timezone = 'UTC') {
  const tz = timezone || 'UTC';
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz
  });
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short'
  });
  return {
    dateLine: dateFmt.format(start),
    timeLine: `${timeFmt.format(start)} – ${timeFmt.format(end)}`
  };
}

function buildEmailShell({ title, bodyHtml, accentColor = '#4f46e5' }) {
  const accent = escapeHtml(accentColor);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="height:4px;background:${accent};"></td></tr>
        <tr><td style="padding:32px 28px 24px;">
          <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#18181b;">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px 28px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">This is an automated message.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function loadEmailContext(organizationId, hostUserId) {
  const [org, host] = await Promise.all([
    Organization.findById(organizationId).select('name').lean(),
    User.findById(hostUserId).select('email firstName lastName username').lean()
  ]);

  const hostName =
    `${host?.firstName || ''} ${host?.lastName || ''}`.trim() ||
    host?.username ||
    'Your host';

  return {
    orgName: org?.name || '',
    hostName,
    hostEmail: host?.email || null
  };
}

async function sendMailSafe({ organizationId, to, subject, text, html, replyTo, attachments }) {
  if (!to) return { success: false, skipped: true, reason: 'no_recipient' };

  const configured = await emailProviderGateway.isConfigured({ organizationId });
  if (!configured) {
    return { success: false, skipped: true, reason: 'not_configured' };
  }

  try {
    return await emailProviderGateway.sendEmail({
      organizationId,
      to,
      subject,
      text,
      html,
      replyTo,
      attachments
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toIcsUtc(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildIcsAttachment({ event, hostName, guestEmail, meetingLink }) {
  const uid = event.eventId || String(event._id);
  const description = [
    meetingLink ? `Join: ${meetingLink}` : '',
    guestEmail ? `Guest: ${guestEmail}` : ''
  ]
    .filter(Boolean)
    .join('\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arivu//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}@arivu`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(event.startDateTime)}`,
    `DTEND:${toIcsUtc(event.endDateTime)}`,
    `SUMMARY:${(event.eventName || 'Appointment').replace(/[,;\\]/g, ' ')}`,
    hostName ? `ORGANIZER;CN=${hostName.replace(/[,;\\]/g, ' ')}:MAILTO:noreply@arivu.local` : '',
    guestEmail ? `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:${guestEmail}` : '',
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    meetingLink ? `LOCATION:${meetingLink.replace(/[,;\\]/g, ' ')}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .join('\r\n');

  return { filename: 'appointment.ics', content: Buffer.from(ics, 'utf8') };
}

function buildCancelIcsAttachment({ event }) {
  const uid = event.eventId || String(event._id);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arivu//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:${uid}@arivu`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(event.startDateTime)}`,
    `DTEND:${toIcsUtc(event.endDateTime)}`,
    `SUMMARY:${(event.eventName || 'Appointment').replace(/[,;\\]/g, ' ')}`,
    'STATUS:CANCELLED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return { filename: 'appointment-cancelled.ics', content: Buffer.from(ics, 'utf8') };
}

module.exports = {
  APPOINTMENT_TYPE_LABELS,
  escapeHtml,
  formatWhen,
  buildEmailShell,
  loadEmailContext,
  sendMailSafe,
  buildIcsAttachment,
  buildCancelIcsAttachment
};
