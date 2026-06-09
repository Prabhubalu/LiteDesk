'use strict';

const Deal = require('../models/Deal');
const PlaybookAlertScheduleJob = require('../models/PlaybookAlertScheduleJob');
const domainEvents = require('../constants/domainEvents');
const { emitNotification } = require('./notificationEngine');
const {
  computeAlertRunAt,
  mapAlertTypeToChannels,
  resolvePlaybookAlertRecipientUsers
} = require('../utils/playbookAlertUtils');
const {
  loadDealsPipelineSettings,
  resolveStagePlaybook
} = require('../utils/playbookResolver');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

function buildPlaybookAlertJobDedupeKey({
  organizationId,
  dealId,
  stageKey,
  actionKey,
  alertIndex,
  playbookStartedAt
}) {
  const startedAtIso = new Date(playbookStartedAt).toISOString();
  return [
    'pbalert',
    toIdString(organizationId),
    toIdString(dealId),
    stageKey,
    actionKey,
    String(alertIndex),
    startedAtIso
  ].join(':');
}

async function cancelPendingPlaybookAlertJobsForDeal(organizationId, dealId, options = {}) {
  if (!organizationId || !dealId) return { cancelled: 0 };

  const query = {
    organizationId,
    dealId,
    status: 'pending'
  };

  if (options.stageKey) {
    query.stageKey = options.stageKey;
  }

  const result = await PlaybookAlertScheduleJob.updateMany(query, {
    $set: {
      status: 'cancelled',
      lastError: options.reason || 'cancelled'
    }
  });

  return { cancelled: result.modifiedCount || 0 };
}

async function syncPlaybookAlertJobsForDeal(deal, resolvedPlaybook, actorId = null) {
  if (!deal?._id || !resolvedPlaybook?.playbook || !deal.playbookState?.startedAt) {
    return { queued: 0, cancelled: 0 };
  }

  const organizationId = deal.organizationId;
  const stageKey = resolvedPlaybook.stageKey;
  const startedAt = deal.playbookState.startedAt;
  const actions = Array.isArray(resolvedPlaybook.playbook.actions)
    ? resolvedPlaybook.playbook.actions
    : [];

  const cancelResult = await PlaybookAlertScheduleJob.updateMany({
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

  const statesByKey = new Map(
    (deal.playbookState.actions || []).map((state) => [state.actionKey, state])
  );

  let queued = 0;

  for (const action of actions) {
    const alerts = Array.isArray(action.alerts) ? action.alerts : [];
    if (!alerts.length) continue;

    const actionState = statesByKey.get(action.key);
    if (!actionState) continue;

    for (let alertIndex = 0; alertIndex < alerts.length; alertIndex += 1) {
      const alert = alerts[alertIndex];
      const runAt = computeAlertRunAt(actionState, deal.playbookState, alert?.offset);
      const dedupeKey = buildPlaybookAlertJobDedupeKey({
        organizationId,
        dealId: deal._id,
        stageKey,
        actionKey: action.key,
        alertIndex,
        playbookStartedAt: startedAt
      });

      try {
        await PlaybookAlertScheduleJob.findOneAndUpdate(
          { dedupeKey },
          {
            $set: {
              organizationId,
              dealId: deal._id,
              stageKey,
              actionKey: action.key,
              alertIndex,
              playbookStartedAt: startedAt,
              runAt,
              status: 'pending',
              lastError: null,
              details: {
                actorId: actorId || null,
                alertType: alert?.type || 'in_app',
                message: alert?.message || '',
                recipients: Array.isArray(alert?.recipients) ? alert.recipients : [],
                actionTitle: actionState.title || action.title || ''
              }
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
  }

  return {
    queued,
    cancelled: cancelResult.modifiedCount || 0
  };
}

async function deliverPlaybookAlert({
  deal,
  actionState,
  alertDetails,
  organizationId,
  actorId
}) {
  const recipientUserIds = await resolvePlaybookAlertRecipientUsers(
    organizationId,
    alertDetails?.recipients,
    deal
  );

  if (!recipientUserIds.length) {
    return { delivered: false, reason: 'no_recipients' };
  }

  const actionTitle = alertDetails?.actionTitle || actionState?.title || 'Playbook activity';
  const body = String(alertDetails?.message || '').trim()
    || `Reminder for "${actionTitle}" on deal "${deal.name || 'Deal'}".`;
  const title = `Playbook: ${actionTitle}`;
  const channels = mapAlertTypeToChannels(alertDetails?.alertType);

  await emitNotification({
    eventType: domainEvents.PLAYBOOK_ACTION_ALERT,
    entity: {
      type: 'Deal',
      id: deal._id,
      title: deal.name || 'Deal',
      actionKey: actionState?.actionKey,
      actionTitle,
      alertRecipientUserIds: recipientUserIds
    },
    organizationId,
    triggeredBy: null,
    sourceAppKey: 'SALES',
    channels,
    title,
    body
  });

  return { delivered: true, recipientCount: recipientUserIds.length };
}

async function processDuePlaybookAlertJobs() {
  const now = new Date();
  const jobs = await PlaybookAlertScheduleJob.find({
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

      if (actionState.status === 'completed') {
        job.status = 'skipped';
        job.lastError = 'action_completed';
        await job.save();
        noteSkip('action_completed');
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

      const delivery = await deliverPlaybookAlert({
        deal,
        actionState,
        alertDetails: job.details || {},
        organizationId: job.organizationId,
        actorId: job.details?.actorId || null
      });

      if (delivery.delivered) {
        job.status = 'completed';
        job.lastError = null;
        await job.save();
        completed += 1;
      } else {
        job.status = 'skipped';
        job.lastError = delivery.reason || 'not_delivered';
        await job.save();
        noteSkip(delivery.reason || 'not_delivered');
        skipped += 1;
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
  buildPlaybookAlertJobDedupeKey,
  cancelPendingPlaybookAlertJobsForDeal,
  syncPlaybookAlertJobsForDeal,
  deliverPlaybookAlert,
  processDuePlaybookAlertJobs
};
