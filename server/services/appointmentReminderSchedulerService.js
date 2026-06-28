'use strict';

/**
 * Cross-tenant scheduler: send appointment reminder emails before start time.
 */

const Organization = require('../models/Organization');
const Event = require('../models/Event');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { sendAppointmentReminderEmail } = require('./appointmentReminderEmailService');

const DEBUG = process.env.APPOINTMENT_REMINDER_SCHEDULER_DEBUG === 'true';

function parseReminderOffsetsHours() {
  const raw = String(process.env.APPOINTMENT_REMINDER_HOURS_BEFORE || '24').trim();
  const parts = raw
    .split(',')
    .map((s) => parseFloat(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.length ? parts : [24];
}

function windowMinutes() {
  return Math.max(5, parseInt(process.env.APPOINTMENT_REMINDER_WINDOW_MINUTES || '15', 10));
}

function computeWindow(hoursBefore) {
  const half = (windowMinutes() * 60 * 1000) / 2;
  const target = Date.now() + hoursBefore * 60 * 60 * 1000;
  return {
    start: new Date(target - half),
    end: new Date(target + half),
    hoursBefore
  };
}

/**
 * @returns {Promise<{ tenantsProcessed: number, candidates: number, sent: number, skipped: number, errors: number }>}
 */
async function tickAppointmentReminders() {
  if (process.env.ENABLE_APPOINTMENT_REMINDER_SCHEDULER === 'false') {
    return { tenantsProcessed: 0, candidates: 0, sent: 0, skipped: 0, errors: 0 };
  }

  const offsets = parseReminderOffsetsHours();
  const minLeadMs = Math.max(
    30 * 60 * 1000,
    parseInt(process.env.APPOINTMENT_REMINDER_MIN_LEAD_MINUTES || '60', 10) * 60 * 1000
  );

  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id database.name')
    .lean();

  let tenantsProcessed = 0;
  let candidates = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    let conn;
    try {
      conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
    } catch (err) {
      errors += 1;
      console.error(`[appointmentReminder] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          for (const hoursBefore of offsets) {
            const { start, end } = computeWindow(hoursBefore);
            const events = await Event.find({
              organizationId: tenant._id,
              deletedAt: null,
              status: 'Planned',
              'appointment.isAppointment': true,
              'appointment.reminderEmailSentAt': null,
              'appointment.reminderStatus': { $ne: 'none' },
              'appointment.bookedByEmail': { $exists: true, $nin: [null, ''] },
              startDateTime: { $gte: start, $lte: end }
            })
              .select(
                'eventName startDateTime endDateTime status location assignedTo organizationId appointment'
              )
              .lean();

            for (const event of events) {
              candidates += 1;
              const msUntilStart = new Date(event.startDateTime).getTime() - Date.now();
              if (msUntilStart < minLeadMs) {
                skipped += 1;
                continue;
              }

              try {
                const result = await sendAppointmentReminderEmail(event, { hoursBefore });
                if (result.sent) {
                  sent += 1;
                  if (DEBUG) {
                    console.log(
                      `[appointmentReminder] sent org=${tenant._id} event=${event._id} hoursBefore=${hoursBefore}`
                    );
                  }
                } else {
                  skipped += 1;
                }
              } catch (err) {
                errors += 1;
                console.error(
                  `[appointmentReminder] send failed event=${event._id}:`,
                  err.message
                );
              }
            }
          }
        }
      );
      tenantsProcessed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[appointmentReminder] tenant ${tenant._id} tick failed:`, err.message);
    }
  }

  if (DEBUG || sent > 0 || errors > 0) {
    console.log(
      `[appointmentReminder] tick: tenants=${tenantsProcessed} candidates=${candidates} sent=${sent} skipped=${skipped} errors=${errors}`
    );
  }

  return { tenantsProcessed, candidates, sent, skipped, errors };
}

module.exports = {
  tickAppointmentReminders,
  parseReminderOffsetsHours,
  computeWindow
};
