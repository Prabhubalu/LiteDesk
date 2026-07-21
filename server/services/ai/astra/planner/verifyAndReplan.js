'use strict';

/**
 * Post-execute verify + bounded re-plan (max 1) for CRM data asks.
 * Failures → repair plan via deterministic overlay → caller re-runs preview once.
 */

const { applyOverlayToQueryPlan, buildDeterministicFilterOverlay } = require('./preciseIntentPlanner');

const DATE_FIELD_KEYS = Object.freeze([
  'startDateTime',
  'dueDate',
  'expectedCloseDate',
  'validUntil',
  'orderDate',
  'paymentDate',
  'submittedAt',
]);

function previewRows(preview) {
  const rows = preview?.result?.rows || preview?.rows;
  return Array.isArray(rows) ? rows : [];
}

function isWonRow(row = {}) {
  const stage = String(row.stage || row.STAGE || '').trim().toLowerCase();
  const status = String(row.status || row.STATUS || '').trim().toLowerCase();
  return status === 'won'
    || stage === 'won'
    || stage === 'closed won'
    || /\bclosed\s+won\b/.test(stage);
}

function isLostRow(row = {}) {
  const stage = String(row.stage || row.STAGE || '').trim().toLowerCase();
  const status = String(row.status || row.STATUS || '').trim().toLowerCase();
  return status === 'lost'
    || stage === 'lost'
    || stage === 'closed lost'
    || /\bclosed\s+lost\b/.test(stage);
}

function isOpenDealRow(row = {}) {
  const status = String(row.status || row.STATUS || '').trim().toLowerCase();
  if (status === 'open') return true;
  if (status === 'won' || status === 'lost') return false;
  return !isWonRow(row) && !isLostRow(row);
}

function amountThresholdFromPlanOrQuestion(plan, question = '') {
  const fromPlan = (plan?.filters || []).find(
    (f) => f.fieldKey === 'amount' && ['gte', 'gt'].includes(f.operator),
  );
  if (fromPlan && Number.isFinite(Number(fromPlan.value))) {
    return { op: fromPlan.operator, value: Number(fromPlan.value) };
  }
  const overlay = buildDeterministicFilterOverlay(question, plan?.moduleKey || 'deals');
  const fromOverlay = (overlay.filters || []).find(
    (f) => f.fieldKey === 'amount' && ['gte', 'gt'].includes(f.operator),
  );
  if (fromOverlay && Number.isFinite(Number(fromOverlay.value))) {
    return { op: fromOverlay.operator, value: Number(fromOverlay.value) };
  }
  return null;
}

function flattenFilterNodes(nodes = [], out = []) {
  for (const n of nodes || []) {
    if (!n) continue;
    if (n.fieldKey && n.operator) out.push(n);
    if (Array.isArray(n.children)) flattenFilterNodes(n.children, out);
  }
  return out;
}

/**
 * Collect date bounds from plan filters and/or NL detectFilters.
 * @returns {{ fieldKey: string, gte?: string, gt?: string, lte?: string, lt?: string }[]}
 */
function dateBoundsFromPlanOrQuestion(plan, question = '') {
  const byField = new Map();
  const absorb = (f) => {
    if (!f?.fieldKey || !DATE_FIELD_KEYS.includes(f.fieldKey)) return;
    if (!['gte', 'gt', 'lte', 'lt'].includes(f.operator)) return;
    const cur = byField.get(f.fieldKey) || { fieldKey: f.fieldKey };
    cur[f.operator] = f.value;
    byField.set(f.fieldKey, cur);
  };

  for (const f of plan?.filters || []) absorb(f);

  try {
    const {
      detectFilters,
      detectModuleKey,
    } = require('../../aiAstraReportBuilderService');
    const mod = plan?.moduleKey || detectModuleKey(question, '') || '';
    if (mod) {
      const { filterTree } = detectFilters(question, mod);
      flattenFilterNodes(filterTree?.children || []).forEach(absorb);
    }
  } catch (_) { /* non-fatal */ }

  return [...byField.values()].filter((b) => b.gte || b.gt || b.lte || b.lt);
}

function rowDateValue(row, fieldKey) {
  const raw = row?.[fieldKey]
    ?? row?.[fieldKey?.toUpperCase?.()]
    ?? row?.start
    ?? row?.due
    ?? null;
  if (raw == null || raw === '') return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

function rowFailsDateBound(row, bound) {
  const t = rowDateValue(row, bound.fieldKey);
  if (t == null) return true;
  if (bound.gte != null && t < new Date(bound.gte).getTime()) return true;
  if (bound.gt != null && t <= new Date(bound.gt).getTime()) return true;
  if (bound.lte != null && t > new Date(bound.lte).getTime()) return true;
  if (bound.lt != null && t >= new Date(bound.lt).getTime()) return true;
  return false;
}

function wantsOpenStatusAsk(question = '', moduleKey = '') {
  const q = String(question || '').toLowerCase();
  if (!/\bopen\b/.test(q) || /\bopen in\b/.test(q)) return false;
  const mod = String(moduleKey || '').toLowerCase();
  return mod === 'deals' || mod === 'tasks' || mod === 'cases' || mod === 'quotes'
    || /\bdeals?\b/.test(q);
}

/**
 * @returns {{ ok: boolean, failures: Array<{ code: string, detail: string }>, criteria: string[] }}
 */
function verifyCrmPreviewAgainstAsk({
  question = '',
  plan = null,
  preview = null,
} = {}) {
  const failures = [];
  const criteria = [
    'rows_match_filters',
    'no_invented_metrics',
    'outcome_matches_ask',
    'date_window_matches_ask',
    'open_status_matches_ask',
    'list_vs_chart_matches_ask',
  ];
  const rows = previewRows(preview);
  const q = String(question || '');
  const moduleKey = plan?.moduleKey || '';

  let isWon = false;
  let isLost = false;
  try {
    const { isWonDealAsk, isLostDealAsk } = require('../../aiAstraReportBuilderService');
    isWon = isWonDealAsk(q);
    isLost = isLostDealAsk(q);
  } catch {
    isWon = /\bwon\b/i.test(q) && !/\bwon't\b/i.test(q);
    isLost = /\blost\b/i.test(q);
  }

  if (isWon && rows.length) {
    const bad = rows.filter((r) => !isWonRow(r));
    if (bad.length) {
      failures.push({
        code: 'WON_ROWS_MISMATCH',
        detail: `${bad.length}/${rows.length} rows are not Won/Closed Won`,
      });
    }
  }
  if (isLost && rows.length) {
    const bad = rows.filter((r) => !isLostRow(r));
    if (bad.length) {
      failures.push({
        code: 'LOST_ROWS_MISMATCH',
        detail: `${bad.length}/${rows.length} rows are not Lost/Closed Lost`,
      });
    }
  }

  const threshold = amountThresholdFromPlanOrQuestion(plan, q);
  if (threshold && rows.length) {
    const bad = rows.filter((r) => {
      const amt = Number(r.amount ?? r.AMOUNT ?? r.value ?? NaN);
      if (!Number.isFinite(amt)) return true;
      return threshold.op === 'gte' ? amt < threshold.value : amt <= threshold.value;
    });
    if (bad.length) {
      failures.push({
        code: 'AMOUNT_ROWS_MISMATCH',
        detail: `${bad.length}/${rows.length} rows fail amount ${threshold.op} ${threshold.value}`,
      });
    }
  }

  // Date window: rows must fall inside NL/plan bounds (e.g. within a week from today).
  const dateBounds = dateBoundsFromPlanOrQuestion(plan, q);
  if (dateBounds.length && rows.length) {
    for (const bound of dateBounds) {
      const bad = rows.filter((r) => rowFailsDateBound(r, bound));
      if (bad.length) {
        failures.push({
          code: 'DATE_ROWS_MISMATCH',
          detail: `${bad.length}/${rows.length} rows outside ${bound.fieldKey} window`,
        });
      }
    }
  }

  // Open status: deal rows must be Open when ask requires it.
  if (wantsOpenStatusAsk(q, moduleKey) && !isWon && !isLost && rows.length) {
    const mod = moduleKey || 'deals';
    if (mod === 'deals' || /\bdeals?\b/i.test(q)) {
      const bad = rows.filter((r) => !isOpenDealRow(r));
      if (bad.length) {
        failures.push({
          code: 'OPEN_STATUS_MISMATCH',
          detail: `${bad.length}/${rows.length} rows are not Open`,
        });
      }
    }
  }

  // List ask must not be planned as a grouped chart rollup.
  const listOnly = /\b(list of|give me the list|show (me )?the list)\b/i.test(q)
    && !/\b(pie|bar|donut|line|chart|graph)\b/i.test(q);
  if (
    listOnly
    && plan
    && plan.wantChart === true
    && plan.groupField
    && plan.chartSliceBy !== 'record'
  ) {
    failures.push({
      code: 'LIST_VS_CHART_MISMATCH',
      detail: 'list ask planned as grouped chart',
    });
  }

  // Plan titled Won but missing outcome filters (LLM drift before overlay)
  const hint = String(plan?.headlineHint || '').toLowerCase();
  if (/\bwon\b/.test(hint) && plan?.filters) {
    const hasOutcome = plan.filters.some(
      (f) => f.fieldKey === 'status' || f.fieldKey === 'stage',
    );
    if (!hasOutcome && isWon) {
      failures.push({
        code: 'WON_FILTER_MISSING',
        detail: 'headline implies Won but plan lacks status/stage filters',
      });
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    criteria,
  };
}

/**
 * Merge detectFilters flat rules into plan.filters (by fieldKey+operator, prefer NL).
 */
function mergeDetectFiltersIntoPlan(plan, question = '') {
  let next = { ...(plan || {}) };
  try {
    const {
      detectFilters,
      detectModuleKey,
    } = require('../../aiAstraReportBuilderService');
    const mod = next.moduleKey || detectModuleKey(question, '') || '';
    if (!mod) return next;
    next.moduleKey = mod;
    const { filterTree } = detectFilters(question, mod);
    const detected = flattenFilterNodes(filterTree?.children || []);
    if (!detected.length) return next;
    const existing = Array.isArray(next.filters) ? next.filters.slice() : [];
    for (const f of detected) {
      const idx = existing.findIndex(
        (e) => e.fieldKey === f.fieldKey && e.operator === f.operator,
      );
      if (idx >= 0) existing[idx] = { ...existing[idx], ...f };
      else existing.push({ fieldKey: f.fieldKey, operator: f.operator, value: f.value });
    }
    next.filters = existing;
  } catch (_) { /* non-fatal */ }
  return next;
}

/**
 * Repair plan for one re-plan attempt. Overlay wins; forces tabular list for outcome asks.
 */
function repairPlanFromVerifyFailures({
  plan = null,
  question = '',
  failures = [],
} = {}) {
  let next = applyOverlayToQueryPlan(plan, question);
  const codes = new Set((failures || []).map((f) => f.code));

  if (codes.has('WON_ROWS_MISMATCH') || codes.has('WON_FILTER_MISSING')) {
    next = {
      ...(next || {}),
      wantList: true,
      wantChart: false,
      chartType: 'none',
      groupField: '',
      reportType: 'tabular',
      headlineHint: 'Won deals',
      filters: next?.filters || [],
    };
  }
  if (codes.has('LOST_ROWS_MISMATCH')) {
    next = {
      ...(next || {}),
      wantList: true,
      wantChart: false,
      chartType: 'none',
      groupField: '',
      reportType: 'tabular',
      headlineHint: 'Lost deals',
      filters: next?.filters || [],
    };
  }
  if (codes.has('AMOUNT_ROWS_MISMATCH')) {
    next = applyOverlayToQueryPlan(next, question);
  }
  if (codes.has('DATE_ROWS_MISMATCH') || codes.has('OPEN_STATUS_MISMATCH')) {
    next = mergeDetectFiltersIntoPlan(next, question);
    next = {
      ...next,
      wantList: true,
      wantChart: next.wantChart === true && !codes.has('OPEN_STATUS_MISMATCH')
        ? next.wantChart
        : (codes.has('DATE_ROWS_MISMATCH') ? next.wantChart : false),
      chartType: codes.has('OPEN_STATUS_MISMATCH') ? 'none' : (next.chartType || 'none'),
      groupField: '',
      reportType: 'tabular',
    };
    if (codes.has('OPEN_STATUS_MISMATCH')) {
      const filters = Array.isArray(next.filters) ? next.filters.slice() : [];
      if (!filters.some((f) => f.fieldKey === 'status' && f.operator === 'is' && /^open$/i.test(String(f.value)))) {
        filters.push({ fieldKey: 'status', operator: 'is', value: 'Open' });
      }
      next.filters = filters.filter((f) => !(f.fieldKey === 'status' && /^won|lost$/i.test(String(f.value))));
      next.headlineHint = next.headlineHint || 'Open records';
    }
  }
  if (codes.has('LIST_VS_CHART_MISMATCH')) {
    next = {
      ...(next || {}),
      wantList: true,
      wantChart: false,
      chartType: 'none',
      chartSliceBy: 'record',
      groupField: '',
      reportType: 'tabular',
    };
  }

  return {
    plan: next,
    replanReason: failures.map((f) => `${f.code}: ${f.detail}`).join('; ').slice(0, 400),
  };
}

/**
 * Run verify; if fail, repair plan once. Caller re-executes with repaired plan.
 * @returns {{ verified: boolean, failures, plan, didReplan: boolean, replanReason: string|null }}
 */
function verifyOrRepairPlan({
  question = '',
  plan = null,
  preview = null,
  alreadyReplanned = false,
} = {}) {
  const result = verifyCrmPreviewAgainstAsk({ question, plan, preview });
  if (result.ok || alreadyReplanned) {
    return {
      verified: result.ok,
      failures: result.failures,
      plan,
      didReplan: false,
      replanReason: null,
    };
  }
  const repaired = repairPlanFromVerifyFailures({
    plan,
    question,
    failures: result.failures,
  });
  return {
    verified: false,
    failures: result.failures,
    plan: repaired.plan,
    didReplan: true,
    replanReason: repaired.replanReason,
  };
}

module.exports = {
  previewRows,
  dateBoundsFromPlanOrQuestion,
  verifyCrmPreviewAgainstAsk,
  repairPlanFromVerifyFailures,
  mergeDetectFiltersIntoPlan,
  verifyOrRepairPlan,
};
