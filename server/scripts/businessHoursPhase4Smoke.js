#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Smoke tests for Business Hours Phase 4:
 * - availability_based assignment → off_hours_deferred + deferred job
 * - automation respectBusinessHours → deferral evaluation + queue row
 *
 *   node scripts/businessHoursPhase4Smoke.js
 *   SMOKE_ORG_ID=<mongoId> node scripts/businessHoursPhase4Smoke.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { simulateAssignment } = require('../services/assignmentRulesEngine');
const {
  filterUsersAvailableNow,
  enqueueOffHoursDeferredAssignment
} = require('../services/assignmentAvailabilityService');
const {
  evaluateAutomationDeferral,
  enqueueDeferredAutomationAction,
  buildDeferDedupeKey
} = require('../services/automationBusinessHoursService');
const { isOpen } = require('../services/businessHoursEngine');
const { resolveBusinessSchedule } = require('../services/businessHoursResolveService');

const SMOKE_ORG_ID = process.env.SMOKE_ORG_ID || '';
const SMOKE_PREFIX = 'bh-phase4-smoke';

function pass(label, detail = '') {
  console.log(`PASS ${label}${detail ? `: ${detail}` : ''}`);
}

function fail(label, reason) {
  throw new Error(`${label} — ${reason}`);
}

async function pickTenant() {
  if (SMOKE_ORG_ID && mongoose.Types.ObjectId.isValid(SMOKE_ORG_ID)) {
    const org = await Organization.findById(SMOKE_ORG_ID)
      .select('_id name database settings.timeZone isTenant isActive')
      .lean();
    if (!org) fail('tenant', `SMOKE_ORG_ID ${SMOKE_ORG_ID} not found`);
    return org;
  }

  const org = await Organization.findOne({
    isTenant: true,
    isActive: { $ne: false }
  })
    .select('_id name database settings.timeZone')
    .lean();

  if (!org) fail('tenant', 'no active tenant organization found');
  return org;
}

async function resolveTenantConnection(org) {
  const dedicatedDb = org.database?.name;
  if (dedicatedDb) {
    const conn = await dbConnectionManager.getOrganizationConnection(dedicatedDb);
    if (conn.readyState !== 1) await conn.asPromise();
    return { conn, dbName: dedicatedDb, mode: 'dedicated' };
  }
  const conn = mongoose.connection;
  if (conn.readyState !== 1) await conn.asPromise();
  return { conn, dbName: conn.db?.databaseName || 'master', mode: 'master' };
}

async function runSmoke(org) {
  const orgId = org._id;
  const { conn, dbName, mode } = await resolveTenantConnection(org);
  console.log(`INFO dbMode=${mode} database=${dbName}`);

  await runWithTenantContext(
    { organizationId: orgId, connection: conn, databaseName: dbName },
    async () => {
      const Group = require('../models/Group');
      const AssignmentScheduleJob = require('../models/AssignmentScheduleJob');
      const DeferredAutomationAction = require('../models/DeferredAutomationAction');

      let ephemeralGroup = null;
      const ephemeralGroupIds = [];
      let group = await Group.findOne({
        organizationId: orgId,
        isActive: { $ne: false },
        members: { $exists: true, $not: { $size: 0 } }
      })
        .select('_id name members')
        .lean();

      if (!group) {
        const User = require('../models/User');
        const users = await User.find({ organizationId: orgId, isActive: { $ne: false } })
          .select('_id')
          .limit(5)
          .lean();
        if (!users.length) {
          fail('fixture', 'no users in organization — cannot create smoke assignment group');
        }
        ephemeralGroup = await Group.create({
          organizationId: orgId,
          name: `${SMOKE_PREFIX} group`,
          description: 'Ephemeral group for business hours Phase 4 smoke',
          members: users.map((u) => u._id),
          isActive: true
        });
        ephemeralGroupIds.push(ephemeralGroup._id);
        group = ephemeralGroup.toObject();
        console.log(`INFO created ephemeral group with ${users.length} member(s)`);
      }

      try {

      const memberIds = (group.members || []).map((id) => String(id));
      const at = new Date();

      const resolved = await resolveBusinessSchedule({ organizationId: orgId, at });
      const openNow = isOpen(at, resolved.schedule);
      console.log(
        `INFO tenant=${org.name || orgId} tz=${resolved.timezone || org.settings?.timeZone || 'UTC'} openNow=${openNow} (${resolved.name || 'schedule'})`
      );

      const availableNow = await filterUsersAvailableNow(orgId, memberIds, at);
      console.log(`INFO group="${group.name}" members=${memberIds.length} availableNow=${availableNow.length}`);

      const smokeRule = {
        ruleId: `${SMOKE_PREFIX}-rule`,
        name: 'Phase 4 smoke (availability)',
        enabled: true,
        order: 0,
        triggerType: 'immediate',
        conditions: { combinator: 'all', clauses: [] },
        primaryGroupId: group._id,
        fallbackGroupIds: [],
        distribution: { mode: 'availability_based' }
      };

      const simulation = await simulateAssignment({
        organizationId: orgId,
        appKey: 'HELPDESK',
        moduleKey: 'cases',
        rules: [smokeRule],
        record: { subject: `${SMOKE_PREFIX} case` },
        context: {}
      });

      if (openNow) {
        if (simulation.outcome?.state === 'assigned') {
          pass('assignment_simulate', 'business hours open — assigned as expected');
        } else {
          console.warn(
            'WARN assignment_simulate: hours open but outcome was',
            simulation.outcome?.state,
            simulation.outcome?.reason
          );
        }
      } else {
        if (simulation.outcome?.state !== 'queued') {
          fail(
            'assignment_simulate',
            `expected queued off-hours, got ${simulation.outcome?.state}`
          );
        }
        if (simulation.outcome?.reason !== 'off_hours_deferred') {
          fail(
            'assignment_simulate',
            `expected off_hours_deferred, got ${simulation.outcome?.reason}`
          );
        }
        pass('assignment_simulate', 'queued with off_hours_deferred');
      }

      const recordId = `${SMOKE_PREFIX}-${Date.now()}`;
      const enqueueResult = await enqueueOffHoursDeferredAssignment({
        organizationId: orgId,
        appKey: 'HELPDESK',
        moduleKey: 'cases',
        recordId,
        rule: smokeRule,
        ruleSetVersion: 1,
        actorId: memberIds[0]
      });

      if (!openNow) {
        if (!enqueueResult.queued) {
          fail('assignment_deferred_job', enqueueResult.reason || 'not queued');
        }
        const job = await AssignmentScheduleJob.findOne({
          organizationId: orgId,
          recordId,
          status: 'pending'
        }).lean();
        if (!job) fail('assignment_deferred_job', 'pending job row not found');
        if (!job.details?.waitForBusinessHours) {
          fail('assignment_deferred_job', 'details.waitForBusinessHours not set');
        }
        if (!(job.runAt > at)) {
          fail('assignment_deferred_job', 'runAt should be in the future');
        }
        pass('assignment_deferred_job', `runAt=${job.runAt.toISOString()}`);
        await AssignmentScheduleJob.deleteOne({ _id: job._id });
      } else {
        console.log('INFO skip assignment_deferred_job (currently within business hours)');
      }

      const event = {
        eventId: `${SMOKE_PREFIX}-evt-${Date.now()}`,
        eventType: 'case.created',
        entityType: 'cases',
        entityId: recordId,
        organizationId: orgId,
        assignedTo: memberIds[0],
        triggeredBy: memberIds[0],
        appKey: 'HELPDESK'
      };

      const noFlag = await evaluateAutomationDeferral(event, { respectBusinessHours: false });
      if (noFlag.shouldDefer) fail('automation_deferral', 'should not defer when flag off');
      pass('automation_deferral', 'respectBusinessHours=false skips defer');

      const withFlag = await evaluateAutomationDeferral(event, { respectBusinessHours: true });
      if (openNow) {
        if (withFlag.shouldDefer) {
          fail('automation_deferral', 'should not defer during open hours');
        }
        pass('automation_deferral', 'open hours — execute immediately');
      } else {
        if (!withFlag.shouldDefer || !withFlag.executeAt) {
          fail('automation_deferral', 'expected deferral outside business hours');
        }
        pass('automation_deferral', `defer until ${withFlag.executeAt.toISOString()}`);

        const ruleId = new mongoose.Types.ObjectId();
        const queued = await enqueueDeferredAutomationAction({
          event,
          rule: { _id: ruleId, respectBusinessHours: true },
          actionIndex: 0,
          actionType: 'notify_user',
          actionParams: { message: SMOKE_PREFIX, recipient: 'owner' },
          executeAt: withFlag.executeAt,
          pauseReason: withFlag.pauseReason
        });
        if (!queued.queued) fail('automation_deferred_row', queued.reason || 'not queued');
        const dedupeKey = buildDeferDedupeKey(event.eventId, ruleId, 0);
        const row = await DeferredAutomationAction.findOne({ dedupeKey }).lean();
        if (!row) fail('automation_deferred_row', 'DeferredAutomationAction not found');
        pass('automation_deferred_row', `executeAt=${row.executeAt.toISOString()}`);
        await DeferredAutomationAction.deleteOne({ _id: row._id });
      }

        console.log('\nBusiness Hours Phase 4 smoke checks passed.');
      } finally {
        for (const groupId of ephemeralGroupIds) {
          await Group.deleteOne({ _id: groupId });
        }
        if (ephemeralGroupIds.length) {
          console.log('INFO removed ephemeral smoke group');
        }
        const staleGroups = await Group.find({
          organizationId: orgId,
          name: new RegExp(`^${SMOKE_PREFIX}`)
        }).select('_id');
        if (staleGroups.length) {
          await Group.deleteMany({ _id: { $in: staleGroups.map((g) => g._id) } });
          console.log(`INFO cleaned ${staleGroups.length} stale smoke group(s)`);
        }
      }
    }
  );
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  await dbConnectionManager.initializeMasterConnection();
  console.log('[businessHoursPhase4Smoke] Connected\n');

  try {
    const org = await pickTenant();
    await runSmoke(org);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\nBusiness Hours Phase 4 smoke checks failed:', err.message);
  process.exit(1);
});
