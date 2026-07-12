'use strict';

/**
 * Cross-tenant scheduler: start active processes with trigger.type === 'schedule'
 * when the configured clock matches the current minute in the process timezone.
 */

const { DateTime } = require('luxon');
const Organization = require('../models/Organization');
const Process = require('../models/Process');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { startProcess } = require('./processInvocation');

const BATCH_PER_TENANT = Math.max(1, parseInt(process.env.PROCESS_SCHEDULE_BATCH || '25', 10));
const DEBUG = process.env.PROCESS_SCHEDULE_DEBUG === 'true';

/**
 * Build idempotent slot id for this schedule minute (process-local timezone).
 * @param {Object} schedule
 * @param {DateTime} zonedNow
 */
function buildScheduleSlotId(schedule, zonedNow) {
  const preset = String(schedule?.preset || schedule?.frequency || 'daily').toLowerCase();
  const stamp = zonedNow.toFormat("yyyy-LL-dd'T'HH:mm");
  return `${preset}:${stamp}`;
}

/**
 * @param {Object} schedule
 * @param {Date} [now]
 * @returns {{ due: boolean, slotId: string|null, zonedNow: DateTime|null }}
 */
function evaluateScheduleDue(schedule, now = new Date()) {
  if (!schedule || typeof schedule !== 'object') {
    return { due: false, slotId: null, zonedNow: null };
  }

  const tz = String(schedule.timezone || 'UTC').trim() || 'UTC';
  let zonedNow;
  try {
    zonedNow = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(tz);
  } catch {
    zonedNow = DateTime.fromJSDate(now, { zone: 'utc' });
  }
  if (!zonedNow.isValid) {
    return { due: false, slotId: null, zonedNow: null };
  }

  const preset = String(schedule.preset || schedule.frequency || 'daily').toLowerCase();
  const hour = Number(schedule.hour ?? 9);
  const minute = Number(schedule.minute ?? 0);
  const dayOfWeek = Number(schedule.dayOfWeek ?? 1); // 0=Sun … 6=Sat (JS / Luxon weekday differs)
  const dayOfMonth = Number(schedule.dayOfMonth ?? 1);

  const h = zonedNow.hour;
  const m = zonedNow.minute;

  let due = false;
  if (preset === 'hourly') {
    // Fire once per hour at the configured minute
    due = m === (Number.isFinite(minute) ? minute : 0);
  } else if (preset === 'daily') {
    due = h === hour && m === minute;
  } else if (preset === 'weekly') {
    // Luxon: 1=Mon … 7=Sun. Designer uses JS-style 0=Sun … 6=Sat.
    const luxonWeekday = dayOfWeek === 0 ? 7 : dayOfWeek;
    due = zonedNow.weekday === luxonWeekday && h === hour && m === minute;
  } else if (preset === 'monthly') {
    const dom = Math.min(28, Math.max(1, dayOfMonth));
    due = zonedNow.day === dom && h === hour && m === minute;
  } else {
    due = h === hour && m === minute;
  }

  return {
    due,
    slotId: due ? buildScheduleSlotId(schedule, zonedNow) : null,
    zonedNow
  };
}

/**
 * @returns {Promise<{ tenantsProcessed: number, due: number, started: number, skipped: number, failed: number }>}
 */
async function tickProcessSchedules() {
  const now = new Date();

  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id database.name')
    .lean();

  let tenantsProcessed = 0;
  let due = 0;
  let started = 0;
  let skipped = 0;
  let failed = 0;

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    let conn;
    try {
      conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
    } catch (err) {
      failed += 1;
      console.error(`[processSchedule] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const processes = await Process.find({
            status: 'active',
            'trigger.type': 'schedule',
            triggerConfigured: { $ne: false }
          })
            .select('_id name appKey entityType trigger organizationId')
            .limit(BATCH_PER_TENANT)
            .lean();

          if (!processes.length) return;

          let tenantHadDue = false;

          for (const proc of processes) {
            const evalResult = evaluateScheduleDue(proc.trigger?.schedule, now);
            if (!evalResult.due || !evalResult.slotId) continue;

            tenantHadDue = true;
            due += 1;

            try {
              const result = await startProcess({
                processId: proc._id.toString(),
                scheduleInvocation: true,
                scheduleSlotId: evalResult.slotId,
                manualParams: {
                  organizationId: tenant._id.toString(),
                  entityType: proc.entityType || null,
                  entityId: null,
                  triggeredBy: null
                }
              });

              if (result?.ok && result.skipped) {
                skipped += 1;
              } else if (result?.ok) {
                started += 1;
                if (DEBUG) {
                  console.log(
                    `[processSchedule] started ${proc._id} slot=${evalResult.slotId} executionId=${result.executionId}`
                  );
                }
              } else {
                failed += 1;
                console.warn(
                  `[processSchedule] start failed ${proc._id}:`,
                  result?.error || 'unknown'
                );
              }
            } catch (err) {
              failed += 1;
              console.error(`[processSchedule] process ${proc._id}:`, err.message);
            }
          }

          if (tenantHadDue) tenantsProcessed += 1;
        }
      );
    } catch (err) {
      failed += 1;
      console.error(`[processSchedule] tenant ${tenant._id} tick failed:`, err.message);
    }
  }

  return { tenantsProcessed, due, started, skipped, failed };
}

module.exports = {
  tickProcessSchedules,
  evaluateScheduleDue,
  buildScheduleSlotId
};
