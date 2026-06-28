'use strict';

const DeferredAutomationAction = require('../models/DeferredAutomationAction');
const { execute: executeAction } = require('./automationActionHandlers');
const { evaluateAutomationDeferral } = require('./automationBusinessHoursService');
const AutomationExecution = require('../models/AutomationExecution');
const { createLogger } = require('./automationLogger');

const log = createLogger('deferredAutomationScheduler');

function buildContext(event) {
  return {
    eventId: event.eventId,
    eventType: event.eventType || null,
    entityType: event.entityType || null,
    entityId: event.entityId || null,
    organizationId: event.organizationId || null,
    triggeredBy: event.triggeredBy || null,
    assignedTo: event.assignedTo || null,
    appKey: event.appKey || 'SALES'
  };
}

async function processDueDeferredAutomationActions() {
  const now = new Date();
  const jobs = await DeferredAutomationAction.find({
    status: 'pending',
    executeAt: { $lte: now }
  })
    .sort({ executeAt: 1 })
    .limit(50);

  let processed = 0;
  let completed = 0;
  let rescheduled = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      job.status = 'running';
      job.attempts = Number(job.attempts || 0) + 1;
      await job.save();

      const event = job.eventPayload;
      const deferral = await evaluateAutomationDeferral(event, {
        respectBusinessHours: true,
        _id: job.ruleId
      });

      if (deferral.shouldDefer && deferral.executeAt && deferral.executeAt > now) {
        job.status = 'pending';
        job.executeAt = deferral.executeAt;
        job.pauseReason = deferral.pauseReason || job.pauseReason;
        await job.save();
        rescheduled += 1;
        processed += 1;
        continue;
      }

      const ctx = buildContext(event);
      const result = await executeAction(
        job.actionType,
        ctx,
        job.actionParams,
        null
      );

      if (result?.ok) {
        job.status = 'completed';
        job.lastError = null;
        await job.save();
        await AutomationExecution.create({
          eventId: job.eventId,
          ruleId: job.ruleId,
          actionIndex: job.actionIndex,
          actionType: job.actionType,
          status: 'completed',
          error: null,
          entityType: event.entityType || null,
          entityId: event.entityId || null
        }).catch(() => {});
        completed += 1;
      } else {
        throw new Error(result?.error || 'action_failed');
      }
      processed += 1;
    } catch (err) {
      job.status = Number(job.attempts || 0) >= Number(job.maxAttempts || 3) ? 'failed' : 'pending';
      job.lastError = err.message;
      await job.save();
      failed += 1;
      processed += 1;
      log.warn('deferred_automation_failed', { id: job._id, error: err.message });
    }
  }

  return { processed, completed, rescheduled, failed };
}

module.exports = {
  processDueDeferredAutomationActions
};
