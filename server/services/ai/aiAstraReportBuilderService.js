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
const { executeAnalyticsReport } = require('../analytics/analyticsEngine');
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
  forms: 'executionStatus',
  sales_orders: 'status',
  invoices: 'status',
  payments: 'status',
  documents: 'status',
});

/** Primary date field per analytics module (registry-aligned). */
const MODULE_DATE_FIELD = Object.freeze({
  deals: 'expectedCloseDate',
  tasks: 'dueDate',
  cases: 'dueDate',
  events: 'startDateTime',
  quotes: 'validUntil',
  invoices: 'dueDate',
  sales_orders: 'orderDate',
  payments: 'paymentDate',
  forms: 'submittedAt',
});

/** NL aliases → analytics moduleKey (order matters: more specific first). */
const MODULE_DETECT_RULES = Object.freeze([
  { key: 'sales_orders', re: /\bsales[\s_-]?orders?\b|\bsalesorders?\b/ },
  { key: 'invoices', re: /\binvoices?\b/ },
  { key: 'payments', re: /\bpayments?\b/ },
  { key: 'documents', re: /\bdocuments?\b|\bdocs?\b/ },
  { key: 'forms', re: /\bform\s+responses?\b|\bforms?\b/ },
  { key: 'tasks', re: /\btasks?\b/ },
  { key: 'deals', re: /\bdeals?\b|\bdels\b|\bpipeline\b|\bopportunit/ },
  { key: 'cases', re: /\bcases?\b|\btickets?\b/ },
  { key: 'events', re: /\bevents?\b|\bmeetings?\b/ },
  { key: 'quotes', re: /\bquotes?\b/ },
  { key: 'people', re: /\b(people|contacts?|leads?)\b/ },
  { key: 'organizations', re: /\b(organizations?|accounts?|companies)\b/ },
  { key: 'items', re: /\b(items?|products?|sku)\b/ },
]);

const MODULE_LIST_TOKEN_RE = /deals?|tasks?|cases?|quotes?|events?|meetings?|people|contacts?|organizations?|accounts?|items?|products?|invoices?|payments?|documents?|docs?|forms?|sales[\s_-]?orders?|records?|rows?/;

function moduleDateField(moduleKey = '') {
  return MODULE_DATE_FIELD[String(moduleKey || '').toLowerCase()] || '';
}

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
    && /\b(task|tasks|deal|deals|pipeline|case|cases|quote|quotes|event|events|people|contacts?|invoice|invoices|payment|payments|document|documents|organization|organizations|item|items|sales.?order|forms?)\b/.test(q)
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
 * Deal coaching / diagnostic asks — need the matching deals + why/next steps,
 * never a generic "Pipeline by Stage" chart.
 */
function isCrmDiagnosticAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  // Product how-to / convert flows are not closure diagnostics
  if (isProductHowToAsk(q)) return false;
  // Quoted record name → single-record summary, not pipeline diagnostic list
  if (extractQuotedRecordName(question)) return false;
  if (/\b(why|how come|what.?s blocking|blocker|stuck|stalled|overdue)\b/.test(q)
    && /\b(deal|deals|clos(?:e|ed|ing|ure)|stage|pipeline|won|lost)\b/.test(q)) {
    return true;
  }
  if (/\b(expedite|accelerate|unshift|unblock|move(?:\s+\w+){0,2}\s+forward|get .+ closed|help .+ close)\b/.test(q)
    && /\b(deal|deals|clos(?:e|ed|ing|ure)|pipeline)\b/.test(q)) {
    return true;
  }
  // "how can/do I close / next steps on pipeline" — not "how do I convert a deal to a quote"
  if (
    /\b(what can (be|i|we) do|next steps?|recommend)\b/.test(q)
    && /\b(clos(?:e|ed|ing|ure)|deal|deals|pipeline)\b/.test(q)
  ) {
    return true;
  }
  if (
    /\bhow (can|do) (i|we)\b/.test(q)
    && /\b(clos(?:e|ed|ing|ure)|pipeline|expedite)\b/.test(q)
    && /\b(deal|deals)\b/.test(q)
  ) {
    return true;
  }
  if (/\b(still not closed|not (yet )?closed|why .{0,40}not closed)\b/.test(q)) return true;
  return false;
}

/** Deals near close / "likely to close" — late-stage OPEN deals only (never Won/Lost). */
function isLikelyToCloseAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q || isWonDealAsk(q) || isLostDealAsk(q) || isProductHowToAsk(q)) return false;
  if (extractQuotedRecordName(question)) return false;
  if (/\blikely\s+to\s+(get\s+)?clos/i.test(q)) return true;
  if (/\b(probably|expected|forecast|predicted)\s+to\s+clos/i.test(q)) return true;
  if (/\bdeals?\b.{0,40}\b(likely|probably|expected)\s+to\s+clos/i.test(q)) return true;
  if (/\bwhich\s+deals?\b.{0,60}\b(will|going\s+to)\s+clos/i.test(q)) return true;
  if (/\bclos(?:e|ing)\s+(soon|this\s+week|this\s+month|next\s+week)\b/i.test(q) && /\bdeals?\b/i.test(q)) {
    return true;
  }
  return false;
}

/** Deals near close / "closure state" — list late-stage open deals, not full pipeline chart. */
function isNearCloseDealAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (isProductHowToAsk(q)) return false;
  if (extractQuotedRecordName(question)) return false;
  if (isLikelyToCloseAsk(q)) return true;
  if (/\b(closure state|closing stage|near[- ]close|about to close|ready to close|late[- ]stage)\b/.test(q)) {
    return true;
  }
  if (/\b(which|list|show|give|get)\b.{0,40}\bdeals?\b.{0,60}\b(clos(?:e|ing|ure)|negotiat|contract sent|proposal)\b/.test(q)) {
    // "which deals … closed" matching Closed Won/Lost lists is handled by isWon/isLost first
    if (/\bclosed\s+won\b|\bclosed\s+lost\b|\balready\s+clos/i.test(q)) return false;
    return true;
  }
  if (/\bdeals?\b.{0,40}\b(in|at)\b.{0,20}\b(closure|closing|negotiation|contract)\b/.test(q)) {
    return true;
  }
  return false;
}

function wantsDealListNotPipelineChart(question = '') {
  return isCrmDiagnosticAsk(question) || isNearCloseDealAsk(question) || isLikelyToCloseAsk(question);
}

const CLOSING_STAGE_VALUES = Object.freeze([
  'Negotiation',
  'Proposal',
  'Contract Sent',
]);

function isOpenLateStageRow(row = {}) {
  const stage = String(row.stage || row.STAGE || '').trim().toLowerCase();
  const status = String(row.status || row.STATUS || '').trim().toLowerCase();
  if (status === 'won' || status === 'lost') return false;
  if (stage === 'closed won' || stage === 'closed lost' || stage === 'won' || stage === 'lost') {
    return false;
  }
  if (/\bclosed\s+(won|lost)\b/.test(stage)) return false;
  return CLOSING_STAGE_VALUES.some((s) => stage === s.toLowerCase())
    || /\b(negotiation|proposal|contract\s*sent)\b/.test(stage);
}

/**
 * Product how-to / documentation — must not route to CRM list/chart.
 */
function isProductHowToAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (/\b(how\s+do\s+i|how\s+to|where\s+(do|can)\s+i|what\s+is\s+the\s+(way|process)|help\s+me\s+(set\s+up|configure|create|convert)|product\s+help|user\s+guide|documentation)\b/.test(q)) {
    return true;
  }
  if (/\bconvert\s+(a\s+|the\s+)?deal\s+to\s+(a\s+|the\s+)?quote\b/.test(q)) return true;
  if (/\brequired\s+fields?\b/.test(q) && /\b(how|convert|create|configure|set\s+up)\b/.test(q)) return true;
  return false;
}

/**
 * Vague importance asks without filters — clarify instead of inventing a deal list.
 */
function isAmbiguousCrmAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q || q.length > 120) return false;
  if (isProductHowToAsk(q)) return false;
  if (/\b(important|key|critical|relevant|interesting)\s+ones?\b/.test(q)) return true;
  if (/^(show|give|get)\s+me\s+(the\s+)?(important|key|critical|relevant)\b/.test(q)) return true;
  if (/^(the\s+)?important\s+ones?\??$/.test(q)) return true;
  return false;
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
 * Same turn asks for a record list and a chart (e.g. "list of deals … and a bar chart").
 * Uses the current utterance only — not blended history — so "same in bar chart" stays chart-only.
 */
function wantsCompoundListAndChart(question = '') {
  const q = String(question || '').toLowerCase();
  const wantsList = /\b(list of|tabular|row.?level|line items?)\b/.test(q)
    || new RegExp(`\\blist\\b.{0,100}\\b(?:${MODULE_LIST_TOKEN_RE.source})\\b`).test(q)
    || /\b(give|show|get)\b.{0,40}\b(list|records?|rows?)\b/.test(q);
  const wantsChart = /\b(bar|pie|donut|line)\s*charts?\b/.test(q)
    || /\b(bar|pie|donut|line)\s+chart\b/.test(q)
    || /\b(as|in)\s+(a\s+)?(bar|pie|donut|line)(\s+chart)?\b/.test(q)
    || /\band\b.{0,40}\b(a\s+)?(bar|pie|donut|line)(\s+chart)?\b/.test(q)
    || /\b(chart|graph|plot)\b/.test(q);
  return wantsList && wantsChart;
}

/**
 * Chart/pie/bar ask with no explicit group-by → slice by record (do not invent stage).
 */
function isChartAskWithoutGroup(question = '', moduleKey = '') {
  const q = String(question || '').toLowerCase();
  if (!q) return false;
  const wantsChart = /\b(bar|pie|donut|line)\s*charts?\b/.test(q)
    || /\b(as|in)\s+(a\s+)?(bar|pie|donut|line)(\s+chart)?\b/.test(q)
    || (/\b(chart|graph|plot|visuali[sz]e)\b/.test(q) && !/\b(list of|tabular|row.?level)\b/.test(q));
  if (!wantsChart) return false;
  return !hasExplicitGroupBy(question, moduleKey);
}

/** True when the user asked for a chart/graph (not a plain list). */
function wantsExplicitChartAsk(question = '') {
  const q = String(question || '').toLowerCase();
  if (!q) return false;
  return /\b(bar|pie|donut|line)\s*charts?\b/.test(q)
    || /\b(as|in)\s+(a\s+)?(bar|pie|donut|line)(\s+chart)?\b/.test(q)
    || /\b(chart|graph|plot|visuali[sz]e)\b/.test(q);
}

/**
 * "give me the list of upcoming events" → table, never invent a bar/pie of records.
 */
function wantsListOnlyAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q || wantsExplicitChartAsk(q)) return false;
  if (wantsCompoundListAndChart(q)) return false;
  return /\b(list of|give me the list|show (me )?the list|tabular|row.?level)\b/.test(q)
    || /\b(give|show|get)\b.{0,40}\blist\b/.test(q);
}

/**
 * Turn analytics preview rows into an Astra chart or table visual.
 * @returns {object[]}
 */
function buildVisualsFromReportPreview(preview, spec = {}, question = '', options = {}) {
  if (preview?.error) return [];
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];

  const groupField = String(spec.groupField || '').trim();
  const metricLabel = spec.metric === 'amount' ? 'amount' : 'count';
  const aggKeys = Array.isArray(spec.aggregations)
    ? spec.aggregations.map((a) => a.label || a.field).filter(Boolean)
    : [];
  const q = String(question || '').toLowerCase();
  const wantsTable = options.forceTable === true
    || (options.forceChart !== true
      && (
        /\btable\b/.test(q)
        || /\b(list of|give me the list|show (me )?the list)\b/.test(q)
      )
      && !/\b(chart|pie|donut|bar|graph|plot)\b/.test(q));

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

/**
 * True when the ask wants each matching record as a chart slice (not stage/status rollup).
 */
function wantsRecordLevelChart(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (/\bby\s+record\b/.test(q) || /\beach\s+(deal|record|row)\b/.test(q)) return true;
  if (/\bnot\s+by\s+(stage|status|priority|owner)\b/.test(q)) return true;
  if (/\bwithout\s+(grouping\s+)?by\s+(stage|status)\b/.test(q)) return true;
  if (/\bindividual\s+(deals?|records?)\b/.test(q)) return true;
  return false;
}

/**
 * True when the ask names a group-by dimension (by stage / status / …).
 * Without this, charts of filtered records should slice by record, not invent stage.
 * Negations ("not by stage") and "by record" must NOT count as explicit group-by.
 */
function hasExplicitGroupBy(question = '', moduleKey = '') {
  if (wantsRecordLevelChart(question)) return false;
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Strip negated group phrases so "not by stage" does not match \bby\s+stage\b
  const cleaned = q
    .replace(/\bnot\s+by\s+(stage|status|priority|owner|assignee|type|channel|industry)\b/g, ' ')
    .replace(/\bwithout\s+(grouping\s+)?by\s+(stage|status)\b/g, ' ');
  if (detectExplicitGroupField(cleaned, moduleKey)) return true;
  return /\bby\s+(stage|status|priority|owner|assignee|type|channel|industry)\b/.test(cleaned)
    || /\b(breakdown|distribution|pipeline)\s+by\b/.test(cleaned)
    || /\bgroup(?:ed)?\s+by\b/.test(cleaned);
}

/**
 * Build a pie/bar from tabular record rows (each matching record = one slice).
 * Deals default to amount; others count as 1 unless a numeric field exists.
 */
function buildRecordLevelChartVisual(preview, spec = {}, options = {}) {
  if (preview?.error) return [];
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];

  const mod = spec.primaryModule || 'records';
  const metric = options.metric === 'count' ? 'count' : (spec.metric || (mod === 'deals' ? 'amount' : 'count'));
  const rawHint = String(spec.chartHint || options.chartHint || 'pie').toLowerCase();
  const chartType = rawHint === 'donut' || rawHint === 'pie'
    ? 'pie'
    : (rawHint === 'line' ? 'line' : 'bar');

  const labelKeys = ['name', 'title', 'caseId', 'quoteNumber', 'eventName', 'item_name', 'first_name'];
  const points = [];
  for (const row of rows.slice(0, 24)) {
    if (!row || typeof row !== 'object') continue;
    let label = '';
    for (const k of labelKeys) {
      if (row[k] != null && String(row[k]).trim()) {
        label = String(row[k]).trim();
        break;
      }
    }
    if (!label) {
      for (const [k, v] of Object.entries(row)) {
        if (k === '_id' || typeof v === 'number') continue;
        if (v != null && String(v).trim()) {
          label = String(v).trim();
          break;
        }
      }
    }
    if (!label) label = '(record)';

    let value = 1;
    if (metric === 'amount' && typeof row.amount === 'number') value = row.amount;
    else if (typeof row.amount === 'number' && mod === 'deals') value = row.amount;
    else if (typeof row.value === 'number') value = row.value;
    points.push({ label: label.slice(0, 48), value: Number(value) || 0 });
  }
  if (!points.length) return [];

  const title = spec.name
    || (metric === 'amount' ? `${mod} by amount` : `${mod} records`);

  return [{
    id: `astra_report_records_${mod}`,
    component: 'chart',
    chartType,
    title,
    metricLabel: metric === 'amount' ? 'amount' : 'count',
    points,
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
  // New free-form asks (list / show / summarize) are NOT answers to "which module?"
  // Sticky report-clarify context must not hijack them into Create report drafts.
  if (
    !/\breport\b/i.test(q)
    && /\b(list of|give me|show me|get me|how many|what are|summarize|prepare|draft|email|pin to|find me|fetch)\b/i.test(q)
  ) {
    return false;
  }
  // Long self-contained asks without "report" are new tasks, not module replies
  if (q.length > 100 && !/\breport\b/i.test(q)) return false;

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
  for (const rule of MODULE_DETECT_RULES) {
    if (rule.re.test(q) && getAnalyticsModuleConfig(rule.key)) {
      return rule.key;
    }
  }
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
    // "group by revenue/amount/value" is a metric ask, not a CRM dimension
    if (/^(revenue|amount|value|dollar|money|sales)\b/.test(phrase)) {
      return '';
    }
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
  // Diagnostic / closure-state asks need the deal rows, not a stage rollup chart.
  if (wantsDealListNotPipelineChart(q)) return 'tabular';
  // Chart / graph visualization wins over "list of" when both appear
  // (e.g. prior list ask + "same in bar chart").
  const wantsChartViz = /\b(bar|pie|donut|line)\s*charts?\b/.test(q)
    || /\b(as|in)\s+(a\s+)?(bar|pie|donut|line)(\s+chart)?\b/.test(q)
    || (/\b(chart|graph|plot|visuali[sz]e)\b/.test(q) && !/\b(list of|tabular|row.?level)\b/.test(q));
  if (wantsChartViz) {
    return 'summary';
  }
  if (/\btabular|row.?level|list of|line items?|which deals?\b/.test(q)) return 'tabular';
  // Filtered record dump without an explicit stage/status breakdown → tabular list
  if (
    /\b(above|over|more than|greater than|below|under|less than)\s*\$?\s*[\d,.]+/.test(q)
    && !/\b(by stage|by status|by priority|breakdown|distribution|pipeline by)\b/.test(q)
  ) {
    return 'tabular';
  }
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

  if (type === 'tabular') {
    groupField = '';
  }

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

/** Normalize curly/smart quotes so name extraction is reliable across OS keyboards. */
function normalizeSmartQuotes(text = '') {
  return String(text || '')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

/**
 * Quoted or explicit record/deal name: Summarize deal 'Sample Deal' …
 * Also accepts curly quotes and unquoted Title Case after deal/record/case/task.
 */
function extractQuotedRecordName(question = '') {
  const q = normalizeSmartQuotes(question).trim();
  if (!q) return '';
  const m = q.match(/["']([^"']{2,80})["']/);
  let name = String(m?.[1] || '').trim();
  if (!name) {
    // deal Sample Deal / deal Acme Renewal — stop before clause punctuation
    const bare = q.match(
      /\b(?:deal|record|case|task|quote|event)\s+([A-Z][\w&.\-]*(?:\s+[A-Z0-9][\w&.\-]*){0,6})(?=\s*[,:;?.!]|\s+and\b|\s+risk|\s+next\b|$)/,
    );
    name = String(bare?.[1] || '').trim();
  }
  if (!name || name.length < 2) return '';
  // Ignore quotes that are only filter tokens
  if (/^(open|won|lost|high|medium|low)$/i.test(name)) return '';
  return name;
}

function nameFieldForModule(moduleKey = '') {
  const mod = String(moduleKey || '').toLowerCase();
  if (mod === 'tasks' || mod === 'cases') return 'title';
  if (mod === 'events') return 'eventName';
  if (mod === 'people') return 'first_name'; // weak — prefer deals/orgs
  return 'name';
}

/** True when the ask wants won / Closed Won deals (not "won't"). */
function isWonDealAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q || /\bwon't\b/.test(q)) return false;
  if (/\bclosed\s+won\b/.test(q)) return true;
  if (/\bwon\s+deals?\b/.test(q)) return true;
  if (/\bdeals?\b.{0,80}\b(?:that\s+are\s+|which\s+are\s+|are\s+)?won\b/.test(q)) return true;
  if (/\b(?:list|listy|show|give|get)\b.{0,60}\bwon\b.{0,40}\bdeals?\b/.test(q)) return true;
  return false;
}

/** True when the ask wants lost / Closed Lost deals. */
function isLostDealAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (/\bclosed\s+lost\b/.test(q)) return true;
  if (/\blost\s+deals?\b/.test(q)) return true;
  if (/\bdeals?\b.{0,80}\b(?:that\s+are\s+|which\s+are\s+|are\s+)?lost\b/.test(q)) return true;
  if (/\b(?:list|listy|show|give|get)\b.{0,60}\blost\b.{0,40}\bdeals?\b/.test(q)) return true;
  return false;
}

function isWonStageOrStatus(row = {}) {
  const stage = String(row.stage || row.STAGE || '').trim().toLowerCase();
  const status = String(row.status || row.STATUS || '').trim().toLowerCase();
  return status === 'won'
    || stage === 'won'
    || stage === 'closed won'
    || /\bclosed\s+won\b/.test(stage);
}

function isLostStageOrStatus(row = {}) {
  const stage = String(row.stage || row.STAGE || '').trim().toLowerCase();
  const status = String(row.status || row.STATUS || '').trim().toLowerCase();
  return status === 'lost'
    || stage === 'lost'
    || stage === 'closed lost'
    || /\bclosed\s+lost\b/.test(stage);
}

/** NL → filterTree children (AND).
 * @param {string} question
 * @param {string} moduleKey
 * @param {{ timeZone?: string, now?: Date }} [opts]
 */
function detectFilters(question = '', moduleKey = '', opts = {}) {
  const q = String(question || '').toLowerCase();
  const children = [];
  const notes = [];
  const timeZone = String(opts.timeZone || 'UTC').trim() || 'UTC';
  const now = opts.now instanceof Date && !Number.isNaN(opts.now.getTime())
    ? opts.now
    : new Date();

  const quotedName = extractQuotedRecordName(question);
  if (quotedName) {
    const nameField = nameFieldForModule(moduleKey);
    children.push(rule(nameField, 'contains', quotedName));
    notes.push(`${nameField} contains "${quotedName}"`);
  }

  // Status / stage shortcuts — one rule per fieldKey (Filter Builder UI is flat per field).
  // Skip pipeline-wide status/stage when the user named a single record.
  if (quotedName) {
    // Amount / priority still allowed below; stage/status open-pipeline heuristics skipped.
  } else if (/\bopen\b/.test(q) && !/\bopen in\b/.test(q) && !isWonDealAsk(q) && !isLostDealAsk(q)) {
    if (moduleKey === 'deals') {
      // Canonical Deal Status is Open|Won|Lost — prefer status over incomplete stage excludes
      children.push(rule('status', 'is', 'Open'));
      notes.push('open pipeline (status = Open)');
    } else if (moduleKey === 'tasks' || moduleKey === 'cases' || moduleKey === 'quotes') {
      children.push(rule('status', 'is_not', 'completed'));
      notes.push('exclude completed');
    } else if (moduleKey === 'invoices' || moduleKey === 'sales_orders' || moduleKey === 'payments') {
      // "open" on commercial docs → not paid
      children.push(rule('status', 'is_not', 'paid'));
      notes.push('open/unpaid (exclude paid)');
    }
    // events: "open" alone does not force status — prefer upcoming date filter below
  }
  if (
    (moduleKey === 'invoices' || moduleKey === 'sales_orders' || moduleKey === 'payments')
    && /\b(unpaid|outstanding)\b/.test(q)
    && !children.some((c) => c.fieldKey === 'status')
  ) {
    children.push(rule('status', 'is_not', 'paid'));
    notes.push('unpaid (exclude paid)');
  }
  if (isWonDealAsk(q) && moduleKey === 'deals') {
    children.push({
      logic: 'OR',
      children: [
        rule('status', 'is', 'Won'),
        rule('stage', 'is_any_of', ['Closed Won', 'Won']),
      ],
    });
    notes.push('won deals (status=Won or stage Closed Won/Won)');
  }
  if (isLostDealAsk(q) && moduleKey === 'deals') {
    children.push({
      logic: 'OR',
      children: [
        rule('status', 'is', 'Lost'),
        rule('stage', 'is_any_of', ['Closed Lost', 'Lost']),
      ],
    });
    notes.push('lost deals (status=Lost or stage Closed Lost/Lost)');
  }
  // "Closure state" / likely-to-close / diagnostic → late-stage OPEN deals only
  // Never apply when the user named a single record or asked for won/lost lists.
  if (
    moduleKey === 'deals'
    && !quotedName
    && !isWonDealAsk(q)
    && !isLostDealAsk(q)
    && !children.some((c) => c.fieldKey === 'stage' || c.fieldKey === 'status' || c.logic)
    && (wantsDealListNotPipelineChart(q)
      || isLikelyToCloseAsk(q)
      || /\b(negotiat|proposal|contract sent)\b/.test(q))
  ) {
    children.push(rule('status', 'is', 'Open'));
    children.push(rule('stage', 'is_any_of', [...CLOSING_STAGE_VALUES]));
    notes.push(
      isLikelyToCloseAsk(q)
        ? 'likely to close (status=Open + Negotiation/Proposal/Contract Sent)'
        : 'closing stages (Open + Negotiation / Proposal / Contract Sent)',
    );
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

  // Explicit status/stage = value (skip when won/lost ask already set outcome filters)
  // Capture one token for status (Open|Won|Lost) — do NOT swallow trailing "amount above …"
  // from queryPlanToDraftInput rewrites ("status is Open amount above 10000").
  const statusEq = q.match(/\bstatus\s*(?:=|is|:)\s*["']?([a-z0-9_-]+)["']?/i);
  if (
    statusEq
    && !children.some((c) => c.fieldKey === 'status')
    && !(moduleKey === 'deals' && isWonDealAsk(q) && /^won$/i.test(String(statusEq[1] || '').trim()))
    && !(moduleKey === 'deals' && isLostDealAsk(q) && /^lost$/i.test(String(statusEq[1] || '').trim()))
  ) {
    children.push(rule('status', 'is', statusEq[1].trim()));
    notes.push(`status = ${statusEq[1].trim()}`);
  }
  // Stage may be multi-word (Contract Sent) but must stop before the next filter/clause token.
  const stageEq = q.match(
    /\bstage\s*(?:=|is|:)\s*["']?([a-z0-9][a-z0-9 _-]*?)(?=\s+(?:amount|status|module|list|group|as|by|and|tabular|chart|priority|revenue)\b|\s*$)/i,
  );
  if (
    stageEq
    && moduleKey === 'deals'
    && !children.some((c) => c.fieldKey === 'stage')
    && !isWonDealAsk(q)
    && !isLostDealAsk(q)
  ) {
    children.push(rule('stage', 'is', stageEq[1].trim()));
    notes.push(`stage = ${stageEq[1].trim()}`);
  }

  // Amount comparisons (kept as gte/gt/… for engine; UI maps to "is" for display)
  const parseMoney = (numRaw, suffix = '') => {
    let n = Number(String(numRaw || '').replace(/,/g, ''));
    if (!Number.isFinite(n)) return NaN;
    const s = String(suffix || '').toLowerCase();
    if (s === 'k') n *= 1000;
    else if (s === 'm') n *= 1e6;
    else if (s === 'b') n *= 1e9;
    return n;
  };
  const mapAmountOp = (opRaw) => {
    const o = String(opRaw || '').toLowerCase();
    if (o === '>=' || o === 'above' || o === 'over' || o === 'more than') return 'gte';
    if (o === '>' || o === 'greater than') return 'gt';
    if (o === '<=' || o === 'below' || o === 'under' || o === 'less than') return 'lte';
    if (o === '<') return 'lt';
    return 'gt';
  };
  if (moduleKey === 'deals') {
    const amountCmp = q.match(
      /\bamount\s*(?:is\s+)?(>=|<=|>|<|above|over|more than|greater than|below|under|less than)\s*\$?\s*([\d,.]+)\s*([kmb])?\b/i,
    ) || q.match(
      /\b(?:deals?|amount|value).{0,48}?\b(above|over|more than|greater than|below|under|less than)\s*\$?\s*([\d,.]+)\s*([kmb])?\b/i,
    ) || q.match(
      /\b(above|over|more than|greater than)\s*\$?\s*([\d,.]+)\s*([kmb])?\b/i,
    );
    // "having amount 10K$" / "amount 10k" → treat as >= threshold
    const amountBare = !amountCmp && q.match(
      /\b(?:having\s+)?amount\s+(?:of\s+|is\s+|at\s+least\s+)?\$?\s*([\d,.]+)\s*([kmb])?\s*\$?\b/i,
    );
    if (amountCmp) {
      const n = parseMoney(amountCmp[2], amountCmp[3]);
      if (Number.isFinite(n)) {
        const op = mapAmountOp(amountCmp[1]);
        children.push(rule('amount', op, n));
        const opLabel = ({ gte: '≥', gt: '>', lte: '≤', lt: '<' })[op] || op;
        const moneyLabel = n >= 1000 && n % 1000 === 0 && n < 1e6
          ? `$${n / 1000}K`
          : `$${n.toLocaleString('en-US')}`;
        notes.push(`amount ${opLabel} ${moneyLabel}`);
      }
    } else if (amountBare) {
      const n = parseMoney(amountBare[1], amountBare[2]);
      if (Number.isFinite(n)) {
        children.push(rule('amount', 'gte', n));
        const moneyLabel = n >= 1000 && n % 1000 === 0 && n < 1e6
          ? `$${n / 1000}K`
          : `$${n.toLocaleString('en-US')}`;
        notes.push(`amount ≥ ${moneyLabel}`);
      }
    }
  }

  // Date: overdue / due this week / upcoming / relative windows / this month / today|tomorrow
  // Day bounds are timezone-aware (org/user TZ) so "tomorrow" matches the staff calendar day.
  let startOfToday;
  let addDays;
  try {
    const { DateTime } = require('luxon');
    const localNow = DateTime.fromJSDate(now, { zone: timeZone });
    const todayStartLocal = localNow.startOf('day');
    startOfToday = todayStartLocal.toUTC().toJSDate();
    addDays = (base, days) => {
      // Interpret `base` as a UTC instant that is a local-midnight anchor, then shift by local days.
      const asLocal = DateTime.fromJSDate(base, { zone: 'utc' }).setZone(timeZone);
      return asLocal.plus({ days }).toUTC().toJSDate();
    };
  } catch (_) {
    startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    addDays = (base, days) => {
      const d = new Date(base.getTime());
      d.setUTCDate(d.getUTCDate() + days);
      return d;
    };
  }

  const dateField = moduleDateField(moduleKey);

  /** Single calendar day: today / tomorrow / yesterday (not multi-day windows). */
  const parseCalendarDayOffset = () => {
    if (/\bday after tomorrow\b/.test(q)) return 2;
    if (/\btomorrow\b/.test(q)) return 1;
    if (/\byesterday\b/.test(q)) return -1;
    if (/\bfor today\b|\btoday'?s\b|\bevents? today\b|\bmeetings? today\b|\bdue today\b|\bscheduled today\b/.test(q)) {
      return 0;
    }
    // Bare "today/tonight" — skip when part of a forward/backward window phrase.
    if (
      /\b(today|tonight)\b/.test(q)
      && !/\b(from today|within|in the next|next \d+|last \d+|past \d+|this week|this month|next week|next month)\b/.test(q)
    ) {
      return 0;
    }
    return null;
  };

  /** "within a week from today" / "in the next 7 days" / "next week" → day count */
  const parseForwardWindowDays = () => {
    if (/\bwithin\s+(?:a|one)\s+week(?:\s+from\s+(?:today|now))?\b/.test(q)) return 7;
    if (/\bwithin\s+(?:a|one)\s+day(?:\s+from\s+(?:today|now))?\b/.test(q)) return 1;
    if (/\bwithin\s+(?:a|one)\s+month(?:\s+from\s+(?:today|now))?\b/.test(q)) return 30;
    const numbered = q.match(/\b(?:within|in)\s+(?:the\s+)?next\s+(\d+)\s+(days?|weeks?|months?)\b/);
    if (numbered) {
      const n = Number(numbered[1]);
      if (!Number.isFinite(n) || n <= 0) return 0;
      const unit = numbered[2];
      if (unit.startsWith('day')) return n;
      if (unit.startsWith('week')) return n * 7;
      if (unit.startsWith('month')) return n * 30;
    }
    if (/\b(?:within|in)\s+(?:the\s+)?next\s+week\b/.test(q) || /\bnext\s+week\b/.test(q)) return 7;
    if (/\b(?:within|in)\s+(?:the\s+)?next\s+day\b/.test(q)) return 1;
    if (/\b(?:within|in)\s+(?:the\s+)?next\s+month\b/.test(q) || /\bnext\s+month\b/.test(q)) return 30;
    if (/\bwithin\s+\d+\s+days?\s+from\s+(?:today|now)\b/.test(q)) {
      const m = q.match(/\bwithin\s+(\d+)\s+days?\s+from\s+(?:today|now)\b/);
      if (m) return Number(m[1]) || 0;
    }
    return 0;
  };

  /** "last 30 days" / "past week" / "in the last 2 weeks" → day count looking backward */
  const parseBackwardWindowDays = () => {
    if (/\b(?:in\s+)?(?:the\s+)?last\s+(?:a\s+)?week\b/.test(q) || /\bpast\s+week\b/.test(q)) return 7;
    if (/\b(?:in\s+)?(?:the\s+)?last\s+(?:a\s+)?month\b/.test(q) || /\bpast\s+month\b/.test(q)) return 30;
    if (/\b(?:in\s+)?(?:the\s+)?last\s+(?:a\s+)?day\b/.test(q) || /\byesterday\b/.test(q)) return 1;
    const numbered = q.match(/\b(?:in\s+)?(?:the\s+)?(?:last|past)\s+(\d+)\s+(days?|weeks?|months?)\b/);
    if (numbered) {
      const n = Number(numbered[1]);
      if (!Number.isFinite(n) || n <= 0) return 0;
      const unit = numbered[2];
      if (unit.startsWith('day')) return n;
      if (unit.startsWith('week')) return n * 7;
      if (unit.startsWith('month')) return n * 30;
    }
    return 0;
  };

  if (/\boverdue\b/.test(q) && (moduleKey === 'tasks' || moduleKey === 'cases' || moduleKey === 'invoices')) {
    const overdueField = dateField || 'dueDate';
    children.push(rule(overdueField, 'lt', startOfToday.toISOString()));
    notes.push(`overdue (${overdueField} before today)`);
  }

  // Stale / at-risk open deals: no activity N days OR past expected close
  if (moduleKey === 'deals' && wantsStaleAtRiskDealAsk(q) && !isWonDealAsk(q) && !isLostDealAsk(q)) {
    const staleDays = parseStaleInactivityDays(q) || 14;
    const cutoff = addDays(startOfToday, -staleDays);
    if (!children.some((c) => c.fieldKey === 'status')) {
      children.push(rule('status', 'is', 'Open'));
    }
    children.push({
      logic: 'OR',
      children: [
        rule('lastActivityDate', 'lt', cutoff.toISOString()),
        rule('expectedCloseDate', 'lt', startOfToday.toISOString()),
      ],
    });
    notes.push(`at-risk open: no activity ${staleDays}d OR past expected close`);
  }

  const calendarDayOffset = dateField ? parseCalendarDayOffset() : null;
  const forwardDays = dateField ? parseForwardWindowDays() : 0;
  const backwardDays = dateField ? parseBackwardWindowDays() : 0;

  // Prefer explicit calendar day (today/tomorrow) over vague windows when both could match.
  if (
    dateField
    && calendarDayOffset !== null
    && forwardDays <= 0
    && !children.some((c) => c.fieldKey === dateField)
  ) {
    const dayStart = addDays(startOfToday, calendarDayOffset);
    const dayEnd = addDays(startOfToday, calendarDayOffset + 1);
    children.push(rule(dateField, 'gte', dayStart.toISOString()));
    children.push(rule(dateField, 'lt', dayEnd.toISOString()));
    const label = calendarDayOffset === 0
      ? 'today'
      : (calendarDayOffset === 1
        ? 'tomorrow'
        : (calendarDayOffset === -1 ? 'yesterday' : `day ${calendarDayOffset}`));
    notes.push(`${label} (${dateField}, ${timeZone})`);
  } else if (dateField && forwardDays > 0 && !children.some((c) => c.fieldKey === dateField)) {
    const end = addDays(startOfToday, forwardDays);
    children.push(rule(dateField, 'gte', startOfToday.toISOString()));
    children.push(rule(dateField, 'lt', end.toISOString()));
    notes.push(`within next ${forwardDays} day${forwardDays === 1 ? '' : 's'} (${dateField})`);
  } else if (
    dateField
    && backwardDays > 0
    && calendarDayOffset === null
    && !children.some((c) => c.fieldKey === dateField)
  ) {
    const start = addDays(startOfToday, -backwardDays);
    children.push(rule(dateField, 'gte', start.toISOString()));
    children.push(rule(dateField, 'lt', addDays(startOfToday, 1).toISOString()));
    notes.push(`last ${backwardDays} day${backwardDays === 1 ? '' : 's'} (${dateField})`);
  } else if (
    /\bdue (this|the) week\b|\bthis week\b/.test(q)
    && dateField
    && (moduleKey === 'tasks' || moduleKey === 'cases' || moduleKey === 'events')
    && !children.some((c) => c.fieldKey === dateField)
  ) {
    const end = addDays(startOfToday, 7);
    children.push(rule(dateField, 'gte', startOfToday.toISOString()));
    children.push(rule(dateField, 'lt', end.toISOString()));
    notes.push(`this week (${dateField})`);
  }

  // "upcoming / coming up / future" → on-or-after today (skip if a window already set)
  if (
    dateField
    && /\b(upcoming|coming up|future)\b/.test(q)
    && !children.some((c) => c.fieldKey === dateField)
  ) {
    children.push(rule(dateField, 'gte', startOfToday.toISOString()));
    notes.push(`upcoming (${dateField} ≥ today)`);
  }

  if (/\b(this month|current month)\b/.test(q) && dateField) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const hasDate = children.some((c) => c.fieldKey === dateField);
    if (!hasDate) {
      children.push(rule(dateField, 'gte', monthStart.toISOString()));
      children.push(rule(dateField, 'lt', monthEnd.toISOString()));
      notes.push(`${dateField} this month`);
    } else if (!children.some((c) => c.fieldKey === dateField && c.operator === 'lt')) {
      children.push(rule(dateField, 'lt', monthEnd.toISOString()));
      notes.push(`${dateField} before month end`);
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

function buildDraftSpec({
  question = '',
  moduleKey = '',
  groupField = '',
  pinSource = null,
  forceType = '',
  timeZone = 'UTC',
} = {}) {
  const mod = resolveReportModuleKey(question, moduleKey, pinSource);
  if (!mod) return null;
  const cfg = getAnalyticsModuleConfig(mod);
  if (!cfg) return null;

  const dealListAsk = wantsDealListNotPipelineChart(question);
  const chartNoGroup = isChartAskWithoutGroup(question, mod)
    || wantsRecordLevelChart(question);
  const explicitGroup = dealListAsk || chartNoGroup
    ? ''
    : (detectExplicitGroupField(question, mod)
      || (groupField ? String(groupField) : '')
      || (pinSource?.groupField ? String(pinSource.groupField) : ''));
  const defaultGroup = dealListAsk || chartNoGroup
    ? ''
    : (explicitGroup || DEFAULT_GROUP[mod] || 'status');
  const layout = detectLayoutOptions(question, mod, defaultGroup);
  let type = layout.type;
  const forced = String(forceType || '').toLowerCase();
  if (forced === 'tabular' || forced === 'summary' || forced === 'matrix') {
    type = forced;
  } else if (dealListAsk || chartNoGroup) {
    // Record-level pie/bar needs row preview, not stage rollup.
    type = 'tabular';
  }
  const group = type === 'tabular' ? '' : (layout.groupField || defaultGroup);
  const template = type === 'tabular' ? null : matchWidgetTemplate(mod, group);
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

  const { filterTree, filterNotes } = detectFilters(question, mod, { timeZone });
  // Ensure filter fields exist in selectedFields so Filters UI can resolve them
  if (filterTree?.children) {
    const pushFilterFields = (nodes) => {
      for (const child of nodes || []) {
        if (child?.fieldKey && !defaults.includes(child.fieldKey)) {
          defaults.push(child.fieldKey);
        }
        if (Array.isArray(child?.children)) pushFilterFields(child.children);
      }
    };
    pushFilterFields(filterTree.children);
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
  if (type === 'tabular') {
    name = filterNotes.length
      ? `${prettyMod} ${filterNotes[0].replace(/^amount\s*/, '')}`
      : `${prettyMod} list`;
  } else if (filterNotes.length) {
    const filterBit = filterNotes[0].replace(/^amount\s*/, '');
    name = group
      ? `${prettyMod} by ${group} (${filterBit})`
      : `${prettyMod} (${filterBit})`;
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
  forceType = '',
  timeZone = '',
} = {}) {
  let tz = String(timeZone || '').trim();
  if (!tz) {
    try {
      const { resolveAstraTimeZone } = require('./aiWorkGraphContextService');
      tz = await resolveAstraTimeZone(organizationId, userId);
    } catch (_) {
      tz = 'UTC';
    }
  }
  const spec = buildDraftSpec({
    question,
    moduleKey,
    pinSource,
    forceType,
    timeZone: tz || 'UTC',
  });
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

const ALLOWED_QUERY_PLAN_OPS = new Set(['is', 'is_not', 'is_any_of', 'gt', 'gte', 'lt', 'lte', 'contains']);
const ALLOWED_CHART_TYPES = new Set(['bar', 'pie', 'line', 'table', 'none']);

/**
 * Casual CRM list / chart / filtered data ask (not explicit Report Builder create).
 */
function isCrmDataAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (isProductHowToAsk(q)) return false;
  if (isAmbiguousCrmAsk(q)) return false;
  if (isCreateWidgetQuestion(q)) return false;
  // Named company / org research is web research — not "organizations by industry"
  try {
    const { isNamedCompanyResearchAsk, looksLikeWebResearchQuestion } = require('./aiWebResearchService');
    if (isNamedCompanyResearchAsk(question) || (looksLikeWebResearchQuestion(question)
      && /\b(organization|organisation|company|crm)\b/i.test(q)
      && !/\b(by\s+industry|list of organizations|all organizations|how many)\b/i.test(q))) {
      return false;
    }
  } catch (_) {
    /* ignore circular load issues in tests */
  }
  // Explicit create/save report stays on Report Builder path
  if (isReportBuilderQuestion(q) && !isVisualGlanceQuestion(q)) {
    // "deals report" is report builder; "list of deals" is data ask
    if (/\b(create|build|make|generate|design|save|draft|new|custom|saved)\b.+\breport\b/.test(q)
      || /\breport builder\b/.test(q)
      || /\b(matrix|metrix|pivot)\b.+\breport\b/.test(q)) {
      return false;
    }
  }
  if (/\b(draft|send|compose|write)\b.+\b(email|mail)\b/.test(q)) return false;
  if (/\b(prepare me|talking points|summarize ['"]).+\b/.test(q) && !/\b(chart|list|table|breakdown)\b/.test(q)) {
    return false;
  }

  if (isThinDataFollowUp(q)) return true;
  if (wantsOwnerLoadAsk(q)) return true;
  if (wantsStaleAtRiskDealAsk(q)) return true;

  const hasModule = Boolean(detectModuleKey(q, ''));
  const hasDataVerb = /\b(list|show|give|get|fetch|how many|count|breakdown|distribution|snapshot|which|who)\b/.test(q);
  const hasVisual = /\b(chart|graph|pie|donut|bar|line|table|plot|visuali)\b/.test(q);
  const hasFilter = /\b(above|over|more than|greater than|below|under|less than|open deals?|closed won|amount|\$|10k|revenue|this week|upcoming|within|next week|last \d+|past week|past month|at[- ]risk|stale|no activity)\b/.test(q);

  if (hasVisual && (hasModule || hasFilter || hasDataVerb)) return true;
  if (hasModule && hasDataVerb) return true;
  if (hasModule && hasFilter && (hasDataVerb || hasVisual || /\blist\b/.test(q))) return true;
  return false;
}

/** Short chart/list follow-ups that inherit filters from the prior CRM data ask. */
function isThinDataFollowUp(question = '') {
  const q = String(question || '').trim();
  if (!q || q.length > 140) return false;
  if (/^(give me |show me |get me )?(the )?same\b/i.test(q)) return true;
  if (/\b(same|that|it|this)\b.+\b(in |as )?(a )?(bar|pie|donut|line|chart|table|graph)\b/i.test(q)) {
    return true;
  }
  if (/^(as |in )?(a )?(bar|pie|donut|line)(\s+chart)?\.?$/i.test(q)) return true;
  if (/^(show|give|get) (me )?(as |in )?(a )?(bar|pie|line|table|chart)/i.test(q)) return true;
  // Sticky status/outcome refinements: "only open ones", "just the closed ones"
  if (/^(only |just )?(the )?(open|closed|won|lost)(\s+ones?)?\.?$/i.test(q)) return true;
  if (/^(only |just )?(open|closed|won|lost)\s+(deals?|ones?|records?)\.?$/i.test(q)) return true;
  return false;
}

/** Normalize arrow / then compounds into multi-line asks for list+filter blending. */
function normalizeDataAskQuestion(question = '') {
  return String(question || '')
    .replace(/\s*(?:->|→)\s*/g, '\n')
    .trim();
}

/**
 * Blend sticky prior CRM data ask into thin follow-ups so filters survive
 * ("deals > 10K" + "same in bar chart" / "only open ones").
 */
function blendDataAskWithHistory(question = '', history = []) {
  const q = normalizeDataAskQuestion(question);
  if (!q) return q;
  const msgs = Array.isArray(history) ? history : [];
  let lastDataAsk = '';
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i];
    if (!m || (m.role !== 'user' && m.role !== 'User')) continue;
    const content = normalizeDataAskQuestion(String(m.content || m.body || ''));
    if (!content || isThinDataFollowUp(content)) continue;
    if (isCrmDataAsk(content) || detectModuleKey(content, '') || /\bamount|deal|task|case|\$\b/i.test(content)) {
      lastDataAsk = content;
      break;
    }
  }
  if (!lastDataAsk) return q;
  if (isThinDataFollowUp(q) || /\b(the )?same\b/i.test(q)) {
    return `${lastDataAsk}\n${q}`;
  }
  return q;
}

function validateQueryPlan(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const moduleKey = detectModuleKey(String(raw.moduleKey || ''), '')
    || (getAnalyticsModuleConfig(raw.moduleKey)
      ? String(raw.moduleKey).toLowerCase()
      : '');
  if (!moduleKey || !getAnalyticsModuleConfig(moduleKey)) return null;

  let reportType = String(raw.reportType || '').toLowerCase();
  if (!['tabular', 'summary', 'matrix'].includes(reportType)) {
    reportType = '';
  }
  let chartType = String(raw.chartType || 'none').toLowerCase();
  if (!ALLOWED_CHART_TYPES.has(chartType)) chartType = 'none';
  let metric = raw.metric === 'amount' ? 'amount' : 'count';

  const rawGroup = raw.groupField;
  const groupNull = rawGroup == null
    || rawGroup === ''
    || String(rawGroup).toLowerCase() === 'null'
    || String(rawGroup).toLowerCase() === 'none';
  let groupField = groupNull
    ? ''
    : resolveGroupFieldAgainstModule(String(rawGroup), moduleKey);
  if (reportType === 'tabular') groupField = '';

  const moduleCfg = getAnalyticsModuleConfig(moduleKey);
  const allowedFieldKeys = new Set([
    ...(Array.isArray(moduleCfg?.defaultFields) ? moduleCfg.defaultFields : []),
    ...listModuleGroupFields(moduleKey).map((f) => f.key),
  ]);

  const filters = [];
  for (const f of Array.isArray(raw.filters) ? raw.filters.slice(0, 8) : []) {
    if (!f || typeof f !== 'object') continue;
    const rawField = String(f.fieldKey || f.field || '').trim();
    const operator = String(f.operator || '').trim().toLowerCase();
    if (!rawField || !ALLOWED_QUERY_PLAN_OPS.has(operator)) continue;
    const resolvedField = allowedFieldKeys.has(rawField)
      ? rawField
      : (resolveGroupFieldAgainstModule(rawField, moduleKey) || '');
    if (!resolvedField || !allowedFieldKeys.has(resolvedField)) continue;
    let value = f.value;
    if (value == null || value === '') continue;
    if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      value = n;
    } else if (operator === 'is_any_of') {
      value = Array.isArray(value)
        ? value.map((v) => String(v).slice(0, 120)).filter(Boolean).slice(0, 12)
        : [String(value).slice(0, 120)];
      if (!value.length) continue;
    } else {
      value = String(value).slice(0, 120);
    }
    filters.push({ fieldKey: resolvedField.slice(0, 60), operator, value });
  }

  const wantList = raw.wantList === true
    || raw.wantList === 'true'
    || reportType === 'tabular'
    || (Array.isArray(raw.outputs) && raw.outputs.some((o) => String(o?.kind || '').toLowerCase() === 'table'));
  const wantChart = raw.wantChart === true
    || raw.wantChart === 'true'
    || (chartType !== 'none' && chartType !== 'table')
    || (Array.isArray(raw.outputs) && raw.outputs.some((o) => String(o?.kind || '').toLowerCase() === 'chart'));

  let chartSliceBy = String(raw.chartSliceBy || '').toLowerCase();
  if (chartSliceBy !== 'record' && chartSliceBy !== 'field') {
    // Never invent stage: list+chart or chart without explicit group → record slices
    chartSliceBy = (wantChart && !groupField) ? 'record' : (groupField ? 'field' : 'record');
  }
  if (chartSliceBy === 'record') groupField = '';

  if (!reportType) {
    reportType = wantList && !wantChart
      ? 'tabular'
      : (wantChart && chartSliceBy === 'field' ? 'summary' : 'tabular');
  }

  return {
    moduleKey,
    reportType,
    groupField,
    chartType: wantChart ? (chartType === 'none' ? 'bar' : chartType) : 'none',
    metric: metric === 'count' && moduleKey === 'deals' && chartSliceBy === 'record'
      ? 'amount'
      : metric,
    filters,
    headlineHint: String(raw.headlineHint || '').trim().slice(0, 120),
    understanding: String(raw.understanding || '').trim().slice(0, 280),
    wantList: Boolean(wantList || (!wantChart && reportType === 'tabular')),
    wantChart: Boolean(wantChart),
    chartSliceBy,
  };
}

/**
 * Guard: composed visuals must match IntentSpec (no silent stage pie when plan says records).
 * Returns corrected visuals when a mismatch is detected.
 */
function verifyComposeMatchesIntent(plan, visuals = [], listPreview = null) {
  if (!plan || !Array.isArray(visuals)) return visuals;
  const out = visuals.slice();
  const hasTable = out.some((v) => v?.component === 'data_table');
  const chartIdx = out.findIndex((v) => v?.component === 'chart');

  if (plan.wantList && !hasTable && listPreview) {
    const tables = buildVisualsFromReportPreview(
      listPreview,
      { primaryModule: plan.moduleKey, name: plan.headlineHint || 'Matching records', type: 'tabular' },
      'table',
      { forceTable: true },
    );
    if (tables.length) out.unshift(...tables);
  }

  if (plan.wantChart && plan.chartSliceBy === 'record' && listPreview) {
    const stageLike = new Set(['new', 'qualification', 'proposal', 'negotiation', 'contract sent', 'closed won', 'closed lost', 'open', 'completed']);
    const chart = chartIdx >= 0 ? out[chartIdx] : null;
    const labels = (chart?.points || []).map((p) => String(p.label || '').toLowerCase());
    const looksLikeStageRollup = labels.length > 0
      && labels.filter((l) => stageLike.has(l)).length >= Math.ceil(labels.length * 0.5);
    if (!chart || looksLikeStageRollup || chart.pinSource?.recordLevel !== true) {
      const fixed = buildRecordLevelChartVisual(listPreview, {
        primaryModule: plan.moduleKey,
        chartHint: plan.chartType === 'none' ? 'pie' : plan.chartType,
        name: plan.headlineHint || `${plan.moduleKey} · ${plan.chartType || 'chart'}`,
        metric: plan.metric,
      });
      if (fixed[0]) {
        fixed[0].pinSource = {
          moduleKey: plan.moduleKey,
          groupField: '',
          metric: plan.metric,
          reportType: 'tabular',
          recordLevel: true,
          question: plan.headlineHint || '',
        };
        if (chartIdx >= 0) out[chartIdx] = fixed[0];
        else out.push(fixed[0]);
      }
    }
  }
  return out;
}

/** Turn a validated QueryPlan into a draft-ready question + pinSource overrides. */
function queryPlanToDraftInput(plan, blendedQuestion = '') {
  if (!plan) return { question: blendedQuestion, pinSource: null };
  // Prefer the user's blended NL for filter parsing — appending "status is Open amount above…"
  // used to create a second bogus status filter. Keep intent hints on separate lines.
  const hints = [];
  hints.push(`module ${plan.moduleKey}`);
  if (plan.wantList || plan.reportType === 'tabular' || plan.chartType === 'table' || plan.chartSliceBy === 'record') {
    hints.push('list of records tabular');
  } else if (plan.groupField) {
    hints.push(`group by ${plan.groupField}`);
    hints.push('summary breakdown');
  }
  if (plan.chartType === 'bar') hints.push('as a bar chart');
  else if (plan.chartType === 'pie') hints.push('as a pie chart');
  else if (plan.chartType === 'line') hints.push('as a line chart');
  else if (plan.chartType === 'table') hints.push('as a table');

  for (const f of plan.filters || []) {
    if (f.fieldKey === 'amount' && ['gt', 'gte'].includes(f.operator)) {
      hints.push(`amount ${f.operator === 'gte' ? 'above' : 'greater than'} ${f.value}`);
    } else if (['gte', 'gt', 'lte', 'lt'].includes(f.operator) && f.value != null) {
      // Preserve date windows from the plan (today/tomorrow overlays).
      hints.push(`${f.fieldKey} ${f.operator} ${f.value}`);
    } else if (f.operator === 'contains' && f.value != null && String(f.value).trim()) {
      // Keep named-record filters even if base NL lost its quotes.
      hints.push(`${f.fieldKey} contains "${String(f.value).trim()}"`);
    } else if (f.operator === 'is') {
      // One filter per line so statusEq cannot swallow trailing amount text.
      hints.push(`${f.fieldKey} is ${f.value}`);
    } else if (f.operator === 'is_not') {
      hints.push(`${f.fieldKey} is not ${f.value}`);
    } else if (f.operator === 'is_any_of' && Array.isArray(f.value)) {
      hints.push(`${f.fieldKey} in ${f.value.join('|')}`);
    }
  }
  if (plan.metric === 'amount') hints.push('by amount revenue');

  const base = String(blendedQuestion || '').trim();
  return {
    question: [base, ...hints].filter(Boolean).join('\n'),
    pinSource: {
      moduleKey: plan.moduleKey,
      groupField: plan.groupField || '',
      metric: plan.metric,
      reportType: plan.chartSliceBy === 'record' ? 'tabular' : plan.reportType,
      recordLevel: plan.chartSliceBy === 'record',
      question: String(blendedQuestion || '').slice(0, 240),
    },
    headlineHint: plan.headlineHint || '',
  };
}

/**
 * Ask the LLM for an allowlisted QueryPlan. Returns { plan, usage }.
 */
async function proposeQueryPlanWithLlm({
  question = '',
  config = null,
  redactOpts = {},
  catalogText = '',
} = {}) {
  const empty = { plan: null, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
  if (!config?.apiKey || !config?.provider || !config?.model) return empty;
  try {
    const { getLlmAdapter } = require('./providerRegistry');
    const { redactMessages } = require('./piiRedaction');
    const { parseJsonObject } = require('./aiMarketingService');
    const { getPrompt } = require('./prompts/promptRegistry');
    const adapter = getLlmAdapter(config.provider);
    if (!adapter?.complete) return empty;

    const plannerPrompt = getPrompt('astra_planner_v2');
    const system = [
      plannerPrompt.text
        || 'You are Astra\'s CRM data planner. Return JSON only.',
      catalogText
        ? `\nLIVE MODULE FIELD CATALOG (prefer these fieldKeys):\n${String(catalogText).slice(0, 3500)}`
        : '',
    ].filter(Boolean).join('\n');

    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: system },
        { role: 'user', content: String(question || '').slice(0, 2000) },
      ], redactOpts),
      temperature: 0,
      maxTokens: 800,
      providerOptions: config.providerOptions,
    });
    const u = completion?.usage || {};
    const usage = {
      promptTokens: Number(u.promptTokens || u.prompt_tokens || 0),
      completionTokens: Number(u.completionTokens || u.completion_tokens || 0),
      totalTokens: 0,
    };
    usage.totalTokens = Number(u.totalTokens || u.total_tokens
      || (usage.promptTokens + usage.completionTokens));
    const text = String(completion?.text || completion?.content || '');
    const parsed = parseJsonObject(text);
    return { plan: validateQueryPlan(parsed), usage };
  } catch {
    return empty;
  }
}

/** True when LLM returned a usable QueryPlan (module + shape). */
function isValidLlmQueryPlan(plan) {
  return Boolean(plan && typeof plan === 'object' && plan.moduleKey);
}

function planHasNameContains(plan, name) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle) return false;
  return (Array.isArray(plan?.filters) ? plan.filters : []).some((f) => {
    if (!f || !['name', 'title', 'eventName', 'first_name'].includes(String(f.fieldKey || ''))) {
      return false;
    }
    if (String(f.operator || '') !== 'contains') return false;
    return String(f.value || '').trim().toLowerCase().includes(needle);
  });
}

/**
 * Thin named-record fallback when LLM omitted contains filter.
 * Full heuristic overlays run only when llmPlanOk is false.
 */
function applyNamedRecordPlanFallback(plan, blended) {
  const namedRecord = extractQuotedRecordName(blended);
  if (!namedRecord || planHasNameContains(plan, namedRecord)) return plan;
  const mod = plan?.moduleKey || detectModuleKey(blended, '') || 'deals';
  const nameField = nameFieldForModule(mod);
  const priorFilters = Array.isArray(plan?.filters)
    ? plan.filters.filter((f) => f?.fieldKey !== nameField
      && f?.fieldKey !== 'name'
      && f?.fieldKey !== 'title'
      && f?.fieldKey !== 'eventName'
      && f?.fieldKey !== 'status'
      && f?.fieldKey !== 'stage')
    : [];
  return {
    ...(plan || {}),
    moduleKey: mod,
    wantList: true,
    wantChart: false,
    chartType: 'none',
    chartSliceBy: 'record',
    groupField: '',
    reportType: 'tabular',
    headlineHint: namedRecord,
    understanding: plan?.understanding
      || `Summarize the single ${mod.replace(/_/g, ' ')} named "${namedRecord}" and the next action.`,
    filters: [
      ...priorFilters,
      { fieldKey: nameField, operator: 'contains', value: namedRecord },
    ],
  };
}

/** Legacy regex plan overlays — only when LLM plan is missing/invalid. */
function applyHeuristicPlanOverlays(plan, blended) {
  let next = plan;

  try {
    const { applyOverlayToQueryPlan } = require('./astra/planner/preciseIntentPlanner');
    next = applyOverlayToQueryPlan(next, blended);
  } catch (_) { /* non-fatal */ }

  next = applyNamedRecordPlanFallback(next, blended);

  if (wantsRecordLevelChart(blended) || isChartAskWithoutGroup(blended, next?.moduleKey || detectModuleKey(blended, '') || 'deals')) {
    next = {
      ...(next || {}),
      moduleKey: next?.moduleKey || detectModuleKey(blended, '') || 'deals',
      chartSliceBy: 'record',
      groupField: '',
      wantChart: true,
      reportType: next?.reportType === 'matrix' ? 'matrix' : 'tabular',
    };
  }

  if (wantsListOnlyAsk(blended)) {
    next = {
      ...(next || {}),
      moduleKey: next?.moduleKey || detectModuleKey(blended, '') || '',
      wantList: true,
      wantChart: false,
      chartType: 'none',
      chartSliceBy: 'record',
      groupField: '',
      reportType: 'tabular',
      headlineHint: next?.headlineHint || '',
    };
  }

  if (wantsOwnerLoadAsk(blended)) {
    const mod = next?.moduleKey
      || detectModuleKey(blended, '')
      || (/\btasks?\b/i.test(blended) ? 'tasks' : 'events');
    next = {
      ...(next || {}),
      moduleKey: mod,
      wantList: true,
      wantChart: false,
      chartType: 'none',
      chartSliceBy: 'record',
      groupField: '',
      reportType: 'tabular',
      headlineHint: next?.headlineHint || 'Owners by load',
      understanding: next?.understanding
        || 'List matching records then rank owners by how many they own.',
    };
  }

  if (wantsStaleAtRiskDealAsk(blended) && !extractQuotedRecordName(blended)) {
    next = {
      ...(next || {}),
      moduleKey: 'deals',
      wantList: true,
      wantChart: false,
      chartType: 'none',
      chartSliceBy: 'record',
      groupField: '',
      reportType: 'tabular',
      metric: 'amount',
      headlineHint: next?.headlineHint || 'At-risk open deals',
      understanding: next?.understanding
        || 'Open deals with no recent activity or past expected close — then rank owner exposure.',
      filters: Array.isArray(next?.filters)
        ? next.filters.filter((f) => !['status', 'stage'].includes(f?.fieldKey))
        : [],
    };
  }

  if (wantsDealListNotPipelineChart(blended) && !isWonDealAsk(blended) && !isLostDealAsk(blended)
    && !wantsStaleAtRiskDealAsk(blended)
    && !extractQuotedRecordName(blended)) {
    const likely = isLikelyToCloseAsk(blended);
    next = {
      ...(next || {}),
      moduleKey: next?.moduleKey || detectModuleKey(blended, '') || 'deals',
      understanding: next?.understanding
        || (likely
          ? 'List open deals in late stages that are most likely to close soon.'
          : 'List deals in closing stages and explain how to move them to Closed Won.'),
      wantList: true,
      wantChart: false,
      chartType: 'none',
      chartSliceBy: 'record',
      groupField: '',
      reportType: 'tabular',
      metric: next?.metric || 'amount',
      filters: Array.isArray(next?.filters)
        ? next.filters.filter((f) => !['status', 'stage'].includes(f?.fieldKey))
        : [],
      headlineHint: likely ? 'Likely to close (open, late-stage)' : (next?.headlineHint || 'Deals in closing stages'),
    };
  }

  if (isWonDealAsk(blended)) {
    next = {
      ...(next || {}),
      moduleKey: next?.moduleKey || detectModuleKey(blended, '') || 'deals',
      wantList: true,
      wantChart: false,
      chartType: 'none',
      chartSliceBy: 'record',
      groupField: '',
      reportType: 'tabular',
      metric: next?.metric || 'amount',
      filters: Array.isArray(next?.filters)
        ? next.filters.filter((f) => f?.fieldKey !== 'stage' && f?.fieldKey !== 'status')
        : [],
      headlineHint: 'Won deals',
      understanding: next?.understanding || 'List deals with Won outcome (status Won or stage Closed Won/Won)',
    };
  } else if (isLostDealAsk(blended)) {
    next = {
      ...(next || {}),
      moduleKey: next?.moduleKey || detectModuleKey(blended, '') || 'deals',
      wantList: true,
      wantChart: false,
      chartType: 'none',
      chartSliceBy: 'record',
      groupField: '',
      reportType: 'tabular',
      metric: next?.metric || 'amount',
      filters: Array.isArray(next?.filters)
        ? next.filters.filter((f) => f?.fieldKey !== 'stage' && f?.fieldKey !== 'status')
        : [],
      headlineHint: 'Lost deals',
      understanding: next?.understanding || 'List deals with Lost outcome (status Lost or stage Closed Lost/Lost)',
    };
  }

  return next;
}

/**
 * Attach grounded LLM prose (+ optional nextAction).
 * Suggested actions must stay relevant to this CRM answer — never org-wide overdue inbox.
 */
async function finalizeCrmDataAskResult(payload, ctx = {}) {
  const {
    applyCrmGroundedSynthesis,
    mergeUsage,
    emptyUsage,
  } = require('./aiAstraCrmAnswerService');

  let structured = payload.structured;
  let usage = mergeUsage(ctx.usage || emptyUsage(), emptyUsage());
  let crmSynthesis = false;
  let answerPromptVersion = '';
  let hasLlmNextAction = false;

  try {
    const applied = await applyCrmGroundedSynthesis(structured, {
      question: ctx.question || payload.blendedQuestion || '',
      plan: payload.plan,
      preview: payload.preview,
      moduleKey: payload.spec?.primaryModule || payload.plan?.moduleKey || '',
      config: ctx.config,
      redactOpts: ctx.redactOpts || {},
      recentTurns: ctx.recentTurns || '',
    });
    structured = applied.structured;
    usage = mergeUsage(usage, applied.usage);
    crmSynthesis = Boolean(applied.crmSynthesis);
    answerPromptVersion = applied.promptVersion || '';
    hasLlmNextAction = Boolean(applied.hasLlmNextAction);
  } catch (_) { /* non-fatal */ }

  if (!hasLlmNextAction) {
    try {
      const {
        citationActionsFromPreview,
        mergeNbaIntoStructuredActions,
      } = require('./aiAstraNextBestActionService');
      const question = ctx.question || payload.blendedQuestion || '';
      const named = extractQuotedRecordName(question);
      const mod = payload.spec?.primaryModule || payload.plan?.moduleKey || '';
      const wantChart = payload.plan?.wantChart === true
        || /\b(pie|bar|donut|line)\s*charts?\b/i.test(question)
        || /\bgroup by\b/i.test(question);

      // Chart / group-by answers: keep pin/report actions only — no random overdue tasks.
      // Named or small list: at most one review_record from the preview rows.
      let grounded = [];
      if (!wantChart) {
        grounded = citationActionsFromPreview(payload.preview, mod)
          .slice(0, named ? 1 : 2);
      }
      if (grounded.length) {
        structured.actions = mergeNbaIntoStructuredActions(
          structured.actions,
          grounded,
          { max: named ? 2 : 3 },
        );
        structured.nbaMode = true;
      }
    } catch (_) { /* non-fatal */ }
  }

  return {
    ...payload,
    structured,
    usage,
    crmSynthesis,
    promptVersions: {
      planner: 'astra_planner_v2',
      answer: answerPromptVersion || null,
    },
  };
}

function attachPinSourceToVisuals(visuals = [], pinSource = null, question = '') {
  if (!Array.isArray(visuals) || !visuals.length) return visuals;
  const pin = pinSource && pinSource.moduleKey
    ? {
      moduleKey: String(pinSource.moduleKey).slice(0, 40),
      groupField: String(pinSource.groupField || '').slice(0, 40),
      metric: pinSource.metric === 'amount' ? 'amount' : 'count',
      ...(pinSource.reportType ? { reportType: String(pinSource.reportType).slice(0, 20) } : {}),
      ...(pinSource.recordLevel === true ? { recordLevel: true } : {}),
      ...(question || pinSource.question
        ? { question: String(question || pinSource.question).slice(0, 240) }
        : {}),
    }
    : null;
  if (!pin) return visuals;
  return visuals.map((v) => (v && typeof v === 'object' ? { ...v, pinSource: pin } : v));
}

/** Run analytics preview from a draft spec without creating a saved report. */
async function previewReportSpec({
  organizationId,
  userId,
  user = null,
  spec = null,
  appKey = '',
  orgContext = null,
  rowLimit = 50,
} = {}) {
  if (!spec?.primaryModule) return { error: 'Missing report spec' };
  let previewUser = user && (user.permissions || user._permissionRuntime || user.role || user.isOwner)
    ? user
    : null;
  if (!previewUser && userId) {
    previewUser = await User.findOne({ _id: userId, organizationId }).lean();
  }
  if (!previewUser) {
    previewUser = user || { _id: userId, organizationId };
  }
  const moduleCfg = getAnalyticsModuleConfig(spec.primaryModule);
  try {
    const result = await executeAnalyticsReport({
      organizationId,
      name: spec.name,
      type: spec.type,
      primaryModule: spec.primaryModule,
      relatedModules: spec.relatedModules || [],
      selectedFields: spec.selectedFields,
      rowGroups: spec.rowGroups,
      columnGroups: spec.columnGroups?.length ? spec.columnGroups : null,
      aggregations: spec.aggregations,
      sorting: spec.sorting,
      filterLogic: spec.filterLogic || 'AND',
      filterTree: spec.filterTree || null,
      calculatedFields: spec.calculatedFields?.length ? spec.calculatedFields : null,
      showGrandTotal: spec.showGrandTotal,
      showSubTotals: spec.showSubTotals,
      showRecordCount: Boolean(spec.showRecordCount),
      drillDownEnabled: spec.drillDownEnabled !== false,
    }, {
      user: previewUser,
      organizationId,
      orgContext: orgContext || previewUser?._orgPermissionContext || undefined,
      appKey: appKey || moduleCfg?.appKey || undefined,
      preview: true,
      rowLimit,
    });
    return { result };
  } catch (err) {
    return { error: String(err?.message || 'Preview failed') };
  }
}

/** Build coaching copy from late-stage deal rows (no invented CRM facts). */
function buildDealClosureCoaching(preview = {}, question = '') {
  const rows = preview?.result?.rows || preview?.rows || [];
  const list = Array.isArray(rows) ? rows.slice(0, 12) : [];
  const bullets = [];
  const now = Date.now();

  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const name = String(row.name || row.title || row.item_name || 'Deal').trim();
    const stage = String(row.stage || row.status || '').trim();
    const amount = typeof row.amount === 'number'
      ? row.amount
      : (Number(row.amount) || null);
    const closeRaw = row.expectedCloseDate || row.expected_close_date || row.closeDate || '';
    const closeDt = closeRaw ? new Date(closeRaw) : null;
    const overdue = closeDt && !Number.isNaN(closeDt.getTime()) && closeDt.getTime() < now;
    const amountBit = amount != null ? ` · $${Math.round(amount).toLocaleString('en-US')}` : '';
    const stageBit = stage ? ` · ${stage}` : '';
    const overdueBit = overdue ? ' · expected close date is past' : '';
    bullets.push(`${name}${stageBit}${amountBit}${overdueBit}`);
  }

  const expedite = [];
  if (list.some((r) => /contract sent/i.test(String(r?.stage || '')))) {
    expedite.push('Contract Sent: confirm signer, send a short reminder, and offer a live walkthrough of remaining terms.');
  }
  if (list.some((r) => /negotiat/i.test(String(r?.stage || '')))) {
    expedite.push('Negotiation: lock commercial terms in writing, escalate pricing blockers, and set a firm decision date.');
  }
  if (list.some((r) => /proposal/i.test(String(r?.stage || '')))) {
    expedite.push('Proposal: book a proposal review, address objections, and move to Contract Sent the same week.');
  }
  if (list.some((r) => {
    const d = r?.expectedCloseDate || r?.expected_close_date;
    return d && new Date(d).getTime() < now;
  })) {
    expedite.push('Past expected close date: re-qualify urgency, refresh the close date with the buyer, or mark Closed Lost if dead.');
  }
  if (!expedite.length && list.length) {
    expedite.push('Owner follow-up today: next meeting, decision-maker confirmation, and a written close plan with a date.');
  }
  if (!list.length) {
    expedite.push('No deals currently in Negotiation / Proposal / Contract Sent — check Qualification for candidates to advance.');
  }

  const headline = list.length
    ? `${list.length} deal${list.length === 1 ? '' : 's'} in closing stages`
    : 'No deals in closing stages';

  return {
    headline,
    bullets: [
      ...bullets.slice(0, 8),
      ...expedite.slice(0, 4).map((t) => `Next: ${t}`),
    ].slice(0, 12),
    detail: isCrmDiagnosticAsk(question)
      ? 'These are open deals in late stages (not Closed Won/Lost). Reasons use stage + expected close date from CRM — confirm blockers with the owner.'
      : '',
  };
}

/**
 * Belt-and-suspenders: drop preview rows that contradict an explicit won/lost ask,
 * or that are already closed when the ask is "likely to close".
 */
function enforceDealOutcomePreview(preview, question = '') {
  if (!preview) return preview;
  const rows = preview?.result?.rows || preview?.rows;
  if (!Array.isArray(rows) || !rows.length) return preview;

  let filtered = rows;
  if (isWonDealAsk(question)) {
    filtered = rows.filter(isWonStageOrStatus);
  } else if (isLostDealAsk(question)) {
    filtered = rows.filter(isLostStageOrStatus);
  } else if (isLikelyToCloseAsk(question) || wantsDealListNotPipelineChart(question)) {
    filtered = rows.filter(isOpenLateStageRow);
  } else {
    return preview;
  }

  if (filtered.length === rows.length) return preview;

  const next = { ...preview };
  if (preview.result && typeof preview.result === 'object') {
    next.result = { ...preview.result, rows: filtered };
  } else {
    next.rows = filtered;
  }
  return next;
}

/**
 * Drop preview rows outside NL/plan date windows (belt-and-suspenders after verify).
 */
function enforceDateWindowPreview(preview, question = '', plan = null) {
  if (!preview) return preview;
  const rows = preview?.result?.rows || preview?.rows;
  if (!Array.isArray(rows) || !rows.length) return preview;

  let bounds = [];
  try {
    const { dateBoundsFromPlanOrQuestion } = require('./astra/planner/verifyAndReplan');
    bounds = dateBoundsFromPlanOrQuestion(plan, question);
  } catch (_) {
    return preview;
  }
  if (!bounds.length) return preview;

  const filtered = rows.filter((row) => {
    for (const bound of bounds) {
      const raw = row?.[bound.fieldKey];
      if (raw == null || raw === '') return false;
      const t = new Date(raw).getTime();
      if (!Number.isFinite(t)) return false;
      if (bound.gte != null && t < new Date(bound.gte).getTime()) return false;
      if (bound.gt != null && t <= new Date(bound.gt).getTime()) return false;
      if (bound.lte != null && t > new Date(bound.lte).getTime()) return false;
      if (bound.lt != null && t >= new Date(bound.lt).getTime()) return false;
    }
    return true;
  });

  if (filtered.length === rows.length) return preview;
  const next = { ...preview };
  if (preview.result && typeof preview.result === 'object') {
    next.result = { ...preview.result, rows: filtered };
  } else {
    next.rows = filtered;
  }
  return next;
}

/**
 * "Who is overloaded / busiest with events this week?" — aggregate assignedTo from list rows.
 */
function wantsOwnerLoadAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (/\b(overloaded|busiest|most (events|meetings|tasks)|who( is|'s) (busiest|overloaded))\b/.test(q)) {
    return true;
  }
  return /\b(who|which)\b.+\b(owner|assignee|assigned)\b.+\b(most|many|events|meetings|tasks)\b/.test(q);
}

function composeOwnerLoadVisuals(preview, options = {}) {
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];

  const counts = new Map();
  for (const row of rows) {
    const owner = String(
      row.assignedTo
      || row.assigned_to
      || row.owner
      || row.ASSIGNEDTO
      || '(unassigned)',
    ).trim() || '(unassigned)';
    counts.set(owner, (counts.get(owner) || 0) + 1);
  }
  const ranked = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 24);

  if (!ranked.length) return [];

  const title = options.title || 'Owners by load';
  const table = {
    id: 'astra_owner_load_table',
    component: 'data_table',
    title,
    columns: ['owner', 'count'],
    rows: ranked.map((r) => [r.label, String(r.value)]),
  };
  const chart = {
    id: 'astra_owner_load_bar',
    component: 'chart',
    chartType: 'bar',
    title,
    metricLabel: 'count',
    points: ranked,
  };
  return options.chartOnly ? [chart] : [table, chart];
}

/** "stale / at-risk / no activity" open deals — CRM list + risk compose. */
function parseStaleInactivityDays(question = '') {
  const q = String(question || '').toLowerCase();
  const m = q.match(/\b(?:no activity|inactive|stale|without activity|without follow[ -]?ups?).{0,28}?(?:in|for|over|last)\s+(\d+)\s+days?\b/)
    || q.match(/\b(\d+)\s+days?\s+(?:with\s+)?(?:no activity|inactive|stale)\b/)
    || q.match(/\blast\s+(\d+)\s+days?\b.{0,40}\b(?:no activity|inactive|stale)\b/);
  if (m && Number.isFinite(Number(m[1]))) return Number(m[1]);
  return 0;
}

function wantsStaleAtRiskDealAsk(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  // Account portfolio health stays on CustomerHealthAnalysis pipeline
  if (/\baccounts?\b/.test(q) && /\bat[- ]risk\b/.test(q) && !/\bdeals?\b/.test(q)) return false;
  const riskSignal = /\b(at[- ]risk|stale|no activity|inactive|dormant)\b/.test(q)
    || /\bdeals?\b.{0,40}\b(stuck|stalled)\b/.test(q)
    || /\b(stuck|stalled)\b.{0,40}\bdeals?\b/.test(q);
  if (!riskSignal) return false;
  return /\bdeals?\b/.test(q) || /\bpipeline\b/.test(q) || !/\b(events?|tasks?|cases?|quotes?)\b/.test(q);
}

/**
 * Multi-hop hop-2 for at-risk deals: deal list + owner $ exposure from retrieved rows only.
 */
function composeAtRiskDealVisuals(preview, options = {}) {
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];

  const dealTable = {
    id: 'astra_at_risk_deals_table',
    component: 'data_table',
    title: options.listTitle || 'At-risk open deals',
    columns: ['name', 'amount', 'stage', 'assignedTo', 'lastActivityDate', 'expectedCloseDate'],
    rows: rows.slice(0, 40).map((r) => [
      String(r.name || r.NAME || ''),
      r.amount != null ? String(r.amount) : '',
      String(r.stage || ''),
      String(r.assignedTo || r.assigned_to || ''),
      r.lastActivityDate ? String(r.lastActivityDate) : '',
      r.expectedCloseDate ? String(r.expectedCloseDate) : '',
    ]),
  };

  const byOwner = new Map();
  for (const row of rows) {
    const owner = String(row.assignedTo || row.assigned_to || '(unassigned)').trim() || '(unassigned)';
    const amt = Number(row.amount);
    const prev = byOwner.get(owner) || { count: 0, amount: 0 };
    prev.count += 1;
    prev.amount += Number.isFinite(amt) ? amt : 0;
    byOwner.set(owner, prev);
  }
  const ranked = [...byOwner.entries()]
    .map(([label, v]) => ({ label, value: Math.round(v.amount), count: v.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 16);

  const ownerTable = {
    id: 'astra_at_risk_owner_table',
    component: 'data_table',
    title: options.ownerTitle || 'At-risk $ by owner',
    columns: ['owner', 'deals', 'amount'],
    rows: ranked.map((r) => [r.label, String(r.count), String(r.value)]),
  };
  const ownerChart = {
    id: 'astra_at_risk_owner_bar',
    component: 'chart',
    chartType: 'bar',
    title: options.ownerTitle || 'At-risk $ by owner',
    metricLabel: 'amount',
    points: ranked.map(({ label, value }) => ({ label, value })),
  };

  return [dealTable, ownerTable, ownerChart];
}

const DEAL_STAGE_ALIASES = Object.freeze({
  new: 'New',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  'contract sent': 'Contract Sent',
  'closed won': 'Closed Won',
  'closed lost': 'Closed Lost',
  won: 'Closed Won',
  lost: 'Closed Lost',
});

function normalizeDealStageLabel(raw = '') {
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return '';
  if (DEAL_STAGE_ALIASES[s]) return DEAL_STAGE_ALIASES[s];
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Detect propose-only CRM write intent from NL (never auto-executes).
 * @returns {{ stage?: string, assignee?: string, status?: string }|null}
 */
function detectCrmWriteProposal(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return null;
  if (!/\b(set|move|change|update|reassign|assign|mark)\b/.test(q)) return null;

  const out = {};
  const stageTo = q.match(
    /\b(?:set|move|change|update)\b.{0,48}\bstage\b.{0,24}\b(?:to|=)\s*["']?(new|qualification|proposal|negotiation|contract sent|closed won|closed lost|won|lost)["']?/,
  ) || q.match(
    /\b(?:move|set)\b.{0,40}\b(?:to|into)\s+(negotiation|proposal|qualification|contract sent|new|closed won|closed lost)\b/,
  );
  if (stageTo?.[1]) {
    out.stage = normalizeDealStageLabel(stageTo[1]);
  }

  const statusTo = q.match(/\b(?:set|mark|change|update)\b.{0,40}\bstatus\b.{0,20}\b(?:to|=)\s*["']?(open|won|lost)["']?/);
  if (statusTo?.[1]) {
    out.status = statusTo[1].replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const assignTo = q.match(/\b(?:re)?assign(?:ed)?\b.{0,40}\b(?:to|=)\s+["']?([a-z0-9][a-z0-9 ._-]{1,60})["']?/)
    || q.match(/\bassign\s+to\s+["']?([a-z0-9][a-z0-9 ._-]{1,60})["']?/);
  if (assignTo?.[1] && !/^(the|a|an|stage|status|deal|me|them)$/i.test(assignTo[1])) {
    out.assignee = String(assignTo[1]).trim();
  }

  if (!out.stage && !out.status && !out.assignee) return null;
  return out;
}

/**
 * Build propose→confirm update_record actions from preview rows (executeNow:false).
 * Resolves assignee names to user ids when organizationId is provided.
 */
async function buildProposeConfirmWriteActions({
  question = '',
  preview = null,
  moduleKey = 'deals',
  limit = 3,
  organizationId = '',
  defaultStage = '',
} = {}) {
  let proposal = detectCrmWriteProposal(question);
  if (!proposal && defaultStage) {
    proposal = { stage: normalizeDealStageLabel(defaultStage) };
  }
  if (!proposal) return [];
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];

  if (proposal.assignee && organizationId) {
    try {
      const { resolveOrgUserByName } = require('./aiAstraMutationService');
      const uid = await resolveOrgUserByName(organizationId, proposal.assignee);
      if (uid) proposal = { ...proposal, assignee: uid, assigneeLabel: proposal.assignee };
    } catch (_) { /* keep name; mutation may still resolve */ }
  }

  const mod = String(moduleKey || 'deals').toLowerCase();
  const actions = [];
  for (const row of rows.slice(0, Math.max(1, limit))) {
    const recordId = String(row._id || row.id || row.recordId || '').trim();
    if (!recordId) continue;
    const name = String(row.name || row.eventName || row.title || recordId).trim();
    const fields = {};
    const bits = [];
    if (proposal.stage && mod === 'deals') {
      fields.stage = proposal.stage;
      bits.push(`stage → ${proposal.stage}`);
    }
    if (proposal.status && (mod === 'deals' || mod === 'tasks' || mod === 'cases' || mod === 'quotes')) {
      fields.status = proposal.status;
      bits.push(`status → ${proposal.status}`);
    }
    if (proposal.assignee) {
      fields.assignedTo = proposal.assignee;
      bits.push(`assign → ${proposal.assigneeLabel || proposal.assignee}`);
    }
    if (!Object.keys(fields).length) continue;
    actions.push({
      label: `Confirm: update ${name.length > 40 ? `${name.slice(0, 37)}…` : name}`,
      kind: 'update_record',
      moduleKey: mod,
      recordId,
      fields,
      executeNow: false,
      priority: 'high',
      rationale: `Propose only — ${bits.join(', ')}. Confirm to apply.`,
    });
  }
  return actions;
}

/**
 * Soft review actions for at-risk deals when no write verb (still propose→human).
 */
function buildAtRiskReviewActions(preview = null, limit = 3) {
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.slice(0, limit).map((row) => {
    const recordId = String(row._id || row.id || row.recordId || '').trim();
    const name = String(row.name || recordId).trim();
    if (!recordId) return null;
    return {
      label: `Review ${name.length > 42 ? `${name.slice(0, 39)}…` : name}`,
      kind: 'review_record',
      moduleKey: 'deals',
      recordId,
      executeNow: false,
      priority: 'medium',
      rationale: 'Open this at-risk deal to follow up',
    };
  }).filter(Boolean);
}

/** Close-the-loop phrasing: propose stage + follow-up tasks from retrieved deals. */
function wantsCloseTheLoopAsk(question = '') {
  const q = String(question || '').toLowerCase();
  if (!q) return false;
  if (/\b(close the loop|propose next|next steps?|follow[- ]?up tasks?)\b/.test(q)) return true;
  return wantsStaleAtRiskDealAsk(q) && Boolean(detectCrmWriteProposal(q));
}

/**
 * Propose create_record follow-up tasks linked to deals (executeNow:false).
 */
function buildFollowUpTaskActions({
  preview = null,
  limit = 3,
  assigneeUserId = '',
  daysUntilDue = 3,
} = {}) {
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + Math.max(1, daysUntilDue));
  const dueIso = due.toISOString();

  return rows.slice(0, limit).map((row) => {
    const recordId = String(row._id || row.id || row.recordId || '').trim();
    const name = String(row.name || recordId).trim();
    if (!recordId) return null;
    const fields = {
      title: `Follow up: ${name}`.slice(0, 200),
      description: `At-risk deal follow-up proposed by Astra for deal ${recordId}.`,
      status: 'todo',
      priority: 'high',
      dueDate: dueIso,
      relatedTo: { type: 'deal', id: recordId },
    };
    if (assigneeUserId) fields.assignedTo = String(assigneeUserId);
    return {
      label: `Confirm: create follow-up for ${name.length > 36 ? `${name.slice(0, 33)}…` : name}`,
      kind: 'create_record',
      moduleKey: 'tasks',
      fields,
      executeNow: false,
      priority: 'high',
      rationale: 'Propose only — creates a task linked to this deal when you confirm.',
    };
  }).filter(Boolean);
}

/**
 * Full close-the-loop action set: stage updates + follow-up tasks (all confirm-gated).
 */
async function buildCloseTheLoopActions({
  question = '',
  preview = null,
  organizationId = '',
  actorUserId = '',
  limit = 3,
} = {}) {
  const q = String(question || '');
  const closeLoop = wantsCloseTheLoopAsk(q) || wantsStaleAtRiskDealAsk(q);
  if (!closeLoop) return [];

  const write = await buildProposeConfirmWriteActions({
    question: q,
    preview,
    moduleKey: 'deals',
    limit,
    organizationId,
    defaultStage: (wantsCloseTheLoopAsk(q) || /\b(negotiation|follow[- ]?up)\b/i.test(q))
      && !detectCrmWriteProposal(q)?.stage
      ? 'Negotiation'
      : '',
  });

  const wantTasks = wantsCloseTheLoopAsk(q)
    || /\bfollow[- ]?up\b/i.test(q)
    || (wantsStaleAtRiskDealAsk(q) && !detectCrmWriteProposal(q));
  const tasks = wantTasks
    ? buildFollowUpTaskActions({
      preview,
      limit,
      assigneeUserId: actorUserId,
    })
    : [];

  const reviews = (!write.length && !tasks.length)
    ? buildAtRiskReviewActions(preview, limit)
    : [];

  return [...write, ...tasks, ...reviews].slice(0, 8);
}

/**
 * Query → execute → compose for casual CRM data asks (list / chart / filtered).
 * Numbers come only from analytics preview — never invented by the LLM.
 */
async function executeCrmDraftOnce({
  organizationId,
  userId,
  user = null,
  blended = '',
  plan = null,
  draftInput = null,
  draftModule = '',
  appKey = '',
  orgContext = null,
  forceType = '',
} = {}) {
  return createAstraReportDraft({
    organizationId,
    userId,
    user,
    // Keep original ask for won/lost OR + likely-to-close Open+stages filters.
    question: (isWonDealAsk(blended) || isLostDealAsk(blended) || isLikelyToCloseAsk(blended)
      || wantsDealListNotPipelineChart(blended))
      ? blended
      : (draftInput?.question || blended),
    moduleKey: draftModule || plan?.moduleKey || '',
    pinSource: draftInput?.pinSource || null,
    runPreview: true,
    appKey,
    orgContext,
    forceType,
  });
}

/**
 * Preview → verify → optional one-shot re-plan → enforce outcome rows.
 */
async function executeCrmDraftWithVerifyReplan(args = {}) {
  const { verifyOrRepairPlan } = require('./astra/planner/verifyAndReplan');
  const blended = args.blended || '';
  let plan = args.plan || null;
  let draftInput = args.draftInput || { question: blended, pinSource: null };
  let didReplan = false;
  let replanReason = null;

  let draft = await executeCrmDraftOnce({ ...args, plan, draftInput });
  const gate = verifyOrRepairPlan({
    question: blended,
    plan,
    preview: draft.preview,
    alreadyReplanned: false,
  });
  if (gate.didReplan) {
    didReplan = true;
    replanReason = gate.replanReason;
    plan = gate.plan;
    if (isWonDealAsk(blended)) {
      plan = {
        ...(plan || {}),
        wantList: true,
        wantChart: false,
        chartType: 'none',
        groupField: '',
        reportType: 'tabular',
        headlineHint: 'Won deals',
      };
    } else if (isLostDealAsk(blended)) {
      plan = {
        ...(plan || {}),
        wantList: true,
        wantChart: false,
        chartType: 'none',
        groupField: '',
        reportType: 'tabular',
        headlineHint: 'Lost deals',
      };
    }
    draftInput = queryPlanToDraftInput(plan, blended);
    draft = await executeCrmDraftOnce({
      ...args,
      plan,
      draftInput,
      forceType: args.forceType
        || (isWonDealAsk(blended) || isLostDealAsk(blended) || wantsDealListNotPipelineChart(blended)
          || wantsListOnlyAsk(blended)
          ? 'tabular'
          : ''),
    });
  }
  draft.preview = enforceDealOutcomePreview(draft.preview, blended);
  draft.preview = enforceDateWindowPreview(draft.preview, blended, plan);
  return { draft, plan, didReplan, replanReason };
}

/**
 * Contextual next-ask chips after a CRM answer.
 * Grounded on module + filters already used — never invents metrics/rows.
 */
function buildCrmSuggestionPack({
  question = '',
  moduleKey = '',
  plan = null,
  rowCount = 0,
  hasChart = false,
  hasTable = false,
} = {}) {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const mod = String(moduleKey || plan?.moduleKey || detectModuleKey(q, '') || '')
    .toLowerCase()
    .trim();
  const modLabel = (mod || 'records').replace(/_/g, ' ');
  const out = [];
  const seen = new Set();

  const push = (text) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 8) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    // Skip near-duplicates of the current ask
    if (q && (key === q || (key.length > 24 && q.includes(key.slice(0, 28))))) return;
    seen.add(key);
    out.push(t.slice(0, 160));
  };

  if (rowCount === 0) {
    if (isWonDealAsk(q) || isLostDealAsk(q)) {
      push('List open deals instead');
      push(`List ${isWonDealAsk(q) ? 'won' : 'lost'} deals from last 90 days`);
      push('Show open deals above $10,000');
    } else {
      push(`Show all ${modLabel} without filters`);
      if (['deals', 'tasks', 'cases', 'quotes'].includes(mod) && !/\bopen\b/.test(q)) {
        push(`List open ${modLabel}`);
      }
      if (mod === 'events' || mod === 'tasks') {
        push(`Upcoming ${modLabel} this week`);
      } else if (mod === 'deals') {
        push('Open deals expected to close this month');
      } else {
        push(`List ${modLabel} from this week`);
      }
    }
    return { clarifyingQuestions: out.slice(0, 4) };
  }

  // High-value multi-hop / write paths first (before generic chart/amount chips)
  if (mod === 'deals') {
    if (wantsStaleAtRiskDealAsk(q) && !wantsCloseTheLoopAsk(q)) {
      push('Close the loop with follow-up tasks on these at-risk deals');
    } else if (!wantsStaleAtRiskDealAsk(q)) {
      push('Which open deals are at risk?');
    }
  }
  if (
    !wantsOwnerLoadAsk(q)
    && ['deals', 'tasks', 'events', 'cases'].includes(mod)
  ) {
    if (mod === 'events' || mod === 'tasks') {
      push(`Who is overloaded with ${modLabel} this week?`);
    } else {
      push(`${modLabel.charAt(0).toUpperCase()}${modLabel.slice(1)} by owner`);
    }
  }

  // Deepen from list → chart / chart → list
  if ((hasTable || wantsListOnlyAsk(q)) && !hasChart && !wantsExplicitChartAsk(q)) {
    push(`Show these ${modLabel} as a pie chart`);
    if (mod === 'deals' && !/\bby stage\b/.test(q)) {
      push('Break these deals down by stage');
    }
  }
  if (hasChart && !wantsListOnlyAsk(q) && !/\b(list of|as a list|show the list)\b/.test(q)) {
    push(`Show the matching ${modLabel} as a list`);
  }

  // Amount / open / date refinements
  if (mod === 'deals') {
    if (!/\b(above|over|greater|more than|\$|amount)\b/.test(q)) {
      push('Only deals above $10,000');
    } else if (/\b(10,?000|10000|10k)\b/.test(q) && !/\b(50,?000|50000|50k)\b/.test(q)) {
      push('Only deals above $50,000');
    }
    if (!/\bopen\b/.test(q) && !isWonDealAsk(q) && !isLostDealAsk(q)) {
      push('Only open deals');
    }
    if (!/\b(this month|this week|expected to close|next week)\b/.test(q)) {
      push('Open deals expected to close this month');
    }
    if (/\bopen\b/.test(q) && !isWonDealAsk(q)) {
      push('Show won deals instead');
    }
  } else if (['tasks', 'cases', 'quotes'].includes(mod)) {
    if (!/\bopen\b/.test(q)) push(`Only open ${modLabel}`);
    if (!/\b(this week|upcoming|overdue|last \d+ days)\b/.test(q)) {
      push(`${modLabel.charAt(0).toUpperCase()}${modLabel.slice(1)} due this week`);
    }
  } else if (mod === 'events') {
    if (!/\b(this week|upcoming|next week|within)\b/.test(q)) {
      push('Upcoming events this week');
    }
    if (!/\bnext week\b/.test(q)) push('Events next week');
  } else if (mod === 'invoices' || mod === 'sales_orders' || mod === 'payments') {
    if (!/\b(unpaid|outstanding|open)\b/.test(q)) {
      push(`Unpaid ${modLabel}`);
    }
  }

  return { clarifyingQuestions: out.slice(0, 4) };
}

/** Attach suggestion chips + suggestionMode flag onto a structured CRM reply. */
function applyCrmSuggestions(structured, ctx = {}) {
  if (!structured || typeof structured !== 'object') return structured;
  const pack = buildCrmSuggestionPack(ctx);
  structured.clarifyingQuestions = pack.clarifyingQuestions;
  structured.suggestionMode = pack.clarifyingQuestions.length > 0;
  return structured;
}

/**
 * Query → execute → compose for casual CRM data asks (list / chart / filtered).
 * Numbers come only from analytics preview — never invented by the LLM.
 */
async function runCrmDataAsk({
  organizationId,
  userId,
  user = null,
  question = '',
  history = [],
  moduleKey = '',
  appKey = '',
  orgContext = null,
  config = null,
  redactOpts = {},
} = {}) {
  const blended = blendDataAskWithHistory(question, history);
  let timeZone = 'UTC';
  try {
    const { resolveAstraTimeZone } = require('./aiWorkGraphContextService');
    timeZone = await resolveAstraTimeZone(organizationId, userId);
  } catch (_) { /* non-fatal */ }
  let catalogText = '';
  try {
    const { fetchPlannerCatalogSlice } = require('./astra/planner/preciseIntentPlanner');
    const slice = await fetchPlannerCatalogSlice({
      organizationId,
      user,
      question: blended,
      moduleKey: moduleKey || '',
    });
    catalogText = slice.catalogText || '';
  } catch (_) { /* non-fatal */ }

  let plan = null;
  let plannerUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  if (config) {
    const proposed = await proposeQueryPlanWithLlm({
      question: blended,
      config,
      redactOpts,
      catalogText,
    });
    plan = proposed?.plan || null;
    plannerUsage = proposed?.usage || plannerUsage;
  }

  const llmPlanOk = isValidLlmQueryPlan(plan);
  if (llmPlanOk) {
    // LLM QueryPlan is authoritative — only thin named-record contains fallback.
    plan = applyNamedRecordPlanFallback(plan, blended);
  } else {
    // No usable LLM plan → legacy regex / overlay heuristics.
    plan = applyHeuristicPlanOverlays(plan, blended);
  }

  const recentTurns = (Array.isArray(history) ? history : [])
    .slice(-6)
    .map((h) => {
      const role = String(h?.role || 'user').toLowerCase() === 'assistant' ? 'Astra' : 'User';
      const body = String(h?.content || h?.body || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      return body ? `${role}: ${body}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const finalizeCtx = {
    organizationId,
    userId,
    question: blended,
    config,
    redactOpts,
    usage: plannerUsage,
    recentTurns,
  };

  const draftInput = plan
    ? queryPlanToDraftInput(plan, blended)
    : { question: blended, pinSource: null, headlineHint: '' };

  const hintModule = mayUsePageModuleHint(blended) ? moduleKey : '';
  const draftModule = hintModule || plan?.moduleKey || '';

  // IntentSpec (LLM) wins over regex: list+chart and record vs field slices.
  const wantList = plan?.wantList === true
    || wantsListOnlyAsk(blended)
    || wantsCompoundListAndChart(blended)
    || wantsDealListNotPipelineChart(blended)
    || (!plan?.wantChart && (plan?.reportType === 'tabular' || /\blist of\b/i.test(blended)));
  const wantChart = !wantsListOnlyAsk(blended)
    && !wantsDealListNotPipelineChart(blended)
    && (plan?.wantChart === true
      || wantsCompoundListAndChart(blended)
      || (plan?.chartType && plan.chartType !== 'none' && plan.chartType !== 'table')
      || /\b(pie|bar|donut|line)\s*charts?\b/i.test(blended)
      || /\b(as|in)\s+(a\s+)?(bar|pie|donut|line)(\s+chart)?\b/i.test(blended));
  const compound = wantList && wantChart;

  // Compound list+chart: execute tabular list + chart, compose both visuals.
  if (compound) {
    const listExec = await executeCrmDraftWithVerifyReplan({
      organizationId,
      userId,
      user,
      blended,
      plan,
      draftInput: {
        question: draftInput.question,
        pinSource: draftInput.pinSource
          ? { ...draftInput.pinSource, reportType: 'tabular', groupField: '' }
          : null,
      },
      draftModule,
      appKey,
      orgContext,
      forceType: 'tabular',
    });
    plan = listExec.plan;
    const listDraft = listExec.draft;

    const chartHint = (plan?.chartType && plan.chartType !== 'none' && plan.chartType !== 'table')
      ? plan.chartType
      : (detectReportChartHint(blended, 'pie') || 'pie');
    const modKey = listDraft.spec?.primaryModule || plan?.moduleKey || '';
    const sliceByRecord = wantsRecordLevelChart(blended)
      || plan?.chartSliceBy === 'record'
      || (!plan?.groupField && !hasExplicitGroupBy(blended, modKey));
    const explicitGroup = !sliceByRecord
      && !wantsRecordLevelChart(blended)
      && (plan?.groupField || hasExplicitGroupBy(blended, modKey));

    const listRowCount = Number(
      listDraft.preview?.result?.rows?.length || listDraft.preview?.rows?.length || 0,
    );
    if (listRowCount === 0 && (isWonDealAsk(blended) || isLostDealAsk(blended))) {
      const outcome = isWonDealAsk(blended) ? 'Won' : 'Lost';
      return finalizeCrmDataAskResult({
        blendedQuestion: blended,
        plan,
        report: listDraft.report,
        spec: listDraft.spec,
        preview: listDraft.preview,
        structured: applyCrmSuggestions({
          headline: `No ${outcome} deals found`,
          bullets: [
            `0 ${outcome} deals matched in your CRM.`,
            `Filter used: status = ${outcome} OR stage in Closed ${outcome} / ${outcome}.`,
          ],
          detail: plan?.understanding || '',
          clarifyingQuestions: [],
          actions: [],
          visuals: [],
          talkToAgent: false,
        }, {
          question: blended,
          moduleKey: 'deals',
          plan,
          rowCount: 0,
        }),
      }, finalizeCtx);
    }

    let tableVisuals = buildVisualsFromReportPreview(
      listDraft.preview,
      { ...listDraft.spec, name: listDraft.spec?.name || 'Matching records' },
      blended,
      { forceTable: true },
    );
    let chartVisuals = [];
    let chartSpec = null;

    if (sliceByRecord) {
      // IntentSpec: pie/bar the matching records themselves (not invented grouping).
      const recordChartName = plan?.headlineHint
        || (listDraft.spec?.name
          ? `${listDraft.spec.name} · ${chartHint}`
          : `${modKey || 'Records'} · ${chartHint}`);
      chartVisuals = buildRecordLevelChartVisual(listDraft.preview, {
        primaryModule: modKey,
        chartHint,
        name: recordChartName,
        metric: plan?.metric === 'count' ? 'count' : (modKey === 'deals' ? 'amount' : 'count'),
      });
      chartSpec = {
        primaryModule: modKey,
        groupField: '',
        chartHint,
        name: recordChartName,
        metric: modKey === 'deals' ? 'amount' : 'count',
      };
    } else {
      chartSpec = buildDraftSpec({
        question: draftInput.question,
        moduleKey: draftModule || modKey,
        pinSource: draftInput.pinSource
          ? {
            ...draftInput.pinSource,
            reportType: 'summary',
            groupField: explicitGroup || draftInput.pinSource.groupField,
          }
          : {
            moduleKey: modKey,
            reportType: 'summary',
            groupField: explicitGroup,
          },
        forceType: 'summary',
      });
      if (chartSpec) {
        chartSpec.chartHint = chartHint;
        if (plan?.headlineHint) chartSpec.name = plan.headlineHint.slice(0, 120);
        const chartPreview = await previewReportSpec({
          organizationId,
          userId,
          user,
          spec: chartSpec,
          appKey,
          orgContext,
        });
        chartVisuals = buildVisualsFromReportPreview(
          chartPreview,
          {
            ...chartSpec,
            chartHint,
            name: chartSpec.name || `${chartSpec.primaryModule} by ${chartSpec.groupField}`,
          },
          blended,
          { forceChart: true },
        );
      }
    }

    if (!chartVisuals.length && !tableVisuals.length && listRowCount > 0) {
      tableVisuals = buildVisualsFromReportPreview(
        listDraft.preview,
        { ...listDraft.spec, name: listDraft.spec?.name || 'Matching records' },
        blended,
        { forceTable: true },
      );
    }

    if (!chartVisuals.length && !tableVisuals.length) {
      return finalizeCrmDataAskResult({
        blendedQuestion: blended,
        plan,
        report: listDraft.report,
        spec: listDraft.spec,
        preview: listDraft.preview,
        structured: applyCrmSuggestions({
          headline: listRowCount === 0 ? 'No matching records' : 'Could not build a visual for these records',
          bullets: [
            listRowCount === 0
              ? `0 ${modKey || 'records'} matched in your CRM.`
              : `${listRowCount} record${listRowCount === 1 ? '' : 's'} matched but no chart/table could be rendered.`,
            'Try a broader filter or confirm records exist in this module.',
          ],
          detail: plan?.understanding || '',
          clarifyingQuestions: [],
          actions: [],
          visuals: [],
          talkToAgent: false,
        }, {
          question: blended,
          moduleKey: modKey,
          plan,
          rowCount: listRowCount,
        }),
      }, finalizeCtx);
    }

    const listPin = {
      moduleKey: modKey,
      groupField: '',
      metric: listDraft.spec?.metric || 'count',
      reportType: 'tabular',
      question: blended.slice(0, 240),
    };
    const chartPin = {
      moduleKey: chartSpec?.primaryModule || modKey,
      groupField: chartSpec?.groupField || '',
      metric: chartSpec?.metric || (modKey === 'deals' ? 'amount' : 'count'),
      reportType: sliceByRecord ? 'tabular' : 'summary',
      recordLevel: sliceByRecord,
      question: blended.slice(0, 240),
    };

    tableVisuals = attachPinSourceToVisuals(tableVisuals, listPin, blended);
    chartVisuals = attachPinSourceToVisuals(chartVisuals, chartPin, blended);

    const actions = Array.isArray(listDraft.structured?.actions)
      ? listDraft.structured.actions.filter((a) => a && [
        'pin_report_to_dashboard',
        'open_report',
        'open_report_builder',
      ].includes(a.kind))
      : [];

    const rowCount = Number(listDraft.preview?.result?.rows?.length || listDraft.preview?.rows?.length || 0);
    if (chartVisuals[0] && (plan?.headlineHint || chartSpec?.name)) {
      chartVisuals[0].title = plan?.headlineHint || chartSpec.name;
    }
    if (tableVisuals[0] && listDraft.spec?.name) {
      tableVisuals[0].title = listDraft.spec.name;
    }

    const intentForVerify = plan || {
      moduleKey: modKey,
      wantList: true,
      wantChart: true,
      chartSliceBy: sliceByRecord ? 'record' : 'field',
      chartType: chartHint,
      metric: chartSpec?.metric || 'amount',
      headlineHint: plan?.headlineHint || '',
    };
    let composedVisuals = verifyComposeMatchesIntent(
      intentForVerify,
      [...tableVisuals, ...chartVisuals],
      listDraft.preview,
    );

    if (!composedVisuals.length) {
      return finalizeCrmDataAskResult({
        blendedQuestion: blended,
        plan,
        report: listDraft.report,
        spec: listDraft.spec,
        preview: listDraft.preview,
        structured: applyCrmSuggestions({
          headline: 'No matching records',
          bullets: [
            `0 ${modKey || 'records'} matched in your CRM.`,
            'Try a broader filter or confirm records exist in this module.',
          ],
          detail: plan?.understanding || '',
          clarifyingQuestions: [],
          actions: [],
          visuals: [],
          talkToAgent: false,
        }, {
          question: blended,
          moduleKey: modKey,
          plan,
          rowCount: 0,
        }),
      }, finalizeCtx);
    }

    const pinActions = composedVisuals.length && rowCount > 0
      ? (actions.length
        ? actions
        : (listDraft.report?._id
          ? [{
            label: 'Pin to dashboard',
            kind: 'pin_report_to_dashboard',
            recordId: String(listDraft.report._id),
            executeNow: false,
            priority: 'medium',
            rationale: 'Pin this live report as a dashboard widget',
          }]
          : []))
      : [];

    const structured = leanVisualStructured({
      headline: plan?.headlineHint || plan?.understanding
        || (rowCount
          ? `${rowCount} matching ${modKey || 'records'} + ${chartHint}`
          : (listDraft.spec?.name || chartSpec?.name || 'Results')),
      visuals: composedVisuals,
      actions: pinActions,
    });
    if (rowCount > 0) {
      structured.bullets = [`${rowCount} record${rowCount === 1 ? '' : 's'} matched`];
    }
    if (plan?.understanding) {
      structured.detail = plan.understanding.slice(0, 400);
    }
    applyCrmSuggestions(structured, {
      question: blended,
      moduleKey: modKey,
      plan,
      rowCount,
      hasChart: composedVisuals.some((v) => v?.component === 'chart'),
      hasTable: composedVisuals.some((v) => v?.component === 'data_table'),
    });

    return finalizeCrmDataAskResult({
      blendedQuestion: blended,
      plan,
      report: listDraft.report,
      spec: listDraft.spec,
      preview: listDraft.preview,
      structured,
    }, finalizeCtx);
  }

  // Fall back: NL draft from blended question when plan missing or module unclear
  let spec = buildDraftSpec({
    question: draftInput.question,
    moduleKey: hintModule,
    pinSource: draftInput.pinSource,
    timeZone,
  });
  if (!spec && plan?.moduleKey) {
    spec = buildDraftSpec({
      question: draftInput.question,
      moduleKey: plan.moduleKey,
      pinSource: draftInput.pinSource,
      timeZone,
    });
  }
  if (!spec) {
    const err = new Error('Could not resolve a CRM module for this data ask.');
    err.statusCode = 400;
    err.code = 'ASTRA_DATA_ASK_MODULE_UNKNOWN';
    throw err;
  }

  // Apply plan chart hint onto spec
  if (plan?.chartType && plan.chartType !== 'none') {
    spec.chartHint = plan.chartType === 'table' ? 'bar' : plan.chartType;
  }
  if (plan?.headlineHint) {
    spec.name = plan.headlineHint.slice(0, 120);
  }

  const singleExec = await executeCrmDraftWithVerifyReplan({
    organizationId,
    userId,
    user,
    blended,
    plan,
    draftInput,
    draftModule,
    appKey,
    orgContext,
    forceType: wantsDealListNotPipelineChart(blended)
      || isWonDealAsk(blended)
      || isLostDealAsk(blended)
      || isChartAskWithoutGroup(blended, draftModule || plan?.moduleKey || '')
      || plan?.chartSliceBy === 'record'
      || wantsListOnlyAsk(blended)
      || wantsOwnerLoadAsk(blended)
      || wantsStaleAtRiskDealAsk(blended)
      || /\b(list of|give me the list|show (me )?the list)\b/i.test(blended)
      ? 'tabular'
      : '',
  });
  plan = singleExec.plan;
  const draft = singleExec.draft;
  if (plan?.headlineHint && draft.spec) {
    draft.spec.name = plan.headlineHint.slice(0, 120);
  }
  if (plan?.chartType && plan.chartType !== 'none' && draft.spec) {
    draft.spec.chartHint = plan.chartType === 'table' ? 'bar' : plan.chartType;
  }

  const chartHint = (plan?.chartType && plan.chartType !== 'none' && plan.chartType !== 'table')
    ? plan.chartType
    : (detectReportChartHint(blended, draft.spec?.chartHint) || draft.spec?.chartHint || 'bar');

  // chartSliceBy:"record" on list-only plans must NOT invent a bar chart of rows.
  const wantsTableVisual = wantsListOnlyAsk(blended)
    || wantsOwnerLoadAsk(blended)
    || wantsStaleAtRiskDealAsk(blended)
    || plan?.chartType === 'table'
    || wantsDealListNotPipelineChart(blended)
    || isWonDealAsk(blended)
    || isLostDealAsk(blended)
    || (draft.spec?.type === 'tabular'
      && !wantsExplicitChartAsk(blended)
      && plan?.wantChart !== true);

  const sliceByRecord = !wantsTableVisual
    && (wantsRecordLevelChart(blended)
      || (plan?.wantChart === true && plan?.chartSliceBy === 'record')
      || isChartAskWithoutGroup(blended, draft.spec?.primaryModule || plan?.moduleKey || ''));

  let visuals = [];
  if (sliceByRecord && !wantsTableVisual) {
    visuals = buildRecordLevelChartVisual(draft.preview, {
      ...draft.spec,
      chartHint,
      name: plan?.headlineHint || draft.spec?.name || `${draft.spec?.primaryModule || 'Records'} · ${chartHint}`,
      metric: plan?.metric === 'count'
        ? 'count'
        : (draft.spec?.primaryModule === 'deals' ? 'amount' : (draft.spec?.metric || 'count')),
    });
  } else {
    visuals = buildVisualsFromReportPreview(
      draft.preview,
      {
        ...draft.spec,
        chartHint: wantsTableVisual ? 'bar' : chartHint,
        name: plan?.headlineHint || draft.spec?.name,
      },
      blended,
      wantsTableVisual ? { forceTable: true } : { forceChart: draft.spec?.type !== 'tabular' },
    );
  }

  const rowCount = Number(draft.preview?.result?.rows?.length || draft.preview?.rows?.length || 0);

  // Multi-hop hop-2: aggregate owners from retrieved rows (no free Mongo).
  if (wantsOwnerLoadAsk(blended) && rowCount > 0) {
    const ownerViz = composeOwnerLoadVisuals(draft.preview, {
      title: plan?.headlineHint || 'Owners by load',
    });
    if (ownerViz.length) {
      visuals = wantsListOnlyAsk(blended) ? [...ownerViz, ...visuals] : ownerViz;
    }
  }

  if (wantsStaleAtRiskDealAsk(blended) && rowCount > 0) {
    const riskViz = composeAtRiskDealVisuals(draft.preview, {
      listTitle: plan?.headlineHint || 'At-risk open deals',
      ownerTitle: 'At-risk $ by owner',
    });
    if (riskViz.length) {
      visuals = riskViz;
    }
  }

  // Rows matched but visual build failed → force a table so we never return Pin-only.
  if (!visuals.length && rowCount > 0) {
    visuals = buildVisualsFromReportPreview(
      draft.preview,
      { ...draft.spec, name: plan?.headlineHint || draft.spec?.name || 'Matching records' },
      blended,
      { forceTable: true },
    );
  }

  const pinSource = {
    moduleKey: draft.spec?.primaryModule || plan?.moduleKey || '',
    groupField: sliceByRecord ? '' : (draft.spec?.groupField || plan?.groupField || ''),
    metric: draft.spec?.metric || plan?.metric || 'count',
    reportType: draft.spec?.type || plan?.reportType || '',
    recordLevel: Boolean(sliceByRecord),
    question: blended.slice(0, 240),
  };
  visuals = attachPinSourceToVisuals(visuals, pinSource, blended);

  const actions = Array.isArray(draft.structured?.actions)
    ? draft.structured.actions.filter((a) => a && [
      'pin_report_to_dashboard',
      'open_report',
      'open_report_builder',
    ].includes(a.kind))
    : [];

  const modLabel = draft.spec?.primaryModule || plan?.moduleKey || 'records';

  // Empty CRM list / failed visual — never show a bare "Pin to dashboard" card.
  if (rowCount === 0 || !visuals.length) {
    const outcome = isWonDealAsk(blended) ? 'Won' : (isLostDealAsk(blended) ? 'Lost' : 'matching');
    const emptyStructured = applyCrmSuggestions({
      headline: isWonDealAsk(blended)
        ? 'No Won deals found'
        : (isLostDealAsk(blended)
          ? 'No Lost deals found'
          : (rowCount === 0 ? 'No matching records' : 'Could not build a visual for these records')),
      bullets: [
        rowCount === 0
          ? `0 ${outcome} ${modLabel} matched in your CRM.`
          : `${rowCount} record${rowCount === 1 ? '' : 's'} matched but no chart/table could be rendered.`,
        isWonDealAsk(blended) || isLostDealAsk(blended)
          ? `Filter used: status = ${outcome} OR stage in Closed ${outcome} / ${outcome}.`
          : 'Try a broader filter or confirm records exist in this module.',
      ],
      detail: plan?.understanding || '',
      clarifyingQuestions: [],
      actions: [],
      visuals: [],
      talkToAgent: false,
    }, {
      question: blended,
      moduleKey: modLabel,
      plan,
      rowCount,
    });
    return finalizeCrmDataAskResult({
      blendedQuestion: blended,
      plan,
      report: draft.report,
      spec: draft.spec,
      preview: draft.preview,
      structured: emptyStructured,
    }, finalizeCtx);
  }

  // Diagnostic / closure: answer the question (list + why/next steps), not a lean chart card.
  if (wantsDealListNotPipelineChart(blended) && !isWonDealAsk(blended) && !isLostDealAsk(blended)) {
    const coaching = buildDealClosureCoaching(draft.preview, blended);
    const coachingActions = actions.length
      ? actions
      : (draft.report?._id
        ? [{
          label: 'Pin to dashboard',
          kind: 'pin_report_to_dashboard',
          recordId: String(draft.report._id),
          executeNow: false,
          priority: 'medium',
          rationale: 'Pin this live report as a dashboard widget',
        }]
        : []);
    const coachingStructured = applyCrmSuggestions({
      headline: coaching.headline || plan?.headlineHint || draft.spec?.name || 'Closing deals',
      bullets: coaching.bullets,
      detail: coaching.detail,
      clarifyingQuestions: [],
      actions: coachingActions,
      visuals,
      talkToAgent: false,
    }, {
      question: blended,
      moduleKey: draft.spec?.primaryModule || plan?.moduleKey || 'deals',
      plan,
      rowCount,
      hasChart: visuals.some((v) => v?.component === 'chart'),
      hasTable: visuals.some((v) => v?.component === 'data_table'),
    });
    return finalizeCrmDataAskResult({
      blendedQuestion: blended,
      plan,
      report: draft.report,
      spec: draft.spec,
      preview: draft.preview,
      structured: coachingStructured,
    }, finalizeCtx);
  }

  const headline = wantsOwnerLoadAsk(blended)
    ? (plan?.headlineHint || 'Owners by load')
    : (wantsStaleAtRiskDealAsk(blended)
      ? (plan?.headlineHint || 'At-risk open deals')
      : (plan?.headlineHint
        || draft.spec?.name
        || draft.structured?.headline
        || 'Results'));

  const pinActions = visuals.length && rowCount > 0
    ? (actions.length
      ? actions
      : (draft.report?._id
        ? [{
          label: 'Pin to dashboard',
          kind: 'pin_report_to_dashboard',
          recordId: String(draft.report._id),
          executeNow: false,
          priority: 'medium',
          rationale: 'Pin this live report as a dashboard widget',
        }]
        : []))
    : [];

  const writeActions = await buildCloseTheLoopActions({
    question: blended,
    preview: draft.preview,
    organizationId,
    actorUserId: userId,
    limit: 3,
  });
  const fallbackWrite = writeActions.length
    ? []
    : await buildProposeConfirmWriteActions({
      question: blended,
      preview: draft.preview,
      moduleKey: draft.spec?.primaryModule || plan?.moduleKey || 'deals',
      limit: 3,
      organizationId,
    });
  const reviewActions = (wantsStaleAtRiskDealAsk(blended)
    && !writeActions.length
    && !fallbackWrite.length)
    ? buildAtRiskReviewActions(draft.preview, 3)
    : [];
  const mergedActions = [...writeActions, ...fallbackWrite, ...reviewActions, ...pinActions].slice(0, 8);

  const structured = leanVisualStructured({
    headline,
    visuals,
    actions: mergedActions,
  });
  // leanVisualStructured keeps pin-only — restore propose→confirm / review / pin set.
  structured.actions = mergedActions.slice(0, 8);
  if (rowCount > 0 && draft.spec?.type === 'tabular') {
    structured.bullets = [`${rowCount} record${rowCount === 1 ? '' : 's'} matched`];
  }
  if (writeActions.length || fallbackWrite.length) {
    structured.detail = [
      plan?.understanding || '',
      'Suggested updates require your confirm — nothing is written until you accept.',
    ].filter(Boolean).join('\n').slice(0, 400);
  }
  applyCrmSuggestions(structured, {
    question: blended,
    moduleKey: draft.spec?.primaryModule || plan?.moduleKey || '',
    plan,
    rowCount,
    hasChart: visuals.some((v) => v?.component === 'chart'),
    hasTable: visuals.some((v) => v?.component === 'data_table'),
  });

  return finalizeCrmDataAskResult({
    blendedQuestion: blended,
    plan,
    report: draft.report,
    spec: draft.spec,
    preview: draft.preview,
    structured,
  }, finalizeCtx);
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
  extractQuotedRecordName,
  nameFieldForModule,
  isWonDealAsk,
  isLostDealAsk,
  enforceDealOutcomePreview,
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
  isCrmDiagnosticAsk,
  isNearCloseDealAsk,
  isLikelyToCloseAsk,
  wantsDealListNotPipelineChart,
  wantsRecordLevelChart,
  isProductHowToAsk,
  isAmbiguousCrmAsk,
  leanVisualStructured,
  isCrmDataAsk,
  isThinDataFollowUp,
  blendDataAskWithHistory,
  verifyComposeMatchesIntent,
  wantsCompoundListAndChart,
  isChartAskWithoutGroup,
  wantsListOnlyAsk,
  wantsExplicitChartAsk,
  wantsOwnerLoadAsk,
  composeOwnerLoadVisuals,
  wantsStaleAtRiskDealAsk,
  parseStaleInactivityDays,
  composeAtRiskDealVisuals,
  detectCrmWriteProposal,
  buildProposeConfirmWriteActions,
  buildAtRiskReviewActions,
  wantsCloseTheLoopAsk,
  buildFollowUpTaskActions,
  buildCloseTheLoopActions,
  buildCrmSuggestionPack,
  applyCrmSuggestions,
  hasExplicitGroupBy,
  buildRecordLevelChartVisual,
  validateQueryPlan,
  queryPlanToDraftInput,
  proposeQueryPlanWithLlm,
  isValidLlmQueryPlan,
  applyNamedRecordPlanFallback,
  applyHeuristicPlanOverlays,
  finalizeCrmDataAskResult,
  runCrmDataAsk,
  executeCrmDraftWithVerifyReplan,
  detectReportType,
};
