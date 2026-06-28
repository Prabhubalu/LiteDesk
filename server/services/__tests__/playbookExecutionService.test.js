'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const crypto = require('crypto');

const Organization = require('../../models/Organization');
const Deal = require('../../models/Deal');
const Task = require('../../models/Task');
const RelationshipInstance = require('../../models/RelationshipInstance');
const {
  executePlaybookForDeal,
  syncDealPlaybookFromActivity,
  computeActionGating,
  updatePlaybookActionStatus,
  evaluatePlaybookExitCriteria,
  reconcilePlaybookForDeal,
  refreshPlaybookStatesForDealList,
  buildActionState
} = require('../playbookExecutionService');

let mongoServer;

const PIPELINE_KEY = 'default';
const STAGE_KEY = 'qualification';
const STAGE_NAME = 'Qualification';
const ACTION_KEY = 'qual-follow-up';

function buildPipelineSettings() {
  return [{
    key: PIPELINE_KEY,
    name: 'Default',
    isDefault: true,
    stages: [
      {
        key: STAGE_KEY,
        name: STAGE_NAME,
        probability: 25,
        status: 'open',
        playbook: {
          enabled: true,
          mode: 'non_sequential',
          autoAdvance: false,
          actions: [{
            key: ACTION_KEY,
            title: 'Follow up call',
            actionType: 'task',
            dueInDays: 2,
            required: true,
            autoCreate: true,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          }],
          exitCriteria: { type: 'all_actions_completed' }
        }
      },
      {
        key: 'proposal',
        name: 'Proposal',
        probability: 50,
        status: 'open',
        playbook: { enabled: false, actions: [] }
      }
    ]
  }];
}

async function seedContext() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await Organization.create({
    name: `Playbook Test Org ${suffix}`,
    slug: `playbook-${suffix}`,
    isTenant: true,
    isActive: true
  });
  const assignedTo = new mongoose.Types.ObjectId();

  const deal = await Deal.create({
    organizationId: org._id,
    name: 'Test Deal',
    amount: 1000,
    stage: STAGE_NAME,
    pipeline: PIPELINE_KEY,
    expectedCloseDate: new Date('2026-12-31'),
    assignedTo
  });

  return { org, deal, assignedTo, pipelineSettings: buildPipelineSettings() };
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('stage entry creates linked task and persists playbookState', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Follow up call');
  assert.equal(String(tasks[0].relatedTo.id), String(deal._id));

  const links = await RelationshipInstance.find({
    organizationId: org._id,
    relationshipKey: 'task_deals',
    'source.moduleKey': 'tasks',
    'source.recordId': tasks[0]._id,
    'target.moduleKey': 'deals',
    'target.recordId': deal._id
  });
  assert.equal(links.length, 1);

  assert.ok(deal.playbookState);
  assert.equal(deal.playbookState.stageKey, STAGE_KEY);
  assert.equal(deal.playbookState.actions.length, 1);
  assert.equal(deal.playbookState.actions[0].actionKey, ACTION_KEY);
  assert.equal(deal.playbookState.actions[0].status, 'pending');
  assert.equal(deal.playbookState.actions[0].required, true);
  assert.equal(String(deal.playbookState.actions[0].createdActivityId), String(tasks[0]._id));
  assert.equal(deal.playbookState.executionLog.length, 1);
});

test('re-entering the same stage does not duplicate activities', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();
  const firstTaskId = deal.playbookState.actions[0].createdActivityId;

  deal.stage = 'Proposal';
  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });

  deal.stage = STAGE_NAME;
  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 1);
  assert.equal(String(deal.playbookState.actions[0].createdActivityId), String(firstTaskId));
  assert.equal(deal.playbookState.executionLog.length, 1);
});

test('completing linked task syncs deal playbook action status', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const taskId = deal.playbookState.actions[0].createdActivityId;
  await Task.updateOne(
    { _id: taskId, organizationId: org._id },
    { $set: { status: 'completed', completedDate: new Date() } }
  );

  await syncDealPlaybookFromActivity({
    activityId: taskId,
    activityType: 'task',
    organizationId: org._id,
    activityDoc: { status: 'completed', completedDate: new Date() }
  });

  const reloaded = await Deal.findById(deal._id).lean();
  assert.equal(reloaded.playbookState.actions[0].status, 'completed');
  assert.ok(reloaded.playbookState.actions[0].completedAt);
});

test('sequential mode blocks later actions and defers auto-create', async () => {
  const { org, deal, assignedTo } = await seedContext();
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
        mode: 'sequential',
        actions: [
          {
            key: 'step-one',
            title: 'Step one',
            actionType: 'task',
            autoCreate: true,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          },
          {
            key: 'step-two',
            title: 'Step two',
            actionType: 'task',
            autoCreate: true,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          }
        ]
      }
    }]
  }];

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 1);
  assert.equal(deal.playbookState.mode, 'sequential');
  assert.equal(deal.playbookState.actions[0].status, 'pending');
  assert.equal(deal.playbookState.actions[1].status, 'blocked');
  assert.deepEqual(deal.playbookState.actions[1].blockedBy, ['step-one']);
});

test('dependency unlock auto-creates the next activity', async () => {
  const { org, deal, assignedTo } = await seedContext();
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
        actions: [
          {
            key: 'first-step',
            title: 'First step',
            actionType: 'task',
            autoCreate: true,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          },
          {
            key: 'second-step',
            title: 'Second step',
            actionType: 'task',
            dependencies: ['first-step'],
            autoCreate: true,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          }
        ]
      }
    }]
  }];

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  let tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 1);
  assert.equal(deal.playbookState.actions[1].status, 'blocked');

  const firstTaskId = deal.playbookState.actions[0].createdActivityId;
  const completedDate = new Date();
  await Task.updateOne(
    { _id: firstTaskId, organizationId: org._id },
    { $set: { status: 'completed', completedDate } }
  );
  await syncDealPlaybookFromActivity({
    activityId: firstTaskId,
    activityType: 'task',
    organizationId: org._id,
    activityDoc: { status: 'completed', completedDate },
    pipelineSettings
  });

  const reloaded = await Deal.findById(deal._id).lean();
  assert.equal(reloaded.playbookState.actions[0].status, 'completed');
  assert.equal(reloaded.playbookState.actions[1].status, 'pending');
  assert.ok(reloaded.playbookState.actions[1].createdActivityId);

  tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 2);
});

test('after_action trigger unlocks and auto-creates when source action completes', async () => {
  const { org, deal, assignedTo } = await seedContext();
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
        actions: [
          {
            key: 'first-step',
            title: 'First step',
            actionType: 'task',
            autoCreate: true,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          },
          {
            key: 'second-step',
            title: 'Second step',
            actionType: 'task',
            autoCreate: true,
            trigger: { type: 'after_action', sourceActionKey: 'first-step' },
            assignment: { type: 'deal_owner' }
          }
        ]
      }
    }]
  }];

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  let tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 1);
  assert.equal(deal.playbookState.actions[1].status, 'blocked');
  assert.deepEqual(deal.playbookState.actions[1].blockedBy, ['first-step']);

  const firstTaskId = deal.playbookState.actions[0].createdActivityId;
  const completedDate = new Date();
  await Task.updateOne(
    { _id: firstTaskId, organizationId: org._id },
    { $set: { status: 'completed', completedDate } }
  );
  await syncDealPlaybookFromActivity({
    activityId: firstTaskId,
    activityType: 'task',
    organizationId: org._id,
    activityDoc: { status: 'completed', completedDate },
    pipelineSettings
  });

  const reloaded = await Deal.findById(deal._id).lean();
  assert.equal(reloaded.playbookState.actions[0].status, 'completed');
  assert.equal(reloaded.playbookState.actions[1].status, 'pending');
  assert.ok(reloaded.playbookState.actions[1].createdActivityId);

  tasks = await Task.find({ organizationId: org._id, deletedAt: null });
  assert.equal(tasks.length, 2);
});

test('computeActionGating enforces dependencies before sequential order', () => {
  const states = [
    { actionKey: 'a', status: 'pending', dependencies: [], blockedBy: [] },
    { actionKey: 'b', status: 'pending', dependencies: ['a'], blockedBy: [] }
  ];
  const defs = [
    { key: 'a', dependencies: [] },
    { key: 'b', dependencies: ['a'] }
  ];

  const gated = computeActionGating(states, defs, 'sequential');
  assert.equal(gated[0].status, 'pending');
  assert.equal(gated[1].status, 'blocked');
});

test('computeActionGating blocks after_action until source action completes', () => {
  const states = [
    { actionKey: 'a', status: 'pending', dependencies: [], blockedBy: [] },
    { actionKey: 'b', status: 'pending', dependencies: [], blockedBy: [] }
  ];
  const defs = [
    { key: 'a', dependencies: [], trigger: { type: 'stage_entry' } },
    { key: 'b', dependencies: [], trigger: { type: 'after_action', sourceActionKey: 'a' } }
  ];

  const gated = computeActionGating(states, defs, 'non_sequential');
  assert.equal(gated[0].status, 'pending');
  assert.equal(gated[1].status, 'blocked');
  assert.deepEqual(gated[1].blockedBy, ['a']);
});

test('blocked playbook actions cannot be manually completed', async () => {
  const { org, deal, assignedTo } = await seedContext();
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
        mode: 'sequential',
        actions: [
          {
            key: 'step-one',
            title: 'Step one',
            actionType: 'task',
            autoCreate: false,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          },
          {
            key: 'step-two',
            title: 'Step two',
            actionType: 'task',
            autoCreate: false,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          }
        ]
      }
    }]
  }];

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  await assert.rejects(
    () => updatePlaybookActionStatus(deal, 'step-two', 'completed', org._id),
    (error) => error.code === 'PLAYBOOK_ACTION_BLOCKED'
  );
});

test('evaluatePlaybookExitCriteria supports custom deal-field conditions', () => {
  const actions = [
    { actionKey: 'a', status: 'completed', required: true }
  ];
  const deal = { amount: 50000 };

  assert.equal(
    evaluatePlaybookExitCriteria(actions, {
      type: 'custom',
      conditions: [{ field: 'amount', operator: 'gte', value: 40000 }]
    }, deal).met,
    true
  );
  assert.equal(
    evaluatePlaybookExitCriteria(actions, {
      type: 'custom',
      conditions: [{ field: 'amount', operator: 'gte', value: 60000 }]
    }, deal).met,
    false
  );
});

test('evaluatePlaybookExitCriteria supports all and any completion modes', () => {
  const actions = [
    { actionKey: 'a', status: 'completed', required: true },
    { actionKey: 'b', status: 'pending', required: false }
  ];

  assert.equal(
    evaluatePlaybookExitCriteria(actions, { type: 'all_actions_completed' }).met,
    true
  );
  assert.equal(
    evaluatePlaybookExitCriteria(actions, { type: 'any_action_completed' }).met,
    true
  );
  assert.equal(
    evaluatePlaybookExitCriteria(
      [{ actionKey: 'a', status: 'pending', required: true }],
      { type: 'all_actions_completed' }
    ).met,
    false
  );
});

test('auto-advance moves deal to configured next stage when exit criteria met', async () => {
  const { org, deal, assignedTo } = await seedContext();
  const pipelineSettings = [{
    key: PIPELINE_KEY,
    name: 'Default',
    isDefault: true,
    stages: [
      {
        key: STAGE_KEY,
        name: STAGE_NAME,
        probability: 25,
        status: 'open',
        playbook: {
          enabled: true,
          mode: 'non_sequential',
          autoAdvance: true,
          actions: [{
            key: 'only-step',
            title: 'Only step',
            actionType: 'task',
            required: true,
            autoCreate: false,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          }],
          exitCriteria: {
            type: 'all_actions_completed',
            nextStageKey: 'proposal'
          }
        }
      },
      {
        key: 'proposal',
        name: 'Proposal',
        probability: 50,
        status: 'open',
        playbook: { enabled: false, actions: [] }
      }
    ]
  }];

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  await updatePlaybookActionStatus(deal, 'only-step', 'completed', org._id);
  await reconcilePlaybookForDeal(deal, {
    actorId: assignedTo,
    pipelineSettings
  });
  deal.modifiedBy = assignedTo;
  await deal.save();

  const reloaded = await Deal.findById(deal._id).lean();
  assert.equal(reloaded.stage, 'Proposal');
  assert.ok(reloaded.activityLogs.some((entry) => entry.action === 'playbook auto-advance'));
  assert.equal(reloaded.playbookState?.stageKey ?? null, null);
});

test('auto-advance does not run when exit criteria are not met', async () => {
  const { org, deal, assignedTo } = await seedContext();
  const pipelineSettings = [{
    key: PIPELINE_KEY,
    name: 'Default',
    isDefault: true,
    stages: [
      {
        key: STAGE_KEY,
        name: STAGE_NAME,
        probability: 25,
        status: 'open',
        playbook: {
          enabled: true,
          mode: 'non_sequential',
          autoAdvance: true,
          actions: [
            {
              key: 'step-one',
              title: 'Step one',
              required: true,
              autoCreate: false,
              trigger: { type: 'stage_entry' },
              assignment: { type: 'deal_owner' }
            },
            {
              key: 'step-two',
              title: 'Step two',
              required: true,
              autoCreate: false,
              trigger: { type: 'stage_entry' },
              assignment: { type: 'deal_owner' }
            }
          ],
          exitCriteria: {
            type: 'all_actions_completed',
            nextStageKey: 'proposal'
          }
        }
      },
      {
        key: 'proposal',
        name: 'Proposal',
        probability: 50,
        status: 'open',
        playbook: { enabled: false, actions: [] }
      }
    ]
  }];

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await updatePlaybookActionStatus(deal, 'step-one', 'completed', org._id);
  await reconcilePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const reloaded = await Deal.findById(deal._id).lean();
  assert.equal(reloaded.stage, STAGE_NAME);
  assert.equal(reloaded.playbookState.exitCriteriaMet, false);
});

test('skipSideEffects reconcile does not auto-advance deal stage', async () => {
  const { org, deal, assignedTo } = await seedContext();
  const pipelineSettings = [{
    key: PIPELINE_KEY,
    name: 'Default',
    isDefault: true,
    stages: [
      {
        key: STAGE_KEY,
        name: STAGE_NAME,
        probability: 25,
        status: 'open',
        playbook: {
          enabled: true,
          mode: 'non_sequential',
          autoAdvance: true,
          actions: [{
            key: 'only-step',
            title: 'Only step',
            actionType: 'task',
            required: true,
            autoCreate: false,
            trigger: { type: 'stage_entry' },
            assignment: { type: 'deal_owner' }
          }],
          exitCriteria: {
            type: 'all_actions_completed',
            nextStageKey: 'proposal'
          }
        }
      },
      {
        key: 'proposal',
        name: 'Proposal',
        probability: 50,
        status: 'open',
        playbook: { enabled: false, actions: [] }
      }
    ]
  }];

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  await updatePlaybookActionStatus(deal, 'only-step', 'completed', org._id);
  await reconcilePlaybookForDeal(deal, {
    actorId: assignedTo,
    pipelineSettings,
    skipSideEffects: true
  });
  await deal.save();

  const reloaded = await Deal.findById(deal._id).lean();
  assert.equal(reloaded.stage, STAGE_NAME);
  assert.equal(reloaded.playbookState.exitCriteriaMet, true);
});

test('list refresh syncs linked task completion without auto-advance', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const taskId = deal.playbookState.actions[0].createdActivityId;
  const completedDate = new Date();
  await Task.updateOne(
    { _id: taskId, organizationId: org._id },
    { $set: { status: 'completed', completedDate } }
  );

  const staleDeal = await Deal.findById(deal._id);
  assert.equal(staleDeal.playbookState.actions[0].status, 'pending');

  await refreshPlaybookStatesForDealList([staleDeal], org._id, { pipelineSettings });

  const reloaded = await Deal.findById(deal._id).lean();
  assert.equal(reloaded.playbookState.actions[0].status, 'completed');
  assert.equal(reloaded.stage, STAGE_NAME);
});

test('buildActionState copies configured resources onto runtime state', () => {
  const startedAt = new Date('2026-06-01T12:00:00.000Z');
  const state = buildActionState({
    key: 'prep-call',
    title: 'Prep call',
    actionType: 'call',
    dueInDays: 1,
    resources: [
      { name: 'Call Script', type: 'template', url: 'https://example.com/script', description: 'Use before dialing' },
      { name: 'Bad Type', type: 'unknown', url: '', description: '' }
    ]
  }, startedAt);

  assert.equal(state.resources.length, 2);
  assert.equal(state.resources[0].name, 'Call Script');
  assert.equal(state.resources[0].type, 'template');
  assert.equal(state.resources[1].type, 'document');
});

test('reconcile syncs resources from latest playbook definition', async () => {
  const { org, deal, assignedTo } = await seedContext();
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
          title: 'Follow up call',
          actionType: 'task',
          autoCreate: false,
          trigger: { type: 'stage_entry' },
          assignment: { type: 'deal_owner' },
          resources: [{ name: 'Discovery Guide', type: 'document', url: 'https://example.com/guide', description: '' }]
        }]
      }
    }]
  }];

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  deal.playbookState.actions[0].resources = [];
  await deal.save();

  await reconcilePlaybookForDeal(deal, { pipelineSettings });
  await deal.save();

  const reloaded = await Deal.findById(deal._id).lean();
  assert.equal(reloaded.playbookState.actions[0].resources.length, 1);
  assert.equal(reloaded.playbookState.actions[0].resources[0].name, 'Discovery Guide');
});

test('playbook state is persisted on deal document', async () => {
  const { org, deal, assignedTo, pipelineSettings } = await seedContext();

  await executePlaybookForDeal(deal, {
    actorId: assignedTo,
    organizationId: org._id,
    pipelineSettings
  });
  await deal.save();

  const reloaded = await Deal.findById(deal._id).lean();
  assert.ok(reloaded.playbookState);
  assert.equal(reloaded.playbookState.stageKey, STAGE_KEY);
  assert.equal(reloaded.playbookState.actions[0].title, 'Follow up call');
  assert.ok(reloaded.playbookState.startedAt);
  assert.ok(reloaded.playbookState.actions[0].dueAt);
});
