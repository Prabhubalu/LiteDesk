'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const crypto = require('crypto');

const Organization = require('../../models/Organization');
const ModuleDefinition = require('../../models/ModuleDefinition');
const User = require('../../models/User');
const Deal = require('../../models/Deal');
const Notification = require('../../models/Notification');
const PlaybookAlertScheduleJob = require('../../models/PlaybookAlertScheduleJob');
const { executePlaybookForDeal } = require('../playbookExecutionService');
const {
  syncPlaybookAlertJobsForDeal,
  processDuePlaybookAlertJobs
} = require('../playbookAlertSchedulingService');
const { computeAlertRunAt } = require('../../utils/playbookAlertUtils');
const { resolveStagePlaybook } = require('../../utils/playbookResolver');
const notificationSSEHub = require('../notificationSSEHub');

let mongoServer;

const PIPELINE_KEY = 'default';
const STAGE_KEY = 'qualification';
const STAGE_NAME = 'Qualification';
const ACTION_KEY = 'research-account';

async function seedContext() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await Organization.create({
    name: `Playbook Alert Org ${suffix}`,
    slug: `pb-alert-${suffix}`,
    isTenant: true,
    isActive: true
  });
  const assignedTo = new mongoose.Types.ObjectId();
  await User.create({
    _id: assignedTo,
    organizationId: org._id,
    username: `owner-${suffix}`,
    email: `owner-${suffix}@example.com`,
    password: 'test-password-hash',
    firstName: 'Playbook',
    lastName: 'Owner',
    status: 'active'
  });

  const pipelineSettings = [{
    key: PIPELINE_KEY,
    name: 'Default',
    isDefault: true,
    stages: [{
      key: STAGE_KEY,
      name: STAGE_NAME,
      probability: 25,
      status: 'open',
      playbook: {
        enabled: true,
        mode: 'non_sequential',
        actions: [{
          key: ACTION_KEY,
          title: 'Research account',
          actionType: 'task',
          dueInDays: 0,
          autoCreate: false,
          trigger: { type: 'stage_entry' },
          assignment: { type: 'deal_owner' },
          alerts: [{
            type: 'in_app',
            offset: { amount: 0, unit: 'hours' },
            recipients: [],
            message: 'Kick off qualification research'
          }]
        }]
      }
    }]
  }];

  await ModuleDefinition.create({
    organizationId: org._id,
    key: 'deals',
    moduleKey: 'deals',
    appKey: 'sales',
    label: 'Deal',
    pluralLabel: 'Deals',
    entityType: 'TRANSACTION',
    type: 'system',
    enabled: true,
    name: 'Deals',
    pipelineSettings
  });

  const deal = await Deal.create({
    organizationId: org._id,
    name: 'Alert Test Deal',
    amount: 1000,
    stage: STAGE_NAME,
    pipeline: PIPELINE_KEY,
    expectedCloseDate: new Date('2026-12-31'),
    assignedTo
  });

  return { org, deal, assignedTo, pipelineSettings };
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  notificationSSEHub.shutdown();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test.beforeEach(async () => {
  await PlaybookAlertScheduleJob.deleteMany({});
  await Notification.deleteMany({});
  await Deal.deleteMany({});
  await ModuleDefinition.deleteMany({});
  await User.deleteMany({});
  await Organization.deleteMany({});
});

test('computeAlertRunAt anchors to action dueAt when present', () => {
  const dueAt = new Date('2026-06-10T09:00:00.000Z');
  const runAt = computeAlertRunAt(
    { dueAt },
    { startedAt: new Date('2026-06-01T09:00:00.000Z') },
    { amount: 1, unit: 'days' }
  );
  assert.equal(runAt.toISOString(), '2026-06-11T09:00:00.000Z');
});

test('executePlaybookForDeal enqueues alert jobs for configured alerts', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const jobs = await PlaybookAlertScheduleJob.find({
    organizationId: org._id,
    dealId: deal._id,
    status: 'pending'
  }).lean();

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].actionKey, ACTION_KEY);
  assert.equal(jobs[0].alertIndex, 0);
});

test('processDuePlaybookAlertJobs delivers in-app notification to deal owner', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const result = await processDuePlaybookAlertJobs();
  assert.equal(result.completed, 1);

  const notifications = await Notification.find({
    organizationId: org._id,
    userId: assignedTo
  }).lean();

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].eventType, 'PLAYBOOK_ACTION_ALERT');
  assert.match(notifications[0].body, /Kick off qualification research/);
});

test('alert jobs are skipped when playbook action is already completed', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  deal.playbookState.actions[0].status = 'completed';
  deal.markModified('playbookState');
  await deal.save();

  const resolvedPlaybook = resolveStagePlaybook(pipelineSettings, deal.pipeline, deal.stage);
  await syncPlaybookAlertJobsForDeal(deal, resolvedPlaybook, assignedTo);

  const result = await processDuePlaybookAlertJobs();
  assert.equal(result.skipped, 1);

  const notifications = await Notification.countDocuments({ organizationId: org._id });
  assert.equal(notifications, 0);
});
