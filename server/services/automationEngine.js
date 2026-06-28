/**
 * ============================================================================
 * PLATFORM CORE: Automation Resolution & Execution Engine
 * ============================================================================
 *
 * Listens to domain events, resolves matching rules, builds execution plan,
 * and executes actions. Idempotent via eventId+ruleId+actionIndex.
 * One action failure does not block others.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const { subscribe } = require('./domainEvents');
const { resolveRules } = require('./automationRegistry');
const { execute: executeAction } = require('./automationActionHandlers');
const AutomationExecution = require('../models/AutomationExecution');
const { createLogger } = require('./automationLogger');
const { isTrashed } = require('../utils/trashGuard');
const {
  evaluateAutomationDeferral,
  enqueueDeferredAutomationAction
} = require('./automationBusinessHoursService');

const log = createLogger('automationEngine');

/** Map domain event entityType to trash moduleKey */
const ENTITY_TO_MODULE = {
  people: 'people',
  person: 'people',
  organization: 'organizations',
  organizations: 'organizations',
  deal: 'deals',
  deals: 'deals',
  task: 'tasks',
  tasks: 'tasks',
  event: 'events',
  events: 'events',
  item: 'items',
  items: 'items',
  response: 'responses',
  responses: 'responses'
};

let initialized = false;

/**
 * Build execution context for action handlers from event.
 *
 * @param {Object} event - Domain event
 * @returns {Object} ctx
 */
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

/**
 * Check if action was already executed (idempotency).
 *
 * @param {string} eventId
 * @param {string} ruleId
 * @param {number} actionIndex
 * @returns {Promise<boolean>}
 */
async function alreadyExecuted(eventId, ruleId, actionIndex) {
  try {
    const r = await AutomationExecution.findOne({
      eventId,
      ruleId: new mongoose.Types.ObjectId(ruleId),
      actionIndex
    }).lean();
    return !!r;
  } catch {
    return false;
  }
}

/**
 * Persist execution result and log.
 *
 * @param {Object} opts
 */
async function persistExecution(opts) {
  const { eventId, ruleId, actionIndex, actionType, status, error, entityType, entityId } = opts;
  try {
    await AutomationExecution.create({
      eventId,
      ruleId: new mongoose.Types.ObjectId(ruleId),
      actionIndex,
      actionType,
      status,
      error: error || null,
      entityType: entityType || null,
      entityId: entityId || null
    });
  } catch (err) {
    log.error('automation_execution_persist_failed', {
      eventId,
      ruleId,
      actionIndex,
      actionType,
      error: err.message
    });
  }
}

/**
 * Process a domain event: resolve rules, build plan, execute actions (idempotent).
 *
 * @param {Object} event - Domain event from domainEvents.emit (includes eventId, assignedTo)
 * @returns {Promise<{ eventId: string, eventType: string, rulesMatched: number, plan: Array<Object>, executed: number, skipped: number, failed: number }>}
 */
async function processEvent(event) {
  const {
    eventId,
    entityType,
    entityId,
    eventType,
    appKey,
    organizationId,
    triggeredBy,
    assignedTo
  } = event;

  // Workflow isolation: skip automation for trashed records
  const moduleKey = entityType ? ENTITY_TO_MODULE[entityType.toLowerCase()] : null;
  if (moduleKey && entityId && organizationId) {
    try {
      const trashed = await isTrashed(moduleKey, entityId, organizationId);
      if (trashed) {
        log.info('automation_skipped_trashed', { eventId, entityType, entityId, moduleKey });
        return {
          eventId,
          eventType,
          rulesMatched: 0,
          deferred: 0,
          plan: [],
          executed: 0,
          skipped: 0,
          failed: 0
        };
      }
    } catch (err) {
      log.warn('automation_trash_check_failed', { eventId, entityType, entityId, error: err.message });
      // Continue on error (don't block automation if trash check fails)
    }
  }

  const matched = await resolveRules(event);
  const plan = [];
  let deferred = 0;

  for (let idx = 0; idx < matched.length; idx += 1) {
    const m = matched[idx];
    const deferral = await evaluateAutomationDeferral(event, m.rule);
    if (deferral.shouldDefer) {
      const enqueueResult = await enqueueDeferredAutomationAction({
        event,
        rule: m.rule,
        actionIndex: idx,
        actionType: m.action?.type,
        actionParams: m.action?.params ?? null,
        executeAt: deferral.executeAt,
        pauseReason: deferral.pauseReason
      });
      if (enqueueResult.queued) {
        deferred += 1;
        log.info('automation_action_deferred', {
          eventId,
          ruleId: m.rule._id?.toString(),
          actionIndex: idx,
          executeAt: enqueueResult.executeAt,
          pauseReason: deferral.pauseReason
        });
      }
      continue;
    }
    plan.push({
      actionIndex: idx,
      ruleId: m.rule._id?.toString(),
      ruleName: m.rule.name,
      actionType: m.action?.type,
      actionParams: m.action?.params ?? null,
      entityType,
      entityId,
      appKey: m.rule.appKey || appKey
    });
  }

  log.info('automation_actions_planned', {
    eventId,
    eventType,
    entityType,
    entityId,
    appKey,
    rulesMatched: matched.length,
    deferred,
    plan: plan.map((p) => ({ ruleId: p.ruleId, actionType: p.actionType, actionIndex: p.actionIndex }))
  });

  const ctx = buildContext(event);
  let executed = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of plan) {
    const { actionIndex, ruleId, ruleName, actionType, actionParams } = item;

    const existing = await alreadyExecuted(eventId, ruleId, actionIndex);
    if (existing) {
      skipped++;
      continue;
    }

    log.info('automation_action_started', {
      eventId,
      ruleId,
      actionType,
      entityType,
      entityId
    });

    // Create execution record BEFORE executing action (so we have ID for start_process)
    let automationExecution = null;
    try {
      automationExecution = await AutomationExecution.create({
        eventId,
        ruleId: new mongoose.Types.ObjectId(ruleId),
        actionIndex,
        actionType,
        status: 'running', // Will be updated after execution
        error: null,
        entityType: entityType || null,
        entityId: entityId || null
      });
    } catch (err) {
      log.error('automation_execution_create_failed', {
        eventId,
        ruleId,
        actionIndex,
        actionType,
        error: err.message
      });
      // Continue execution even if record creation fails (non-blocking)
    }

    try {
      // Execute action with automationExecutionId for linking
      const automationExecutionId = automationExecution?._id?.toString() || null;
      const result = await executeAction(actionType, ctx, actionParams, automationExecutionId);
      
      if (result && result.ok) {
        executed++;
        
        // Update execution record
        if (automationExecution) {
          await AutomationExecution.updateOne(
            { _id: automationExecution._id },
            {
              status: 'completed',
              error: null
            }
          );
        } else {
          // Fallback: create record if it wasn't created before
          await persistExecution({
            eventId,
            ruleId,
            actionIndex,
            actionType,
            status: 'completed',
            error: null,
            entityType,
            entityId
          });
        }
        
        const logData = {
          eventId,
          ruleId,
          actionType,
          entityType,
          entityId,
          taskId: result.taskId,
          notificationId: result.notificationId,
          processExecutionId: result.processExecutionId
        };
        
        log.info('automation_action_completed', logData);
      } else {
        failed++;
        const errMsg = result?.error || 'Unknown error';
        
        // Update execution record
        if (automationExecution) {
          await AutomationExecution.updateOne(
            { _id: automationExecution._id },
            {
              status: 'failed',
              error: errMsg
            }
          );
        } else {
          // Fallback: create record if it wasn't created before
          await persistExecution({
            eventId,
            ruleId,
            actionIndex,
            actionType,
            status: 'failed',
            error: errMsg,
            entityType,
            entityId
          });
        }
        
        log.info('automation_action_failed', {
          eventId,
          ruleId,
          actionType,
          entityType,
          entityId,
          error: errMsg
        });
      }
    } catch (err) {
      failed++;
      const errMsg = err?.message || String(err);
      
      // Update execution record
      if (automationExecution) {
        await AutomationExecution.updateOne(
          { _id: automationExecution._id },
          {
            status: 'failed',
            error: errMsg
          }
        );
      } else {
        // Fallback: create record if it wasn't created before
        await persistExecution({
          eventId,
          ruleId,
          actionIndex,
          actionType,
          status: 'failed',
          error: errMsg,
          entityType,
          entityId
        });
      }
      
      log.info('automation_action_failed', {
        eventId,
        ruleId,
        actionType,
        entityType,
        entityId,
        error: errMsg
      });
    }
  }

  return {
    eventId,
    eventType,
    rulesMatched: matched.length,
    deferred,
    plan,
    executed,
    skipped,
    failed
  };
}

/**
 * Initialize the engine: subscribe to domain events and process each one.
 * Safe to call multiple times (idempotent).
 */
function init() {
  if (initialized) return;
  initialized = true;
  subscribe((event) => processEvent(event));
  log.info('automation_engine_initialized', {});
}

module.exports = {
  init,
  processEvent
};
