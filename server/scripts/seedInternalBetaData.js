#!/usr/bin/env node
/**
 * Internal beta — rich, realistic seed data for teammate testing and partner demos.
 *
 * Creates (or reuses) a dedicated tenant: default slug `arivu-internal-beta`.
 * Populates people, company accounts, deals across the pipeline, tasks, meetings, internal audit events,
 * helpdesk cases, and a sample form. (Dashboards, reports, and automations are often org UI config; extend here as needed.)
 *
 * Run against your dev / UAT database (not production) unless you know what you are doing.
 *
 *   node scripts/seedInternalBetaData.js
 *   npm run seed:internal-beta   # from server/ (same as above)
 *   node scripts/seedInternalBetaData.js --skip-org    # only top up CRM data if org already exists
 *   INTERNAL_BETA_SEED_PASSWORD=YourSecure!Pass node scripts/seedInternalBetaData.js
 *
 * Env:
 *   INTERNAL_BETA_SEED_PASSWORD — owner login password (default: one-time random, printed to stdout)
 *   INTERNAL_BETA_SLUG          — org slug (default: arivu-internal-beta)
 *   INTERNAL_BETA_FORCE=1      — re-run data seed even if deals already exist
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { getMongoUris, connectMasterWithRetry, MASTER_DB } = require('../lib/mongoConnect');
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
const Role = require('../models/Role');

const argv = new Set(process.argv.slice(2));
const ONLY_DATA = argv.has('--skip-org');
const force = process.env.INTERNAL_BETA_FORCE === '1' || process.env.INTERNAL_BETA_FORCE === 'true';
const BETA_SLUG = (process.env.INTERNAL_BETA_SLUG || 'arivu-internal-beta').toLowerCase().replace(/[^a-z0-9-]/g, '');

const TENANT_NAME = 'Arivu Internal Demo';
const TAG = 'Internal Beta';
const BETA_NOTES = 'Seeded for internal beta (realistic enterprise scenario).';

const PEOPLE = [
  { first_name: 'Alexandra', last_name: 'Morrison', email: 'alex.morrison@nimbuslogistics.com', title: 'VP Operations', phone: '+1 312 555 0140', tags: [TAG, 'Enterprise'] },
  { first_name: 'Santiago', last_name: 'Rivas', email: 's.rivas@nimbuslogistics.com', title: 'Procurement Director', phone: '+1 312 555 0141', tags: [TAG, 'Economic buyer'] },
  { first_name: 'Priya', last_name: 'Natarajan', email: 'priya.n@vertexhealth.com', title: 'IT Director', phone: '+1 415 555 0190', tags: [TAG, 'Champion'] },
  { first_name: 'Daniel', last_name: 'Kwon', email: 'dkwon@vertexhealth.com', title: 'Security Lead', phone: '+1 415 555 0191', tags: [TAG, 'Influencer'] },
  { first_name: 'Rachel', last_name: 'Foster', email: 'r.foster@helixmfg.com', title: 'COO', phone: '+1 503 555 0103', tags: [TAG, 'C-level'] },
  { first_name: 'Marcus', last_name: 'Ibrahim', email: 'm.ibrahim@helixmfg.com', title: 'Plant Manager', phone: '+1 503 555 0104', tags: [TAG, 'User'] },
  { first_name: 'Elena', last_name: 'Garcia', email: 'elena.g@sample.io', title: 'Program Manager', phone: '+1 206 555 0177', tags: [TAG, 'Trial'] }
];

const ACCOUNTS = [
  { name: 'Nimbus Logistics', industry: 'Logistics & Supply Chain', status: 'Active', size: 'Enterprise', region: 'North America' },
  { name: 'Vertex Health Systems', industry: 'Healthcare', status: 'Active', size: 'Mid-market', region: 'West' },
  { name: 'Helix Manufacturing', industry: 'Manufacturing', status: 'Active', size: 'Enterprise', region: 'Pacific Northwest' }
];

function getPipelineInfo(dealsModule) {
  const pips = (dealsModule && Array.isArray(dealsModule.pipelineSettings) && dealsModule.pipelineSettings.length
    ? dealsModule.pipelineSettings
    : null);
  if (!pips || !pips.length) {
    return { pipelineKey: 'default_pipeline', stageNames: ['Qualification', 'Proposal', 'Negotiation', 'Contract Sent', 'Closed Won', 'Closed Lost'] };
  }
  const pip = pips.find((p) => p && p.isDefault) || pips[0];
  const key = (pip.key || 'default_pipeline').toString();
  const stages = Array.isArray(pip.stages) ? pip.stages : [];
  const names = stages.map((s) => s.name).filter(Boolean);
  if (!names.length) {
    return { pipelineKey: key, stageNames: ['Qualification', 'Proposal', 'Closed Won', 'Closed Lost'] };
  }
  return { pipelineKey: key, stageNames: names };
}

function dealStatusForStage(stageName) {
  const s = (stageName || '').toLowerCase();
  if (s.includes('won')) return 'Won';
  if (s.includes('lost')) return 'Lost';
  return 'Open';
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000);
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000);
}

async function ensureOwnerUser(organization, passwordPlain) {
  const defaultEmail = process.env.INTERNAL_BETA_SEED_EMAIL || `beta.owner+${BETA_SLUG}@arivusystems.com`;
  let u = await User.findOne({ organizationId: organization._id, isOwner: true });
  if (u) {
    if (process.env.INTERNAL_BETA_SEED_PASSWORD) {
      const salt = await bcrypt.genSalt(10);
      u.password = await bcrypt.hash(process.env.INTERNAL_BETA_SEED_PASSWORD, salt);
      await u.save();
      console.log('   Updated owner password from INTERNAL_BETA_SEED_PASSWORD');
    }
    return { user: u, email: u.email, password: passwordPlain || undefined };
  }
  u = await User.create({
    organizationId: organization._id,
    username: 'internalbeta',
    email: defaultEmail,
    password: await bcrypt.hash(passwordPlain, await bcrypt.genSalt(10)),
    firstName: 'Internal',
    lastName: 'Beta',
    role: 'owner',
    isOwner: true,
    status: 'active',
  });
  u.setPermissionsByRole('owner');
  await u.save();
  return { user: u, email: u.email, password: passwordPlain };
}

async function createOrLoadTenant() {
  let org = await Organization.findOne({ slug: BETA_SLUG });
  if (org) {
    console.log(`\nUsing existing org slug=${BETA_SLUG} (${org._id})`);
    return org;
  }
  if (ONLY_DATA) {
    throw new Error(`Organization with slug ${BETA_SLUG} not found. Run without --skip-org first.`);
  }

  const dbName = `arivu_${BETA_SLUG.replace(/-/g, '_')}`;
  const dbm = require('../utils/databaseConnectionManager');
  const uriCfg = getMongoUris();
  dbm.baseMongoUri = uriCfg.baseUri;
  dbm.connectionQuery = uriCfg.mongoQueryString;
  await dbm.initializeMasterConnection();
  const connectionString = `${uriCfg.baseUri}/${dbName}${uriCfg.mongoQueryString || ''}`;

  try {
    await dbm.createOrganizationDatabase(dbName);
  } catch (e) {
    console.warn('   (database may already exist)', e.message);
  }

  const temp = new Organization();
  const allowedModules = temp.getModulesForTier('paid').filter((m) => !['demo_requests', 'instances'].includes(m));
  const enabledApps = [
    { appKey: 'SALES', status: 'ACTIVE', enabledAt: new Date() },
    { appKey: 'AUDIT', status: 'ACTIVE', enabledAt: new Date() },
    { appKey: 'PORTAL', status: 'ACTIVE', enabledAt: new Date() },
  ];
  if (!enabledApps.find((a) => a.appKey === 'HELPDESK')) {
    enabledApps.push({ appKey: 'HELPDESK', status: 'ACTIVE', enabledAt: new Date() });
  }

  org = await Organization.create({
    name: TENANT_NAME,
    slug: BETA_SLUG,
    industry: 'Business Software',
    isActive: true,
    isTenant: true,
    customerStatus: 'Active',
    subscription: { status: 'active', tier: 'paid', currentPeriodStart: new Date() },
    limits: { maxUsers: 500, maxContacts: 100000, maxDeals: 100000, maxStorageGB: 200 },
    settings: { timeZone: 'America/New_York', currency: 'USD' },
    enabledModules: allowedModules,
    enabledApps,
    database: { name: dbName, connectionString, createdAt: new Date(), initialized: true },
  });

  const pwd =
    process.env.INTERNAL_BETA_SEED_PASSWORD ||
    `Arivu!beta-${Math.random().toString(36).slice(2, 10)}`;
  const { user } = await ensureOwnerUser(org, pwd);
  await Role.createDefaultRoles(org._id);

  const salesInit = require('../services/salesAppInitializer');
  await salesInit.initializeSales(org._id);

  const updateOrganizationsModuleFields = require('./updateOrganizationsModuleFields');
  await require('./updateDealsModuleFields')(org._id);
  await require('./updatePeopleModuleFields')(org._id);
  try {
    await updateOrganizationsModuleFields(org._id);
  } catch (e) {
    console.warn('   updateOrganizationsModuleFields:', e.message);
  }

  console.log('\n✅ Created tenant', org.name, org._id);
  console.log('   Database:', dbName);
  console.log('   Login email:', process.env.INTERNAL_BETA_SEED_EMAIL || `beta.owner+${BETA_SLUG}@arivusystems.com`);
  console.log('   Login password (save securely):', pwd);
  return Organization.findById(org._id);
}

async function seedCrm(organization, owner) {
  const orgId = organization._id;
  if (!force) {
    const dCount = await Deal.countDocuments({ organizationId: orgId, deletedAt: null });
    if (dCount >= 3) {
      console.log(`\n⏭️  Skipping CRM seed: ${dCount} deals already exist. Set INTERNAL_BETA_FORCE=1 to re-seed.`);
      return;
    }
  }

  const dealsMod = await ModuleDefinition.findOne({ organizationId: orgId, moduleKey: 'deals' });
  const { pipelineKey, stageNames } = getPipelineInfo(dealsMod);
  const pick = (i) => stageNames[Math.min(i, stageNames.length - 1)];

  const userName = 'Internal Beta';

  const peopleDocs = [];
  for (const p of PEOPLE) {
    const exist = await People.findOne({ organizationId: orgId, email: p.email, deletedAt: null });
    if (exist) {
      peopleDocs.push(exist);
      continue;
    }
    const person = await People.create({
      organizationId: orgId,
      createdBy: owner._id,
      assignedTo: owner._id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      // Must match server/constants/recordSource.js (RECORD_SOURCE_VALUES)
      source: 'Import',
      tags: p.tags,
      participations: {
        SALES: { role: 'Contact', contact_status: 'Active' },
      },
      activityLogs: [
        { user: userName, userId: owner._id, action: 'contact_upserted', message: BETA_NOTES, timestamp: daysAgo(3) },
        { user: userName, userId: owner._id, action: 'email_sent', message: 'Intro call scheduled', timestamp: daysAgo(1) },
      ],
    });
    peopleDocs.push(person);
  }

  const accountDocs = [];
  for (const a of ACCOUNTS) {
    const exist = await Organization.findOne({
      name: a.name,
      isTenant: false,
      createdBy: owner._id,
    });
    if (exist) {
      accountDocs.push(exist);
      continue;
    }
    const o = await Organization.create({
      name: a.name,
      industry: a.industry,
      isTenant: false,
      customerStatus: a.status,
      createdBy: owner._id,
      assignedTo: owner._id,
      activityLogs: [
        { user: userName, userId: owner._id, action: 'created this record', details: { type: 'create', region: a.region, size: a.size }, timestamp: daysAgo(10) },
      ],
    });
    accountDocs.push(o);
  }

  const companyByEmail = (email) => {
    if (email.includes('nimbus')) return accountDocs[0] || null;
    if (email.includes('vertex')) return accountDocs[1] || null;
    if (email.includes('helix')) return accountDocs[2] || null;
    return accountDocs[0] || null;
  };

  const wonIdx = stageNames.findIndex((s) => (s || '').toLowerCase().includes('won'));
  const wonStage = wonIdx >= 0 ? wonIdx : Math.max(0, stageNames.length - 2);

  const dealSeeds = [
    { name: 'Nimbus — Fleet routing & analytics (FY renewal)', amount: 420000, pIdx: 0, cIdx: 0, aIdx: 0, dayClose: 45, next: 'Security review on pricing' },
    { name: 'Vertex — Patient data platform integration', amount: 185000, pIdx: 1, cIdx: 2, aIdx: 1, dayClose: 28, next: 'Architecture workshop' },
    { name: 'Helix — MES + quality module rollout (Phase 1)', amount: 310000, pIdx: 2, cIdx: 4, aIdx: 2, dayClose: 60, next: 'Pilot line selection' },
    { name: 'Nimbus — Add-on: warehouse labor planning', amount: 78000, pIdx: 1, cIdx: 1, aIdx: 0, dayClose: 14, next: 'Send SOW' },
    { name: 'Vertex — Support uplift (Q2 bundle)', amount: 42000, pIdx: 4, cIdx: 3, aIdx: 1, dayClose: 7, next: 'Procurement sign-off' },
    { name: 'Closed reference — MedTech co. (inbound)', amount: 96000, pIdx: wonStage, cIdx: 0, aIdx: 1, dayClose: -30, next: 'Closed' },
  ];

  for (const d of dealSeeds) {
    const contact = peopleDocs[d.cIdx] || peopleDocs[0];
    const acct = accountDocs[d.aIdx] || companyByEmail(contact.email);
    const st = pick(d.pIdx);
    const status = dealStatusForStage(st);
    const expected = d.dayClose >= 0 ? daysFromNow(d.dayClose) : daysAgo(-d.dayClose);

    let newDeal;
    try {
    newDeal = await Deal.create({
      organizationId: orgId,
      name: d.name,
      amount: d.amount,
      currency: 'USD',
      pipeline: pipelineKey,
      stage: st,
      probability: status === 'Won' ? 100 : status === 'Lost' ? 0 : [20, 35, 50, 65, 80][d.pIdx % 5] || 40,
      expectedCloseDate: expected,
      actualCloseDate: status === 'Won' || status === 'Lost' ? daysAgo(5) : undefined,
      contactId: contact._id,
      accountId: acct?._id,
      assignedTo: owner._id,
      createdBy: owner._id,
      modifiedBy: owner._id,
      status: status === 'Won' ? 'Won' : status === 'Lost' ? 'Lost' : 'Open',
      type: d.amount > 200000 ? 'New Business' : 'Existing Business',
      nextStep: d.next,
      description: `${BETA_NOTES} Enterprise motion with real stakeholders; pipeline stage ${st}.`,
      lastActivityDate: daysAgo(1),
      activityLogs: [
        { user: userName, userId: owner._id, action: 'created', details: { pipeline: pipelineKey }, timestamp: daysAgo(2) },
        { user: userName, userId: owner._id, action: 'note_added', details: { text: 'Discovery completed; next step: ROI model.' }, timestamp: daysAgo(1) },
      ],
    });
    await syncDealRelationshipInstances({
      organizationId: orgId,
      dealDoc: newDeal,
      createdBy: owner._id,
      peopleMode: 'replace',
      organizationsMode: 'replace',
    });
    } catch (e) {
      console.warn('   [deal] create/sync skipped for one record:', e.message);
    }
  }

  const contactForTask = (i) => peopleDocs[i % peopleDocs.length];
  const firstDeal = await Deal.findOne({ organizationId: orgId }).sort({ amount: -1 });
  const tasks = [
    { title: 'Send revised proposal — Nimbus fleet bundle', days: 2, done: false, rel: 'deal' },
    { title: 'Vertex security questionnaire (SIG Lite)', days: 5, done: true, rel: 'contact' },
    { title: 'Helix: schedule plant walkthrough with ops', days: 7, done: false, rel: 'contact' },
    { title: 'Internal: QBR deck for leadership review', days: 1, done: true, rel: 'none' },
  ];

  for (const t of tasks) {
    const due = t.done ? daysAgo(1) : daysFromNow(t.days);
    const rel =
      t.rel === 'none'
        ? { type: 'none', id: null }
        : t.rel === 'contact'
          ? { type: 'contact', id: contactForTask(2)._id }
          : { type: 'deal', id: firstDeal?._id || null };

    const rt = rel.id
      ? { type: rel.type, id: rel.id }
      : { type: 'none' };
    await Task.create({
      organizationId: orgId,
      title: t.title,
      description: BETA_NOTES,
      status: t.done ? 'done' : 'in_progress',
      priority: t.days <= 2 ? 'high' : 'medium',
      dueDate: due,
      startDate: daysAgo(t.done ? 4 : 0),
      completedDate: t.done ? daysAgo(1) : null,
      assignedTo: owner._id,
      assignedBy: owner._id,
      relatedTo: rt,
    });
  }

  const evCount = await Event.countDocuments({ organizationId: orgId });
  if (evCount >= 3 && !force) {
    console.log('   (Skipping events: already seeded. INTERNAL_BETA_FORCE=1 to re-seed.)');
  } else {
  const start1 = daysFromNow(1);
  const end1 = new Date(start1.getTime() + 3600000);
  const start2 = daysFromNow(3);
  const end2 = new Date(start2.getTime() + 7200000);
  const start3 = daysAgo(2);
  const end3 = new Date(start3.getTime() + 3600000);

  await Event.create({
    organizationId: orgId,
    eventName: 'Q2 expansion — Nimbus executive checkpoint',
    eventType: 'Meeting',
    status: 'Planned',
    assignedTo: owner._id,
    startDateTime: start1,
    endDateTime: end1,
    location: 'https://meet.arivu.example/room/nimbus-checkin',
    createdBy: owner._id,
    modifiedBy: owner._id,
    createdTime: new Date(),
    modifiedTime: new Date(),
  });
  await Event.create({
    organizationId: orgId,
    eventName: 'Vertex — security & architecture working session',
    eventType: 'Meeting',
    status: 'Planned',
    assignedTo: owner._id,
    startDateTime: start2,
    endDateTime: end2,
    location: 'Seattle, WA — on-site (Building A, Conf 2)',
    createdBy: owner._id,
    modifiedBy: owner._id,
    createdTime: new Date(),
    modifiedTime: new Date(),
  });
  const helixPast = await Event.create({
    organizationId: orgId,
    eventName: 'Helix — MES scoping (completed)',
    eventType: 'Meeting',
    status: 'Planned',
    assignedTo: owner._id,
    startDateTime: start3,
    endDateTime: end3,
    location: 'Portland, OR',
    createdBy: owner._id,
    modifiedBy: owner._id,
    createdTime: daysAgo(3),
    modifiedTime: daysAgo(1),
  });
  // Model pre-save forces new events to Planned; mark completed in a follow-up write for seed realism.
  await Event.updateOne(
    { _id: helixPast._id },
    { $set: { status: 'Completed', completedAt: daysAgo(1), modifiedTime: new Date() } }
  );
  }

  // Helpdesk: two cases
  const existingCases = await Case.countDocuments({ organizationId: orgId });
  if (existingCases < 2 && (force || existingCases === 0)) {
    const tag = `IB${Date.now().toString(36).toUpperCase()}`;
    const mkSla = (resDays) => ({
      cycleNo: 1,
      startedAt: new Date(),
      status: 'running',
      responseTargetAt: daysFromNow(resDays / 2),
      resolutionTargetAt: daysFromNow(resDays),
      policySnapshot: { label: 'Standard', internalBeta: true },
    });
    await Case.create({
      organizationId: orgId,
      caseId: `HD-${tag}-1`,
      title: 'SSO: Azure AD group mapping for field reps',
      caseType: 'Service Request',
      priority: 'High',
      status: 'In Progress',
      contactId: peopleDocs[0]?._id,
      organizationRefId: accountDocs[0]?._id,
      assignedTo: owner._id,
      caseNotes: 'Internal beta seed — customer expects mapping doc by Friday.',
      channel: 'Internal',
      currentSlaCycle: mkSla(3),
      activities: [
        { activityType: 'comment', message: 'Triage: routing to platform team', internal: true, actorId: owner._id, actorName: 'Internal Beta' },
      ],
      createdBy: owner._id,
      updatedBy: owner._id,
    });
    await Case.create({
      organizationId: orgId,
      caseId: `HD-${tag}-2`,
      title: 'Performance: list view slow on 10k+ rows',
      caseType: 'Support Ticket',
      priority: 'Medium',
      status: 'New',
      contactId: peopleDocs[3]?._id,
      assignedTo: owner._id,
      caseNotes: 'Repro: Helpdesk > Cases with saved view “All open”.',
      channel: 'Internal',
      currentSlaCycle: mkSla(5),
      createdBy: owner._id,
      updatedBy: owner._id,
    });
  }

  // Internal Audit events (in-progress + closed) — distinct from general meetings
  const intAuditCount = await Event.countDocuments({ organizationId: orgId, eventType: 'Internal Audit' });
  if (intAuditCount >= 2 && !force) {
    /* already seeded */
  } else {
    if (force && intAuditCount > 0) {
      await Event.deleteMany({ organizationId: orgId, eventType: 'Internal Audit' });
    }
    const aStart = daysFromNow(2);
    const aEnd = new Date(aStart.getTime() + 2 * 3600000);
    const completedStart = daysAgo(4);
    const completedEnd = new Date(completedStart.getTime() + 3600000);
    const nameScheduled = 'Internal — Q2 controls & access review (scheduled)';
    const nameClosed = 'Internal — Data handling spot check (closed)';
    if (!(await Event.findOne({ organizationId: orgId, eventName: nameScheduled }))) {
      await Event.create({
        organizationId: orgId,
        eventName: nameScheduled,
        eventType: 'Internal Audit',
        status: 'Planned',
        auditState: 'needs_review',
        relatedToId: orgId,
        assignedTo: owner._id,
        auditorId: owner._id,
        correctiveOwnerId: owner._id,
        startDateTime: aStart,
        endDateTime: aEnd,
        location: 'Remote — secure review room / VPN',
        createdBy: owner._id,
        modifiedBy: owner._id,
        createdTime: new Date(),
        modifiedTime: new Date(),
      });
    }
    if (!(await Event.findOne({ organizationId: orgId, eventName: nameClosed }))) {
      await Event.create({
        organizationId: orgId,
        eventName: nameClosed,
        eventType: 'Internal Audit',
        auditState: 'closed',
        relatedToId: orgId,
        assignedTo: owner._id,
        auditorId: owner._id,
        correctiveOwnerId: owner._id,
        startDateTime: completedStart,
        endDateTime: completedEnd,
        location: 'HQ / documented',
        createdBy: owner._id,
        modifiedBy: owner._id,
        createdTime: daysAgo(5),
        modifiedTime: daysAgo(1),
      });
    }
  }

  if (!(await Form.findOne({ organizationId: orgId, name: 'QBR — Customer health (sample)' }))) {
    await Form.create({
      organizationId: orgId,
      name: 'QBR — Customer health (sample)',
      description: 'Internal beta sample audit-style form for QBRs.',
      formType: 'Audit',
      status: 'Active',
      visibility: 'Internal',
      formId: `form-beta-${BETA_SLUG}-qbr`,
      formVersion: 1,
      assignedTo: owner._id,
      sections: [
        {
          sectionId: 'sec-beta-qbr',
          name: 'Engagement & outcomes',
          questions: [
            { questionId: 'q1', questionText: 'Primary business outcome for this quarter', type: 'Text', mandatory: true },
            { questionId: 'q2', questionText: 'Satisfaction (1-5 stars)', type: 'Rating', mandatory: true },
            { questionId: 'q3', questionText: 'Risks or blockers', type: 'Textarea', mandatory: false },
          ],
        },
      ],
      createdBy: owner._id,
      modifiedBy: owner._id,
    });
  }

  console.log(`\n✅ CRM + tasks + events + helpdesk + form seeded for org ${orgId}`);
}

async function main() {
  console.log('══ Arivu internal beta data seed ══\n');
  const uri = getMongoUris();
  if (mongoose.connection.readyState === 0) {
    await connectMasterWithRetry(uri.masterUri);
  }
  if (mongoose.connection.name !== MASTER_DB) {
    console.error(`Expected connection to ${MASTER_DB}, got ${mongoose.connection.name}`);
    process.exit(1);
  }
  const dbm = require('../utils/databaseConnectionManager');
  const u = getMongoUris();
  dbm.baseMongoUri = u.baseUri;
  dbm.connectionQuery = u.mongoQueryString;
  await dbm.initializeMasterConnection();

  let org;
  if (ONLY_DATA) {
    org = await Organization.findOne({ slug: BETA_SLUG });
    if (!org) {
      throw new Error(`No organization with slug ${BETA_SLUG}. Run full seed first (without --skip-org).`);
    }
  } else {
    org = await createOrLoadTenant();
  }
  if (!org._id) {
    throw new Error('No organization id');
  }
  const pwd =
    process.env.INTERNAL_BETA_SEED_PASSWORD ||
    `Arivu!beta-${Math.random().toString(36).slice(2, 10)}`;
  let owner = await User.findOne({ organizationId: org._id, isOwner: true });
  if (!owner) {
    const r = await ensureOwnerUser(org, pwd);
    owner = r.user;
    if (!process.env.INTERNAL_BETA_SEED_PASSWORD) {
      console.log('\nOwner password (one-time):', r.password);
    }
  }
  await seedCrm(org, owner);

  await mongoose.connection.close();
  console.log('\nDone. Use this tenant for UAT: dev / internal beta. Do not point production here.\n');
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { createOrLoadTenant, seedCrm, getPipelineInfo };
