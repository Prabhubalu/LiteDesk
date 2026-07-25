'use strict';

const { RISK } = require('../governance/risk');
const { isAstraStudioEnabled } = require('../../astraStudio/flags');
const canvasService = require('../../astraStudio/canvasService');
const { buildTemplateOps } = require('../../astraStudio/templates');
const { CANVAS_TYPES, WIDGET_TYPES } = require('../../astraStudio/constants');
const { docFromState, listWidgets } = require('../../astraStudio/yjsDocument');
const AstraCanvasSuggestion = require('../../../models/AstraCanvasSuggestion');
const { queueExport } = require('../../astraStudio/exportService');

// Lazy: avoid bootstrap → canvasTools → hydrate → specialistFill → tenantCatalog → bootstrap
function getHydrateCanvas() {
  return require('../../astraStudio/canvasHydrateService').hydrateCanvas;
}

function inferCanvasType(query = '') {
  const q = String(query).toLowerCase();
  // Deal / opportunity asks before meeting (avoids "prep to advance deal" → meeting_prep)
  if (/war\s*room|opportunity|deal\s+health|win\s+strateg|advance\b.*\b(deal|proposal|stage)|to\s+proposal/.test(q)) {
    return 'opportunity_war_room';
  }
  if (/meeting|prep(are)?\s+(?:me\s+)?for|prep\s+a\s+meeting|meeting\s+prep/.test(q)) {
    return 'meeting_preparation';
  }
  if (/customer\s*360|analyze\s+(this\s+)?customer|account\s+360/.test(q)) return 'customer_360';
  if (/executive\s+report|board\s+report/.test(q)) return 'executive_report';
  if (/account\s+plan/.test(q)) return 'account_planning';
  if (/\bqbr\b|quarterly\s+business/.test(q)) return 'quarterly_business_review';
  if (/success\s+plan|onboarding\s+plan/.test(q)) return 'customer_success_plan';
  if (/renewal/.test(q)) return 'renewal_workspace';
  if (/support|investigation|root\s+cause/.test(q)) return 'support_investigation';
  if (/project\s+workspace|implementation\s+roadmap/.test(q)) return 'project_workspace';
  if (/workflow|when\s+a\s+deal|process\s+diagram/.test(q)) return 'workflow_design';
  if (/brainstorm|swot|mind\s*map|sticky/.test(q)) return 'brainstorming';
  if (/strateg/.test(q)) return 'strategy_workspace';
  // Meeting prep: tolerate typos (meetng), "prepare … with Name", quoted party
  if (/\bmeet(?:ing|ng)?\b|\bprep(?:are)?\b|\bwith\s+['"“]|for\s+['"“]/.test(q)) {
    return 'meeting_preparation';
  }
  return 'blank';
}

/** Intent → best single widget type (scored). */
const INTENT_WIDGET_RULES = [
  { type: 'ai.risk', title: 'Risks', re: /\brisk|objection|blocker|concern|red\s*flag/i, weight: 10 },
  { type: 'ai.recommendations', title: 'Talking points', re: /\btalking\s*point|recommend|pitch|script|what\s+to\s+say/i, weight: 10 },
  { type: 'ai.summary', title: 'Meeting agenda', re: /\bagenda|summary|overview|prep\s+notes/i, weight: 9 },
  { type: 'ai.insights', title: 'Stakeholders', re: /\bstakeholder|buyer|sponsor|decision.?maker|influencer/i, weight: 9 },
  { type: 'ai.nba', title: 'Next best actions', re: /\bnba|next\s+best|next\s+action/i, weight: 8 },
  { type: 'content.checklist', title: 'Action items', re: /\bchecklist|action\s+item|todo|to-?do|next\s+steps?/i, weight: 9 },
  { type: 'viz.timeline', title: 'Timeline', re: /\btimeline|history|previous\s+meeting|chronolog/i, weight: 8 },
  { type: 'analytics.chart', title: 'Chart', re: /\bchart|graph|visuali[sz]e|plot/i, weight: 8 },
  { type: 'analytics.kpi', title: 'KPIs', re: /\bkpi|metric|scorecard/i, weight: 7 },
  { type: 'crm.deal', title: 'Deal', re: /\bdeal|opportunity|pipeline/i, weight: 7 },
  { type: 'crm.contact', title: 'Contact', re: /\bcontact|person|people\b/i, weight: 6 },
  { type: 'crm.organization', title: 'Account', re: /\baccount|organization|customer\b/i, weight: 6 },
  { type: 'crm.case', title: 'Case', re: /\bcase|ticket|support\s+issue/i, weight: 7 },
  { type: 'comms.meeting_notes', title: 'Meeting notes', re: /\bnotes|live\s+notes|minutes/i, weight: 7 },
  { type: 'comms.conversation_timeline', title: 'Email & call history', re: /\bemail|call\s+history|conversation/i, weight: 6 },
  { type: 'viz.kanban', title: 'Kanban', re: /\bkanban|board\b/i, weight: 6 },
];

function indexWidgetsByType(widgets = []) {
  const byType = new Map();
  for (const w of widgets) {
    const type = String(w?.type || '');
    if (type && !byType.has(type)) byType.set(type, w);
  }
  return byType;
}

/**
 * Choose the single best widget for the user intent.
 * @param {string} instruction
 * @param {Array} existingWidgets
 * @param {{ targetWidgetId?: string|null }} [opts]
 * @returns {{ type: string|null, title: string|null, existingId?: string, mode: 'add'|'update'|'refresh'|'remove' } | null}
 */
function resolveWidgetIntent(instruction, existingWidgets = [], opts = {}) {
  const q = String(instruction || '').trim();
  if (!q) return null;
  const wantsAdd = /\b(add|create|insert|include|put|new)\b/i.test(q);
  const wantsUpdate = /\b(update|refresh|revise|rewrite|change|improve|expand|refine|fill|regenerate|edit)\b/i.test(q);
  const wantsRemove = /\b(remove|delete|drop|hide)\b/i.test(q);

  // Explicit UI selection: always bind asks to that widget
  const targetId = opts.targetWidgetId ? String(opts.targetWidgetId) : '';
  if (targetId) {
    const selected = existingWidgets.find((w) => String(w?.id || '') === targetId);
    if (selected) {
      const title = String(selected.config?.title || selected.type || 'panel');
      if (wantsRemove) {
        return {
          type: String(selected.type || ''),
          title,
          existingId: selected.id,
          mode: 'remove',
        };
      }
      return {
        type: String(selected.type || ''),
        title,
        existingId: selected.id,
        mode: 'update',
      };
    }
  }

  const byType = indexWidgetsByType(existingWidgets);

  let best = null;
  for (const rule of INTENT_WIDGET_RULES) {
    if (!rule.re.test(q)) continue;
    let score = rule.weight;
    if (wantsAdd) score += 2;
    if (wantsUpdate && byType.has(rule.type)) score += 3;
    if (byType.has(rule.type)) score += 1;
    if (!best || score > best.score) {
      best = { ...rule, score, existing: byType.get(rule.type) || null };
    }
  }

  if (!best) {
    // Generic refresh of whole board
    if (wantsUpdate || /fill|hydrat|populate|load\s+data/i.test(q)) {
      return { type: null, title: null, mode: 'refresh' };
    }
    return null;
  }

  if (wantsRemove && best.existing) {
    return {
      type: best.type,
      title: best.title,
      existingId: best.existing.id,
      mode: 'remove',
    };
  }

  if (best.existing) {
    return {
      type: best.type,
      title: best.title,
      existingId: best.existing.id,
      mode: 'update',
    };
  }

  return {
    type: best.type,
    title: best.title,
    mode: 'add',
  };
}

function buildAddWidgetOp(type, title, index = 0) {
  return {
    op: 'addWidget',
    widget: {
      id: `w_${Date.now().toString(36)}_${index}`,
      type,
      frame: {
        x: 60 + (index % 3) * 40,
        y: 60 + Math.floor(index / 3) * 40,
        w: 340,
        h: 240,
        z: 4,
      },
      config: { title: title || type.split('.').pop() },
      ai: type.startsWith('ai.') ? { confidence: 0.7 } : undefined,
      collapsed: false,
    },
  };
}

/** @deprecated prefer resolveWidgetIntent — kept for tests / callers */
function instructionToOps(instruction, existingWidgets = [], opts = {}) {
  const intent = resolveWidgetIntent(instruction, existingWidgets, opts);
  if (!intent || intent.mode === 'refresh') return [];
  if (intent.mode === 'remove' && intent.existingId) {
    return [{ op: 'removeWidget', widgetId: intent.existingId }];
  }
  if (intent.mode === 'update') return [];
  if (intent.mode === 'add' && intent.type && WIDGET_TYPES.includes(intent.type)) {
    return [buildAddWidgetOp(intent.type, intent.title)];
  }
  return [];
}

function dedupeAddOps(ops, existingWidgets = []) {
  const byType = indexWidgetsByType(existingWidgets);
  const seen = new Set(byType.keys());
  const out = [];
  for (const op of ops) {
    if (op?.op !== 'addWidget') {
      out.push(op);
      continue;
    }
    const type = String(op.widget?.type || '');
    if (!type || seen.has(type)) continue;
    seen.add(type);
    out.push(op);
  }
  return out;
}

async function runCanvasGenerate(input, ctx) {
  if (!isAstraStudioEnabled()) {
    return { ok: false, error: 'ASTRA_STUDIO_DISABLED' };
  }
  const organizationId = ctx.organizationId;
  const userId = ctx.userId;
  if (!organizationId || !userId) {
    return { ok: false, error: 'MISSING_CONTEXT' };
  }

  let canvasId = input.canvasId || ctx.flags?.canvasId || null;
  const promptText = String(input.prompt || ctx.query || input.title || '').trim();
  let canvasType =
    (CANVAS_TYPES.includes(input.canvasType) && input.canvasType) ||
    inferCanvasType(promptText);
  let intent = null;
  try {
    const { classifyCanvasIntent } = require('../../astraStudio/classifyCanvasType');
    const classified = await classifyCanvasIntent({
      organizationId,
      prompt: promptText,
      hintType: canvasType,
    });
    canvasType = classified.canvasType || canvasType;
    intent = classified.intent || null;
  } catch (err) {
    console.warn('[canvas.generate] classifyCanvasIntent failed:', err?.message || err);
  }
  const title = input.title || input.prompt || ctx.query || 'Astra Studio canvas';
  const focus = Array.isArray(input.focus)
    ? input.focus
    : ctx.focus?.moduleKey && ctx.focus?.recordId
      ? [{ moduleKey: ctx.focus.moduleKey, recordId: ctx.focus.recordId }]
      : [];

  if (!canvasId) {
    const created = await canvasService.createCanvas({
      organizationId,
      userId,
      title: String(title).slice(0, 240),
      canvasType,
      focus,
      status: 'active',
    });
    canvasId = created._id;
  } else {
    await canvasService.updateCanvasMeta({
      organizationId,
      canvasId,
      userId,
      patch: { canvasType, title: String(title).slice(0, 240), focus, status: 'active' },
    });
  }

  const built = buildTemplateOps(canvasType, { title, focus });
  const result = await canvasService.applyOps({
    organizationId,
    canvasId,
    ops: built.ops,
    actorUserId: userId,
    reason: 'ai',
  });

  let hydrate = null;
  try {
    hydrate = await getHydrateCanvas()({
      organizationId,
      userId,
      canvasId,
      prompt: input.prompt || ctx.query || title,
      canvasType,
      focus,
      intent,
    });
    if (hydrate?.focus?.length) {
      // keep local focus in sync for response
      focus.splice(0, focus.length, ...hydrate.focus);
    }
  } catch (err) {
    console.warn('[canvas.generate] hydrate failed:', err?.message || err);
  }

  return {
    ok: true,
    canvasId: String(canvasId),
    canvasType,
    title: built.titleHint || title,
    focus: hydrate?.focus || focus,
    hydrated: hydrate?.updated || 0,
    summary: result.summary,
    claims: [
      {
        text: `Generated ${canvasType} workspace with ${result.summary?.widgetCount || 0} widgets`,
        source: 'canvas.generate',
      },
    ],
  };
}

async function runCanvasMutate(input, ctx) {
  if (!isAstraStudioEnabled()) {
    return { ok: false, error: 'ASTRA_STUDIO_DISABLED' };
  }
  const canvasId = input.canvasId || ctx.flags?.canvasId;
  if (!canvasId) return { ok: false, error: 'canvasId required' };

  const instruction = String(input.instruction || input.prompt || ctx.query || '');
  const access = await canvasService.getCanvas({
    organizationId: ctx.organizationId,
    canvasId,
    userId: ctx.userId,
  });
  if (access?.error) return { ok: false, error: access.error };

  const existingWidgets = listWidgets(docFromState(access.canvas?.yjsState));
  const targetWidgetId =
    input.targetWidgetId
    || ctx.flags?.targetWidgetId
    || null;
  const intent = resolveWidgetIntent(instruction, existingWidgets, { targetWidgetId });

  let ops = Array.isArray(input.ops) ? [...input.ops] : [];
  if (!ops.length && intent) {
    ops = instructionToOps(instruction, existingWidgets, { targetWidgetId });
  }
  ops = dedupeAddOps(ops, existingWidgets);

  const targetTypes = intent?.type ? [intent.type] : null;
  const forceHydrate =
    Boolean(targetWidgetId)
    || intent?.mode === 'update'
    || intent?.mode === 'refresh'
    || /fill|hydrat|refresh|populate|load\s+data|regenerate|update|revise|refine|improve|expand|rewrite/i.test(instruction);

  // Add once, then hydrate that panel (or update existing matching panel)
  // Skip add-path when the user explicitly selected an existing widget
  if (!targetWidgetId && intent?.mode === 'add' && intent.type && WIDGET_TYPES.includes(intent.type)) {
    if (!ops.length) ops = [buildAddWidgetOp(intent.type, intent.title)];
    ops = dedupeAddOps(ops, existingWidgets);
    if (ops.length) {
      for (const op of ops) {
        if (op.widget?.type && !WIDGET_TYPES.includes(op.widget.type)) {
          return { ok: false, error: `Unknown widget type: ${op.widget.type}` };
        }
      }
      await canvasService.applyOps({
        organizationId: ctx.organizationId,
        canvasId,
        ops,
        actorUserId: ctx.userId,
        reason: 'ai',
      });
    }
    const hydrate = await getHydrateCanvas()({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      canvasId,
      prompt: instruction,
      focus: Array.isArray(input.focus) ? input.focus : [],
      force: true,
      targetTypes: [intent.type],
    });
    return {
      ok: true,
      canvasId: String(canvasId),
      mode: 'add',
      widgetType: intent.type,
      hydrated: hydrate?.updated || 0,
      focus: hydrate?.focus,
      summary: hydrate?.summary,
      claims: [{
        text: `Added ${intent.title || intent.type} and filled it from your request`,
        source: 'canvas.mutate',
      }],
    };
  }

  if (intent?.mode === 'remove' && ops.length) {
    const result = await canvasService.applyOps({
      organizationId: ctx.organizationId,
      canvasId,
      ops,
      actorUserId: ctx.userId,
      reason: 'ai',
    });
    return {
      ok: true,
      canvasId: String(canvasId),
      mode: 'remove',
      summary: result.summary,
      claims: [{ text: `Removed ${intent.title || intent.type}`, source: 'canvas.mutate' }],
    };
  }

  // Update / refresh: never add duplicates — hydrate the best matching widget(s)
  if (forceHydrate || intent?.mode === 'update' || intent?.mode === 'refresh' || !ops.length) {
    const hydrate = await getHydrateCanvas()({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      canvasId,
      prompt: instruction,
      focus: Array.isArray(input.focus) ? input.focus : [],
      force: true,
      targetTypes: targetWidgetId ? null : targetTypes,
      targetWidgetIds: intent?.existingId ? [intent.existingId] : (targetWidgetId ? [String(targetWidgetId)] : null),
    });
    if (hydrate?.ok) {
      return {
        ok: true,
        canvasId: String(canvasId),
        mode: intent?.mode || 'refresh',
        widgetType: intent?.type || null,
        targetWidgetId: intent?.existingId || targetWidgetId || null,
        hydrated: hydrate.updated,
        focus: hydrate.focus,
        summary: hydrate.summary,
        claims: [{
          text: intent?.title || intent?.type
            ? `Updated “${intent.title || intent.type}” from your request`
            : `Updated ${hydrate.updated || 0} canvas widget(s)`,
          source: 'canvas.mutate',
        }],
      };
    }
  }

  if (!ops.length) return { ok: false, error: 'No ops to apply' };

  for (const op of ops) {
    if (op.widget?.type && !WIDGET_TYPES.includes(op.widget.type)) {
      return { ok: false, error: `Unknown widget type: ${op.widget.type}` };
    }
  }

  const result = await canvasService.applyOps({
    organizationId: ctx.organizationId,
    canvasId,
    ops,
    actorUserId: ctx.userId,
    reason: 'ai',
  });
  return {
    ok: true,
    canvasId: String(canvasId),
    summary: result.summary,
    claims: [{ text: `Applied ${ops.length} canvas mutation(s)`, source: 'canvas.mutate' }],
  };
}

async function runCanvasSuggest(input, ctx) {
  if (!isAstraStudioEnabled()) {
    return { ok: false, error: 'ASTRA_STUDIO_DISABLED' };
  }
  const canvasId = input.canvasId || ctx.flags?.canvasId;
  if (!canvasId || !input.message) {
    return { ok: false, error: 'canvasId and message required' };
  }
  const suggestion = await AstraCanvasSuggestion.create({
    organizationId: ctx.organizationId,
    canvasId,
    message: String(input.message).slice(0, 1000),
    actionType: input.actionType || null,
    actionPayload: input.actionPayload || null,
    status: 'pending',
    createdBy: 'ai',
  });
  return { ok: true, suggestionId: String(suggestion._id) };
}

async function runCanvasExport(input, ctx) {
  if (!isAstraStudioEnabled()) {
    return { ok: false, error: 'ASTRA_STUDIO_DISABLED' };
  }
  const canvasId = input.canvasId || ctx.flags?.canvasId;
  if (!canvasId) return { ok: false, error: 'canvasId required' };
  const access = await canvasService.getCanvas({
    organizationId: ctx.organizationId,
    canvasId,
    userId: ctx.userId,
  });
  if (access.error) return { ok: false, error: access.error };
  const job = await queueExport({
    organizationId: ctx.organizationId,
    canvasId,
    userId: ctx.userId,
    format: input.format || 'html',
    canvas: access.canvas,
  });
  return { ok: true, export: { format: job.format, status: job.status, contentType: job.contentType } };
}

function registerCanvasTools(registry) {
  registry.registerTool({
    name: 'canvas.generate',
    family: 'canvas',
    risk: RISK.WRITE,
    description:
      'Generate or rebuild an Astra Studio Living Canvas from a natural-language prompt and optional focus records.',
    run: runCanvasGenerate,
  });
  registry.registerTool({
    name: 'canvas.mutate',
    family: 'canvas',
    risk: RISK.WRITE,
    description:
      'Incrementally mutate the current Living Canvas (add/move/update/remove widgets) without full recreation.',
    run: runCanvasMutate,
  });
  registry.registerTool({
    name: 'canvas.suggest',
    family: 'canvas',
    risk: RISK.READ,
    description: 'Create a dismissible smart suggestion on the current canvas.',
    run: runCanvasSuggest,
  });
  registry.registerTool({
    name: 'canvas.export',
    family: 'canvas',
    risk: RISK.READ,
    description: 'Export the current Living Canvas to pdf/html/docx/pptx/xlsx.',
    run: runCanvasExport,
  });
}

module.exports = {
  registerCanvasTools,
  runCanvasGenerate,
  runCanvasMutate,
  runCanvasSuggest,
  runCanvasExport,
  inferCanvasType,
  instructionToOps,
  resolveWidgetIntent,
  dedupeAddOps,
};
