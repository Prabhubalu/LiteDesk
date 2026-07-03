/**
 * ============================================================================
 * PLATFORM CORE: Automation Action Handlers
 * ============================================================================
 *
 * Minimal action implementations: create_task, notify_user.
 * No email, SMS, or external integrations.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createLogger } = require('./automationLogger');
const { startProcess } = require('./processInvocation');
const { runAnalyticsReportForAutomation } = require('./analytics/analyticsAutomationService');

const log = createLogger('automationActionHandlers');

const ENTITY_TO_RELATED_TO = {
  people: 'contact',
  organization: 'organization',
  deal: 'deal'
};

/**
 * Resolve assignee/recipient: 'owner' | 'triggeredBy' -> User id.
 * Returns null if unresolved (log and caller should skip).
 *
 * @param {Object} ctx - { assignedTo, triggeredBy, organizationId }
 * @param {string} kind - 'owner' | 'triggeredBy'
 * @returns {Promise<string|null>} User id string or null
 */
async function resolveAssignee(ctx, kind) {
  const orgId = ctx.organizationId;
  if (!orgId) return null;
  const raw = kind === 'owner' ? ctx.assignedTo : ctx.triggeredBy;
  const id = raw != null ? (raw.toString ? raw.toString() : String(raw)) : null;
  if (!id || id === 'system') return null;
  try {
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: new mongoose.Types.ObjectId(orgId)
    })
      .select('_id')
      .lean();
    return user ? user._id.toString() : null;
  } catch {
    return null;
  }
}

/**
 * create_task handler.
 * Params: title (required), description?, dueInDays?, assignee ('owner'|'triggeredBy'),
 *         relatedEntity: { entityType, entityId }.
 *
 * @param {Object} ctx - Event context { eventId, entityType, entityId, organizationId, triggeredBy, assignedTo, appKey }
 * @param {Object} params - Action params
 * @returns {Promise<{ ok: boolean, taskId?: string, error?: string }>}
 */
async function createTask(ctx, params) {
  const title = params?.title;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return { ok: false, error: 'create_task requires non-empty title' };
  }
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'create_task requires organizationId' };

  const assigneeKind = params?.assignee === 'owner' ? 'owner' : 'triggeredBy';
  const assigneeId = await resolveAssignee(ctx, assigneeKind);
  if (!assigneeId) {
    return { ok: false, error: `create_task: could not resolve assignee (${assigneeKind})` };
  }

  let dueDate = null;
  const dueInDays = params?.dueInDays;
  if (typeof dueInDays === 'number' && dueInDays >= 0) {
    const d = new Date();
    d.setDate(d.getDate() + dueInDays);
    dueDate = d;
  }

  let relatedTo = { type: 'none', id: null };
  const re = params?.relatedEntity;
  const useTrigger = re && (re.entityId === '__trigger__' || re.entityId === '');
  const entityType = useTrigger ? ctx.entityType : (re?.entityType ?? null);
  const entityId = useTrigger ? ctx.entityId : (re?.entityId ?? null);
  if (entityType && entityId) {
    const type = ENTITY_TO_RELATED_TO[String(entityType).toLowerCase()] || 'none';
    if (type !== 'none') {
      try {
        relatedTo = { type, id: new mongoose.Types.ObjectId(entityId) };
      } catch {
        relatedTo = { type: 'none', id: null };
      }
    }
  }

  try {
    const { assignResolvedSource } = require('./sourceResolver');
    const taskPayload = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      title: title.trim(),
      description: params?.description && typeof params.description === 'string' ? params.description.trim() : undefined,
      dueDate,
      relatedTo,
      assignedTo: new mongoose.Types.ObjectId(assigneeId),
      assignedBy: ctx.triggeredBy ? new mongoose.Types.ObjectId(ctx.triggeredBy) : undefined,
      status: 'todo',
      priority: 'medium',
      createdBy: ctx.triggeredBy ? new mongoose.Types.ObjectId(ctx.triggeredBy) : undefined
    };
    assignResolvedSource(taskPayload, 'automation');
    const task = await Task.create(taskPayload);
    return { ok: true, taskId: task._id.toString() };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * notify_user handler.
 * Params: message (required), recipient ('owner'|'triggeredBy').
 * Creates IN_APP notification only.
 *
 * @param {Object} ctx - Event context
 * @param {Object} params - Action params
 * @returns {Promise<{ ok: boolean, notificationId?: string, error?: string }>}
 */
async function notifyUser(ctx, params) {
  const message = params?.message;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { ok: false, error: 'notify_user requires non-empty message' };
  }
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'notify_user requires organizationId' };

  const recipientKind = params?.recipient === 'owner' ? 'owner' : 'triggeredBy';
  const userId = await resolveAssignee(ctx, recipientKind);
  if (!userId) {
    return { ok: false, error: `notify_user: could not resolve recipient (${recipientKind})` };
  }

  const appKey = (ctx.appKey || 'SALES').toUpperCase();
  const title = 'Automation';
  const body = message.trim();

  try {
    let entity = undefined;
    const entityType = ctx.entityType || null;
    const entityId = ctx.entityId || null;
    if (entityType && entityId && mongoose.Types.ObjectId.isValid(entityId)) {
      entity = { type: entityType, id: new mongoose.Types.ObjectId(entityId) };
    }
    const doc = {
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      appKey,
      eventType: 'AUTOMATION_NOTIFY',
      title,
      body,
      channel: 'IN_APP',
      source: 'SYSTEM',
      ...(entity && { entity })
    };
    const notification = await Notification.create(doc);
    return { ok: true, notificationId: notification._id.toString() };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * start_process handler.
 * Starts a Process Execution from an Automation Rule.
 * Params: processId (required), inputMapping (optional).
 *
 * @param {Object} ctx - Event context { eventId, entityType, entityId, organizationId, triggeredBy, assignedTo, appKey }
 * @param {Object} params - Action params { processId, inputMapping? }
 * @param {string} [automationExecutionId] - Automation execution ID (for linking)
 * @returns {Promise<{ ok: boolean, processExecutionId?: string, error?: string }>}
 */
async function startProcessAction(ctx, params, automationExecutionId = null) {
  const processId = params?.processId;
  if (!processId || typeof processId !== 'string') {
    return { ok: false, error: 'start_process requires processId' };
  }

  const orgId = ctx.organizationId;
  if (!orgId) {
    return { ok: false, error: 'start_process requires organizationId' };
  }

  // Build input mapping (optional key-value mapping to populate process dataBag)
  const inputMapping = params?.inputMapping || {};

  // Start process using the formal invocation service
  // Pass the domain event if available (from context)
  const event = ctx.eventId ? {
    eventId: ctx.eventId,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    eventType: ctx.eventType || null,
    organizationId: ctx.organizationId,
    triggeredBy: ctx.triggeredBy,
    assignedTo: ctx.assignedTo,
    appKey: ctx.appKey
  } : null;

  try {
    const result = await startProcess({
      processId,
      event,
      manualParams: event ? null : {
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        organizationId: ctx.organizationId,
        triggeredBy: ctx.triggeredBy,
        assignedTo: ctx.assignedTo
      },
      inputMapping,
      automationExecutionId
    });

    if (result.ok) {
      return {
        ok: true,
        processExecutionId: result.executionId
      };
    } else {
      return { ok: false, error: result.error || 'Process start failed' };
    }
  } catch (err) {
    return { ok: false, error: `start_process error: ${err.message}` };
  }
}

async function liveChatCreateCase(ctx, params) {
  if (String(ctx.entityType || '').toLowerCase() !== 'live_chat_session') {
    return { ok: false, error: 'live_chat_create_case requires live_chat_session trigger' };
  }
  if (!ctx.organizationId || !ctx.entityId) {
    return { ok: false, error: 'live_chat_create_case requires organizationId and session entityId' };
  }

  try {
    const { createCaseFromLiveChatSession } = require('./liveChatCaseAdapter');
    const result = await createCaseFromLiveChatSession({
      organizationId: ctx.organizationId,
      sessionId: ctx.entityId,
      actorId: ctx.triggeredBy,
      title: params?.title,
    });
    return { ok: true, caseId: result.caseId };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function liveChatLinkCase(ctx, params) {
  if (String(ctx.entityType || '').toLowerCase() !== 'live_chat_session') {
    return { ok: false, error: 'live_chat_link_case requires live_chat_session trigger' };
  }
  const caseId = params?.caseId;
  if (!caseId) {
    return { ok: false, error: 'live_chat_link_case requires caseId' };
  }

  try {
    const { linkExistingCaseToSession } = require('./liveChatCaseAdapter');
    const result = await linkExistingCaseToSession({
      organizationId: ctx.organizationId,
      sessionId: ctx.entityId,
      caseId,
      actorId: ctx.triggeredBy,
    });
    return { ok: true, caseId: result.caseId };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function liveChatCreateLead(ctx) {
  if (String(ctx.entityType || '').toLowerCase() !== 'live_chat_session') {
    return { ok: false, error: 'live_chat_create_lead requires live_chat_session trigger' };
  }
  if (!ctx.organizationId || !ctx.entityId) {
    return { ok: false, error: 'live_chat_create_lead requires organizationId and session entityId' };
  }

  try {
    const { createLeadFromLiveChatSession } = require('./liveChatCrmAdapter');
    const result = await createLeadFromLiveChatSession({
      organizationId: ctx.organizationId,
      sessionId: ctx.entityId,
      actorId: ctx.triggeredBy,
    });
    return { ok: true, personId: result.personId, created: result.created };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function liveChatLinkPerson(ctx, params) {
  if (String(ctx.entityType || '').toLowerCase() !== 'live_chat_session') {
    return { ok: false, error: 'live_chat_link_person requires live_chat_session trigger' };
  }
  const personId = params?.personId;
  if (!personId) {
    return { ok: false, error: 'live_chat_link_person requires personId' };
  }

  try {
    const { linkExistingPersonToSession } = require('./liveChatCrmAdapter');
    const result = await linkExistingPersonToSession({
      organizationId: ctx.organizationId,
      sessionId: ctx.entityId,
      personId,
      actorId: ctx.triggeredBy,
    });
    return { ok: true, personId: result.personId };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function runAnalyticsReportAction(ctx, params) {
  const reportId = params?.reportId != null ? String(params.reportId).trim() : '';
  if (!reportId) {
    return { ok: false, error: 'run_analytics_report requires reportId' };
  }

  const orgId = ctx.organizationId;
  if (!orgId) {
    return { ok: false, error: 'run_analytics_report requires organizationId' };
  }

  const attachRaw = params?.attachToRecord;
  const attachToRecord = attachRaw === false || attachRaw === 'false' ? false : true;

  const userId =
    (await resolveAssignee(ctx, 'triggeredBy')) || (await resolveAssignee(ctx, 'owner'));
  if (!userId) {
    return { ok: false, error: 'run_analytics_report: could not resolve executing user' };
  }

  try {
    return await runAnalyticsReportForAutomation({
      organizationId: orgId,
      userId,
      reportId,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      appKey: ctx.appKey,
      attachToRecord,
    });
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

const handlers = {
  create_task: createTask,
  notify_user: notifyUser,
  start_process: startProcessAction,
  run_analytics_report: runAnalyticsReportAction,
  live_chat_create_case: liveChatCreateCase,
  live_chat_link_case: liveChatLinkCase,
  live_chat_create_lead: liveChatCreateLead,
  live_chat_link_person: liveChatLinkPerson,
};

/**
 * Execute an action by type. Handlers are wrapped in try/catch by the engine.
 *
 * @param {string} actionType
 * @param {Object} ctx - Event context
 * @param {Object} params - Action params
 * @param {string} [automationExecutionId] - Automation execution ID (for linking with processes)
 * @returns {Promise<{ ok: boolean, taskId?: string, notificationId?: string, processExecutionId?: string, error?: string }>}
 */
async function execute(actionType, ctx, params, automationExecutionId = null) {
  const fn = handlers[actionType];
  if (!fn) {
    return { ok: false, error: `Unknown action type: ${actionType}` };
  }
  
  // For start_process action, pass automationExecutionId
  if (actionType === 'start_process') {
    return fn(ctx, params || {}, automationExecutionId);
  }
  
  return fn(ctx, params || {});
}

module.exports = {
  execute,
  handlers
};
