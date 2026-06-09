'use strict';

const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const PlaybookScheduleJob = require('../models/PlaybookScheduleJob');
const {
  shouldAutoCreateOnDelay,
  computeTriggerDelayRunAt
} = require('../utils/playbookTriggerUtils');
const {
  loadDealsPipelineSettings,
  resolveStagePlaybook
} = require('../utils/playbookResolver');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

function buildPlaybookJobDedupeKey({
  organizationId,
  dealId,
  stageKey,
  actionKey,
  playbookStartedAt
}) {
  const startedAtIso = new Date(playbookStartedAt).toISOString();
  return [
    'pbjob',
    toIdString(organizationId),
    toIdString(dealId),
    stageKey,
    actionKey,
    startedAtIso
  ].join(':');
}

async function cancelPendingPlaybookDelayJobsForDeal(organizationId, dealId, options = {}) {
  if (!organizationId || !dealId) return { cancelled: 0 };

  const query = {
    organizationId,
    dealId,
    status: 'pending'
  };

  if (options.stageKey) {
    query.stageKey = options.stageKey;
  }

  const result = await PlaybookScheduleJob.updateMany(query, {
    $set: {
      status: 'cancelled',
      lastError: options.reason || 'cancelled'
    }
  });

  return { cancelled: result.modifiedCount || 0 };
}

async function syncPlaybookDelayJobsForDeal(deal, resolvedPlaybook, actorId = null) {
  if (!deal?._id || !resolvedPlaybook?.playbook || !deal.playbookState?.startedAt) {
    return { queued: 0, cancelled: 0 };
  }

  const organizationId = deal.organizationId;
  const stageKey = resolvedPlaybook.stageKey;
  const startedAt = deal.playbookState.startedAt;
  const actions = Array.isArray(resolvedPlaybook.playbook.actions)
    ? resolvedPlaybook.playbook.actions
    : [];

  const cancelResult = await PlaybookScheduleJob.updateMany({
    organizationId,
    dealId: deal._id,
    status: 'pending',
    $or: [
      { stageKey: { $ne: stageKey } },
      { playbookStartedAt: { $ne: startedAt } }
    ]
  }, {
    $set: {
      status: 'cancelled',
      lastError: 'playbook_state_changed'
    }
  });

  let queued = 0;
  const statesByKey = new Map(
    (deal.playbookState.actions || []).map((state) => [state.actionKey, state])
  );

  for (const action of actions) {
    if (!shouldAutoCreateOnDelay(action)) continue;

    const actionState = statesByKey.get(action.key);
    if (!actionState || actionState.createdActivityId) continue;

    const runAt = computeTriggerDelayRunAt(startedAt, action.trigger?.delay);
    const dedupeKey = buildPlaybookJobDedupeKey({
      organizationId,
      dealId: deal._id,
      stageKey,
      actionKey: action.key,
      playbookStartedAt: startedAt
    });

    try {
      await PlaybookScheduleJob.findOneAndUpdate(
        { dedupeKey },
        {
          $set: {
            organizationId,
            dealId: deal._id,
            stageKey,
            actionKey: action.key,
            playbookStartedAt: startedAt,
            runAt,
            status: 'pending',
            lastError: null,
            details: { actorId: actorId || null }
          },
          $setOnInsert: {
            attempts: 0,
            maxAttempts: 3
          }
        },
        { upsert: true, new: true }
      );
      queued += 1;
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  return {
    queued,
    cancelled: cancelResult.modifiedCount || 0
  };
}

async function processDuePlaybookDelayJobs() {
  const now = new Date();
  const jobs = await PlaybookScheduleJob.find({
    status: 'pending',
    runAt: { $lte: now }
  })
    .sort({ runAt: 1 })
    .limit(50);

  let processed = 0;
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const skipReasons = {};

  const noteSkip = (reason) => {
    const key = String(reason || 'unknown');
    skipReasons[key] = (skipReasons[key] || 0) + 1;
  };

  const {
    autoCreateSingleDelayedPlaybookAction
  } = require('./playbookExecutionService');

  for (const job of jobs) {
    try {
      job.status = 'running';
      job.attempts = Number(job.attempts || 0) + 1;
      await job.save();

      const deal = await Deal.findOne({
        _id: job.dealId,
        organizationId: job.organizationId,
        deletedAt: null
      });

      if (!deal?.playbookState?.actions?.length) {
        job.status = 'skipped';
        job.lastError = 'playbook_state_missing';
        await job.save();
        noteSkip('playbook_state_missing');
        skipped += 1;
        processed += 1;
        continue;
      }

      const currentStageKey = String(deal.playbookState.stageKey || '').trim();
      if (currentStageKey !== job.stageKey) {
        job.status = 'skipped';
        job.lastError = 'playbook_state_stale';
        await job.save();
        noteSkip('playbook_state_stale');
        skipped += 1;
        processed += 1;
        continue;
      }

      const actionState = deal.playbookState.actions.find((item) => item.actionKey === job.actionKey);
      if (!actionState) {
        job.status = 'skipped';
        job.lastError = 'action_not_found';
        await job.save();
        noteSkip('action_not_found');
        skipped += 1;
        processed += 1;
        continue;
      }

      const pipelineSettings = await loadDealsPipelineSettings(job.organizationId);
      const resolvedPlaybook = resolveStagePlaybook(
        pipelineSettings,
        deal.pipeline,
        deal.stage
      );

      if (!resolvedPlaybook || resolvedPlaybook.stageKey !== job.stageKey) {
        job.status = 'skipped';
        job.lastError = 'playbook_not_active';
        await job.save();
        noteSkip('playbook_not_active');
        skipped += 1;
        processed += 1;
        continue;
      }

      const result = await autoCreateSingleDelayedPlaybookAction(
        deal,
        resolvedPlaybook,
        job.actionKey,
        job.details?.actorId || null,
        { pipelineSettings }
      );

      if (result.created) {
        await deal.save();
        job.status = 'completed';
        job.lastError = null;
        await job.save();
        completed += 1;
      } else if (result.reason === 'already_created') {
        job.status = 'completed';
        job.lastError = null;
        await job.save();
        completed += 1;
      } else if (
        result.reason === 'not_actionable'
        || result.reason === 'auto_create_disabled'
        || result.reason === 'not_delay_trigger'
        || result.reason === 'action_not_found'
        || result.reason === 'no_assignee'
      ) {
        job.status = 'skipped';
        job.lastError = result.reason;
        await job.save();
        noteSkip(result.reason);
        skipped += 1;
      } else {
        throw new Error(result.reason || 'delayed_create_failed');
      }

      processed += 1;
    } catch (error) {
      const maxAttempts = Number(job.maxAttempts || 3);
      job.status = Number(job.attempts || 0) >= maxAttempts ? 'failed' : 'pending';
      job.lastError = error?.message || 'unknown_error';
      await job.save();
      failed += 1;
      processed += 1;
    }
  }

  return {
    processed,
    completed,
    failed,
    skipped,
    skipReasons
  };
}

module.exports = {
  buildPlaybookJobDedupeKey,
  cancelPendingPlaybookDelayJobsForDeal,
  syncPlaybookDelayJobsForDeal,
  processDuePlaybookDelayJobs
};
