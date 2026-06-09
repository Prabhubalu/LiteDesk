'use strict';

const mongoose = require('mongoose');
const Task = require('../models/Task');
const Event = require('../models/Event');
const Deal = require('../models/Deal');
const RelationshipInstance = require('../models/RelationshipInstance');
const { assignResolvedSource } = require('./sourceResolver');
const {
  loadDealsPipelineSettings,
  resolveStageByKey,
  resolveStagePlaybook
} = require('../utils/playbookResolver');
const { resolvePlaybookAssigneeId } = require('../utils/playbookAssignmentResolver');
const {
  shouldAutoCreateImmediately,
  shouldAutoCreateWhenUnblocked,
  shouldAutoCreateOnDelay
} = require('../utils/playbookTriggerUtils');
const { evaluateCustomPlaybookExitCriteria } = require('../utils/playbookExitCriteriaEvaluator');

const TASK_COMPLETED_STATUSES = new Set(['completed', 'done', 'closed', 'complete']);
const EVENT_ACTION_TYPES = new Set(['event', 'meeting']);
const PLAYBOOK_RESOURCE_TYPES = new Set(['document', 'link', 'form', 'template', 'other']);

function normalizeActionResources(resources) {
  if (!Array.isArray(resources)) return [];
  return resources.map((resource) => ({
    name: resource?.name || '',
    type: PLAYBOOK_RESOURCE_TYPES.has(resource?.type) ? resource.type : 'document',
    url: resource?.url || '',
    description: resource?.description || ''
  }));
}

function syncActionResourcesFromDefinitions(actionStates, playbookActions) {
  const defsByKey = new Map(
    (Array.isArray(playbookActions) ? playbookActions : []).map((action) => [action.key, action])
  );

  return actionStates.map((state) => {
    const plain = state?.toObject ? state.toObject() : state;
    const definition = defsByKey.get(plain.actionKey);
    const resources = normalizeActionResources(definition?.resources);
    return {
      ...plain,
      resources
    };
  });
}

function isEventActionType(actionType) {
  return EVENT_ACTION_TYPES.has(String(actionType || '').toLowerCase());
}

function shouldAutoCreateOnStageEntry(action) {
  return shouldAutoCreateImmediately(action);
}

function computeDueAt(startedAt, dueInDays) {
  const base = startedAt instanceof Date ? startedAt : new Date(startedAt || Date.now());
  const days = Math.max(0, Number(dueInDays) || 0);
  const dueAt = new Date(base);
  dueAt.setDate(dueAt.getDate() + days);
  return dueAt;
}

function findExecutionLogEntry(executionLog, stageKey, actionKey) {
  if (!Array.isArray(executionLog)) return null;
  return executionLog.find((entry) => entry.stageKey === stageKey && entry.actionKey === actionKey) || null;
}

function buildActionState(action, startedAt) {
  return {
    actionKey: action.key,
    title: action.title || '',
    actionType: action.actionType || 'task',
    dueAt: computeDueAt(startedAt, action.dueInDays),
    required: action.required !== false,
    status: 'pending',
    completedAt: null,
    dependencies: Array.isArray(action.dependencies) ? [...action.dependencies] : [],
    blockedBy: [],
    createdActivityId: null,
    createdActivityType: null,
    resources: normalizeActionResources(action.resources)
  };
}

function resolvePlaybookMode(playbook) {
  return playbook?.mode === 'sequential' ? 'sequential' : 'non_sequential';
}

function computeActionGating(actionStates, playbookActions, mode) {
  const states = actionStates.map((state) => {
    const plain = state?.toObject ? state.toObject() : state;
    return { ...plain };
  });
  const byKey = new Map(states.map((state) => [state.actionKey, state]));
  const defs = Array.isArray(playbookActions) ? playbookActions : [];

  let firstOpenIndex = -1;
  if (mode === 'sequential') {
    firstOpenIndex = defs.findIndex((def) => {
      const state = byKey.get(def.key);
      return state && state.status !== 'completed';
    });
  }

  for (let index = 0; index < defs.length; index += 1) {
    const def = defs[index];
    const state = byKey.get(def.key);
    if (!state) continue;

    state.dependencies = Array.isArray(def.dependencies) ? [...def.dependencies] : [];

    if (state.status === 'completed') {
      state.blockedBy = [];
      continue;
    }

    const effectiveDeps = [...state.dependencies];
    if (def.trigger?.type === 'after_action' && def.trigger.sourceActionKey) {
      const sourceKey = String(def.trigger.sourceActionKey);
      if (!effectiveDeps.includes(sourceKey)) {
        effectiveDeps.push(sourceKey);
      }
    }

    const unmetDeps = effectiveDeps.filter((depKey) => {
      const dep = byKey.get(depKey);
      return !dep || dep.status !== 'completed';
    });

    const blockedBySequential = mode === 'sequential'
      && firstOpenIndex >= 0
      && index !== firstOpenIndex;

    if (unmetDeps.length > 0 || blockedBySequential) {
      state.status = 'blocked';
      const blockedBy = [...unmetDeps];
      if (blockedBySequential && firstOpenIndex >= 0) {
        const gateKey = defs[firstOpenIndex]?.key;
        if (gateKey && !blockedBy.includes(gateKey)) {
          blockedBy.push(gateKey);
        }
      }
      state.blockedBy = blockedBy;
      continue;
    }

    state.status = 'pending';
    state.blockedBy = [];
  }

  return states;
}

function isActionActionable(actionState) {
  return actionState?.status === 'pending';
}

function evaluatePlaybookExitCriteria(actionStates, exitCriteria, deal = null) {
  const actions = Array.isArray(actionStates) ? actionStates : [];
  const type = exitCriteria?.type || 'all_actions_completed';

  if (type === 'manual') {
    return { met: false, type };
  }

  if (type === 'custom') {
    return evaluateCustomPlaybookExitCriteria(actions, exitCriteria, deal);
  }

  if (!actions.length) {
    return { met: false, type };
  }

  const completedCount = actions.filter((action) => action.status === 'completed').length;

  if (type === 'any_action_completed') {
    return { met: completedCount > 0, type };
  }

  if (type === 'all_actions_completed') {
    const requiredActions = actions.filter((action) => action.required !== false);
    const targetActions = requiredActions.length > 0 ? requiredActions : actions;
    const met = targetActions.every((action) => action.status === 'completed');
    return { met, type };
  }

  return { met: false, type };
}

function applyExitCriteriaState(playbookState, playbook, actionStates, deal = null) {
  const exitCriteria = playbook?.exitCriteria || {};
  const evaluation = evaluatePlaybookExitCriteria(actionStates, exitCriteria, deal);
  const wasMet = playbookState.exitCriteriaMet === true;

  playbookState.exitCriteriaType = evaluation.type;
  playbookState.exitCriteriaCustomDescription = exitCriteria.customDescription || '';
  playbookState.autoAdvanceEnabled = playbook?.autoAdvance === true;
  playbookState.exitCriteriaMet = evaluation.met;
  playbookState.exitCriteriaMetAt = evaluation.met
    ? (wasMet && playbookState.exitCriteriaMetAt ? playbookState.exitCriteriaMetAt : new Date())
    : null;

  return evaluation;
}

async function maybeAutoAdvanceDealFromPlaybook(deal, resolvedPlaybook, pipelineSettings, options = {}) {
  if (!deal?.playbookState?.exitCriteriaMet) {
    return false;
  }

  const playbook = resolvedPlaybook?.playbook;
  if (!playbook?.autoAdvance) {
    return false;
  }

  const nextStageKey = String(playbook.exitCriteria?.nextStageKey || '').trim();
  if (!nextStageKey) {
    return false;
  }

  if (
    deal.playbookState.autoAdvancedAt
    && deal.playbookState.autoAdvancedToStageKey === nextStageKey
    && deal.playbookState.stageKey === resolvedPlaybook.stageKey
  ) {
    return false;
  }

  const nextStageResolved = resolveStageByKey(
    pipelineSettings,
    resolvedPlaybook.pipelineKey,
    nextStageKey
  );
  if (!nextStageResolved?.stage) {
    return false;
  }

  const nextStageName = nextStageResolved.stage.name || nextStageKey;
  const currentStageName = String(deal.stage || '').trim();
  if (currentStageName === nextStageName || currentStageName === nextStageKey) {
    return false;
  }

  const previousStage = currentStageName;
  deal.stage = nextStageName;
  deal.playbookState.autoAdvancedAt = new Date();
  deal.playbookState.autoAdvancedToStageKey = nextStageKey;

  if (!Array.isArray(deal.stageHistory)) {
    deal.stageHistory = [];
  }
  deal.stageHistory.push({
    stage: nextStageName,
    changedAt: new Date(),
    changedBy: options.actorId || null
  });

  if (!Array.isArray(deal.activityLogs)) {
    deal.activityLogs = [];
  }
  deal.activityLogs.push({
    user: 'System',
    userId: options.actorId || null,
    action: 'playbook auto-advance',
    details: {
      from: previousStage,
      to: nextStageName,
      fromStageKey: resolvedPlaybook.stageKey,
      toStageKey: nextStageKey,
      exitCriteriaType: deal.playbookState.exitCriteriaType || null
    },
    timestamp: new Date()
  });

  if (options.actorId) {
    deal.modifiedBy = options.actorId;
  }

  await executePlaybookForDeal(deal, {
    actorId: options.actorId || null,
    organizationId: deal.organizationId,
    pipelineSettings
  });

  deal.markModified('stage');
  deal.markModified('stageHistory');
  deal.markModified('activityLogs');
  deal.markModified('playbookState');

  return true;
}

async function activityRecordExists(activityType, activityId, organizationId) {
  if (!activityId || !mongoose.Types.ObjectId.isValid(String(activityId))) {
    return false;
  }

  if (activityType === 'event') {
    const event = await Event.findOne({
      _id: activityId,
      organizationId
    }).select('_id').lean();
    return !!event;
  }

  const task = await Task.findOne({
    _id: activityId,
    organizationId,
    deletedAt: null
  }).select('_id').lean();
  return !!task;
}

function resolvePlaybookStatusFromActivityDoc(activityType, activityDoc) {
  if (!activityDoc) return null;

  if (activityType === 'task') {
    const status = String(activityDoc.status || '').toLowerCase();
    if (TASK_COMPLETED_STATUSES.has(status)) {
      return {
        status: 'completed',
        completedAt: activityDoc.completedDate || new Date()
      };
    }
    return { status: 'pending', completedAt: null };
  }

  if (activityType === 'event') {
    if (activityDoc.status === 'Completed') {
      return {
        status: 'completed',
        completedAt: activityDoc.completedAt || new Date()
      };
    }
    return { status: 'pending', completedAt: null };
  }

  return null;
}

function applyPlaybookActionStatus(action, resolvedStatus) {
  if (!action || !resolvedStatus) return false;

  const previousStatus = action.status;
  const previousCompletedAt = action.completedAt ? new Date(action.completedAt).getTime() : null;
  const nextCompletedAt = resolvedStatus.completedAt ? new Date(resolvedStatus.completedAt).getTime() : null;

  if (previousStatus === resolvedStatus.status && previousCompletedAt === nextCompletedAt) {
    return false;
  }

  action.status = resolvedStatus.status;
  action.completedAt = resolvedStatus.completedAt;
  return true;
}

async function syncActionStatusFromActivity(actionState, organizationId) {
  if (!actionState?.createdActivityId || !actionState.createdActivityType) {
    return actionState;
  }

  if (actionState.createdActivityType === 'task') {
    const task = await Task.findOne({
      _id: actionState.createdActivityId,
      organizationId,
      deletedAt: null
    }).select('status completedDate').lean();

    if (!task) return actionState;

    const status = String(task.status || '').toLowerCase();
    if (TASK_COMPLETED_STATUSES.has(status)) {
      return {
        ...actionState,
        status: 'completed',
        completedAt: task.completedDate || actionState.completedAt || new Date()
      };
    }
    return { ...actionState, status: 'pending', completedAt: null };
  }

  if (actionState.createdActivityType === 'event') {
    const event = await Event.findOne({
      _id: actionState.createdActivityId,
      organizationId
    }).select('status completedAt').lean();

    if (!event) return actionState;

    if (event.status === 'Completed') {
      return {
        ...actionState,
        status: 'completed',
        completedAt: event.completedAt || actionState.completedAt || new Date()
      };
    }
    return { ...actionState, status: 'pending', completedAt: null };
  }

  return actionState;
}

async function resolveAssigneeId(deal, assignment, actorId) {
  return resolvePlaybookAssigneeId(deal, assignment, actorId);
}

async function ensureTaskDealRelationshipLink({ organizationId, taskId, dealId, actorId }) {
  const normalizedSource = {
    appKey: 'platform',
    moduleKey: 'tasks',
    recordId: taskId
  };
  const normalizedTarget = {
    appKey: 'sales',
    moduleKey: 'deals',
    recordId: dealId
  };

  const existing = await RelationshipInstance.findOne({
    organizationId,
    relationshipKey: 'task_deals',
    'source.appKey': normalizedSource.appKey,
    'source.moduleKey': normalizedSource.moduleKey,
    'source.recordId': normalizedSource.recordId,
    'target.appKey': normalizedTarget.appKey,
    'target.moduleKey': normalizedTarget.moduleKey,
    'target.recordId': normalizedTarget.recordId
  }).lean();

  if (existing) return existing;

  return RelationshipInstance.create({
    organizationId,
    relationshipKey: 'task_deals',
    source: normalizedSource,
    target: normalizedTarget,
    createdBy: actorId || null
  });
}

async function createPlaybookTask({ deal, action, assigneeId, actorId, dueAt }) {
  const taskPayload = {
    organizationId: deal.organizationId,
    title: action.title || 'Playbook task',
    description: action.description || '',
    relatedTo: {
      type: 'deal',
      id: deal._id
    },
    assignedTo: assigneeId,
    assignedBy: actorId || assigneeId,
    status: 'todo',
    priority: 'medium',
    dueDate: dueAt,
    createdBy: actorId || assigneeId,
    activityLogs: [{
      user: 'System',
      userId: actorId || null,
      action: 'created',
      details: { source: 'playbook', actionKey: action.key },
      timestamp: new Date()
    }]
  };
  assignResolvedSource(taskPayload, 'automation');
  const task = await Task.create(taskPayload);

  try {
    await ensureTaskDealRelationshipLink({
      organizationId: deal.organizationId,
      taskId: task._id,
      dealId: deal._id,
      actorId
    });
  } catch (linkErr) {
    console.error('[playbookExecutionService] Failed to link playbook task to deal:', linkErr?.message || linkErr);
  }

  return task;
}

async function createPlaybookEvent({ deal, action, assigneeId, actorId, dueAt }) {
  const startDateTime = dueAt instanceof Date ? dueAt : new Date(dueAt || Date.now());
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

  const eventPayload = {
    organizationId: deal.organizationId,
    eventName: action.title || 'Playbook event',
    eventType: 'Meeting',
    status: 'Planned',
    eventOwnerId: assigneeId,
    startDateTime,
    endDateTime,
    location: '',
    createdBy: actorId || assigneeId,
    modifiedBy: actorId || assigneeId,
    createdTime: new Date(),
    modifiedTime: new Date(),
    notes: action.description
      ? [{ text: action.description, createdBy: actorId || assigneeId, createdAt: new Date() }]
      : []
  };
  assignResolvedSource(eventPayload, 'automation');
  return Event.create(eventPayload);
}

async function createActivityForAction({ deal, action, assigneeId, actorId, dueAt }) {
  if (isEventActionType(action.actionType)) {
    const event = await createPlaybookEvent({ deal, action, assigneeId, actorId, dueAt });
    return { activityId: event._id, activityType: 'event' };
  }

  const task = await createPlaybookTask({ deal, action, assigneeId, actorId, dueAt });
  return { activityId: task._id, activityType: 'task' };
}

function appendExecutionLogEntry(executionLog, entry) {
  const next = Array.isArray(executionLog) ? [...executionLog] : [];
  const existingIndex = next.findIndex(
    (item) => item.stageKey === entry.stageKey && item.actionKey === entry.actionKey
  );
  if (existingIndex >= 0) {
    next[existingIndex] = { ...next[existingIndex], ...entry };
    return next;
  }
  next.push(entry);
  return next;
}

async function buildPlaybookStateForStage({
  deal,
  resolvedPlaybook,
  actorId,
  existingState = null
}) {
  const startedAt = new Date();
  let executionLog = Array.isArray(existingState?.executionLog)
    ? [...existingState.executionLog]
    : [];

  const actions = Array.isArray(resolvedPlaybook.playbook.actions)
    ? resolvedPlaybook.playbook.actions
    : [];

  const mode = resolvePlaybookMode(resolvedPlaybook.playbook);
  const actionStates = [];

  for (const action of actions) {
    let actionState = buildActionState(action, startedAt);
    const logEntry = findExecutionLogEntry(executionLog, resolvedPlaybook.stageKey, action.key);

    if (logEntry?.createdActivityId) {
      const stillExists = await activityRecordExists(
        logEntry.createdActivityType,
        logEntry.createdActivityId,
        deal.organizationId
      );
      if (stillExists) {
        actionState = {
          ...actionState,
          createdActivityId: logEntry.createdActivityId,
          createdActivityType: logEntry.createdActivityType || null
        };
        actionState = await syncActionStatusFromActivity(actionState, deal.organizationId);
      }
    } else if (actionState.createdActivityId) {
      actionState = await syncActionStatusFromActivity(actionState, deal.organizationId);
    }

    actionStates.push(actionState);
  }

  let gatedStates = syncActionResourcesFromDefinitions(
    computeActionGating(actionStates, actions, mode),
    actions
  );

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const stateIndex = gatedStates.findIndex((item) => item.actionKey === action.key);
    if (stateIndex < 0) continue;

    let actionState = gatedStates[stateIndex];
    if (
      shouldAutoCreateOnStageEntry(action)
      && isActionActionable(actionState)
      && !actionState.createdActivityId
    ) {
      const assigneeId = await resolveAssigneeId(deal, action.assignment, actorId);
      if (!assigneeId) continue;

      const created = await createActivityForAction({
        deal,
        action,
        assigneeId,
        actorId,
        dueAt: actionState.dueAt
      });

      actionState = {
        ...actionState,
        createdActivityId: created.activityId,
        createdActivityType: created.activityType
      };
      gatedStates[stateIndex] = actionState;

      executionLog = appendExecutionLogEntry(executionLog, {
        stageKey: resolvedPlaybook.stageKey,
        actionKey: action.key,
        createdActivityId: created.activityId,
        createdActivityType: created.activityType,
        createdAt: new Date()
      });
    }
  }

  gatedStates = computeActionGating(gatedStates, actions, mode);

  const playbookState = {
    stageKey: resolvedPlaybook.stageKey,
    stageName: resolvedPlaybook.stageName,
    pipelineKey: resolvedPlaybook.pipelineKey,
    mode,
    startedAt,
    actions: gatedStates,
    executionLog,
    exitCriteriaType: null,
    exitCriteriaMet: false,
    exitCriteriaMetAt: null,
    autoAdvanceEnabled: resolvedPlaybook.playbook.autoAdvance === true,
    autoAdvancedAt: null,
    autoAdvancedToStageKey: null
  };

  applyExitCriteriaState(playbookState, resolvedPlaybook.playbook, gatedStates, deal);

  return playbookState;
}

async function autoCreateSingleDelayedPlaybookAction(
  deal,
  resolvedPlaybook,
  actionKey,
  actorId,
  options = {}
) {
  if (!deal?.playbookState?.actions?.length || !resolvedPlaybook?.playbook) {
    return { created: false, reason: 'playbook_state_missing' };
  }

  const playbookActions = Array.isArray(resolvedPlaybook.playbook.actions)
    ? resolvedPlaybook.playbook.actions
    : [];
  const action = playbookActions.find((item) => item.key === actionKey);
  if (!action) {
    return { created: false, reason: 'action_not_found' };
  }
  if (!shouldAutoCreateOnDelay(action)) {
    return { created: false, reason: 'not_delay_trigger' };
  }

  const stateIndex = deal.playbookState.actions.findIndex((item) => item.actionKey === actionKey);
  if (stateIndex < 0) {
    return { created: false, reason: 'action_not_found' };
  }

  const actionState = deal.playbookState.actions[stateIndex];
  if (actionState.createdActivityId) {
    return { created: false, reason: 'already_created' };
  }
  if (!isActionActionable(actionState)) {
    return { created: false, reason: 'not_actionable' };
  }

  const assigneeId = await resolveAssigneeId(deal, action.assignment, actorId);
  if (!assigneeId) {
    return { created: false, reason: 'no_assignee' };
  }

  const created = await createActivityForAction({
    deal,
    action,
    assigneeId,
    actorId,
    dueAt: actionState.dueAt
  });

  actionState.createdActivityId = created.activityId;
  actionState.createdActivityType = created.activityType;
  deal.playbookState.executionLog = appendExecutionLogEntry(
    deal.playbookState.executionLog,
    {
      stageKey: resolvedPlaybook.stageKey,
      actionKey: action.key,
      createdActivityId: created.activityId,
      createdActivityType: created.activityType,
      createdAt: new Date()
    }
  );
  deal.markModified('playbookState');

  const pipelineSettings = options.pipelineSettings
    || await loadDealsPipelineSettings(deal.organizationId);
  await reconcilePlaybookForDeal(deal, {
    actorId,
    pipelineSettings
  });

  return { created: true, activityId: created.activityId };
}

async function autoCreateUnblockedPlaybookActivities({
  deal,
  resolvedPlaybook,
  actionStates,
  executionLog,
  actorId
}) {
  const actions = Array.isArray(resolvedPlaybook.playbook.actions)
    ? resolvedPlaybook.playbook.actions
    : [];
  let nextExecutionLog = Array.isArray(executionLog) ? [...executionLog] : [];
  let nextStates = actionStates.map((state) => ({ ...state }));
  let createdAny = false;

  for (const action of actions) {
    const stateIndex = nextStates.findIndex((item) => item.actionKey === action.key);
    if (stateIndex < 0) continue;

    const actionState = nextStates[stateIndex];
    if (
      !shouldAutoCreateWhenUnblocked(action)
      || !isActionActionable(actionState)
      || actionState.createdActivityId
    ) {
      continue;
    }

    const assigneeId = await resolveAssigneeId(deal, action.assignment, actorId);
    if (!assigneeId) continue;

    const created = await createActivityForAction({
      deal,
      action,
      assigneeId,
      actorId,
      dueAt: actionState.dueAt
    });

    nextStates[stateIndex] = {
      ...actionState,
      createdActivityId: created.activityId,
      createdActivityType: created.activityType
    };
    nextExecutionLog = appendExecutionLogEntry(nextExecutionLog, {
      stageKey: resolvedPlaybook.stageKey,
      actionKey: action.key,
      createdActivityId: created.activityId,
      createdActivityType: created.activityType,
      createdAt: new Date()
    });
    createdAny = true;
  }

  return {
    actionStates: nextStates,
    executionLog: nextExecutionLog,
    createdAny
  };
}

async function reconcilePlaybookForDeal(deal, options = {}) {
  if (!deal?.playbookState?.actions?.length) {
    return false;
  }

  const organizationId = deal.organizationId;
  const pipelineSettings = options.pipelineSettings
    || await loadDealsPipelineSettings(organizationId);
  const resolvedPlaybook = resolveStagePlaybook(
    pipelineSettings,
    deal.pipeline,
    deal.stage
  );

  if (!resolvedPlaybook) {
    return false;
  }

  const mode = resolvePlaybookMode(resolvedPlaybook.playbook);
  const playbookActions = Array.isArray(resolvedPlaybook.playbook.actions)
    ? resolvedPlaybook.playbook.actions
    : [];
  let changed = false;

  for (const action of deal.playbookState.actions) {
    if (!action.createdActivityId || !action.createdActivityType) {
      continue;
    }
    const synced = await syncActionStatusFromActivity(
      {
        actionKey: action.actionKey,
        createdActivityId: action.createdActivityId,
        createdActivityType: action.createdActivityType,
        status: action.status,
        completedAt: action.completedAt
      },
      organizationId
    );
    if (applyPlaybookActionStatus(action, {
      status: synced.status,
      completedAt: synced.completedAt
    })) {
      changed = true;
    }
  }

  const previousSnapshot = JSON.stringify(deal.playbookState.actions);
  let gatedStates = computeActionGating(deal.playbookState.actions, playbookActions, mode);
  if (JSON.stringify(gatedStates) !== previousSnapshot) {
    changed = true;
  }

  const skipSideEffects = options.skipSideEffects === true;
  let autoCreateResult = {
    actionStates: gatedStates,
    executionLog: deal.playbookState.executionLog,
    createdAny: false
  };

  if (!skipSideEffects) {
    autoCreateResult = await autoCreateUnblockedPlaybookActivities({
      deal,
      resolvedPlaybook,
      actionStates: gatedStates,
      executionLog: deal.playbookState.executionLog,
      actorId: options.actorId || null
    });

    if (autoCreateResult.createdAny) {
      changed = true;
    }

    gatedStates = computeActionGating(autoCreateResult.actionStates, playbookActions, mode);
    if (JSON.stringify(gatedStates) !== JSON.stringify(deal.playbookState.actions)) {
      changed = true;
    }
  }

  gatedStates = syncActionResourcesFromDefinitions(gatedStates, playbookActions);
  if (JSON.stringify(gatedStates) !== JSON.stringify(deal.playbookState.actions)) {
    changed = true;
  }

  deal.playbookState.mode = mode;
  deal.playbookState.actions = gatedStates;
  deal.playbookState.executionLog = autoCreateResult.executionLog;

  const previousExitMet = deal.playbookState.exitCriteriaMet === true;
  const exitEvaluation = applyExitCriteriaState(
    deal.playbookState,
    resolvedPlaybook.playbook,
    gatedStates,
    deal
  );
  if (exitEvaluation.met !== previousExitMet) {
    changed = true;
  }

  if (changed) {
    deal.markModified('playbookState');
  }

  let advanced = false;
  if (!skipSideEffects) {
    advanced = await maybeAutoAdvanceDealFromPlaybook(
      deal,
      resolvedPlaybook,
      pipelineSettings,
      options
    );
  }

  return changed || advanced;
}

const LIST_PLAYBOOK_REFRESH_LIMIT = 50;

async function refreshPlaybookStatesForDealList(deals, organizationId, options = {}) {
  if (!Array.isArray(deals) || deals.length === 0) {
    return false;
  }

  const limit = Number.isFinite(options.limit) ? options.limit : LIST_PLAYBOOK_REFRESH_LIMIT;
  const candidates = deals
    .filter((deal) => deal?.playbookState?.actions?.length > 0)
    .slice(0, limit);
  if (candidates.length === 0) {
    return false;
  }

  const pipelineSettings = options.pipelineSettings
    || await loadDealsPipelineSettings(organizationId);

  const savePromises = [];
  for (const deal of candidates) {
    const changed = await reconcilePlaybookForDeal(deal, {
      pipelineSettings,
      skipSideEffects: true,
      actorId: options.actorId || null
    });
    if (changed) {
      savePromises.push(deal.save());
    }
  }

  if (savePromises.length === 0) {
    return false;
  }

  await Promise.all(savePromises);
  return true;
}

async function executePlaybookForDeal(deal, options = {}) {
  if (!deal) return null;

  const organizationId = deal.organizationId;
  const pipelineSettings = options.pipelineSettings
    || await loadDealsPipelineSettings(organizationId);

  const resolvedPlaybook = resolveStagePlaybook(
    pipelineSettings,
    deal.pipeline,
    deal.stage
  );

  if (!resolvedPlaybook) {
    const priorLog = Array.isArray(deal.playbookState?.executionLog)
      ? deal.playbookState.executionLog
      : [];
    deal.playbookState = priorLog.length ? { executionLog: priorLog } : null;
    deal.markModified('playbookState');
    try {
      const { cancelPendingPlaybookDelayJobsForDeal } = require('./playbookSchedulingService');
      const { cancelPendingPlaybookAlertJobsForDeal } = require('./playbookAlertSchedulingService');
      await cancelPendingPlaybookDelayJobsForDeal(
        deal.organizationId,
        deal._id,
        { reason: 'playbook_disabled' }
      );
      await cancelPendingPlaybookAlertJobsForDeal(
        deal.organizationId,
        deal._id,
        { reason: 'playbook_disabled' }
      );
    } catch (scheduleErr) {
      console.error('[playbookExecutionService] cancel playbook jobs failed:', scheduleErr?.message || scheduleErr);
    }
    return deal.playbookState;
  }

  const existingState = deal.playbookState && typeof deal.playbookState === 'object'
    ? deal.playbookState
    : null;

  const playbookState = await buildPlaybookStateForStage({
    deal,
    resolvedPlaybook,
    actorId: options.actorId || null,
    existingState
  });

  deal.playbookState = playbookState;
  deal.markModified('playbookState');

  try {
    const { syncPlaybookDelayJobsForDeal } = require('./playbookSchedulingService');
    const { syncPlaybookAlertJobsForDeal } = require('./playbookAlertSchedulingService');
    await syncPlaybookDelayJobsForDeal(deal, resolvedPlaybook, options.actorId || null);
    await syncPlaybookAlertJobsForDeal(deal, resolvedPlaybook, options.actorId || null);
  } catch (scheduleErr) {
    console.error('[playbookExecutionService] sync playbook jobs failed:', scheduleErr?.message || scheduleErr);
  }

  return playbookState;
}

async function updatePlaybookActionStatus(deal, actionKey, status, organizationId) {
  if (!deal?.playbookState || !Array.isArray(deal.playbookState.actions)) {
    return null;
  }

  const normalizedStatus = status === 'completed' ? 'completed' : 'pending';
  const action = deal.playbookState.actions.find((item) => item.actionKey === actionKey);
  if (!action) {
    return null;
  }

  if (action.status === 'blocked') {
    const error = new Error('Playbook action is blocked');
    error.code = 'PLAYBOOK_ACTION_BLOCKED';
    throw error;
  }

  action.status = normalizedStatus;
  action.completedAt = normalizedStatus === 'completed' ? new Date() : null;
  deal.markModified('playbookState');

  if (action.createdActivityId && action.createdActivityType === 'task' && normalizedStatus === 'completed') {
    await Task.updateOne(
      {
        _id: action.createdActivityId,
        organizationId,
        deletedAt: null
      },
      {
        $set: {
          status: 'completed',
          completedDate: new Date(),
          modifiedBy: deal.modifiedBy || deal.ownerId || null
        }
      }
    );
  }

  await reconcilePlaybookForDeal(deal, {
    actorId: deal.modifiedBy || deal.ownerId || null,
    organizationId
  });

  return deal.playbookState.actions.find((item) => item.actionKey === actionKey) || action;
}

async function syncDealPlaybookFromActivity({
  activityId,
  activityType,
  organizationId,
  activityDoc = null,
  pipelineSettings = null
}) {
  if (!activityId || !organizationId || !activityType) {
    return null;
  }

  const deal = await Deal.findOne({
    organizationId,
    deletedAt: null,
    'playbookState.actions.createdActivityId': activityId
  });

  if (!deal?.playbookState?.actions?.length) {
    return null;
  }

  const action = deal.playbookState.actions.find(
    (item) => String(item.createdActivityId) === String(activityId)
      && item.createdActivityType === activityType
  );
  if (!action) {
    return null;
  }

  let doc = activityDoc;
  if (!doc) {
    if (activityType === 'task') {
      doc = await Task.findOne({
        _id: activityId,
        organizationId,
        deletedAt: null
      }).select('status completedDate').lean();
    } else if (activityType === 'event') {
      doc = await Event.findOne({
        _id: activityId,
        organizationId
      }).select('status completedAt').lean();
    }
  }

  const resolvedStatus = resolvePlaybookStatusFromActivityDoc(activityType, doc);
  const statusChanged = applyPlaybookActionStatus(action, resolvedStatus);
  const reconciled = await reconcilePlaybookForDeal(deal, {
    organizationId,
    pipelineSettings
  });

  if (!statusChanged && !reconciled) {
    return null;
  }

  await deal.save();
  return deal;
}

async function refreshPlaybookStateFromActivities(deal) {
  return reconcilePlaybookForDeal(deal);
}

module.exports = {
  TASK_COMPLETED_STATUSES,
  EVENT_ACTION_TYPES,
  isEventActionType,
  shouldAutoCreateOnStageEntry,
  shouldAutoCreateImmediately,
  shouldAutoCreateOnDelay,
  autoCreateSingleDelayedPlaybookAction,
  computeDueAt,
  findExecutionLogEntry,
  buildActionState,
  normalizeActionResources,
  syncActionResourcesFromDefinitions,
  resolvePlaybookMode,
  computeActionGating,
  isActionActionable,
  evaluatePlaybookExitCriteria,
  applyExitCriteriaState,
  maybeAutoAdvanceDealFromPlaybook,
  autoCreateUnblockedPlaybookActivities,
  reconcilePlaybookForDeal,
  buildPlaybookStateForStage,
  executePlaybookForDeal,
  updatePlaybookActionStatus,
  syncActionStatusFromActivity,
  resolvePlaybookStatusFromActivityDoc,
  applyPlaybookActionStatus,
  syncDealPlaybookFromActivity,
  refreshPlaybookStateFromActivities,
  refreshPlaybookStatesForDealList,
  LIST_PLAYBOOK_REFRESH_LIMIT
};
