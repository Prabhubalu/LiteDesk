'use strict';

/**
 * astraV2Controller — HTTP surface for the Astra v2 platform.
 * Tenant + auth are enforced by upstream middleware; this layer only adapts
 * req/res to the orchestrator and autonomous service.
 */

const astra = require('../services/astra');
const { runOrchestrator } = require('../services/astra/orchestrator/runOrchestrator');
const autonomousService = require('../services/astra/autonomous/autonomousService');
const personalMemoryService = require('../services/astra/memory/personalMemoryService');
const orgMemoryService = require('../services/astra/memory/orgMemoryService');
const conversationStore = require('../services/astra/memory/conversationStore');
const { openStream, sendDelta, closeStream, failStream } = require('../services/astra/experience/sse');

function orgId(req) {
  return req.user?.organizationId || req.organizationId || null;
}

function userId(req) {
  return req.user?._id || req.user?.id || null;
}

function handleError(res, error) {
  const status = error?.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error?.message || 'Astra request failed',
    code: error?.code || 'ASTRA_V2_ERROR',
  });
}

async function getStatus(req, res) {
  try {
    const summary = astra.bootstrapAstra();
    return res.json({
      success: true,
      enabled: astra.flags.isAstraV2Enabled(),
      shadow: astra.flags.isAstraV2Shadow(),
      tools: summary.tools,
      agents: summary.agents,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function ask(req, res) {
  try {
    const organizationId = orgId(req);
    const uid = userId(req);
    const focus = req.body?.focus || null;
    const moduleKey = req.body?.moduleKey || focus?.moduleKey || null;
    const query = req.body?.query || req.body?.prompt || '';

    const thread = await conversationStore.ensureConversation({
      organizationId,
      userId: uid,
      conversationId: req.body?.conversationId || null,
      titleHint: query,
      moduleKey: moduleKey || '',
      recordId: focus?.recordId || req.body?.recordId || '',
    });
    const conversationId = String(thread._id);

    const clientHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = clientHistory.length
      ? clientHistory
      : conversationStore.toLlmHistory(thread);

    const result = await runOrchestrator({
      organizationId,
      userId: uid,
      query,
      surface: req.body?.surface || 'chat',
      agent: req.body?.agent || 'coworker',
      entity: req.body?.entity || moduleKey || undefined,
      limit: req.body?.limit,
      history,
      conversationId,
      focus,
      steps: req.body?.steps,
      workflow: req.body?.workflow,
    });

    const summary = await conversationStore.appendTurn({
      organizationId,
      userId: uid,
      conversationId,
      userMessage: query,
      assistantMessage: {
        body: result.answer,
        structured: {
          blocks: result.blocks || [],
          suggestions: result.suggestions || [],
          proposals: result.proposals || result.actions || [],
          intent: result.intent || null,
        },
      },
    });

    return res.json({
      success: true,
      ...result,
      conversationId,
      conversationTitle: summary?.title || thread.title,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function askStream(req, res) {
  try {
    openStream(res);
    const result = await runOrchestrator({
      organizationId: orgId(req),
      userId: userId(req),
      query: req.query?.query || req.body?.query || '',
      surface: req.query?.surface || 'chat',
      history: [],
    });
    // Non-token streaming: emit the final grounded answer as one delta + done.
    sendDelta(res, result.answer);
    return closeStream(res, {
      intent: result.intent,
      claims: result.claims,
      toolResult: result.toolResult,
    });
  } catch (error) {
    return failStream(res, error);
  }
}

async function listTools(req, res) {
  astra.ensureBootstrapped();
  return res.json({ success: true, tools: astra.toolRegistry.listTools() });
}

async function listAgents(req, res) {
  astra.ensureBootstrapped();
  const tools = astra.toolRegistry.listTools();
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const agents = astra.agentRegistry.listAgents().map((agent) => ({
    name: agent.name,
    title: agent.title,
    description: agent.description,
    autonomy: agent.autonomy,
    systemHint: agent.systemHint,
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    toolDetails: (Array.isArray(agent.tools) ? agent.tools : []).map((toolName) => {
      const tool = toolsByName.get(toolName);
      return tool || {
        name: toolName,
        family: 'unknown',
        risk: 'read',
        description: '',
        missing: true,
      };
    }),
  }));
  return res.json({
    success: true,
    agents,
    tools,
    meta: {
      agentCount: agents.length,
      toolCount: tools.length,
      ootb: true,
    },
  });
}

async function confirmAction(req, res) {
  try {
    astra.ensureBootstrapped();
    const toolName = String(req.body?.toolName || req.body?.kind || '').trim();
    if (!toolName) {
      return res.status(400).json({ success: false, message: 'toolName is required', code: 'ASTRA_CONFIRM_TOOL_REQUIRED' });
    }
    const tool = astra.toolRegistry.getTool(toolName);
    if (!tool) {
      return res.status(404).json({ success: false, message: `Unknown tool: ${toolName}`, code: 'ASTRA_TOOL_NOT_FOUND' });
    }

    const payload =
      (req.body?.payload && typeof req.body.payload === 'object' && req.body.payload)
      || (req.body?.fields && typeof req.body.fields === 'object' && req.body.fields)
      || {};
    const conversationId = String(req.body?.conversationId || '').trim();
    const proposalId = String(req.body?.proposalId || '').trim();
    const organizationId = orgId(req);
    const uid = userId(req);

    const result = await tool.run(
      { ...payload, confirmed: true },
      {
        organizationId,
        userId: uid,
        surface: req.body?.surface || 'chat',
        toolRegistry: astra.toolRegistry,
        deps: {},
      },
    );

    if (result?.created === false || result?.error) {
      return res.status(400).json({
        success: false,
        message: result?.guidance || 'Action failed',
        code: result?.error || 'ASTRA_CONFIRM_FAILED',
        result,
      });
    }

    const { recordPathFor } = require('../services/astra/tools/moduleCatalog');
    const moduleKey = String(
      req.body?.moduleKey
      || (toolName === 'calendar.createEvent' ? 'events'
        : toolName === 'crm.tasks.create' ? 'tasks'
          : toolName === 'crm.deals.create' ? 'deals'
            : toolName === 'crm.cases.create' ? 'cases'
              : toolName === 'crm.people.create' ? 'people'
                : toolName === 'crm.organizations.create' ? 'organizations'
                  : '')
      || '',
    ).trim() || undefined;
    const recordId = String(
      result?.id || result?.recordId || result?._id || '',
    ).trim() || undefined;
    const href = recordId && moduleKey ? recordPathFor(moduleKey, recordId) : null;
    const navigateLabel = moduleKey === 'events'
      ? 'View event'
      : moduleKey === 'tasks'
        ? 'View task'
        : moduleKey === 'deals'
          ? 'View deal'
          : moduleKey === 'cases'
            ? 'View case'
            : moduleKey === 'people'
              ? 'View contact'
              : moduleKey === 'organizations'
                ? 'View organization'
                : (href ? 'Open record' : null);
    const message = result?.guidance || result?.summary || 'Action confirmed';

    if (
      conversationId
      && organizationId
      && result?.created === true
      && toolName === 'calendar.createEvent'
    ) {
      const sessionMemory = require('../services/astra/memory/sessionMemory');
      sessionMemory.setFocus(organizationId, conversationId, {
        kind: 'events',
        moduleKey: 'events',
        id: recordId || undefined,
        name: result.title || payload.title || undefined,
        startDateTime: payload.startDateTime || undefined,
        endDateTime: payload.endDateTime || undefined,
      });
    }

    if (conversationId && organizationId && uid && proposalId) {
      await conversationStore.resolveProposal({
        organizationId,
        userId: uid,
        conversationId,
        proposalId,
        status: 'completed',
        recordId: recordId || null,
        href: href || null,
        navigateLabel: navigateLabel || null,
        rationale: message,
        assistantBody: message,
      });
    } else if (conversationId && organizationId && uid) {
      await conversationStore.appendTurn({
        organizationId,
        userId: uid,
        conversationId,
        userMessage: '',
        assistantMessage: {
          body: message,
          structured: {
            blocks: [],
            suggestions: [],
            proposals: [],
            navigate: href
              ? { href, label: navigateLabel, recordId }
              : null,
          },
        },
      });
    }

    return res.json({
      success: true,
      message,
      result,
      recordId: recordId || null,
      moduleKey: moduleKey || null,
      href: href || null,
      navigateLabel: navigateLabel || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getNextBestActions(req, res) {
  try {
    const nba = await autonomousService.nextBestActions({
      organizationId: orgId(req),
      userId: userId(req),
      surface: req.query?.surface || 'home',
    });
    return res.json({ success: true, ...nba });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listGoals(req, res) {
  try {
    const goals = await autonomousService.listGoals({
      organizationId: orgId(req),
      userId: userId(req),
      status: req.query?.status || 'active',
    });
    return res.json({ success: true, goals });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createGoal(req, res) {
  try {
    const goal = await autonomousService.createGoal({
      organizationId: orgId(req),
      userId: userId(req),
      title: req.body?.title,
      description: req.body?.description,
      surface: req.body?.surface,
      target: req.body?.target,
      dueAt: req.body?.dueAt,
    });
    return res.status(201).json({ success: true, goal });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateGoal(req, res) {
  try {
    const goal = await autonomousService.updateGoal({
      organizationId: orgId(req),
      goalId: req.params.goalId,
      patch: req.body || {},
    });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    return res.json({ success: true, goal });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getMemory(req, res) {
  try {
    const personal = await personalMemoryService.getPersonalMemory({
      organizationId: orgId(req),
      userId: userId(req),
    });
    const org = await orgMemoryService.listOrgMemory({
      organizationId: orgId(req),
      scope: req.query?.scope || 'grounding',
    });
    return res.json({ success: true, personal, org });
  } catch (error) {
    return handleError(res, error);
  }
}

async function putMemory(req, res) {
  try {
    const personal = await personalMemoryService.updatePersonalMemory({
      organizationId: orgId(req),
      userId: userId(req),
      patch: req.body || {},
    });
    return res.json({ success: true, personal });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listConversations(req, res) {
  try {
    const conversations = await conversationStore.listConversations({
      organizationId: orgId(req),
      userId: userId(req),
      limit: req.query?.limit,
    });
    return res.json({ success: true, conversations });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getConversation(req, res) {
  try {
    const conversation = await conversationStore.getConversation({
      organizationId: orgId(req),
      userId: userId(req),
      conversationId: req.params.conversationId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found', code: 'ASTRA_CONVERSATION_NOT_FOUND' });
    }
    return res.json({ success: true, conversation });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteConversation(req, res) {
  try {
    const ok = await conversationStore.deleteConversation({
      organizationId: orgId(req),
      userId: userId(req),
      conversationId: req.params.conversationId,
    });
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Conversation not found', code: 'ASTRA_CONVERSATION_NOT_FOUND' });
    }
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteAllConversations(req, res) {
  try {
    const scope = String(req.query?.scope || req.body?.scope || 'all').toLowerCase();
    let before = null;
    if (req.query?.before || req.body?.before) {
      before = new Date(req.query?.before || req.body?.before);
    } else if (scope === 'older' || scope === 'before_today') {
      const now = new Date();
      before = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const deleted = await conversationStore.deleteAllConversations({
      organizationId: orgId(req),
      userId: userId(req),
      before,
    });
    return res.json({ success: true, deleted });
  } catch (error) {
    return handleError(res, error);
  }
}

async function renameConversation(req, res) {
  try {
    const conversation = await conversationStore.renameConversation({
      organizationId: orgId(req),
      userId: userId(req),
      conversationId: req.params.conversationId,
      title: req.body?.title,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found', code: 'ASTRA_CONVERSATION_NOT_FOUND' });
    }
    return res.json({ success: true, conversation });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  getStatus,
  ask,
  askStream,
  confirmAction,
  listTools,
  listAgents,
  getNextBestActions,
  listGoals,
  createGoal,
  updateGoal,
  getMemory,
  putMemory,
  listConversations,
  getConversation,
  deleteConversation,
  deleteAllConversations,
  renameConversation,
};
