#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * End-to-end SLA record application check (generic policy engine → case cycle).
 *
 * Usage:
 *   node scripts/testSlaRecordApplication.js
 *   node scripts/testSlaRecordApplication.js --user-email hello@arivusystems.com
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { getMongoUris, connectMasterWithRetry } = require('../lib/mongoConnect');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Case = require('../models/Case');
const SlaPolicy = require('../models/SlaPolicy');
const SlaInstance = require('../models/SlaInstance');
const { createInitialSlaCycle, applyStatusToSlaCycle } = require('../services/caseLifecycleService');
const {
  finalizeCaseSlaOnCreate,
  applyCaseSlaLifecycle,
  usesGenericEngine,
  loadActiveInstances
} = require('../services/sla/slaCaseBridgeService');
const { simulatePolicyMatch } = require('../services/sla/slaPolicyEngine');

function parseArgs(argv) {
  const out = { userEmail: process.env.DEFAULT_ADMIN_EMAIL || 'hello@arivusystems.com' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--user-email') out.userEmail = argv[++i];
  }
  return out;
}

function buildCaseId() {
  const now = new Date();
  return `CAS-${now.getUTCFullYear()}-${String(Date.now()).slice(-6)}-SLA`;
}

function assertTruthy(label, value) {
  if (!value) throw new Error(`Assertion failed: ${label}`);
  console.log(`  ✓ ${label}`);
}

async function loadUser(email) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() })
    .select('_id email organizationId username')
    .lean();
  if (!user) throw new Error(`User not found: ${email}`);
  return user;
}

async function runForOrg(user) {
  const organizationId = user.organizationId;
  const generic = await usesGenericEngine(organizationId);
  assertTruthy('generic SLA engine enabled', generic);

  const policies = await SlaPolicy.find({
    organizationId,
    'scope.moduleKey': 'cases',
    active: true,
    deletedAt: null
  })
    .select('policyKey name isDefault targets entryCriteria')
    .lean();

  assertTruthy('at least one active cases SLA policy', policies.length > 0);
  console.log(`  Policies loaded: ${policies.map((p) => p.policyKey).join(', ')}`);

  const sampleRecord = {
    status: 'New',
    priority: 'Critical',
    caseType: 'Support Ticket',
    channel: 'Internal'
  };

  const simulation = await simulatePolicyMatch({
    organizationId,
    moduleKey: 'cases',
    sampleRecord,
    event: { type: 'record_created' }
  });

  assertTruthy('simulation finds matching policy', simulation.matches?.length > 0);
  const match = simulation.matches[0];
  console.log(`  Matched policy: ${match.policyKey} (${match.name})`);
  assertTruthy('matched policy has targets', Array.isArray(match.targets) && match.targets.length > 0);

  const now = new Date();
  const cycle = applyStatusToSlaCycle(createInitialSlaCycle(1, now), 'New', now);

  const draft = {
    organizationId,
    caseId: buildCaseId(),
    title: 'SLA engine integration test case',
    caseType: 'Support Ticket',
    priority: 'Critical',
    status: 'New',
    channel: 'Internal',
    caseOwnerId: user._id,
    currentSlaCycle: cycle,
    createdBy: user._id,
    updatedBy: user._id
  };

  const created = await Case.create(draft);
  try {
    const syncedCycle = await finalizeCaseSlaOnCreate({
      organizationId,
      caseRecord: created,
      actorId: user._id
    });

    created.currentSlaCycle = syncedCycle;
    await created.save();

    assertTruthy('response target set on cycle', syncedCycle?.responseTargetAt);
    assertTruthy('resolution target set on cycle', syncedCycle?.resolutionTargetAt);
    assertTruthy('policy snapshot key set', syncedCycle?.policySnapshot?.key);

    const instances = await loadActiveInstances(organizationId, created._id, cycle.cycleNo || 1);
    assertTruthy('SlaInstance rows created', instances.length >= 2);

    const milestones = new Set(instances.map((i) => i.milestoneKey));
    assertTruthy('first_response instance exists', milestones.has('first_response'));
    assertTruthy('resolution instance exists', milestones.has('resolution'));

    const criticalFr = instances.find((i) => i.milestoneKey === 'first_response');
    const duration = criticalFr?.policySnapshot?.durationMinutes;
    assertTruthy('first_response duration minutes present', Number(duration) > 0);

    console.log('\n  Case:', created.caseId, String(created._id));
    console.log('  Response target:', syncedCycle.responseTargetAt?.toISOString());
    console.log('  Resolution target:', syncedCycle.resolutionTargetAt?.toISOString());
    console.log('  Policy:', syncedCycle.policySnapshot?.key, syncedCycle.policySnapshot?.name || '');
    console.log('  Instances:', instances.map((i) => `${i.milestoneKey}:${i.status}`).join(', '));

    // Lifecycle: pause when status moves to Waiting for Customer
    created.status = 'Waiting for Customer';
    const pausedCycle = await applyCaseSlaLifecycle({
      organizationId,
      caseRecord: created,
      cycle: syncedCycle,
      changes: { status: 'Waiting for Customer', fromStatus: 'New' }
    });
    created.currentSlaCycle = pausedCycle;
    await created.save();

    assertTruthy('cycle paused on Waiting for Customer', pausedCycle?.status === 'paused');

    const pausedInstances = await loadActiveInstances(organizationId, created._id, cycle.cycleNo || 1);
    const allPaused = pausedInstances.every((i) => i.status === 'paused' || i.status === 'met');
    assertTruthy('SLA instances paused', allPaused);

    return { ok: true, caseId: created.caseId, mongoId: String(created._id) };
  } finally {
    await SlaInstance.deleteMany({ organizationId, recordId: created._id });
    await Case.deleteOne({ _id: created._id });
    console.log('  ✓ cleaned up test case');
  }
}

async function connectDb() {
  const { masterUri } = getMongoUris();
  await connectMasterWithRetry(masterUri);
  await dbConnectionManager.initializeMasterConnection();
  console.log(`Connected to ${mongoose.connection.db?.databaseName || 'master'}`);
}

async function withTenant(organizationId, fn) {
  const org = await Organization.findById(organizationId).select('_id name database').lean();
  if (!org) throw new Error(`Organization not found: ${organizationId}`);

  let conn = mongoose.connection;
  let dbName = conn.db?.databaseName || 'master';

  if (org.database?.name) {
    conn = await dbConnectionManager.getOrganizationConnection(org.database.name);
    if (conn.readyState !== 1) await conn.asPromise();
    dbName = org.database.name;
  } else if (conn.readyState !== 1) {
    await conn.asPromise();
  }

  console.log(`Tenant: ${org.name || org._id} (db=${dbName})`);
  return runWithTenantContext(
    { organizationId: org._id, connection: conn, databaseName: dbName },
    fn
  );
}

async function main() {
  const args = parseArgs(process.argv);
  await connectDb();

  const user = await loadUser(args.userEmail);
  console.log(`\nSLA record application test — ${user.email}\n`);

  await withTenant(user.organizationId, async () => {
    await runForOrg(user);
    console.log('\n✅ SLA applies to records correctly\n');
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ SLA record application test failed:\n', err.message);
  process.exit(1);
});
