'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const crypto = require('crypto');

const Organization = require('../../models/Organization');
const ModuleDefinition = require('../../models/ModuleDefinition');
const Deal = require('../../models/Deal');
const Task = require('../../models/Task');
const PlaybookScheduleJob = require('../../models/PlaybookScheduleJob');
const { executePlaybookForDeal } = require('../playbookExecutionService');
const {
  syncPlaybookDelayJobsForDeal,
  processDuePlaybookDelayJobs,
  cancelPendingPlaybookDelayJobsForDeal
} = require('../playbookSchedulingService');
const { computeTriggerDelayRunAt } = require('../../utils/playbookTriggerUtils');
const { resolveStagePlaybook } = require('../../utils/playbookResolver');

let mongoServer;

const PIPELINE_KEY = 'default';
const STAGE_KEY = 'qualification';
const STAGE_NAME = 'Qualification';
const DELAYED_ACTION_KEY = 'delayed-follow-up';

async function seedContext() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await Organization.create({
    name: `Playbook Delay Org ${suffix}`,
    slug: `pb-delay-${suffix}`,
    isTenant: true,
    isActive: true
  });
  const assignedTo = new mongoose.Types.ObjectId();

  const deal = await Deal.create({
    organizationId: org._id,
    name: 'Delay Test Deal',
    amount: 1000,
    stage: STAGE_NAME,
    pipeline: PIPELINE_KEY,
    expectedCloseDate: new Date('2026-12-31'),
    assignedTo
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
          key: DELAYED_ACTION_KEY,
          title: 'Delayed follow up',
          actionType: 'task',
          dueInDays: 1,
          autoCreate: true,
          trigger: { type: 'time_delay', delay: { amount: 0, unit: 'hours' } },
          assignment: { type: 'deal_owner' }
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

  return { org, deal, assignedTo, pipelineSettings };
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.beforeEach(async () => {
  await PlaybookScheduleJob.deleteMany({});
  await Task.deleteMany({});
  await Deal.deleteMany({});
  await ModuleDefinition.deleteMany({});
  await Organization.deleteMany({});
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('computeTriggerDelayRunAt supports minutes, hours, and days', () => {
  const anchor = new Date('2026-06-01T12:00:00.000Z');

  assert.equal(
    computeTriggerDelayRunAt(anchor, { amount: 30, unit: 'minutes' }).toISOString(),
    '2026-06-01T12:30:00.000Z'
  );
  assert.equal(
    computeTriggerDelayRunAt(anchor, { amount: 2, unit: 'hours' }).toISOString(),
    '2026-06-01T14:00:00.000Z'
  );
  assert.equal(
    computeTriggerDelayRunAt(anchor, { amount: 1, unit: 'days' }).toISOString(),
    '2026-06-02T12:00:00.000Z'
  );
});

test('executePlaybookForDeal enqueues delayed auto-create jobs', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const jobs = await PlaybookScheduleJob.find({
    organizationId: org._id,
    dealId: deal._id,
    status: 'pending'
  }).lean();

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].actionKey, DELAYED_ACTION_KEY);
  assert.equal(jobs[0].stageKey, STAGE_KEY);

  const tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 0);
});

test('processDuePlaybookDelayJobs creates linked task when delay elapses', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const result = await processDuePlaybookDelayJobs();
  assert.equal(result.completed, 1);

  const reloaded = await Deal.findById(deal._id).lean();
  assert.ok(reloaded.playbookState.actions[0].createdActivityId);

  const tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Delayed follow up');
});

test('pending delay jobs are cancelled when deal leaves stage playbook', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const cancelResult = await cancelPendingPlaybookDelayJobsForDeal(org._id, deal._id, {
    reason: 'test_cancel'
  });
  assert.equal(cancelResult.cancelled, 1);

  const resolvedPlaybook = resolveStagePlaybook(pipelineSettings, deal.pipeline, deal.stage);
  const syncResult = await syncPlaybookDelayJobsForDeal(deal, resolvedPlaybook, assignedTo);
  assert.equal(syncResult.queued, 1);

  deal.stage = 'Proposal';
  deal.playbookState = { executionLog: deal.playbookState.executionLog };
  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings: [{
      ...pipelineSettings[0],
      stages: [
        pipelineSettings[0].stages[0],
        {
          key: 'proposal',
          name: 'Proposal',
          probability: 50,
          status: 'open',
          playbook: { enabled: false, actions: [] }
        }
      ]
    }]
  });
  await deal.save();

  const pendingJobs = await PlaybookScheduleJob.countDocuments({
    organizationId: org._id,
    dealId: deal._id,
    status: 'pending'
  });
  assert.equal(pendingJobs, 0);
});
