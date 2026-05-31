#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Local SLA Phase 1 simulator — manipulate case SLA state and run the monitor tick.
 *
 * Usage:
 *   npm run simulate:helpdesk-sla -- --help
 *   npm run simulate:helpdesk-sla -- list-users
 *   npm run simulate:helpdesk-sla -- create --user-email hello@arivusystems.com
 *   npm run simulate:helpdesk-sla -- status --case-id <mongoId>
 *   npm run simulate:helpdesk-sla -- warning --case-id <mongoId> --metric resolution
 *   npm run simulate:helpdesk-sla -- tick --user-email hello@arivusystems.com
 *   npm run simulate:helpdesk-sla -- demo --user-email hello@arivusystems.com
 *
 * Note: users live in the master DB (arivu_master). Cases live in the tenant DB.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { getMongoUris, connectMasterWithRetry } = require('../lib/mongoConnect');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Case = require('../models/Case');
const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const {
  createInitialSlaCycle,
  applyStatusToSlaCycle
} = require('../services/caseLifecycleService');
const { applySlaTargetsToCycle } = require('../services/helpdeskSlaService');
const { resolveSlaScheduleForOrganization } = require('../services/helpdeskBusinessHoursService');
const { computeCycleSlaProgress } = require('../services/helpdeskSlaClockService');
const { tickHelpdeskSlaNotifications } = require('../services/helpdeskSlaMonitorService');

const COMMANDS = new Set([
  'create',
  'status',
  'warning',
  'breach',
  'tick',
  'pause',
  'resume',
  'response-met',
  'reset-alerts',
  'demo',
  'list-users',
  'help'
]);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv) {
  const out = {
    command: 'help',
    caseId: null,
    userEmail: null,
    userId: null,
    metric: 'resolution',
    percent: null,
    title: 'SLA simulation case',
    priority: 'Medium',
    help: false
  };

  const positional = argv.filter((a) => !a.startsWith('--'));
  if (positional[2]) out.command = positional[2];

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--case-id') out.caseId = argv[++i];
    else if (a === '--user-email') out.userEmail = argv[++i];
    else if (a === '--user-id') out.userId = argv[++i];
    else if (a === '--metric') out.metric = argv[++i];
    else if (a === '--percent') out.percent = Number(argv[++i]);
    else if (a === '--title') out.title = argv[++i];
    else if (a === '--priority') out.priority = argv[++i];
    else if (a.includes('@') && a !== '--' && !out.userEmail) out.userEmail = a;
  }

  if (out.help) out.command = 'help';
  return out;
}

function printHelp() {
  console.log(`
Helpdesk SLA local simulator (Phase 1)

  npm run simulate:helpdesk-sla -- <command> [options]

Commands:
  list-users          Show HELPDESK users in master DB (for --user-email)
  create              Create an open case with SLA targets (prints case id)
  status              Print SLA progress for a case
  warning             Backdate SLA so the next tick fires a warning (default 85%)
  breach              Backdate SLA so the next tick fires a breach (default 105%)
  tick                Run SLA monitor once (scoped to user's tenant if --user-email given)
  pause               Set status to "Waiting for Customer" (SLA paused)
  resume              Set status to "In Progress" (SLA running)
  response-met        Mark first-response SLA as met
  reset-alerts        Clear SLA alert flags on a case (re-test warnings)
  demo                create → warning → tick → breach → tick (walkthrough)

Options:
  --case-id <id>      Case MongoDB _id or human caseId (e.g. CAS-2026-036046-SIM)
  --user-email <email> Org user for create/demo/tick (default: first HELPDESK user)
  --user-id <id>      User MongoDB _id
  --metric response|resolution   (default: resolution)
  --percent <n>       Target elapsed % for warning/breach (defaults: 85 / 105)
  --title <text>      Title for create/demo
  --priority <p>      Low | Medium | High | Critical (default: Medium)

Examples:
  npm run simulate:helpdesk-sla -- list-users
  npm run simulate:helpdesk-sla -- create --user-email hello@arivusystems.com
  npm run simulate:helpdesk-sla -- demo --user-email hello@arivusystems.com
  npm run simulate:helpdesk-sla -- tick --user-email hello@arivusystems.com

Tips:
  - Users are stored in master DB (arivu_master). Use list-users if email lookup fails.
  - Pass --user-email on tick so cases in tenant DBs are scanned.
  - Open the case in /helpdesk/cases/<id> as owner before running tick.
`);
}

async function connectDb() {
  const { masterUri } = getMongoUris();
  await connectMasterWithRetry(masterUri);
  await dbConnectionManager.initializeMasterConnection();
  console.log(`Connected to ${mongoose.connection.db?.databaseName || 'master'}`);
}

async function resolveTenantConnection(organizationId) {
  const org = await Organization.findById(organizationId).select('_id name database').lean();
  if (!org) throw new Error(`Organization not found: ${organizationId}`);

  if (org.database?.name) {
    const conn = await dbConnectionManager.getOrganizationConnection(org.database.name);
    if (conn.readyState !== 1) await conn.asPromise();
    return { org, conn, dbName: org.database.name, mode: 'dedicated' };
  }

  const conn = mongoose.connection;
  if (conn.readyState !== 1) await conn.asPromise();
  return {
    org,
    conn,
    dbName: conn.db?.databaseName || 'master',
    mode: 'master'
  };
}

async function withTenant(organizationId, fn) {
  const { org, conn, dbName, mode } = await resolveTenantConnection(organizationId);
  console.log(`Tenant: ${org.name || org._id} (${mode}, db=${dbName})`);
  return runWithTenantContext(
    { organizationId: org._id, connection: conn, databaseName: dbName },
    fn
  );
}

const USER_SELECT = '_id email username organizationId allowedApps firstName lastName status';

async function resolveUser({ userEmail, userId }) {
  if (userId) {
    return User.findById(userId).select(USER_SELECT).lean();
  }

  if (userEmail) {
    const normalized = userEmail.toLowerCase().trim();
    let user = await User.findOne({ email: normalized }).select(USER_SELECT).lean();
    if (!user) {
      user = await User.findOne({
        email: new RegExp(`^${escapeRegex(normalized)}$`, 'i')
      }).select(USER_SELECT).lean();
    }
    if (!user) {
      user = await User.findOne({ username: normalized }).select(USER_SELECT).lean();
    }
    return user;
  }

  return User.findOne({
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
    allowedApps: { $in: ['HELPDESK'] }
  })
    .select(USER_SELECT)
    .lean();
}

async function listHelpdeskUsers(limit = 20) {
  return User.find({
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
    allowedApps: { $in: ['HELPDESK'] }
  })
    .select(USER_SELECT)
    .sort({ email: 1 })
    .limit(limit)
    .lean();
}

async function printUserNotFound(args) {
  console.error('No user found. Pass --user-email or --user-id');
  const samples = await listHelpdeskUsers(8);
  if (samples.length) {
    console.error('\nAvailable HELPDESK users (master DB):');
    for (const row of samples) {
      console.error(`  ${row.email}${row.username ? ` (username: ${row.username})` : ''}`);
    }
    console.error('\nRun: npm run simulate:helpdesk-sla -- list-users');
  } else {
    console.error('No users with HELPDESK in allowedApps were found in master DB.');
  }
}

async function loadCase(caseRef, organizationId) {
  if (!caseRef || !String(caseRef).trim()) {
    throw new Error('--case-id is required (MongoDB _id or caseId like CAS-2026-036046-SIM)');
  }

  const ref = String(caseRef).trim();
  const query = { deletedAt: null };
  if (organizationId) query.organizationId = organizationId;

  if (mongoose.Types.ObjectId.isValid(ref)) {
    query._id = ref;
  } else {
    query.caseId = ref;
  }

  const row = await Case.findOne(query);
  if (!row) {
    throw new Error(`Case not found: ${ref} (use MongoDB _id or caseId from create output)`);
  }
  return row;
}

function buildCaseId() {
  const now = new Date();
  return `CAS-${now.getUTCFullYear()}-${String(Date.now()).slice(-6)}-SIM`;
}

async function createSimCase(user, args) {
  const now = new Date();
  const cycle = createInitialSlaCycle(1, now);
  const adjusted = applyStatusToSlaCycle(cycle, 'New', now);
  const targetAware = await applySlaTargetsToCycle({
    organizationId: user.organizationId,
    cycle: adjusted,
    context: {
      caseType: 'Support Ticket',
      priority: args.priority,
      channel: 'Internal'
    },
    startedAt: adjusted.startedAt
  });

  return Case.create({
    organizationId: user.organizationId,
    caseId: buildCaseId(),
    title: args.title,
    caseType: 'Support Ticket',
    priority: args.priority,
    status: 'New',
    channel: 'Internal',
    caseOwnerId: user._id,
    currentSlaCycle: targetAware,
    activities: [{
      activityType: 'case_created',
      message: 'Case created by SLA simulator',
      internal: true,
      actorId: user._id,
      actorName: 'SLA Simulator',
      createdAt: now
    }],
    createdBy: user._id,
    updatedBy: user._id
  });
}

async function printStatus(caseRow) {
  const schedule = await resolveSlaScheduleForOrganization(caseRow.organizationId);
  const progress = computeCycleSlaProgress(caseRow.currentSlaCycle, schedule);
  const cycle = caseRow.currentSlaCycle;

  console.log('\nCase:', caseRow.caseId, String(caseRow._id));
  console.log('  Title:', caseRow.title);
  console.log('  Status:', caseRow.status);
  console.log('  Priority:', caseRow.priority);
  console.log('  Owner:', String(caseRow.caseOwnerId));
  console.log('  Cycle status:', cycle.status);
  console.log('  Response target:', cycle.responseTargetAt?.toISOString() || '-');
  console.log('  Response met:', cycle.responseMetAt?.toISOString() || '-');
  console.log('  Resolution target:', cycle.resolutionTargetAt?.toISOString() || '-');
  console.log('  Pause segments:', Array.isArray(cycle.pauseSegments) ? cycle.pauseSegments.length : 0);

  for (const key of ['response', 'resolution']) {
    const p = progress[key];
    console.log(`  ${key}: state=${p.state} elapsed=${p.elapsedMinutes ?? '-'}m budget=${p.budgetMinutes ?? '-'}m percent=${p.elapsedPercent ?? '-'}%`);
  }

  const alerts = cycle.policySnapshot?.alerts || {};
  console.log('  Alerts:', JSON.stringify(alerts, null, 2).split('\n').join('\n  '));
  console.log('');
}

async function setProgress(caseRow, { metric, percent }) {
  const schedule = await resolveSlaScheduleForOrganization(caseRow.organizationId);
  const cycle = caseRow.currentSlaCycle?.toObject?.() || { ...caseRow.currentSlaCycle };
  const budgetKey = metric === 'response' ? 'firstResponseMinutes' : 'resolutionMinutes';
  const budgetMinutes = Number(cycle.policySnapshot?.[budgetKey]) ||
    Number(metric === 'response' ? 60 : 480);

  if (!Number.isFinite(budgetMinutes) || budgetMinutes <= 0) {
    throw new Error(`No ${budgetKey} on policy snapshot — recreate case or configure SLA targets`);
  }

  const targetPercent = Math.max(1, Number(percent) || 85);
  const elapsedMinutes = (budgetMinutes * targetPercent) / 100;
  const startedAt = new Date(Date.now() - elapsedMinutes * 60000);

  const nextCycle = {
    ...cycle,
    startedAt,
    pausedAt: null,
    pauseSegments: [],
    status: 'running',
    responseMetAt: metric === 'response' && targetPercent >= 100 ? cycle.responseMetAt : null,
    policySnapshot: {
      ...(cycle.policySnapshot || {}),
      alerts: {}
    }
  };

  const recomputed = await applySlaTargetsToCycle({
    organizationId: caseRow.organizationId,
    cycle: nextCycle,
    context: {
      caseType: caseRow.caseType,
      priority: caseRow.priority,
      channel: caseRow.channel
    },
    startedAt
  });

  caseRow.currentSlaCycle = recomputed;
  await caseRow.save();

  const progress = computeCycleSlaProgress(recomputed, schedule);
  console.log(`Set ${metric} SLA to ~${targetPercent}% elapsed (budget ${budgetMinutes}m, started ${startedAt.toISOString()})`);
  console.log(`  Current ${metric} state: ${progress[metric].state} (${progress[metric].elapsedPercent}%)`);
}

async function runTick(organizationId) {
  if (organizationId) {
    return withTenant(organizationId, async () => {
      const result = await tickHelpdeskSlaNotifications();
      printTickResult(result);
      return result;
    });
  }

  const tenants = await Organization.find({ isTenant: true, isActive: { $ne: false } })
    .select('_id name')
    .lean();

  const totals = { processed: 0, warningSent: 0, breachSent: 0, escalationsSent: 0 };
  for (const tenant of tenants) {
    console.log(`\n--- Tick tenant: ${tenant.name || tenant._id} ---`);
    const result = await withTenant(tenant._id, () => tickHelpdeskSlaNotifications());
    totals.processed += result.processed;
    totals.warningSent += result.warningSent;
    totals.breachSent += result.breachSent;
    totals.escalationsSent += result.escalationsSent || 0;
  }
  printTickResult(totals);
  return totals;
}

function printTickResult(result) {
  console.log('\nSLA tick complete');
  console.log('  processed:', result.processed);
  console.log('  warningSent:', result.warningSent);
  console.log('  breachSent:', result.breachSent);
  console.log('  escalationsSent:', result.escalationsSent || 0);
  console.log('\nCheck bell/toast on /helpdesk/ (logged in as case owner).\n');
}

async function ensureDemoEscalationRules(organizationId) {
  const existing = await TenantAppConfiguration.findOne({
    organizationId,
    appKey: 'HELPDESK',
    enabled: true
  }).select('settings').lean();

  const root = existing?.settings?.helpdeskExecution || existing?.settings || {};
  if (Array.isArray(root.escalationRules) && root.escalationRules.length > 0) {
    return false;
  }

  await TenantAppConfiguration.findOneAndUpdate(
    { organizationId, appKey: 'HELPDESK' },
    {
      $set: {
        'settings.helpdeskExecution.escalationRules': [
          {
            key: 'sim-owner-90',
            name: 'Sim: notify owner at 90%',
            triggerPercent: 90,
            actionType: 'NOTIFY_OWNER'
          },
          {
            key: 'sim-leadership-100',
            name: 'Sim: leadership at 100%',
            triggerPercent: 100,
            actionType: 'NOTIFY_LEADERSHIP'
          }
        ]
      }
    },
    { upsert: false }
  );
  return true;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === 'help' || !COMMANDS.has(args.command)) {
    printHelp();
    process.exit(args.command === 'help' ? 0 : 1);
  }

  await connectDb();

  try {
    if (args.command === 'list-users') {
      const rows = await listHelpdeskUsers(50);
      if (!rows.length) {
        console.log('No HELPDESK users found in master DB.');
        return;
      }
      console.log('\nHELPDESK users (master DB):\n');
      for (const row of rows) {
        console.log(`  ${row.email}${row.username ? `  username=${row.username}` : ''}  org=${row.organizationId}`);
      }
      console.log('');
      return;
    }

    const user = await resolveUser(args);
    if (!user && args.command !== 'tick') {
      await printUserNotFound(args);
      process.exit(1);
    }

    if (args.command === 'tick') {
      const orgId = user?.organizationId || null;
      if (!orgId) {
        console.log('No --user-email provided; ticking all active tenants...');
      }
      await runTick(orgId);
      return;
    }

    await withTenant(user.organizationId, async () => {
      if (args.command === 'create') {
        const doc = await createSimCase(user, args);
        console.log('\nCreated case');
        console.log('  id:', String(doc._id));
        console.log('  caseId:', doc.caseId);
        console.log('  owner:', user.email);
        console.log('\nOpen: /helpdesk/cases/' + String(doc._id));
        await printStatus(doc);
        return;
      }

      if (args.command === 'demo') {
        const addedRules = await ensureDemoEscalationRules(user.organizationId);
        if (addedRules) console.log('Installed sample escalationRules on HELPDESK config.');

        const doc = await createSimCase(user, { ...args, title: args.title || 'SLA demo case' });
        console.log('\n1) Created case', String(doc._id));

        await setProgress(doc, { metric: 'resolution', percent: 85 });
        console.log('2) Set resolution to warning zone (85%)');
        await runTick(user.organizationId);

        await setProgress(doc, { metric: 'resolution', percent: 105 });
        console.log('3) Set resolution to breach zone (105%)');
        await runTick(user.organizationId);

        console.log('Demo done. Case id:', String(doc._id));
        console.log('Open in app: /helpdesk/cases/' + String(doc._id));
        return;
      }

      const caseRow = await loadCase(args.caseId, user.organizationId);

      if (args.command === 'status') {
        await printStatus(caseRow);
        return;
      }

      if (args.command === 'warning') {
        await setProgress(caseRow, { metric: args.metric, percent: args.percent || 85 });
        console.log('Run: npm run simulate:helpdesk-sla -- tick --user-email', user.email);
        return;
      }

      if (args.command === 'breach') {
        await setProgress(caseRow, { metric: args.metric, percent: args.percent || 105 });
        console.log('Run: npm run simulate:helpdesk-sla -- tick --user-email', user.email);
        return;
      }

      if (args.command === 'reset-alerts') {
        caseRow.currentSlaCycle.policySnapshot = {
          ...(caseRow.currentSlaCycle.policySnapshot || {}),
          alerts: {}
        };
        await caseRow.save();
        console.log('Cleared SLA alert flags on case', String(caseRow._id));
        return;
      }

      if (args.command === 'pause') {
        caseRow.status = 'Waiting for Customer';
        caseRow.currentSlaCycle = applyStatusToSlaCycle(
          caseRow.currentSlaCycle?.toObject?.() || caseRow.currentSlaCycle,
          'Waiting for Customer'
        );
        await caseRow.save();
        console.log('Case paused (Waiting for Customer):', String(caseRow._id));
        await printStatus(caseRow);
        return;
      }

      if (args.command === 'resume') {
        caseRow.status = 'In Progress';
        caseRow.currentSlaCycle = applyStatusToSlaCycle(
          caseRow.currentSlaCycle?.toObject?.() || caseRow.currentSlaCycle,
          'In Progress'
        );
        await caseRow.save();
        console.log('Case resumed (In Progress):', String(caseRow._id));
        await printStatus(caseRow);
        return;
      }

      if (args.command === 'response-met') {
        caseRow.currentSlaCycle.responseMetAt = new Date();
        await caseRow.save();
        console.log('Marked response SLA met on case', String(caseRow._id));
        await printStatus(caseRow);
      }
    });
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
