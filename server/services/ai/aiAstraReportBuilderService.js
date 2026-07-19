'use strict';

/**
 * Astra → Analytics Report Builder bridge.
 * Creates real AnalyticsReport drafts (same model/API as Reports module),
 * applies NL filters / joins / formulas / share / schedule, previews via the
 * analytics engine, and returns actions to open/edit/publish.
 */

const AnalyticsReport = require('../../models/AnalyticsReport');
const User = require('../../models/User');
const Role = require('../../models/Role');
const Group = require('../../models/Group');
const { getAnalyticsModuleConfig } = require('../analytics/analyticsModuleRegistry');
const { getCrossModuleJoin, listJoinsForSource } = require('../analytics/analyticsRelationshipRegistry');
const { runAnalyticsReportWithLogging } = require('../analytics/analyticsExecutionService');
const { createSchedule } = require('../analyticsScheduleService');
const { pinExistingReportToDashboard } = require('../analytics/pinAstraVisualToDashboard');
const { ANALYTICS_WIDGET_TEMPLATES } = require('../../constants/analyticsWidgetTemplates');

const DEFAULT_GROUP = Object.freeze({
  deals: 'stage',
  tasks: 'status',
  cases: 'status',
  events: 'eventType',
  quotes: 'status',
  people: 'status',
  organizations: 'industry',
  items: 'item_type',
});

function slugify(name, fallback = 'astra_report') {
  return String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 72) || fallback;
}

async function ensureUniqueApiName(organizationId, base) {
  let apiName = base;
  let suffix = 1;
  while (suffix < 40) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await AnalyticsReport.findOne({
      organizationId,
      apiName,
      status: { $ne: 'archived' },
    }).select('_id').lean();
    if (!exists) return apiName;
    apiName = `${base}_${suffix}`;
    suffix += 1;
  }
  return `${base}_${Date.now().toString(36)}`;
}

/** Explicit "build / create / save a report" — not a one-off chart glance. */
function isReportBuilderQuestion(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  // Widget follow-ups must not create another report draft
  if (isCreateWidgetQuestion(q)) return false;
  if (/\b(create|build|make|generate|design|save|draft)\b.+\b(report|reports)\b/.test(q)) return true;
  if (/\b(report builder|new report|custom report|saved report)\b/.test(q)) return true;
  if (/\b(save|pin|turn)\b.+\b(as|into)\b.+\breport\b/.test(q)) return true;
  if (/\breport\b.+\b(i can|that i can|so i can)\b.+\b(edit|reuse|save|open)\b/.test(q)) return true;
  if (/\b(build|create|make)\b.+\breport\b/.test(q)) return true;
  // "task matrix report" / "tasks metrix report" / "deals by stage report"
  if (/\b(matrix|metrix|pivot|cross[- ]?tab)\b.+\breport\b/.test(q) || /\breport\b.+\b(matrix|metrix|pivot)\b/.test(q)) {
    return true;
  }
  if (
    /\breport\b/.test(q)
    && /\b(task|tasks|deal|deals|pipeline|case|cases|quote|quotes|event|events|people|contacts?)\b/.test(q)
  ) {
    return true;
  }
  // Share / schedule a report (still creates a real Analytics report)
  if (/\b(schedule|email)\b.+\breport\b/.test(q) || /\breport\b.+\b(daily|weekly|monthly)\b/.test(q)) {
    return true;
  }
  if (/\bshare\b.+\breport\b/.test(q) || /\breport\b.+\b(org(?:anization)?|team|everyone)\b/.test(q)) {
    return true;
  }
  return false;
}

/** "Create a widget for the above report" / "make a pie widget from that report" */
function isCreateWidgetQuestion(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (/\b(create|build|make|add|generate)\b.+\bwidgets?\b/.test(q)) return true;
  if (/\bwidgets?\b.+\b(for|from|using|of)\b.+\breport\b/.test(q)) return true;
  if (/\b(turn|convert|make)\b.+\breport\b.+\b(into|as)\b.+\bwidget\b/.test(q)) return true;
  if (/\bpin\b.+\breport\b.+\b(as\s+)?(a\s+)?widget\b/.test(q)) return true;
  return false;
}

function detectWidgetChartType(question = '') {
  const q = String(question || '').toLowerCase();
  if (/\b(pie|donut)\b/.test(q)) return 'pie';
  if (/\bline\b/.test(q)) return 'line';
  if (/\bkpi|metric card\b/.test(q)) return 'kpi';
  if (/\btable\b/.test(q)) return 'table';
  return 'bar';
}

/** Chart hint for report draft / pin — donut maps to pie (UI already renders pie as donut). */
function detectReportChartHint(question = '', templateChartType = '') {
  const q = String(question || '');
  if (/\b(pie|donut)\b/i.test(q)) return 'pie';
  if (/\bline\b/i.test(q)) return 'line';
  if (/\b(bar|column|histogram)\b/i.test(q)) return 'bar';
  const t = String(templateChartType || '').toLowerCase();
  if (t === 'donut' || t === 'pie') return 'pie';
  if (t === 'line' || t === 'bar') return t;
  return 'bar';
}

/** Staff asked for a chart/table glance — keep the reply visual-first. */
function wantsLeanVisualReply(question = '') {
  const q = String(question || '').toLowerCase();
  return /\b(chart|graph|pie|donut|bar|line|table|visuali[sz]e|plot)\b/.test(q);
}

/**
 * Pure chart/table ask (not create/save report) — do not open Report Builder draft path.
 * "pie of tasks", "table of deals by stage", "show me a bar chart".
 */
function isVisualGlanceQuestion(question = '') {
  if (!wantsLeanVisualReply(question)) return false;
  if (isReportBuilderQuestion(question)) return false;
  if (isCreateWidgetQuestion(question)) return false;
  return true;
}

/**
 * Turn analytics preview rows into an Astra chart or table visual.
 * @returns {object[]}
 */
function buildVisualsFromReportPreview(preview, spec = {}, question = '') {
  if (preview?.error) return [];
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];

  const groupField = String(spec.groupField || '').trim();
  const metricLabel = spec.metric === 'amount' ? 'amount' : 'count';
  const aggKeys = Array.isArray(spec.aggregations)
    ? spec.aggregations.map((a) => a.label || a.field).filter(Boolean)
    : [];
  const q = String(question || '').toLowerCase();
  const wantsTable = /\btable\b/.test(q) && !/\b(chart|pie|donut|bar|graph|plot)\b/.test(q);

  const points = [];
  for (const row of rows.slice(0, wantsTable ? 40 : 24)) {
    if (!row || typeof row !== 'object') continue;
    let label = '';
    if (groupField && row[groupField] != null && row[groupField] !== '') {
      label = String(row[groupField]);
    } else {
      const skip = new Set(['_id', 'count', 'amount', ...aggKeys]);
      for (const [k, v] of Object.entries(row)) {
        if (skip.has(k) || typeof v === 'number') continue;
        if (v != null && v !== '') {
          label = String(v);
          break;
        }
      }
    }
    if (!label) label = '(empty)';

    let value;
    if (row[metricLabel] != null) value = row[metricLabel];
    else if (row.count != null) value = row.count;
    else if (row.amount != null) value = row.amount;
    else {
      for (const key of aggKeys) {
        if (typeof row[key] === 'number') {
          value = row[key];
          break;
        }
      }
    }
    if (value == null) {
      for (const [k, v] of Object.entries(row)) {
        if (k === groupField || k === '_id') continue;
        if (typeof v === 'number') {
          value = v;
          break;
        }
      }
    }
    points.push({ label, value: Number(value) || 0, row });
  }

  if (!points.length) return [];

  const mod = spec.primaryModule || 'records';
  const dim = groupField || 'category';
  const title = spec.name || `${mod} by ${dim}`;

  if (wantsTable) {
    const columns = groupField
      ? [groupField, metricLabel]
      : Object.keys(points[0].row || {}).filter((k) => k !== '_id').slice(0, 6);
    return [{
      id: `astra_report_table_${mod}_${dim}`,
      component: 'data_table',
      title,
      columns: columns.length ? columns : ['label', 'value'],
      rows: points.map((p) => {
        if (groupField) return [p.label, String(p.value)];
        return columns.map((c) => String(p.row?.[c] ?? ''));
      }),
    }];
  }

  const rawHint = String(spec.chartHint || 'bar').toLowerCase();
  const chartType = rawHint === 'donut' || rawHint === 'pie'
    ? 'pie'
    : (rawHint === 'line' ? 'line' : 'bar');
  return [{
    id: `astra_report_${mod}_${dim}`,
    component: 'chart',
    chartType,
    title,
    metricLabel,
    points: points.map(({ label, value }) => ({ label, value })),
  }];
}

/** Compact reply when staff asked for a chart/table — visual first, minimal copy. */
function leanVisualStructured({ headline = '', visuals = [], actions = [] } = {}) {
  const viz = Array.isArray(visuals) ? visuals.filter(Boolean) : [];
  const first = viz[0];
  const list = Array.isArray(actions) ? actions.filter(Boolean) : [];
  const pin = list.find((a) => a.kind === 'pin_report_to_dashboard');
  const open = list.find((a) => a.kind === 'open_report_builder');
  return {
    headline: String(headline || first?.title || 'Preview').slice(0, 120),
    bullets: [],
    detail: '',
    clarifyingQuestions: [],
    actions: pin ? [pin] : (open ? [open] : []),
    visuals: viz,
    talkToAgent: false,
  };
}

/** Module named in the ask itself (never from page/workspace hint). */
function questionNamesReportModule(question = '') {
  return Boolean(detectModuleKey(question, ''));
}

/**
 * Page/list module may be used only when the user points at current context
 * (“this list”, “current module”, “from this page”).
 */
function mayUsePageModuleHint(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  return (
    /\b(this|current|here)\b.+\b(list|page|module|view|screen|pipeline|board)\b/.test(q)
    || /\b(for|from|on)\b.+\b(this|the current)\b/.test(q)
    || /\b(this|current)\b.+\b(deals?|tasks?|cases?|quotes?|events?)\b/.test(q)
    || /\breport\b.+\b(for|from)\b.+\b(this|here|current)\b/.test(q)
  );
}

/** “Create report” with no module (and no page-pointer) — must clarify first. */
function isUnderspecifiedReportQuestion(question = '') {
  if (!isReportBuilderQuestion(question)) return false;
  if (questionNamesReportModule(question)) return false;
  if (mayUsePageModuleHint(question)) return false;
  return true;
}

function buildReportRequirementsStructured() {
  return {
    headline: 'What should this report cover?',
    bullets: [
      'Tell me the CRM module — tasks, deals, cases, quotes, events, people, or organizations.',
      'Optional: grouping (by status / stage), filters, chart type, or matrix layout.',
      'Example: “Create a tasks by status matrix report” or “Deals by stage with amount”.',
    ],
    clarifyingQuestions: [
      'Which module should the report use (tasks, deals, cases, …)?',
      'How should it group — by status, stage, priority, assignee?',
      'Any filters (open only, overdue, date range) or chart type?',
    ],
    detail: 'I need a bit more detail before creating a real Analytics report draft — I will not guess a module.',
    actions: [],
    visuals: [],
    talkToAgent: false,
  };
}

/** After Astra asked for report requirements, accept “tasks” / “deals by stage”. */
function isReportModuleFollowUp(question = '', history = []) {
  const q = String(question || '').trim();
  if (!q || !detectModuleKey(q, '')) return false;
  // Real write intents that mention a module but are not report answers
  if (
    /\b(create|add|schedule|assign|complete|update|book)\b.+\b(task|deal|case|event|meeting|quote)\b/i.test(q)
    && !/\breport\b/i.test(q)
  ) {
    return false;
  }
  const msgs = Array.isArray(history) ? history : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i];
    if (!m || m.role === 'user') continue;
    if (m.role !== 'assistant') continue;
    const blob = [
      m.content,
      m.structured?.headline,
      ...(Array.isArray(m.structured?.clarifyingQuestions) ? m.structured.clarifyingQuestions : []),
      ...(Array.isArray(m.structured?.bullets) ? m.structured.bullets : []),
    ].filter(Boolean).join(' ').toLowerCase();
    if (
      /which module|what should this report|report cover|name a (crm )?module|tasks, deals, cases|i need a bit more detail before creating a real analytics report/i
        .test(blob)
    ) {
      return true;
    }
    break;
  }
  return false;
}

/** Resolve module for draft: question first; page hint only when user points at current context. */
function resolveReportModuleKey(question = '', hintModule = '', pinSource = null) {
  const fromQuestion = detectModuleKey(question, '');
  if (fromQuestion) return fromQuestion;
  if (mayUsePageModuleHint(question) && hintModule && getAnalyticsModuleConfig(hintModule)) {
    return String(hintModule).toLowerCase();
  }
  if (pinSource?.moduleKey && getAnalyticsModuleConfig(pinSource.moduleKey)) {
    return String(pinSource.moduleKey).toLowerCase();
  }
  return '';
}

/** Pull latest analytics report id from chat history / citations / actions. */
function extractReportIdFromHistory(history = []) {
  if (!Array.isArray(history)) return '';
  // Prefer most recent assistant/user turn that mentions a report id
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];
    const text = String(row?.content || row?.body || '').trim();
    const fromMarker = text.match(/\breportId[=:]\s*([a-f0-9]{24})\b/i)
      || text.match(/\breport[_ ]?id[=:]\s*([a-f0-9]{24})\b/i)
      || text.match(/\[report:([a-f0-9]{24})\]/i);
    if (fromMarker) return fromMarker[1];
    const actions = Array.isArray(row?.actions) ? row.actions : [];
    for (const a of actions) {
      const kind = String(a?.kind || '');
      if (!/report|pin_report/i.test(kind) && kind !== 'open_report_builder' && kind !== 'open_report' && kind !== 'publish_report' && kind !== 'pin_report_to_dashboard' && kind !== 'export_report') {
        continue;
      }
      const rid = String(a?.recordId || a?.fields?.reportId || '').trim();
      if (/^[a-f0-9]{24}$/i.test(rid)) return rid;
    }
    const citations = Array.isArray(row?.citations) ? row.citations : [];
    for (const c of citations) {
      if (String(c?.sourceType || '').includes('analytics_report') || String(c?.sourceType || '') === 'analytics_reports') {
        const sid = String(c?.sourceId || '').trim();
        if (/^[a-f0-9]{24}$/i.test(sid)) return sid;
      }
    }
  }
  return '';
}

async function resolveReportForWidget({
  organizationId,
  userId,
  reportId = '',
  history = [],
} = {}) {
  let id = String(reportId || '').trim() || extractReportIdFromHistory(history);
  if (id) {
    const report = await AnalyticsReport.findOne({
      _id: id,
      organizationId,
      status: { $ne: 'archived' },
    });
    if (report) return report;
  }
  // Fallback: latest Astra report owned by this user
  return AnalyticsReport.findOne({
    organizationId,
    ownerId: userId,
    status: { $ne: 'archived' },
    tags: 'astra',
  }).sort({ updatedAt: -1, createdAt: -1 });
}

/**
 * Create an AnalyticsWidget from a prior report (chat follow-up) and pin to dashboard.
 */
async function createAstraWidgetFromReport({
  organizationId,
  userId,
  question = '',
  history = [],
  reportId = '',
  appKey = 'SALES',
} = {}) {
  const report = await resolveReportForWidget({
    organizationId,
    userId,
    reportId,
    history,
  });
  if (!report) {
    const err = new Error('No report found in this chat. Create a report first, then ask for a widget.');
    err.statusCode = 400;
    err.code = 'ASTRA_WIDGET_NO_REPORT';
    throw err;
  }

  const chartType = detectWidgetChartType(question);
  const pin = await pinExistingReportToDashboard({
    organizationId,
    userId,
    report,
    chartType,
    appKey,
    titleOverride: String(report.name || '').trim(),
  });

  const widgetId = String(pin.widget?._id || '');
  const dashId = String(pin.dashboard?._id || '');
  const reportIdOut = String(report._id);

  const actions = [
    {
      label: 'Open widget',
      kind: 'open_widget',
      recordId: widgetId,
      moduleKey: 'analytics_widgets',
      priority: 'high',
      rationale: 'Edit chart type, mapping, and style in Widget Builder',
      fields: { widgetId, autoOpen: true },
      executeNow: false,
    },
    {
      label: 'Open dashboard',
      kind: 'open_dashboard',
      recordId: dashId,
      moduleKey: 'analytics_dashboards',
      priority: 'high',
      rationale: 'See the widget on your dashboard',
      fields: { dashboardId: dashId },
      executeNow: false,
    },
    {
      label: 'Open report',
      kind: 'open_report',
      recordId: reportIdOut,
      moduleKey: 'analytics_reports',
      priority: 'medium',
      rationale: 'View the source report',
      fields: { reportId: reportIdOut },
      executeNow: false,
    },
  ].filter((a) => a.recordId);

  return {
    report: {
      _id: reportIdOut,
      name: report.name,
      status: report.status,
      primaryModule: report.primaryModule,
    },
    widget: pin.widget,
    dashboard: pin.dashboard,
    structured: {
      headline: `Widget ready · ${pin.widget?.name || report.name}`,
      bullets: [
        `Created widget “${pin.widget?.name || report.name}” (${chartType}) from report “${report.name}”.`,
        pin.dashboard?.name
          ? `Pinned to dashboard “${pin.dashboard.name}”.`
          : 'Widget created.',
        `reportId=${reportIdOut}`,
      ],
      detail: [
        'This is a real Analytics widget bound to your report — same as Widgets in Reports.',
        'Open the widget to change chart type, or open the dashboard to see it live.',
      ].join('\n'),
      actions,
      visuals: [],
      clarifyingQuestions: [],
      talkToAgent: false,
    },
  };
}

function detectModuleKey(question = '', hintModule = '') {
  if (hintModule && getAnalyticsModuleConfig(hintModule)) {
    return String(hintModule).toLowerCase();
  }
  const q = String(question || '').toLowerCase();
  if (/\btasks?\b/.test(q)) return 'tasks';
  if (/\bdeals?\b|\bpipeline\b|\bopportunit/.test(q)) return 'deals';
  if (/\bcases?\b|\btickets?\b/.test(q)) return 'cases';
  if (/\bevents?\b|\bmeetings?\b/.test(q)) return 'events';
  if (/\bquotes?\b/.test(q)) return 'quotes';
  if (/\b(people|contacts?|leads?)\b/.test(q)) return 'people';
  if (/\b(organizations?|accounts?|companies)\b/.test(q)) return 'organizations';
  if (/\b(items?|products?|sku)\b/.test(q)) return 'items';
  return '';
}

function normalizeFieldToken(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Common staff phrasing → tokens that should match real field keys/labels. */
function expandGroupSynonyms(phrase = '') {
  const p = normalizeFieldToken(phrase);
  if (!p) return [];
  const map = {
    owner: ['assignedto', 'assignee'],
    assignee: ['assignedto', 'owner'],
    assigned: ['assignedto'],
    assignedto: ['assignedto', 'owner', 'assignee'],
    type: ['type', 'tasktype', 'casetype', 'eventtype', 'itemtype', 'item_type', 'partnertype'],
    kind: ['type', 'tasktype', 'casetype', 'eventtype', 'itemtype'],
    category: ['category', 'itemtype', 'tasktype', 'casetype'],
    stage: ['stage', 'pipeline'],
    pipeline: ['stage'],
    status: ['status', 'leadstatus', 'contactstatus', 'customerstatus'],
    priority: ['priority'],
    channel: ['channel'],
    industry: ['industry'],
    source: ['source', 'leadsource'],
    leadsource: ['leadsource', 'source'],
  };
  const out = new Set([p, ...(map[p] || [])]);
  return [...out];
}

/**
 * Extract the group-by phrase from natural language.
 * "Tasks group by type" → "type"; "breakdown by assigned to" → "assigned to"
 */
function extractGroupByPhrase(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return '';

  const groupBy = q.match(
    /\b(?:group(?:ed)?\s+by|break(?:\s*down)?\s+by|pivot\s+by|categorize\s+by|split\s+by)\s+([a-z][a-z0-9]*(?:\s+[a-z0-9]+){0,4})/
  );
  if (groupBy?.[1]) {
    return groupBy[1]
      .replace(/\s+(?:chart|table|report|pie|bar|donut|matrix|please|now)$/i, '')
      .trim();
  }

  // "by type" / "by assigned to" — ignore "created by" / "updated by"
  const by = q.match(
    /(?<!\b(?:created|updated|modified|submitted|written|owned)\s)\bby\s+([a-z][a-z0-9]*(?:\s+[a-z0-9]+){0,3})\b/
  );
  if (by?.[1]) {
    const phrase = by[1]
      .replace(/\s+(?:chart|table|report|pie|bar|donut|matrix|please)$/i, '')
      .trim();
    // Avoid matching "by Stage" inside unrelated long sentences without intent words
    if (phrase && !/^(the|a|an|my|our|this|that|these|those)$/.test(phrase)) {
      return phrase;
    }
  }
  return '';
}

function listModuleGroupFields(moduleKey = '') {
  const key = String(moduleKey || '').toLowerCase();
  if (!key) return [];
  let fields = [];
  try {
    // Lazy require — avoid circular load cost at module init
    // eslint-disable-next-line global-require
    const { getBaseFieldsForKey } = require('../../controllers/moduleController');
    const loaded = getBaseFieldsForKey(key);
    fields = Array.isArray(loaded) ? loaded : [];
  } catch {
    fields = [];
  }

  const cfg = getAnalyticsModuleConfig(key);
  const defaults = Array.isArray(cfg?.defaultFields) ? cfg.defaultFields : [];
  const seen = new Set(fields.map((f) => String(f?.key || '').toLowerCase()).filter(Boolean));
  for (const fieldKey of defaults) {
    const k = String(fieldKey || '').trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    fields.push({ key: k, label: k, type: 'string' });
    seen.add(k.toLowerCase());
  }

  return fields
    .filter((f) => f && f.key && !String(f.key).startsWith('_'))
    .filter((f) => {
      const t = String(f.type || f.dataType || '');
      if (/date|currency|decimal|integer|number|auto-number|image|file|text-area|rich.?text/i.test(t)) {
        // Still allow if key is a known categorical suffix
        if (!/(status|stage|type|priority|channel|industry|source|assigned)/i.test(f.key)) {
          return false;
        }
      }
      return true;
    });
}

function scoreFieldMatch(phrase = '', field = {}, moduleKey = '') {
  const rawPhrase = String(phrase || '').trim().toLowerCase();
  const p = normalizeFieldToken(rawPhrase);
  if (!p || !field?.key) return 0;

  const keyRaw = String(field.key);
  const key = normalizeFieldToken(keyRaw);
  const label = normalizeFieldToken(field.label || '');
  const topLevel = !keyRaw.includes('.');
  const type = String(field.type || field.dataType || '');
  let score = 0;

  if (p === key) score = 100;
  else if (p === label) score = 98;
  else if (label.endsWith(p) && p.length >= 3) score = 90;
  else if (key.endsWith(p) && p.length >= 3) {
    // taskType / caseType / item_type ← "type"
    score = 86 - Math.min(Math.max(key.length - p.length, 0), 12);
  } else if (label.includes(p) && p.length >= 3) score = 72;
  else if (key.includes(p) && p.length >= 3) score = 68;

  const labelWords = String(field.label || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (labelWords.includes(rawPhrase) || labelWords[labelWords.length - 1] === rawPhrase) {
    score = Math.max(score, 88);
  }

  for (const syn of expandGroupSynonyms(rawPhrase)) {
    if (syn === key) score = Math.max(score, 94);
    else if (key.endsWith(syn) && syn.length >= 3) score = Math.max(score, 84);
    else if (label.includes(syn) && syn.length >= 3) score = Math.max(score, 75);
  }

  // Prefer module-prefixed type fields (taskType on tasks)
  const singular = String(moduleKey || '').toLowerCase().replace(/s$/, '');
  if (p === 'type' && key === `${normalizeFieldToken(singular)}type`) {
    score = Math.max(score, 96);
  }
  if (p === 'type' && (key === 'itemtype' || key === 'item_type')) {
    score = Math.max(score, 94);
  }

  if (!topLevel) score -= 18;
  if (/picklist/i.test(type)) score += 6;
  if (/lookup/i.test(type)) score += 3;
  if (/multi-picklist/i.test(type)) score += 2;
  if (/text-area|date|currency|decimal|integer|auto-number|image/i.test(type)) score -= 25;

  return score;
}

/**
 * Resolve a staff phrase to a real module field key using catalog labels + keys.
 * "type" on tasks → taskType; "owner" → assignedTo; "channel" on cases → channel.
 */
function resolveGroupFieldAgainstModule(phrase = '', moduleKey = '') {
  const raw = String(phrase || '').trim();
  if (!raw) return '';
  const fields = listModuleGroupFields(moduleKey);
  if (!fields.length) {
    return mapGroupTokenLegacy(raw, moduleKey);
  }

  let best = null;
  let bestScore = 0;
  for (const field of fields) {
    const score = scoreFieldMatch(raw, field, moduleKey);
    if (score > bestScore) {
      bestScore = score;
      best = field;
    }
  }
  if (best && bestScore >= 60) return best.key;

  const legacy = mapGroupTokenLegacy(raw, moduleKey);
  if (legacy) {
    const hit = fields.find(
      (f) => normalizeFieldToken(f.key) === normalizeFieldToken(legacy)
    );
    if (hit) return hit.key;
  }
  return '';
}

/** Legacy token map — only used as fallback after catalog fuzzy match. */
function mapGroupTokenLegacy(token = '', moduleKey = '') {
  const t = String(token || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const compact = t.replace(/[\s_]+/g, '');
  if (t === 'stage' || t === 'stages' || compact === 'stage') return 'stage';
  if (t === 'status' || t === 'statuses' || compact === 'status') return 'status';
  if (t === 'priority' || t === 'priorities' || compact === 'priority') return 'priority';
  if (
    compact === 'assignedto'
    || compact === 'assignee'
    || compact === 'owner'
    || t === 'assigned to'
    || t === 'assigned'
  ) {
    return 'assignedTo';
  }
  if (compact === 'createdby' || t === 'created by') return 'createdBy';
  if (compact === 'updatedby' || t === 'updated by') return 'updatedBy';
  if (compact === 'industry') return 'industry';
  if (compact === 'source' || compact === 'leadsource' || t === 'lead source') {
    return compact === 'leadsource' || t === 'lead source' ? 'leadSource' : 'source';
  }
  if (t === 'amount' || t === 'value') return 'amount';
  if (/^[a-z][a-z0-9]*$/i.test(t.replace(/\s+/g, ''))) {
    const parts = t.split(/[\s_]+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    return parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  }
  return t.replace(/\s+/g, '_');
}

function mapGroupToken(token = '', moduleKey = '') {
  const resolved = resolveGroupFieldAgainstModule(token, moduleKey);
  if (resolved) return resolved;
  return mapGroupTokenLegacy(token, moduleKey);
}

/**
 * Group dimension named in the ask ("group by assigned to", "by priority").
 * Empty when the user did not name a dimension (caller applies module default).
 */
function detectExplicitGroupField(question = '', moduleKey = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return '';

  const phrase = extractGroupByPhrase(q);
  if (phrase) {
    return resolveGroupFieldAgainstModule(phrase, moduleKey);
  }

  // Bare dimension words when clearly a breakdown / report / snapshot ask
  if (/\b(snapshot|breakdown|report|chart|table|metrics?|overview|analysis|analy[sz]e)\b/.test(q)) {
    for (const candidate of [
      'stage',
      'status',
      'priority',
      'type',
      'channel',
      'industry',
      'assignee',
      'owner',
      'assigned to',
      'source',
    ]) {
      if (candidate === 'stage' && moduleKey && moduleKey !== 'deals') {
        // only auto-pick stage for deals unless phrase is explicit
        if (!/\bstage\b/.test(q)) continue;
      }
      const re = new RegExp(`\\b${candidate.replace(/\s+/g, '\\s+')}\\b`);
      if (re.test(q)) {
        const resolved = resolveGroupFieldAgainstModule(candidate, moduleKey);
        if (resolved) return resolved;
      }
    }
  }
  return '';
}

function detectGroupField(question = '', moduleKey = '') {
  return detectExplicitGroupField(question, moduleKey)
    || DEFAULT_GROUP[moduleKey]
    || 'status';
}

function detectReportType(question = '', groupField = '') {
  const q = String(question || '').toLowerCase();
  if (/\b(matrix|pivot|cross[- ]?tab)\b/.test(q)) return 'matrix';
  if (/\btabular|row.?level|list of|line items?\b/.test(q)) return 'tabular';
  if (/\bkpi|single metric|total count\b/.test(q) && !groupField) return 'summary';
  if (groupField) return 'summary';
  return 'summary';
}

/** Matrix / pivot + sorting + drill / runtime flags. */
function detectLayoutOptions(question = '', moduleKey = '', defaultGroup = '') {
  const q = String(question || '').toLowerCase();
  const notes = [];
  let type = detectReportType(question, defaultGroup);
  let groupField = defaultGroup;
  let columnGroups = [];
  let sorting = null;
  let drillDownEnabled = !/\b(no drill|without drill|disable drill)\b/.test(q);
  let runtimeFilters = /\b(runtime filters?|prompt( for)? filters?|ask( for)? filters?)\b/.test(q);
  let showRecordCount = /\b(record count|show counts?)\b/.test(q) || type !== 'tabular';

  const byAndBy = q.match(/\bby\s+([a-z_]+)\s+and\s+(?:by\s+)?([a-z_]+)\b/);
  const pivotVs = q.match(/\b(?:pivot|matrix|cross[- ]?tab)\b.+\b([a-z_]+)\s+(?:vs|versus|by|against)\s+([a-z_]+)\b/);
  const wantsMatrix = /\b(matrix|pivot|cross[- ]?tab)\b/.test(q) || Boolean(byAndBy) || Boolean(pivotVs);

  if (wantsMatrix) {
    type = 'matrix';
    const a = mapGroupToken(byAndBy?.[1] || pivotVs?.[1] || defaultGroup, moduleKey);
    const b = mapGroupToken(byAndBy?.[2] || pivotVs?.[2] || 'assignedTo', moduleKey);
    groupField = a || defaultGroup;
    if (b && b !== groupField) {
      columnGroups = [{ field: b }];
      notes.push(`matrix: rows=${groupField}, columns=${b}`);
    } else {
      notes.push(`matrix: rows=${groupField}`);
    }
  }

  const sortMatch = q.match(/\bsort(?:ed)?\s+by\s+([a-z_]+)(?:\s+(asc|desc|ascending|descending))?\b/);
  const topBy = q.match(/\btop\s+(?:by\s+)?([a-z_]+)\b/);
  if (sortMatch || topBy) {
    const field = mapGroupToken(sortMatch?.[1] || topBy?.[1] || 'amount', moduleKey);
    let order = 'desc';
    if (sortMatch?.[2]) {
      order = /asc/.test(sortMatch[2]) ? 'asc' : 'desc';
    } else if (topBy) {
      order = 'desc';
    }
    if (field) {
      sorting = [{ field, order }];
      notes.push(`sort ${field} ${order}`);
    }
  }

  if (runtimeFilters) notes.push('runtime filters enabled');
  if (!drillDownEnabled) notes.push('drill-down disabled');

  const wantsPin = /\bpin\b.+\b(dashboard|home)\b/.test(q)
    || /\b(add|pin)\b.+\b(to\s+)?dashboard\b/.test(q)
    || /\bdashboard\b.+\bpin\b/.test(q);
  const wantsExport = /\bexport\b/.test(q);

  return {
    type,
    groupField,
    columnGroups,
    sorting,
    drillDownEnabled,
    runtimeFilters,
    showRecordCount,
    wantsPin,
    wantsExport,
    layoutNotes: notes,
  };
}

function matchWidgetTemplate(moduleKey, groupField) {
  return ANALYTICS_WIDGET_TEMPLATES.find((t) => {
    const preset = t.reportPreset;
    if (!preset) return false;
    if (preset.primaryModule !== moduleKey) return false;
    const g = Array.isArray(preset.rowGroups) && preset.rowGroups[0]
      ? String(preset.rowGroups[0].field || '')
      : '';
    return !groupField || g === groupField;
  }) || null;
}

function rule(fieldKey, operator, value) {
  return { fieldKey, operator, value };
}

/** NL → filterTree children (AND). */
function detectFilters(question = '', moduleKey = '') {
  const q = String(question || '').toLowerCase();
  const children = [];
  const notes = [];

  // Status / stage shortcuts — one rule per fieldKey (Filter Builder UI is flat per field).
  if (/\bopen\b/.test(q) && !/\bopen in\b/.test(q)) {
    if (moduleKey === 'deals') {
      children.push(rule('stage', 'is_not', 'Closed Won'));
      notes.push('open pipeline (exclude Closed Won)');
    } else if (moduleKey === 'tasks' || moduleKey === 'cases' || moduleKey === 'quotes') {
      children.push(rule('status', 'is_not', 'completed'));
      notes.push('exclude completed');
    }
  }
  if (/\b(closed won|won deals?)\b/.test(q) && moduleKey === 'deals') {
    children.push(rule('stage', 'is', 'Closed Won'));
    notes.push('stage = Closed Won');
  }
  if (/\b(closed lost|lost deals?)\b/.test(q) && moduleKey === 'deals') {
    children.push(rule('stage', 'is', 'Closed Lost'));
    notes.push('stage = Closed Lost');
  }
  if (/\bhigh priority\b/.test(q)) {
    children.push(rule('priority', 'is', 'high'));
    notes.push('priority = high');
  }
  if (/\bmedium priority\b/.test(q)) {
    children.push(rule('priority', 'is', 'medium'));
    notes.push('priority = medium');
  }
  if (/\blow priority\b/.test(q)) {
    children.push(rule('priority', 'is', 'low'));
    notes.push('priority = low');
  }

  // Explicit status/stage = value
  const statusEq = q.match(/\bstatus\s*(?:=|is|:)\s*["']?([a-z0-9 _-]+)["']?/i);
  if (statusEq) {
    children.push(rule('status', 'is', statusEq[1].trim()));
    notes.push(`status = ${statusEq[1].trim()}`);
  }
  const stageEq = q.match(/\bstage\s*(?:=|is|:)\s*["']?([a-z0-9 _-]+)["']?/i);
  if (stageEq && moduleKey === 'deals') {
    children.push(rule('stage', 'is', stageEq[1].trim()));
    notes.push(`stage = ${stageEq[1].trim()}`);
  }

  // Amount comparisons (kept as gte/gt/… for engine; UI maps to "is" for display)
  const amountCmp = q.match(/\bamount\s*(>=|<=|>|<|above|over|greater than|below|under|less than)\s*\$?([\d,.]+)/i);
  if (amountCmp && moduleKey === 'deals') {
    const opRaw = amountCmp[1].toLowerCase();
    const n = Number(String(amountCmp[2]).replace(/,/g, ''));
    if (Number.isFinite(n)) {
      let op = 'gt';
      if (opRaw === '>=' || opRaw === 'above' || opRaw === 'over') op = 'gte';
      else if (opRaw === '>' || opRaw === 'greater than') op = 'gt';
      else if (opRaw === '<=' || opRaw === 'below' || opRaw === 'under' || opRaw === 'less than') op = 'lte';
      else if (opRaw === '<') op = 'lt';
      children.push(rule('amount', op, n));
      notes.push(`amount ${op} ${n}`);
    }
  }

  // Date: overdue / due this week / this month — one rule per date field for UI
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (/\boverdue\b/.test(q) && (moduleKey === 'tasks' || moduleKey === 'cases')) {
    children.push(rule('dueDate', 'lt', startOfToday.toISOString()));
    notes.push('overdue (due before today)');
  } else if (/\bdue (this|the) week\b|\bthis week\b/.test(q) && moduleKey === 'tasks') {
    const end = new Date(startOfToday);
    end.setUTCDate(end.getUTCDate() + 7);
    children.push(rule('dueDate', 'lt', end.toISOString()));
    notes.push('due this week');
  }
  if (/\b(this month|current month)\b/.test(q)) {
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const dateField = moduleKey === 'deals' ? 'expectedCloseDate'
      : moduleKey === 'events' ? 'start' : 'dueDate';
    if (moduleKey === 'deals' || moduleKey === 'tasks' || moduleKey === 'events') {
      children.push(rule(dateField, 'lt', monthEnd.toISOString()));
      notes.push(`${dateField} this month`);
    }
  }

  if (!children.length) {
    return { filterTree: null, filterNotes: [] };
  }
  return {
    filterTree: { logic: 'AND', children },
    filterNotes: notes,
  };
}

/** NL → relatedModules (1-hop joins from registry). */
function detectJoins(question = '', moduleKey = '') {
  const q = String(question || '').toLowerCase();
  const available = listJoinsForSource(moduleKey);
  if (!available.length) return { relatedModules: [], joinNotes: [] };

  const wants = [];
  const notes = [];
  const askJoin = /\b(join|joined|with|including|include|and their|plus)\b/.test(q);

  const tryAdd = (target, aliases) => {
    if (!aliases.some((a) => new RegExp(`\\b${a}\\b`).test(q))) return;
    if (!getCrossModuleJoin(moduleKey, target)) return;
    if (!wants.includes(target)) {
      wants.push(target);
      notes.push(`join ${moduleKey} → ${target}`);
    }
  };

  if (askJoin || /\b(contacts?|people|organizations?|accounts?|companies)\b/.test(q)) {
    tryAdd('people', ['people', 'contacts?', 'contact']);
    tryAdd('organizations', ['organizations?', 'accounts?', 'companies', 'company']);
  }

  // "deals with organizations" without explicit join verb
  if (!wants.length) {
    tryAdd('people', ['with (?:their )?contacts?', 'with (?:their )?people']);
    tryAdd('organizations', ['with (?:their )?organizations?', 'with (?:their )?accounts?']);
  }

  return { relatedModules: wants.slice(0, 2), joinNotes: notes };
}

/** NL → calculatedFields (safe arithmetic expressions). */
function detectFormulas(question = '', moduleKey = '', reportType = 'summary') {
  const q = String(question || '').toLowerCase();
  const fields = [];
  const notes = [];

  if (!/\b(formula|calculated|compute|weighted|commission|margin)\b/.test(q)
    && !/\bamount\s*\*\s*/.test(q)
    && !/\b\*\s*probability\b/.test(q)) {
    return { calculatedFields: [], formulaNotes: [] };
  }

  if (moduleKey === 'deals' && (/\bweighted\b/.test(q) || /\bamount\s*\*\s*probability\b/.test(q) || /\bprobability\b/.test(q))) {
    fields.push({
      key: 'weighted_amount',
      label: 'Weighted amount',
      expression: 'amount * probability / 100',
    });
    notes.push('formula: weighted_amount = amount * probability / 100');
  }
  if (moduleKey === 'deals' && /\bcommission\b/.test(q)) {
    const pct = q.match(/commission\s*(?:of\s*)?(\d+)\s*%/);
    const rate = pct ? Number(pct[1]) / 100 : 0.1;
    fields.push({
      key: 'commission',
      label: 'Commission',
      expression: `amount * ${rate}`,
    });
    notes.push(`formula: commission = amount * ${rate}`);
  }
  if (/\bmargin\b/.test(q) && moduleKey === 'deals') {
    fields.push({
      key: 'margin',
      label: 'Margin',
      expression: 'amount - cost',
    });
    notes.push('formula: margin = amount - cost (requires cost field)');
  }

  // Inline expression: formula X = a * b
  const named = q.match(/\bformula\s+([a-z_][a-z0-9_]*)\s*=\s*([0-9a-z_+\-*/. ]+)/i);
  if (named) {
    const key = named[1].trim();
    const expression = named[2].trim().replace(/\s+/g, ' ');
    if (/^[\d\s+\-*/()._a-zA-Z]+$/.test(expression)) {
      fields.push({ key, label: key, expression });
      notes.push(`formula: ${key} = ${expression}`);
    }
  }

  // Tabular reports surface formulas best; for summary still attach for builder.
  if (fields.length && reportType === 'summary') {
    notes.push('formulas apply to preview rows — refine in Report Builder if needed');
  }

  return { calculatedFields: fields.slice(0, 3), formulaNotes: notes };
}

/** NL → visibility + optional role/team name for sharedWith. */
function detectVisibility(question = '') {
  const q = String(question || '').toLowerCase();
  const roleNamed = q.match(/\b(?:share with|visible to)\s+(?:the\s+)?(?:role\s+)?["']?([a-z0-9][a-z0-9 _-]{1,40})["']?\s+role\b/)
    || q.match(/\brole\s+["']?([a-z0-9][a-z0-9 _-]{1,40})["']?\b/);
  const teamNamed = q.match(/\b(?:share with|visible to)\s+(?:the\s+)?(?:team|group)\s+["']?([a-z0-9][a-z0-9 _-]{1,40})["']?\b/)
    || q.match(/\bteam\s+["']?([a-z0-9][a-z0-9 _-]{1,40})["']?\b/);

  if (roleNamed) {
    return {
      visibility: 'role',
      visibilityNote: `share with role “${roleNamed[1].trim()}”`,
      shareTarget: { type: 'role', name: roleNamed[1].trim() },
    };
  }
  if (teamNamed || (/\b(share|visibility|visible)\b/.test(q) && /\b(team|my team)\b/.test(q))) {
    return {
      visibility: 'team',
      visibilityNote: teamNamed ? `share with team “${teamNamed[1].trim()}”` : 'shared with team',
      shareTarget: teamNamed ? { type: 'team', name: teamNamed[1].trim() } : null,
    };
  }
  if (/\b(organization|org[- ]?wide|everyone|company[- ]?wide|all users)\b/.test(q)
    || /\bshare\b.+\b(org|organization|everyone)\b/.test(q)) {
    return { visibility: 'organization', visibilityNote: 'shared with organization', shareTarget: null };
  }
  return { visibility: 'private', visibilityNote: '', shareTarget: null };
}

async function resolveSharedWith(organizationId, shareTarget) {
  if (!shareTarget?.type || !shareTarget?.name) return null;
  const name = String(shareTarget.name).trim();
  if (!name) return null;
  if (shareTarget.type === 'role') {
    const role = await Role.findOne({
      organizationId,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).select('_id name').lean();
    if (!role) return null;
    return [{ type: 'role', id: String(role._id), label: role.name }];
  }
  if (shareTarget.type === 'team') {
    const team = await Group.findOne({
      organizationId,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).select('_id name').lean();
    if (!team) return null;
    return [{ type: 'team', id: String(team._id), label: team.name }];
  }
  return null;
}

/** NL → schedule intent (requires publish + recipient). */
function detectSchedule(question = '') {
  const q = String(question || '').toLowerCase();
  const wants = /\b(schedule|email me|send me|subscribe)\b/.test(q)
    || /\b(daily|weekly|monthly)\b.+\breport\b/.test(q)
    || /\breport\b.+\b(daily|weekly|monthly)\b/.test(q);
  if (!wants) return null;

  let frequency = 'weekly';
  if (/\bdaily\b/.test(q)) frequency = 'daily';
  else if (/\bmonthly\b/.test(q)) frequency = 'monthly';

  let exportFormat = 'csv';
  if (/\bpdf\b/.test(q)) exportFormat = 'pdf';
  else if (/\bxlsx|excel\b/.test(q)) exportFormat = 'xlsx';

  const emailMatch = String(question || '').match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );

  return {
    frequency,
    exportFormat,
    recipientEmail: emailMatch ? emailMatch[0].toLowerCase() : '',
    scheduleNote: `schedule ${frequency} ${exportFormat}`,
  };
}

function buildDraftSpec({ question = '', moduleKey = '', groupField = '', pinSource = null } = {}) {
  const mod = resolveReportModuleKey(question, moduleKey, pinSource);
  if (!mod) return null;
  const cfg = getAnalyticsModuleConfig(mod);
  if (!cfg) return null;

  const defaultGroup = detectGroupField(question, mod)
    || pinSource?.groupField
    || DEFAULT_GROUP[mod]
    || 'status';
  const layout = detectLayoutOptions(question, mod, defaultGroup);
  const group = layout.groupField || defaultGroup;
  const type = layout.type;
  const template = matchWidgetTemplate(mod, group);
  const defaults = Array.isArray(cfg.defaultFields) ? cfg.defaultFields.slice() : [];
  if (group && !defaults.includes(group)) defaults.unshift(group);

  const { relatedModules, joinNotes } = detectJoins(question, mod);
  // Pull a few joined display fields into selection when joining
  if (relatedModules.includes('people')) {
    ['people.email', 'people.first_name'].forEach((f) => {
      if (!defaults.includes(f)) defaults.push(f);
    });
  }
  if (relatedModules.includes('organizations')) {
    ['organizations.name'].forEach((f) => {
      if (!defaults.includes(f)) defaults.push(f);
    });
  }

  const { filterTree, filterNotes } = detectFilters(question, mod);
  // Ensure filter fields exist in selectedFields so Filters UI can resolve them
  if (filterTree?.children) {
    for (const child of filterTree.children) {
      const fk = child?.fieldKey;
      if (fk && !defaults.includes(fk)) defaults.push(fk);
    }
  }

  const selectedFields = defaults.slice(0, 10).map((field) => ({
    field,
    role: field === group ? 'dimension' : 'attribute',
  }));

  const useAmount = pinSource?.metric === 'amount'
    || (/\b(value|amount|revenue|pipeline)\b/i.test(question) && mod === 'deals');

  const aggregations = type === 'tabular'
    ? []
    : (useAmount
      ? [{ field: 'amount', fn: 'sum', label: 'amount' }]
      : [{ field: '_id', fn: 'count', label: 'count' }]);

  const { calculatedFields, formulaNotes } = detectFormulas(question, mod, type);
  const { visibility, visibilityNote, shareTarget } = detectVisibility(question);
  const schedule = detectSchedule(question);

  const nameFromTemplate = template?.reportPreset?.name;
  const prettyMod = cfg.label || mod;
  let name = nameFromTemplate
    || (type === 'matrix'
      ? `${prettyMod} matrix`
      : (group
        ? `${prettyMod} by ${group}`
        : `${prettyMod} report`));
  if (filterNotes.length) {
    name = `${name} (filtered)`;
  }

  const builderStep = filterTree ? 'filters'
    : (layout.columnGroups?.length || layout.sorting ? 'group' : 'fields');

  return {
    name: String(name).slice(0, 120),
    description: `Created by Astra from: ${String(question || '').trim().slice(0, 200)}`,
    type,
    primaryModule: mod,
    relatedModules,
    selectedFields,
    rowGroups: type === 'tabular' || !group ? [] : [{ field: group }],
    columnGroups: layout.columnGroups || [],
    aggregations,
    sorting: layout.sorting,
    filterLogic: 'AND',
    filterTree,
    calculatedFields,
    showGrandTotal: type !== 'tabular',
    showSubTotals: type === 'matrix',
    showRecordCount: layout.showRecordCount,
    drillDownEnabled: layout.drillDownEnabled,
    runtimeFilters: layout.runtimeFilters,
    tags: ['astra', 'report-builder'],
    chartHint: detectReportChartHint(question, template?.chartType),
    groupField: group,
    metric: useAmount ? 'amount' : 'count',
    visibility,
    shareTarget,
    schedulingEnabled: Boolean(schedule),
    schedule,
    wantsPin: layout.wantsPin,
    wantsExport: layout.wantsExport,
    builderStep,
    appliedNotes: [
      ...filterNotes,
      ...joinNotes,
      ...formulaNotes,
      ...(layout.layoutNotes || []),
      visibilityNote,
      schedule?.scheduleNote || '',
      layout.wantsPin ? 'pin to dashboard' : '',
      layout.wantsExport ? 'export requested' : '',
    ].filter(Boolean),
  };
}

/**
 * Create a draft AnalyticsReport + optional preview/publish/schedule.
 */
async function createAstraReportDraft({
  organizationId,
  userId,
  user = null,
  question = '',
  moduleKey = '',
  pinSource = null,
  runPreview = true,
  appKey = '',
  orgContext = null,
} = {}) {
  const spec = buildDraftSpec({ question, moduleKey, pinSource });
  if (!spec) {
    const err = new Error('Could not resolve a CRM module for this report. Name a module (tasks, deals, cases, …).');
    err.statusCode = 400;
    err.code = 'ASTRA_REPORT_MODULE_UNKNOWN';
    throw err;
  }

  // Preview needs a real permissioned user — stub {_id, organizationId} fails module read.
  let previewUser = user && (user.permissions || user._permissionRuntime || user.role || user.isOwner)
    ? user
    : null;
  if (!previewUser && userId) {
    previewUser = await User.findOne({ _id: userId, organizationId }).lean();
  }
  if (!previewUser) {
    previewUser = user || { _id: userId, organizationId };
  }

  const apiName = await ensureUniqueApiName(
    organizationId,
    slugify(`${spec.name}_astra`)
  );

  const shouldSchedule = Boolean(spec.schedule);
  const shouldPin = Boolean(spec.wantsPin);
  let status = 'draft';
  let publishedAt = null;
  if (shouldSchedule || shouldPin) {
    status = 'published';
    publishedAt = new Date();
  }

  const sharedWith = await resolveSharedWith(organizationId, spec.shareTarget);

  const report = await AnalyticsReport.create({
    organizationId,
    name: spec.name,
    apiName,
    description: spec.description,
    type: spec.type,
    primaryModule: spec.primaryModule,
    relatedModules: spec.relatedModules || [],
    selectedFields: spec.selectedFields,
    rowGroups: spec.rowGroups,
    columnGroups: spec.columnGroups?.length ? spec.columnGroups : null,
    aggregations: spec.aggregations,
    sorting: spec.sorting,
    filterLogic: spec.filterLogic,
    filterTree: spec.filterTree || null,
    calculatedFields: spec.calculatedFields?.length ? spec.calculatedFields : null,
    showGrandTotal: spec.showGrandTotal,
    showSubTotals: spec.showSubTotals,
    showRecordCount: Boolean(spec.showRecordCount),
    drillDownEnabled: spec.drillDownEnabled !== false,
    runtimeFilters: Boolean(spec.runtimeFilters),
    tags: spec.tags,
    status,
    version: 1,
    publishedAt,
    visibility: spec.visibility || 'private',
    sharedWith: sharedWith || null,
    schedulingEnabled: Boolean(spec.schedulingEnabled),
    ownerId: userId,
    createdBy: userId,
    listedInHome: true,
  });

  let preview = null;
  if (runPreview) {
    try {
      const moduleCfg = getAnalyticsModuleConfig(spec.primaryModule);
      preview = await runAnalyticsReportWithLogging(report, {
        user: previewUser,
        organizationId,
        orgContext: orgContext || previewUser?._orgPermissionContext || undefined,
        appKey: appKey || moduleCfg?.appKey || undefined,
        preview: true,
        rowLimit: 50,
      });
    } catch (err) {
      preview = { error: String(err?.message || 'Preview failed') };
    }
  }

  let scheduleRecord = null;
  let scheduleError = '';
  if (shouldSchedule) {
    let recipient = spec.schedule.recipientEmail || '';
    if (!recipient) {
      const dbUser = await User.findOne({ _id: userId, organizationId })
        .select('email')
        .lean();
      recipient = String(dbUser?.email || user?.email || '').trim().toLowerCase();
    }
    if (recipient) {
      try {
        scheduleRecord = await createSchedule(organizationId, {
          _id: userId,
        }, {
          name: `${spec.name} schedule`,
          reportId: report._id,
          assetType: 'report',
          frequency: spec.schedule.frequency,
          exportFormat: spec.schedule.exportFormat,
          recipients: [recipient],
          hour: 9,
          minute: 0,
          dayOfWeek: 1,
          timezone: 'UTC',
        });
      } catch (err) {
        scheduleError = String(err?.message || 'Schedule create failed');
      }
    } else {
      scheduleError = 'No recipient email — add one in Report Builder → Schedule, or include an email in your ask.';
    }
  }

  let pinResult = null;
  let pinError = '';
  if (shouldPin) {
    try {
      pinResult = await pinExistingReportToDashboard({
        organizationId,
        userId,
        report,
        chartType: spec.chartHint || 'bar',
        appKey: 'SALES',
      });
    } catch (err) {
      pinError = String(err?.message || 'Pin failed');
    }
  }

  if (spec.shareTarget && !sharedWith) {
    spec.appliedNotes.push(
      `Could not resolve ${spec.shareTarget.type} “${spec.shareTarget.name}” — set sharing in Report Builder`
    );
  }

  const reportId = String(report._id);
  const step = spec.builderStep || 'fields';
  const actions = [
    {
      label: 'Open in Report Builder',
      kind: 'open_report_builder',
      recordId: reportId,
      moduleKey: 'analytics_reports',
      priority: 'high',
      rationale: 'Edit fields, filters, joins, formulas, schedule, and share',
      fields: { reportId, step, autoOpen: false },
      executeNow: false,
    },
    {
      label: 'Open report',
      kind: 'open_report',
      recordId: reportId,
      moduleKey: 'analytics_reports',
      priority: 'medium',
      rationale: 'View the report detail page',
      fields: { reportId },
      executeNow: false,
    },
  ];

  if (status !== 'published') {
    actions.push({
      label: 'Publish report',
      kind: 'publish_report',
      recordId: reportId,
      moduleKey: 'analytics_reports',
      priority: 'medium',
      rationale: 'Make this report available to run and pin on dashboards',
      fields: { reportId },
      executeNow: false,
    });
  }

  if (spec.wantsExport) {
    actions.push({
      label: 'Export CSV',
      kind: 'export_report',
      recordId: reportId,
      moduleKey: 'analytics_reports',
      priority: 'low',
      rationale: 'Download report results as CSV',
      fields: { reportId, format: 'csv' },
      executeNow: false,
    });
  }

  if (!shouldPin) {
    actions.push({
      label: 'Pin to dashboard',
      kind: 'pin_report_to_dashboard',
      recordId: reportId,
      moduleKey: 'analytics_reports',
      priority: 'low',
      rationale: 'Publish (if needed) and pin this report as a dashboard widget',
      fields: { reportId, chartType: spec.chartHint || 'bar' },
      executeNow: false,
    });
  }

  // Cap at 4 highest-priority actions for UI
  const priorityRank = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));
  const cappedActions = actions.slice(0, 4);

  const rowCount = Number(preview?.result?.rowCount ?? preview?.rowCount ?? 0);
  const bullets = [
    `${status === 'published' ? 'Published' : 'Draft'} report “${spec.name}” created in Reports.`,
    `Module: ${spec.primaryModule}${spec.groupField ? ` · group by ${spec.groupField}` : ''}`
      + (spec.type === 'matrix' ? ' · matrix' : '')
      + (spec.relatedModules?.length ? ` · joins: ${spec.relatedModules.join(', ')}` : '')
      + (spec.visibility && spec.visibility !== 'private' ? ` · visibility: ${spec.visibility}` : ''),
    `reportId=${reportId}`,
    ...(spec.appliedNotes || []).slice(0, 5).map((n) => `Applied: ${n}`),
    preview?.error
      ? `Preview note: ${preview.error}`
      : (rowCount ? `Preview returned ${rowCount} row(s).` : 'Preview ready.'),
  ];
  if (scheduleRecord) {
    bullets.push(
      `Schedule active: ${spec.schedule.frequency} ${spec.schedule.exportFormat} → `
      + `${(scheduleRecord.recipients || []).join(', ') || 'recipient'}.`
    );
  } else if (scheduleError) {
    bullets.push(`Schedule: ${scheduleError}`);
  }
  if (pinResult?.dashboard) {
    bullets.push(`Pinned to dashboard “${pinResult.dashboard.name}”.`);
  } else if (pinError) {
    bullets.push(`Pin: ${pinError}`);
  }

  const visuals = buildVisualsFromReportPreview(preview, spec, question);
  // Visual-first when we have a chart/table preview — avoid reportId / essay cards.
  const lean = visuals.length > 0;
  const leanActions = cappedActions.map((a) => {
    if (a.kind !== 'open_report_builder') return a;
    return {
      ...a,
      fields: { ...(a.fields || {}), autoOpen: false },
    };
  });
  const structured = lean
    ? leanVisualStructured({
      headline: spec.name,
      visuals,
      actions: leanActions,
    })
    : {
      headline: `Report ${status === 'published' ? 'ready' : 'draft ready'} · ${spec.name}`,
      bullets,
      detail: [
        'This is a real Analytics report — same object as Reports → Report Builder.',
        'Filters, joins, formulas, matrix layout, visibility, schedule, and pin were applied when named.',
        'Use Open in Report Builder when you want to edit fields, filters, or layout.',
      ].join('\n'),
      actions: cappedActions,
      visuals,
      clarifyingQuestions: [],
      talkToAgent: false,
    };

  return {
    report: {
      _id: reportId,
      name: report.name,
      status: report.status,
      type: report.type,
      primaryModule: report.primaryModule,
      apiName: report.apiName,
      visibility: report.visibility,
    },
    spec,
    preview,
    schedule: scheduleRecord
      ? { _id: String(scheduleRecord._id), frequency: scheduleRecord.frequency }
      : null,
    pin: pinResult,
    structured,
  };
}

module.exports = {
  isReportBuilderQuestion,
  isCreateWidgetQuestion,
  isUnderspecifiedReportQuestion,
  isReportModuleFollowUp,
  mayUsePageModuleHint,
  questionNamesReportModule,
  buildReportRequirementsStructured,
  resolveReportModuleKey,
  buildDraftSpec,
  createAstraReportDraft,
  createAstraWidgetFromReport,
  detectModuleKey,
  detectFilters,
  detectJoins,
  detectFormulas,
  detectVisibility,
  detectSchedule,
  detectLayoutOptions,
  detectGroupField,
  detectExplicitGroupField,
  mapGroupToken,
  extractGroupByPhrase,
  resolveGroupFieldAgainstModule,
  listModuleGroupFields,
  resolveSharedWith,
  extractReportIdFromHistory,
  detectWidgetChartType,
  detectReportChartHint,
  buildVisualsFromReportPreview,
  wantsLeanVisualReply,
  isVisualGlanceQuestion,
  leanVisualStructured,
};
