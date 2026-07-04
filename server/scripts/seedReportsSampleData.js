#!/usr/bin/env node
/**
 * Seed random sample records across all analytics-reportable modules (Reports E2E testing).
 *
 * Creates N records (default 10) per module listed in analyticsModuleRegistry.js:
 * people, organizations, deals, tasks, events, cases, quotes, items, forms (FormResponse).
 *
 * Usage (from server/):
 *   node scripts/seedReportsSampleData.js
 *   node scripts/seedReportsSampleData.js <organizationId>
 *   node scripts/seedReportsSampleData.js --user-email you@example.com
 *   node scripts/seedReportsSampleData.js --org-slug my-tenant --count 10
 *   npm run seed:reports-sample
 *
 * Env:
 *   SEED_REPORTS_COUNT — records per module (default 10)
 *   SEED_ORG_SLUG      — tenant slug when org id not passed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { getMongoUris, connectMasterWithRetry } = require('../lib/mongoConnect');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { listAnalyticsModules } = require('../services/analytics/analyticsModuleRegistry');
const { syncDealRelationshipInstances } = require('../services/dealRelationshipInstanceSync');

const Organization = require('../models/Organization');
const User = require('../models/User');
const People = require('../models/People');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Event = require('../models/Event');
const Form = require('../models/Form');
const ModuleDefinition = require('../models/ModuleDefinition');
const Case = require('../models/Case');
const Quote = require('../models/Quote');
const Item = require('../models/Item');
const FormResponse = require('../models/FormResponse');

const { QUOTE_STATUSES } = require('../constants/quoteLifecycle');
const { CASE_TYPES, CASE_PRIORITIES, CASE_STATUSES } = require('../constants/caseLifecycle');

const SEED_TAG = 'ReportsE2E';
const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Blake', 'Drew'];
const LAST_NAMES = ['Chen', 'Patel', 'Nguyen', 'Brooks', 'Silva', 'Kim', 'Reed', 'Hayes', 'Morales', 'Foster'];
const INDUSTRIES = ['Technology', 'Healthcare', 'Manufacturing', 'Retail', 'Finance', 'Logistics', 'Education'];
const ITEM_TYPES = ['Product', 'Service', 'Serialized Product', 'Non-Stock Product'];
const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];
const EVENT_TYPES = ['Meeting'];

function parseArgs(argv) {
  const out = {
    orgId: null,
    orgSlug: process.env.SEED_ORG_SLUG || null,
    userEmail: null,
    count: Number(process.env.SEED_REPORTS_COUNT) || 10,
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--org-slug') out.orgSlug = argv[++i];
    else if (a === '--user-email') out.userEmail = argv[++i];
    else if (a === '--count') out.count = Math.max(1, Number(argv[++i]) || 10);
    else if (!a.startsWith('-') && mongoose.Types.ObjectId.isValid(a)) out.orgId = a;
  }

  return out;
}

function printHelp() {
  console.log(`
Seed sample data for Reports E2E testing

  node scripts/seedReportsSampleData.js [organizationId] [options]

Options:
  --org-slug <slug>     Tenant slug (or SEED_ORG_SLUG)
  --user-email <email>  Resolve org from user email
  --count <n>           Records per module (default: 10)
  --help                Show this help

Modules seeded (from analytics registry):
  people, organizations, deals, tasks, events, cases, quotes, items, forms
`);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000);
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function connectDb() {
  const { masterUri } = getMongoUris();
  await connectMasterWithRetry(masterUri);
  await dbConnectionManager.initializeMasterConnection();
}

async function resolveTenantConnection(organizationId) {
  const org = await Organization.findById(organizationId).select('_id name slug database').lean();
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
    mode: 'master',
  };
}

async function withTenant(organizationId, fn) {
  const { org, conn, dbName, mode } = await resolveTenantConnection(organizationId);
  console.log(`Tenant: ${org.name || org._id} (slug=${org.slug || 'n/a'}, ${mode}, db=${dbName})`);
  return runWithTenantContext(
    { organizationId: org._id, connection: conn, databaseName: dbName },
    fn,
  );
}

async function resolveOrganizationId({ orgId, orgSlug, userEmail }) {
  if (orgId && mongoose.Types.ObjectId.isValid(orgId)) {
    return new mongoose.Types.ObjectId(orgId);
  }

  if (userEmail) {
    const normalized = userEmail.toLowerCase().trim();
    let user = await User.findOne({ email: normalized }).select('organizationId').lean();
    if (!user) {
      user = await User.findOne({
        email: new RegExp(`^${escapeRegex(normalized)}$`, 'i'),
      }).select('organizationId').lean();
    }
    if (!user?.organizationId) {
      throw new Error(`No user found for email: ${userEmail}`);
    }
    return user.organizationId;
  }

  if (orgSlug) {
    const org = await Organization.findOne({ slug: orgSlug.toLowerCase() }).select('_id').lean();
    if (!org?._id) throw new Error(`No organization with slug: ${orgSlug}`);
    return org._id;
  }

  const org = await Organization.findOne({ isTenant: true }).select('_id slug name').lean();
  if (!org?._id) {
    throw new Error('No tenant organization found — pass organizationId, --org-slug, or --user-email');
  }
  console.log(`Using first tenant org: ${org.name} (${org.slug}, ${org._id})`);
  return org._id;
}

async function resolveActor(organizationId) {
  let user = await User.findOne({ organizationId, isOwner: true, status: 'active' })
    .select('_id email')
    .lean();
  if (!user) {
    user = await User.findOne({ organizationId, status: 'active' }).select('_id email').lean();
  }
  if (!user) throw new Error(`No active user found for organization ${organizationId}`);
  return user;
}

function getPipelineInfo(dealsModule) {
  const pips = dealsModule?.pipelineSettings?.length ? dealsModule.pipelineSettings : null;
  if (!pips?.length) {
    return { pipelineKey: 'default_pipeline', stageNames: ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] };
  }
  const pip = pips.find((p) => p?.isDefault) || pips[0];
  const key = String(pip.key || 'default_pipeline');
  const names = (Array.isArray(pip.stages) ? pip.stages : []).map((s) => s.name).filter(Boolean);
  if (!names.length) {
    return { pipelineKey: key, stageNames: ['Qualification', 'Proposal', 'Closed Won', 'Closed Lost'] };
  }
  return { pipelineKey: key, stageNames: names };
}

async function ensureSampleForm(organizationId, ownerId) {
  const existing = await Form.findOne({ organizationId, name: `${SEED_TAG} Sample Form` }).lean();
  if (existing) return existing;

  const form = await Form.create({
    organizationId,
    name: `${SEED_TAG} Sample Form`,
    description: 'Auto-created for Reports E2E seed data',
    formType: 'Survey',
    status: 'Active',
    visibility: 'Internal',
    formId: `form-${SEED_TAG.toLowerCase()}-${Date.now().toString(36)}`,
    formVersion: 1,
    assignedTo: ownerId,
    sections: [
      {
        sectionId: 'sec-reports-e2e',
        name: 'Sample questions',
        questions: [
          { questionId: 'q1', questionText: 'Overall satisfaction (1-5)', type: 'Rating', mandatory: true },
          { questionId: 'q2', questionText: 'Comments', type: 'Textarea', mandatory: false },
        ],
      },
    ],
    createdBy: ownerId,
    modifiedBy: ownerId,
  });
  return form.toObject();
}

async function seedPeople(orgId, ownerId, count, runId) {
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}.${runId}.${i}@reports-e2e.example`;
    const doc = await People.create({
      organizationId: orgId,
      createdBy: ownerId,
      assignedTo: ownerId,
      first_name: first,
      last_name: last,
      email,
      phone: `+1 555 ${String(randomInt(100, 999)).padStart(3, '0')} ${String(randomInt(1000, 9999))}`,
      source: 'Import',
      tags: [SEED_TAG, `run-${runId}`],
      participations: { SALES: { role: 'Contact', contact_status: 'Active' } },
    });
    created.push(doc);
  }
  return created;
}

async function seedOrganizations(ownerId, count, runId) {
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const doc = await Organization.create({
      name: `${pick(['Acme', 'Nova', 'Summit', 'Pioneer', 'Atlas'])} ${pick(LAST_NAMES)} ${runId}-${i}`,
      industry: pick(INDUSTRIES),
      isTenant: false,
      customerStatus: pick(['Active', 'Prospect']),
      createdBy: ownerId,
      assignedTo: ownerId,
      tags: [SEED_TAG, `run-${runId}`],
    });
    created.push(doc);
  }
  return created;
}

async function seedDeals(orgId, ownerId, count, runId, people, accounts) {
  const dealsMod = await ModuleDefinition.findOne({ organizationId: orgId, moduleKey: 'deals' });
  const { pipelineKey, stageNames } = getPipelineInfo(dealsMod);
  const created = [];

  for (let i = 0; i < count; i += 1) {
    const stage = stageNames[i % stageNames.length];
    const status = /won/i.test(stage) ? 'Won' : /lost/i.test(stage) ? 'Lost' : 'Open';
    const contact = people[i % people.length];
    const account = accounts[i % accounts.length];
    const amount = randomInt(5000, 250000);

    const deal = await Deal.create({
      organizationId: orgId,
      name: `${SEED_TAG} Deal ${runId}-${i + 1}`,
      amount,
      currency: 'USD',
      pipeline: pipelineKey,
      stage,
      probability: status === 'Won' ? 100 : randomInt(10, 90),
      expectedCloseDate: daysFromNow(randomInt(7, 90)),
      contactId: contact?._id,
      accountId: account?._id,
      assignedTo: ownerId,
      createdBy: ownerId,
      modifiedBy: ownerId,
      status,
      tags: [SEED_TAG, `run-${runId}`],
      description: `Sample deal for Reports E2E (${runId})`,
    });

    try {
      await syncDealRelationshipInstances({
        organizationId: orgId,
        dealDoc: deal,
        createdBy: ownerId,
        peopleMode: 'replace',
        organizationsMode: 'replace',
      });
    } catch (err) {
      console.warn(`   [deals] relationship sync skipped for ${deal._id}:`, err.message);
    }
    created.push(deal);
  }
  return created;
}

async function seedTasks(orgId, ownerId, count, runId, people) {
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const done = i % 3 === 0;
    const doc = await Task.create({
      organizationId: orgId,
      title: `${SEED_TAG} Task ${runId}-${i + 1}`,
      description: `Sample task for Reports E2E (${runId})`,
      status: done ? 'done' : pick(TASK_STATUSES.filter((s) => s !== 'done')),
      priority: pick(TASK_PRIORITIES),
      dueDate: done ? daysAgo(1) : daysFromNow(randomInt(1, 14)),
      startDate: daysAgo(randomInt(0, 5)),
      completedDate: done ? daysAgo(1) : null,
      assignedTo: ownerId,
      assignedBy: ownerId,
      relatedTo: people[i % people.length]
        ? { type: 'contact', id: people[i % people.length]._id }
        : { type: 'none' },
      tags: [SEED_TAG],
    });
    created.push(doc);
  }
  return created;
}

async function seedEvents(orgId, ownerId, count, runId) {
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const past = i % 4 === 0;
    const start = past ? daysAgo(randomInt(1, 30)) : daysFromNow(randomInt(1, 30));
    const end = new Date(start.getTime() + randomInt(1, 3) * 3600000);
    const doc = await Event.create({
      organizationId: orgId,
      eventName: `${SEED_TAG} Event ${runId}-${i + 1}`,
      eventType: pick(EVENT_TYPES),
      status: 'Planned',
      assignedTo: ownerId,
      startDateTime: start,
      endDateTime: end,
      location: pick(['Remote', 'HQ Conference Room', 'Customer site']),
      createdBy: ownerId,
      modifiedBy: ownerId,
      createdTime: new Date(),
      modifiedTime: new Date(),
    });
    created.push(doc);
  }
  return created;
}

async function seedCases(orgId, ownerId, count, runId, people, accounts) {
  const created = [];
  const mkSla = (resDays) => ({
    cycleNo: 1,
    startedAt: new Date(),
    status: 'running',
    responseTargetAt: daysFromNow(resDays / 2),
    resolutionTargetAt: daysFromNow(resDays),
    policySnapshot: { label: 'Standard', seedTag: SEED_TAG },
  });

  for (let i = 0; i < count; i += 1) {
    const doc = await Case.create({
      organizationId: orgId,
      caseId: `RPT-${runId}-${String(i + 1).padStart(3, '0')}`,
      title: `${SEED_TAG} Case ${runId}-${i + 1}`,
      caseType: pick(CASE_TYPES),
      priority: pick(CASE_PRIORITIES),
      status: pick(CASE_STATUSES),
      contactId: people[i % people.length]?._id,
      organizationRefId: accounts[i % accounts.length]?._id,
      assignedTo: ownerId,
      channel: 'Internal',
      caseNotes: `Sample case for Reports E2E (${runId})`,
      currentSlaCycle: mkSla(randomInt(2, 7)),
      tags: [SEED_TAG],
      createdBy: ownerId,
      updatedBy: ownerId,
    });
    created.push(doc);
  }
  return created;
}

async function seedQuotes(orgId, ownerId, count, runId, people, accounts, deals) {
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const doc = await Quote.create({
      organizationId: orgId,
      quoteNumber: `QT-${runId}-${String(i + 1).padStart(3, '0')}`,
      quoteTitle: `${SEED_TAG} Quote ${runId}-${i + 1}`,
      status: pick(QUOTE_STATUSES),
      assignedTo: ownerId,
      contactId: people[i % people.length]?._id,
      organizationRefId: accounts[i % accounts.length]?._id,
      dealId: deals[i % deals.length]?._id,
      currency: 'USD',
      subtotal: randomInt(1000, 50000),
      grandTotal: randomInt(1000, 55000),
      validUntil: daysFromNow(randomInt(14, 60)),
      sourceContext: 'manual',
    });
    created.push(doc);
  }
  return created;
}

async function seedItems(orgId, ownerId, count, runId) {
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const doc = await Item.create({
      organizationId: orgId,
      item_name: `${SEED_TAG} Item ${runId}-${i + 1}`,
      item_code: `SKU-${runId}-${String(i + 1).padStart(3, '0')}`,
      item_type: pick(ITEM_TYPES),
      status: pick(['Active', 'Inactive']),
      unit_of_measure: pick(['pcs', 'hours', 'units']),
      createdBy: ownerId,
      modifiedBy: ownerId,
      tags: [SEED_TAG],
      source: 'Import',
    });
    created.push(doc);
  }
  return created;
}

async function seedFormResponses(orgId, ownerId, count, runId, sampleForm) {
  const created = [];
  const execStatuses = ['Not Started', 'In Progress', 'Submitted'];

  for (let i = 0; i < count; i += 1) {
    const doc = await FormResponse.create({
      organizationId: orgId,
      formId: sampleForm._id,
      submittedBy: ownerId,
      submittedAt: daysAgo(randomInt(0, 14)),
      executionStatus: execStatuses[i % execStatuses.length],
      source: 'Direct',
      responseDetails: [
        { questionId: 'q1', sectionId: 'sec-reports-e2e', answer: randomInt(1, 5), score: randomInt(1, 5) },
        { questionId: 'q2', sectionId: 'sec-reports-e2e', answer: `${SEED_TAG} response ${runId}-${i + 1}` },
      ],
      kpis: {
        rating: randomInt(1, 5),
        finalScore: randomInt(60, 100),
        totalQuestions: 2,
      },
    });
    created.push(doc);
  }
  return created;
}

async function seedAll({ organizationId, count }) {
  const runId = Date.now().toString(36).toUpperCase();
  const actor = await resolveActor(organizationId);
  const summary = {};

  await withTenant(organizationId, async () => {
    console.log(`\nSeeding ${count} records per module (run=${runId}, tag=${SEED_TAG})...\n`);

    const people = await seedPeople(organizationId, actor._id, count, runId);
    summary.people = people.length;
    console.log(`  people:          ${people.length}`);

    const accounts = await seedOrganizations(actor._id, count, runId);
    summary.organizations = accounts.length;
    console.log(`  organizations:   ${accounts.length}`);

    const deals = await seedDeals(organizationId, actor._id, count, runId, people, accounts);
    summary.deals = deals.length;
    console.log(`  deals:           ${deals.length}`);

    summary.tasks = (await seedTasks(organizationId, actor._id, count, runId, people)).length;
    console.log(`  tasks:           ${summary.tasks}`);

    summary.events = (await seedEvents(organizationId, actor._id, count, runId)).length;
    console.log(`  events:          ${summary.events}`);

    summary.cases = (await seedCases(organizationId, actor._id, count, runId, people, accounts)).length;
    console.log(`  cases:           ${summary.cases}`);

    summary.quotes = (await seedQuotes(organizationId, actor._id, count, runId, people, accounts, deals)).length;
    console.log(`  quotes:          ${summary.quotes}`);

    summary.items = (await seedItems(organizationId, actor._id, count, runId)).length;
    console.log(`  items:           ${summary.items}`);

    const sampleForm = await ensureSampleForm(organizationId, actor._id);
    summary.forms = (await seedFormResponses(organizationId, actor._id, count, runId, sampleForm)).length;
    console.log(`  forms (responses): ${summary.forms}`);
  });

  const modules = listAnalyticsModules().map((m) => m.moduleKey);
  const missing = modules.filter((k) => summary[k] == null);
  if (missing.length) {
    console.warn(`\nWarning: no seeder for registry modules: ${missing.join(', ')}`);
  }

  console.log(`\nDone. Seeded as user ${actor.email}. Filter by tag "${SEED_TAG}" or run id "${runId}".`);
  return { runId, summary, actorEmail: actor.email };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('══ Reports E2E sample data seed ══\n');
  await connectDb();

  const organizationId = await resolveOrganizationId(args);
  await seedAll({ organizationId, count: args.count });

  await dbConnectionManager.closeAllConnections();
  await mongoose.connection.close();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedAll, SEED_TAG };
