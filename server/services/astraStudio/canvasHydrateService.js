'use strict';

/**
 * Progressive canvas hydrate: resolve CRM focus from the prompt, bind CRM widgets,
 * and fill narrative widgets via Mission Control specialist seats (surface: service).
 */

const searchService = require('../searchService');
const canvasService = require('./canvasService');
const { docFromState, listWidgets } = require('./yjsDocument');
const {
  panelKind,
  fillWidgetsWithSpecialists,
  bodyToChecklistItems,
} = require('./specialistWidgetFill');
// Situation briefs are resolved via canvasBriefRegistry inside hydrateCanvas

const AI_TYPES = new Set([
  'ai.summary',
  'ai.insights',
  'ai.recommendations',
  'ai.risk',
  'ai.nba',
]);

const NARRATIVE_TYPES = new Set([
  ...AI_TYPES,
  'content.table',
  'viz.relationship_graph',
  'content.rich_text',
]);

function extractEntityHint(prompt = '') {
  const text = String(prompt || '').trim();
  if (!text) return '';
  const quoted = text.match(/['"“”]([^'"“”]{2,80})['"“”]/);
  if (quoted?.[1]) return quoted[1].trim();
  const withFor = text.match(
    /\b(?:with|for|of|about|regarding)\s+([A-Za-z0-9][A-Za-z0-9 .,&'_-]{1,60}?)(?:\s+(?:deal|meeting|case|account|org(?:anization)?|tomorrow|today|next)\b|[?.!]|$)/i,
  );
  if (withFor?.[1]) return withFor[1].trim().replace(/[?.!,]+$/, '');
  // Strip common canvas boilerplate words and take leftover proper-ish tokens
  const stripped = text
    .replace(/\b(prepare|prep|me|for|of|a|an|the|upcoming|meeting|war\s*room|build|workspace|canvas|living|opportunity|investigate|give\s+me|customer\s*360|qbr)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length >= 2 && stripped.length <= 64 && stripped.split(/\s+/).length <= 6) {
    return stripped;
  }
  return '';
}

const PARTY_FOCUS = new Set(['people', 'organizations', 'deals']);

function hasPartyFocus(focus = []) {
  return focus.some((f) => PARTY_FOCUS.has(normalizeModule(f.moduleKey)));
}

/** Company / product names must not be treated as people ("Vtiger CRM", "Acme Inc"). */
function looksLikeCompanyHint(hint = '') {
  const text = String(hint || '').trim();
  if (!text) return false;
  return /\b(crm|inc|llc|ltd|corp|corporation|company|co\.|software|solutions|technologies|systems|labs|group|holdings|partners|consulting|account|org(?:anization)?)\b/i.test(
    text,
  );
}

function looksLikePersonNameHint(hint = '') {
  const text = String(hint || '').trim();
  if (!text) return false;
  // Deal/account/product phrases must not be treated as people
  if (/\b(deal|opportunity|account|org(?:anization)?|case|quote|renewal|pipeline|war\s*room)\b/i.test(text)) {
    return false;
  }
  if (looksLikeCompanyHint(text)) return false;
  const parts = text.split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every((p) => /^[A-Za-z][A-Za-z.'-]*$/.test(p));
}

function wantsDealFocus(prompt = '') {
  return /war\s*room|opportun|deal\s+health|win\s+strateg|advance\b.*\b(deal|proposal|stage)|to\s+proposal|\bdeal\b/i.test(
    String(prompt || ''),
  );
}

function focusMatchesHint(focus = [], hint = '') {
  const h = String(hint || '').trim().toLowerCase();
  if (!h) return true;
  const tokens = h.split(/\s+/).filter((t) => t.length > 1);
  return (Array.isArray(focus) ? focus : []).some((f) => {
    const name = String(f?.recordName || '').toLowerCase();
    if (!name) return false;
    if (name.includes(h) || h.includes(name)) return true;
    return tokens.every((t) => name.includes(t));
  });
}

function bestSearchHit(arr, hint = '') {
  const list = Array.isArray(arr) ? arr : [];
  if (!list.length) return null;
  const h = String(hint || '').trim().toLowerCase();
  if (!h) return list[0];
  const scored = list.map((hit) => {
    const title = String(hit.title || hit.name || '').toLowerCase();
    let score = 99;
    if (title === h) score = 0;
    else if (title.startsWith(h) || h.startsWith(title)) score = 1;
    else if (title.includes(h)) score = 2;
    else {
      const tokens = h.split(/\s+/).filter(Boolean);
      if (tokens.length && tokens.every((t) => title.includes(t))) score = 3;
    }
    return { hit, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].score < 99 ? scored[0].hit : list[0];
}

/**
 * @returns {Promise<Array<{ moduleKey: string, recordId: string, recordName?: string }>>}
 */
async function resolveFocusFromPrompt({
  organizationId,
  prompt,
  existingFocus = [],
  entityHint = '',
  preferredModules = null,
  skipFocus = false,
}) {
  if (skipFocus) return [];

  const normalizedExisting = prioritizeFocus(
    (Array.isArray(existingFocus) ? existingFocus : [])
      .filter((f) => f?.moduleKey && f?.recordId)
      .map((f) => ({
        moduleKey: String(f.moduleKey),
        recordId: String(f.recordId),
        recordName: f.recordName ? String(f.recordName) : undefined,
      })),
  );

  const hint = String(entityHint || extractEntityHint(prompt) || '').trim();

  // Keep hard CRM focus only when it matches the named party in the prompt.
  if (
    normalizedExisting.length
    && hasPartyFocus(normalizedExisting)
    && focusMatchesHint(normalizedExisting, hint)
  ) {
    return prioritizeFocus(normalizedExisting, preferredModules);
  }

  if (!hint || hint.length < 2) return prioritizeFocus(normalizedExisting, preferredModules);

  try {
    const grouped = await searchService.searchAll(organizationId, hint, { limitPerModule: 5 });
    const bucket = grouped?.results || grouped || {};
    const focus = [];
    const seen = new Set();
    const pick = (arr, moduleKey) => {
      const hit = bestSearchHit(arr, hint);
      if (!hit?.id) return null;
      const key = `${moduleKey}:${hit.id}`;
      if (seen.has(key)) return hit;
      seen.add(key);
      focus.push({
        moduleKey,
        recordId: String(hit.id),
        recordName: String(hit.title || hit.name || hint),
      });
      return hit;
    };

    // Prefer modules from intent policy (deal-first for war room, org-first for 360, …)
    const pref = Array.isArray(preferredModules) ? preferredModules.map(normalizeModule) : [];
    const wantsDeal = wantsDealFocus(prompt) || pref[0] === 'deals';
    const wantsCase = pref[0] === 'cases';
    const wantsOrg = pref[0] === 'organizations' || looksLikeCompanyHint(hint);

    if (wantsCase) {
      pick(bucket.cases, 'cases');
      pick(bucket.people, 'people');
      pick(bucket.organizations, 'organizations');
      pick(bucket.deals, 'deals');
    } else if (wantsOrg) {
      pick(bucket.organizations, 'organizations');
      pick(bucket.deals, 'deals');
      pick(bucket.people, 'people');
    } else if (wantsDeal) {
      pick(bucket.deals, 'deals');
      pick(bucket.organizations, 'organizations');
      pick(bucket.people, 'people');
    } else {
      // Person-first for meeting / named-party prompts
      const person = pick(bucket.people, 'people');
      if (person?.organizationId) {
        const orgKey = `organizations:${person.organizationId}`;
        if (!seen.has(orgKey)) {
          seen.add(orgKey);
          focus.push({
            moduleKey: 'organizations',
            recordId: String(person.organizationId),
            recordName: String(person.organizationName || 'Account'),
          });
        }
      }
      if (person) {
        pick(bucket.deals, 'deals');
      } else if (!looksLikePersonNameHint(hint)) {
        pick(bucket.organizations, 'organizations');
        pick(bucket.deals, 'deals');
      } else {
        // Person-shaped hint with no people hit — still try account match
        pick(bucket.organizations, 'organizations');
        pick(bucket.deals, 'deals');
      }
    }
    if (!wantsCase) pick(bucket.cases, 'cases');
    pick(bucket.quotes, 'quotes');

    // Prefer party focus. Never fall back to tasks/events when the hint looks like a person name
    // (those often match meeting titles and starve CRM widgets of real bindings).
    if (!hasPartyFocus(focus) && !looksLikePersonNameHint(hint)) {
      pick(bucket.tasks, 'tasks');
      pick(bucket.events, 'events');
    }

    if (focus.length) return prioritizeFocus(focus, preferredModules);
    return prioritizeFocus(normalizedExisting, preferredModules);
  } catch (err) {
    console.warn('[canvasHydrate] focus search failed:', err?.message || err);
    return normalizedExisting;
  }
}

const FOCUS_PRIORITY = ['people', 'organizations', 'deals', 'cases', 'quotes', 'tasks', 'events'];

function prioritizeFocus(focus = [], preferredModules = null) {
  const order = Array.isArray(preferredModules) && preferredModules.length
    ? preferredModules.map(normalizeModule)
    : FOCUS_PRIORITY;
  return [...focus].sort((a, b) => {
    const ai = order.indexOf(normalizeModule(a.moduleKey));
    const bi = order.indexOf(normalizeModule(b.moduleKey));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function normalizeModule(mk = '') {
  const k = String(mk).toLowerCase();
  if (k === 'organization' || k === 'org' || k === 'account') return 'organizations';
  if (k === 'person' || k === 'contact') return 'people';
  if (k === 'deal') return 'deals';
  if (k === 'case') return 'cases';
  if (k === 'quote') return 'quotes';
  if (k === 'task') return 'tasks';
  return k;
}

function bindingForWidgetType(type, focus) {
  const t = String(type || '');
  const crm = t.startsWith('crm.') ? normalizeModule(t.slice(4)) : '';
  if (!crm || !focus?.length) return null;
  let hit = focus.find((f) => normalizeModule(f.moduleKey) === crm);
  // Meeting-prep "Customer overview" is crm.organization — fall back to person when no account
  if (!hit && (crm === 'organizations' || crm === 'organization')) {
    hit = focus.find((f) => normalizeModule(f.moduleKey) === 'people');
    if (hit) {
      return {
        moduleKey: 'people',
        recordId: String(hit.recordId),
        recordIds: [String(hit.recordId)],
      };
    }
  }
  if (!hit && (crm === 'contact' || crm === 'contacts')) {
    hit = focus.find((f) => normalizeModule(f.moduleKey) === 'people');
  }
  if (!hit && (crm === 'task' || crm === 'tasks')) {
    // Prefer a real task; otherwise leave unbound (checklist hydrate fills open tasks)
    hit = focus.find((f) => normalizeModule(f.moduleKey) === 'tasks');
    if (!hit) return null;
  }
  if (!hit) return null;
  return {
    moduleKey: normalizeModule(hit.moduleKey) === 'people' ? 'people' : normalizeModule(crm) || crm,
    recordId: String(hit.recordId),
    recordIds: [String(hit.recordId)],
  };
}

async function generateAiBodies({
  organizationId,
  userId,
  canvasId,
  prompt,
  focus,
  aiWidgets,
  situationText = '',
  canvasType = '',
  brief = null,
  policy = null,
  intent = null,
}) {
  if (!aiWidgets.length) return [];

  const groundedFor = (w) => {
    const kind = panelKind(w);
    if (kind === 'buying_signals' && brief?.signalBullets) return brief.signalBullets;
    if (kind === 'risk' && brief?.riskBullets) return brief.riskBullets;
    if (kind === 'stakeholders' && brief?.stakeholderBullets) return brief.stakeholderBullets;
    if (kind === 'competitors') {
      return brief?.competitorWebBullets || brief?.competitorBullets || '';
    }
    return '';
  };

  try {
    const rows = await fillWidgetsWithSpecialists(aiWidgets, {
      organizationId,
      userId,
      canvasId,
      prompt,
      focus,
      situationText,
      canvasType,
      policy,
      intent,
    });
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    const seenBodies = new Set();
    return aiWidgets.map((w) => {
      const hit = byId.get(String(w.id));
      let body = String(hit?.body || '').trim();
      // Prefer CRM-grounded seeds over invented template fallbacks
      if (!body) body = String(groundedFor(w) || '').trim();
      const key = body.replace(/\s+/g, ' ').toLowerCase();
      // Avoid cloning the same dump across panels — leave duplicate empty
      if (key && seenBodies.has(key)) {
        const alt = String(groundedFor(w) || '').trim();
        const altKey = alt.replace(/\s+/g, ' ').toLowerCase();
        body = alt && altKey !== key ? alt : '';
      }
      const finalKey = String(body || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (finalKey) seenBodies.add(finalKey);
      return {
        id: w.id,
        body,
        agentKey: hit?.agentKey,
        grounded: Boolean(hit?.grounded || (body && brief?.situation)),
      };
    }).filter((row) => String(row.body || '').trim());
  } catch (err) {
    console.warn('[canvasHydrate] specialist fill failed:', err?.message || err);
    // CRM seeds only — never invent canned template bullets
    return aiWidgets
      .map((w) => {
        const body = String(groundedFor(w) || '').trim();
        if (!body) return null;
        return {
          id: w.id,
          body,
          grounded: Boolean(brief?.situation),
        };
      })
      .filter(Boolean);
  }
}

/**
 * Prefer CRM-grounded snippets from the situation brief.
 * Never invent “Confirm risks…” style templates — empty is correct.
 */
function fallbackBody(_widget, _prompt, _focus, _situationText = '', _canvasType = '', _opts = {}) {
  return '';
}

/**
 * Bind CRM widgets + fill AI widgets on an existing canvas.
 */
async function hydrateCanvas({
  organizationId,
  userId,
  canvasId,
  prompt = '',
  canvasType = 'meeting_preparation',
  focus: inputFocus = [],
  force = false,
  targetTypes = null,
  targetWidgetIds = null,
  intent: inputIntent = null,
}) {
  if (!organizationId || !canvasId) {
    return { ok: false, error: 'MISSING_CONTEXT' };
  }

  const typeFilter = Array.isArray(targetTypes) && targetTypes.length
    ? new Set(targetTypes.map(String))
    : null;
  const idFilter = Array.isArray(targetWidgetIds) && targetWidgetIds.length
    ? new Set(targetWidgetIds.map(String))
    : null;

  function matchesTarget(w) {
    if (idFilter && !idFilter.has(String(w.id))) return false;
    if (typeFilter && !typeFilter.has(String(w.type || ''))) return false;
    return true;
  }

  const { resolveCanvasIntent } = require('./canvasIntent');
  const { getHydratePolicy } = require('./hydratePolicy');
  const { buildBriefForCanvas, panelMetricsFromOrgBrief } = require('./canvasBriefRegistry');

  const intent = inputIntent && inputIntent.canvasType
    ? inputIntent
    : await resolveCanvasIntent({
      organizationId,
      prompt,
      hintType: canvasType,
      existingType: canvasType,
    });

  let resolvedType = intent.canvasType || canvasType || 'meeting_preparation';
  const policy = getHydratePolicy(resolvedType, intent);

  let focus = await resolveFocusFromPrompt({
    organizationId,
    prompt: intent.entityHint ? `${prompt} ${intent.entityHint}` : prompt,
    existingFocus: inputFocus,
    entityHint: intent.entityHint || '',
    preferredModules: policy.preferredFocusModules,
    skipFocus: policy.scope === 'org' || policy.scope === 'abstract',
  });

  const softInputFocus =
    Array.isArray(inputFocus)
    && inputFocus.length > 0
    && !hasPartyFocus(inputFocus);
  // Soft focus (tasks/events) → party focus: rewrite panels that were filled against the wrong entity.
  const forceRefresh = Boolean(force || (softInputFocus && hasPartyFocus(focus)));

  const brief = await buildBriefForCanvas({
    organizationId,
    focus,
    prompt,
    canvasType: resolvedType,
    intent,
    policy,
  });
  if (brief.focus?.length) {
    focus = brief.focus;
  }
  let situationText = brief.llmText || '';
  if (intent.goals?.length) {
    situationText = `${situationText}\n\nINTENT GOALS: ${intent.goals.join(', ')}`.slice(0, 5000);
  }

  const metaPatch = {
    ...(focus.length ? { focus } : {}),
    ...(resolvedType ? { canvasType: resolvedType } : {}),
  };
  if (Object.keys(metaPatch).length) {
    await canvasService.updateCanvasMeta({
      organizationId,
      canvasId,
      userId,
      patch: metaPatch,
    });
  }

  const canvas = await canvasService.getCanvas({
    organizationId,
    canvasId,
    userId,
  });
  if (canvas?.error) return { ok: false, error: canvas.error };

  let doc = docFromState(canvas.canvas?.yjsState);
  let widgets = listWidgets(doc);

  // Empty board (e.g. mis-inferred blank type): seed template from prompt/title, then fill.
  if (!widgets.length) {
    const { buildTemplateOps } = require('./templates');
    const hint = String(prompt || canvas.canvas?.title || '').trim();
    let type = String(resolvedType || canvas.canvas?.canvasType || '').trim() || 'blank';
    if (type === 'blank' && hint) {
      type = intent.canvasType || 'meeting_preparation';
      if (type === 'blank') type = 'meeting_preparation';
    }
    if (type && type !== 'blank') {
      resolvedType = type;
      const built = buildTemplateOps(type, {
        title: hint || canvas.canvas?.title,
        focus,
      });
      if (built.ops?.length) {
        await canvasService.applyOps({
          organizationId,
          canvasId,
          ops: built.ops,
          actorUserId: userId,
          reason: 'ai',
        });
        await canvasService.updateCanvasMeta({
          organizationId,
          canvasId,
          userId,
          patch: { canvasType: type, ...(built.titleHint ? { title: built.titleHint } : {}) },
        });
        const refreshed = await canvasService.getCanvas({
          organizationId,
          canvasId,
          userId,
        });
        doc = docFromState(refreshed.canvas?.yjsState);
        widgets = listWidgets(doc);
      }
    }
  }

  const ops = [];

  for (const w of widgets) {
    if (!matchesTarget(w)) continue;
    if (!String(w.type || '').startsWith('crm.')) continue;
    const bindings = bindingForWidgetType(w.type, focus);
    if (!bindings) continue;
    const same =
      w.bindings?.recordId
      && String(w.bindings.recordId) === bindings.recordId
      && normalizeModule(w.bindings?.moduleKey) === normalizeModule(bindings.moduleKey);
    if (same) continue;
    ops.push({ op: 'updateWidget', widgetId: w.id, bindings });
  }

  const aiWidgets = widgets
    .filter((w) => matchesTarget(w))
    .filter((w) => NARRATIVE_TYPES.has(String(w.type || '')))
    .filter((w) => {
      if (forceRefresh) return true;
      const body = w.config?.body || w.config?.summary || w.ai?.text;
      return !body;
    })
    .slice(0, 10);

  // Web competitor research only when policy allows
  const needsCompetitorWeb = policy.allowWebCompetitors
    && aiWidgets.some((w) => panelKind(w) === 'competitors');
  if (needsCompetitorWeb) {
    try {
      const { researchCompetitorsForCanvas } = require('./competitorWebResearch');
      const web = await researchCompetitorsForCanvas({
        organizationId,
        focus,
        prompt,
        situation: brief.situation,
      });
      if (web?.body) {
        brief.competitorWebBullets = web.body;
        // Enrich specialist prompt context with public findings
        if (situationText) {
          situationText = `${situationText}\n\nWEB COMPETITOR RESEARCH:\n${web.body}`.slice(0, 5000);
        } else {
          situationText = `WEB COMPETITOR RESEARCH:\n${web.body}`.slice(0, 5000);
        }
      }
    } catch (err) {
      console.warn('[canvasHydrate] competitor web research failed:', err?.message || err);
    }
  }

  const bodies = await generateAiBodies({
    organizationId,
    userId,
    canvasId,
    prompt,
    focus,
    aiWidgets,
    situationText,
    canvasType: resolvedType,
    brief,
    policy,
    intent,
  });

  for (const row of bodies) {
    if (!String(row.body || '').trim()) continue;
    ops.push({
      op: 'updateWidget',
      widgetId: row.id,
      config: { body: row.body },
      ai: {
        text: row.body,
        confidence: row.grounded ? 0.85 : 0.65,
        hydratedAt: new Date().toISOString(),
        specialist: row.agentKey || undefined,
      },
    });
  }

  // Seed analytics KPI / chart strips when policy allows
  if (policy.seedAnalytics) {
  for (const w of widgets) {
    if (!matchesTarget(w)) continue;
    if (String(w.type || '') !== 'analytics.kpi' && !String(w.type || '').includes('analytics.')) continue;
    const metrics = w.config?.metrics;
    const hasReal = Array.isArray(metrics) && metrics.some((m) => {
      if (!m || m.value == null) return false;
      const v = String(m.value).trim();
      return v && v !== '—' && !/^check$/i.test(v) && !/^confirm$/i.test(v);
    });
    if (hasReal && !forceRefresh) continue;

    let nextMetrics = [];
    if (brief.orgScoped) {
      nextMetrics = panelMetricsFromOrgBrief(
        brief,
        w.config?.title || '',
        w.type || '',
      );
    } else {
      nextMetrics = require('./canvasSituationBrief').kpiMetricsFromSituation(
        brief.situation,
        focus,
        w.config?.title || w.type || '',
      );
    }
    if (!nextMetrics.length) {
      // Clear invented metrics on force refresh
      if (forceRefresh && hasReal) {
        ops.push({
          op: 'updateWidget',
          widgetId: w.id,
          config: { metrics: [] },
        });
      }
      continue;
    }
    ops.push({
      op: 'updateWidget',
      widgetId: w.id,
      config: { metrics: nextMetrics },
    });
  }
  }

  const checklistWidgets = widgets.filter((w) => {
    if (!matchesTarget(w)) return false;
    if (String(w.type || '') !== 'content.checklist') return false;
    if (!policy.seedTasks && !forceRefresh) {
      // Still allow suggestion checklists via specialist when fillWithoutParty
      // Open-tasks CRM seed only when seedTasks
    }
    const items = w.config?.items;
    const hasItems = Array.isArray(items) && items.length > 0;
    return !hasItems || forceRefresh;
  });

  if (checklistWidgets.length) {
    const crmTasks = policy.seedTasks && Array.isArray(brief.openTasks) ? brief.openTasks : [];
    const isOpenTasksPanel = (w) => {
      const title = String(w.config?.title || '');
      return /open\s+tasks?/i.test(title);
    };

    const suggestionPanels = checklistWidgets.filter((w) => !isOpenTasksPanel(w));
    let byId = new Map();
    if (suggestionPanels.length) {
      const checklistBodies = await fillWidgetsWithSpecialists(suggestionPanels.slice(0, 3), {
        organizationId,
        userId,
        canvasId,
        prompt,
        focus,
        situationText,
        canvasType: resolvedType,
        policy,
        intent,
      });
      byId = new Map(checklistBodies.map((r) => [String(r.id), r]));
    }

    for (const w of checklistWidgets) {
      let items = [];
      if (isOpenTasksPanel(w)) {
        // Platform tasks only — never invent checklist rows
        items = crmTasks.map((t) => ({
          id: String(t.id),
          label: t.label,
          done: Boolean(t.done),
        }));
      } else {
        const hit = byId.get(String(w.id));
        items = hit?.body ? bodyToChecklistItems(hit.body) : [];
      }
      if (!items.length) continue;
      ops.push({
        op: 'updateWidget',
        widgetId: w.id,
        config: { items },
        ai: isOpenTasksPanel(w)
          ? {
              text: items.map((i) => `• ${i.label}`).join('\n'),
              confidence: 0.9,
              hydratedAt: new Date().toISOString(),
              specialist: 'crm-tasks',
            }
          : undefined,
      });
    }
  }

  for (const w of widgets) {
    if (!matchesTarget(w)) continue;
    const items = w.config?.items;
    const hasItems = Array.isArray(items) && items.length > 0;
    if (policy.seedTimeline && String(w.type || '') === 'viz.timeline' && (!hasItems || forceRefresh)) {
      const timelineItems = brief.timelineItems?.length ? brief.timelineItems : [];
      if (!timelineItems.length) {
        if (forceRefresh && hasItems) {
          ops.push({
            op: 'updateWidget',
            widgetId: w.id,
            config: { items: [] },
          });
        }
        continue;
      }
      ops.push({
        op: 'updateWidget',
        widgetId: w.id,
        config: { items: timelineItems },
      });
    }
    const needsComms =
      forceRefresh
      || !(Array.isArray(w.config?.items) && w.config.items.length)
      || !(Array.isArray(w.config?.messages) && w.config.messages.length);
    if (
      policy.seedComms
      && String(w.type || '').startsWith('comms.')
      && brief.commsItems?.length
      && needsComms
    ) {
      ops.push({
        op: 'updateWidget',
        widgetId: w.id,
        config: {
          items: brief.commsItems,
          messages: brief.commsItems,
          body: brief.commsItems.map((m) => `• ${m.label}`).join('\n'),
        },
      });
    }
  }

  if (!ops.length) {
    return { ok: true, focus, updated: 0 };
  }

  const result = await canvasService.applyOps({
    organizationId,
    canvasId,
    ops,
    actorUserId: userId,
    reason: 'ai',
  });

  return {
    ok: !result?.error,
    focus,
    updated: ops.length,
    error: result?.error,
    summary: result?.summary,
  };
}

module.exports = {
  extractEntityHint,
  resolveFocusFromPrompt,
  hydrateCanvas,
  bestSearchHit,
  focusMatchesHint,
  looksLikePersonNameHint,
  looksLikeCompanyHint,
  wantsDealFocus,
};
