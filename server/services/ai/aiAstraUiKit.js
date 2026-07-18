'use strict';

/**
 * Curated Astra presentation kit — agents pick only from this allowlist.
 * Not the full Vue codebase (unsafe / unbounded). Mirrors CRM UI patterns.
 */

const ASTRA_UI_COMPONENTS = [
  {
    key: 'kpi_strip',
    when: 'Show 2–6 headline metrics (pipeline value, open count, win rate, etc.)',
    props: 'title?, items:[{label,value,hint?}]',
  },
  {
    key: 'chart',
    when: 'Distribution / comparison — pie, bar, or line',
    props: 'chartType:pie|bar|line, title?, metricLabel?, points:[{label,value}]',
  },
  {
    key: 'progress_list',
    when: 'Ranked share of a whole (stage mix) as premium bars',
    props: 'title?, items:[{label,value,max?}]',
  },
  {
    key: 'data_table',
    when: 'Precise breakdown table staff can scan',
    props: 'title?, columns:[string], rows:[[string|number]]',
  },
  {
    key: 'callout',
    when: 'Insight, warning, or next-step recommendation',
    props: 'tone:insight|success|warning|danger, title?, body',
  },
];

const ALLOWED = new Set(ASTRA_UI_COMPONENTS.map((c) => c.key));

function formatAstraUiCatalogForPrompt() {
  return [
    '=== ASTRA UI KIT (choose best components; product renders them — never ASCII) ===',
    'Emit visuals as an array of UI blocks using ONLY these keys:',
    ...ASTRA_UI_COMPONENTS.map((c) => `- ${c.key}: ${c.when}. Props: ${c.props}`),
    'For reports / charts / dashboards: prefer kpi_strip + chart + data_table + callout (insight).',
    'Never invent metrics — use CRM context / aggregates only.',
    'visuals example: [{"component":"kpi_strip","items":[{"label":"Open","value":"14"}]},{"component":"chart","chartType":"pie","points":[{"label":"New","value":5}]}]',
  ].join('\n');
}

function formatMoney(n) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `$${Math.round(v).toLocaleString('en-US')}`;
  }
}

function pct(part, whole) {
  const w = Number(whole) || 0;
  if (!w) return '0%';
  return `${Math.round((Number(part) / w) * 100)}%`;
}

/**
 * Deterministic premium layout from DB aggregates (authoritative).
 * Agent can refine tone via callout/headline; numbers stay DB-backed.
 */
function composeAstraUiFromData({
  question = '',
  moduleKey = '',
  series = [],
  groupField = '',
  stats = null,
  totalRecords = 0,
  chartType = '',
} = {}) {
  const blocks = [];
  const mod = String(moduleKey || 'records');
  const dim = groupField || 'category';
  const rows = Array.isArray(series) ? series : [];
  const totalCount = rows.reduce((s, r) => s + (Number(r.value) || 0), 0) || totalRecords;
  const wantChart = Boolean(chartType)
    || /\b(chart|graph|pie|bar|line|visuali|report|dashboard)\b/i.test(question);

  if (stats && mod === 'deals') {
    const open = Number(stats.openCount) || 0;
    const won = Number(stats.wonCount) || 0;
    const lost = Number(stats.lostCount) || 0;
    const decided = won + lost;
    const winRate = decided ? `${Math.round((won / decided) * 100)}%` : '—';
    blocks.push({
      id: 'kpi_pipeline',
      component: 'kpi_strip',
      title: 'Pipeline snapshot',
      items: [
        { label: 'Pipeline value', value: formatMoney(stats.pipelineValue), hint: 'Open deals' },
        { label: 'Open deals', value: String(open) },
        { label: 'Won', value: String(won) },
        { label: 'Win rate', value: winRate, hint: 'Won / (Won+Lost)' },
      ],
    });
  } else if (totalCount > 0) {
    blocks.push({
      id: 'kpi_module',
      component: 'kpi_strip',
      title: `${mod} snapshot`,
      items: [
        { label: 'Total', value: String(totalRecords || totalCount) },
        { label: `Groups (${dim})`, value: String(rows.length) },
      ],
    });
  }

  if (wantChart && rows.length) {
    const useAmount = /\b(value|amount|revenue|pipeline value|\$)\b/i.test(question)
      && rows.some((r) => Number(r.amount) > 0);
    const points = rows.map((r) => ({
      label: String(r.label || '(empty)'),
      value: useAmount ? Number(r.amount) || 0 : Number(r.value) || 0,
    }));
    const type = chartType || 'pie';
    blocks.push({
      id: `chart_${dim}`,
      component: 'chart',
      chartType: type,
      title: `${mod} by ${dim}`,
      metricLabel: useAmount ? 'amount' : 'count',
      points,
    });
    blocks.push({
      id: `progress_${dim}`,
      component: 'progress_list',
      title: 'Share by stage',
      items: points.map((p) => ({
        label: p.label,
        value: p.value,
        max: points.reduce((s, x) => s + x.value, 0) || 1,
      })),
    });
  }

  if (rows.length) {
    const useAmount = rows.some((r) => Number(r.amount) > 0);
    blocks.push({
      id: `table_${dim}`,
      component: 'data_table',
      title: 'Breakdown',
      columns: useAmount
        ? [dim, 'Count', '%', 'Amount']
        : [dim, 'Count', '%'],
      rows: rows.map((r) => {
        const count = Number(r.value) || 0;
        const base = [String(r.label), count, pct(count, totalCount)];
        if (useAmount) base.push(formatMoney(r.amount));
        return base;
      }),
    });
  }

  if (wantChart || /\breport|dashboard|analy/i.test(question)) {
    blocks.push({
      id: 'callout_insight',
      component: 'callout',
      tone: 'insight',
      title: 'How to read this',
      body: 'Figures above are calculated from live CRM aggregates for this module list — not a sample estimate.',
    });
  }

  return blocks.slice(0, 8);
}

function normalizeAstraVisuals(rawVisuals = []) {
  if (!Array.isArray(rawVisuals)) return [];
  const out = [];
  for (const row of rawVisuals.slice(0, 8)) {
    if (!row || typeof row !== 'object') continue;
    const component = String(row.component || '').trim().toLowerCase();
    if (!ALLOWED.has(component)) continue;
    const id = String(row.id || `${component}_${out.length}`).slice(0, 80);

    if (component === 'chart') {
      const points = Array.isArray(row.points)
        ? row.points.map((p) => ({
          label: String(p?.label || '').trim().slice(0, 80),
          value: Number(p?.value) || 0,
        })).filter((p) => p.label)
        : [];
      if (!points.length) continue;
      out.push({
        id,
        component: 'chart',
        chartType: ['pie', 'bar', 'line'].includes(String(row.chartType))
          ? String(row.chartType)
          : 'pie',
        title: String(row.title || '').trim().slice(0, 120),
        metricLabel: String(row.metricLabel || 'value').slice(0, 40),
        points: points.slice(0, 40),
      });
      continue;
    }

    if (component === 'kpi_strip') {
      const items = Array.isArray(row.items)
        ? row.items.map((it) => ({
          label: String(it?.label || '').trim().slice(0, 60),
          value: String(it?.value ?? '').trim().slice(0, 40),
          hint: String(it?.hint || '').trim().slice(0, 80),
        })).filter((it) => it.label && it.value)
        : [];
      if (!items.length) continue;
      out.push({
        id,
        component: 'kpi_strip',
        title: String(row.title || '').trim().slice(0, 120),
        items: items.slice(0, 6),
      });
      continue;
    }

    if (component === 'progress_list') {
      const items = Array.isArray(row.items)
        ? row.items.map((it) => ({
          label: String(it?.label || '').trim().slice(0, 80),
          value: Number(it?.value) || 0,
          max: Number(it?.max) > 0 ? Number(it.max) : undefined,
        })).filter((it) => it.label)
        : [];
      if (!items.length) continue;
      out.push({
        id,
        component: 'progress_list',
        title: String(row.title || '').trim().slice(0, 120),
        items: items.slice(0, 20),
      });
      continue;
    }

    if (component === 'data_table') {
      const columns = Array.isArray(row.columns)
        ? row.columns.map((c) => String(c || '').trim().slice(0, 40)).filter(Boolean)
        : [];
      const rows = Array.isArray(row.rows)
        ? row.rows.slice(0, 40).map((r) => (
          Array.isArray(r)
            ? r.map((c) => (typeof c === 'number' ? c : String(c ?? '').slice(0, 80)))
            : []
        )).filter((r) => r.length)
        : [];
      if (!columns.length || !rows.length) continue;
      out.push({
        id,
        component: 'data_table',
        title: String(row.title || '').trim().slice(0, 120),
        columns: columns.slice(0, 8),
        rows,
      });
      continue;
    }

    if (component === 'callout') {
      const body = String(row.body || '').trim().slice(0, 600);
      if (!body) continue;
      const tone = ['insight', 'success', 'warning', 'danger'].includes(String(row.tone))
        ? String(row.tone)
        : 'insight';
      out.push({
        id,
        component: 'callout',
        tone,
        title: String(row.title || '').trim().slice(0, 120),
        body,
      });
    }
  }
  return out;
}

/**
 * Merge agent-chosen blocks with DB-composed premium layout.
 * DB numbers win for kpi/chart/table; keep agent callouts when valid.
 */
function mergeAstraUiBlocks({ composed = [], fromAgent = [] } = {}) {
  const agent = normalizeAstraVisuals(fromAgent);
  const base = normalizeAstraVisuals(composed);
  if (!base.length) return agent;
  if (!agent.length) return base;

  const agentCallouts = agent.filter((b) => b.component === 'callout');
  const agentCharts = agent.filter((b) => b.component === 'chart');
  const out = base.map((b) => {
    if (b.component === 'chart' && agentCharts[0]?.chartType) {
      return { ...b, chartType: agentCharts[0].chartType };
    }
    return b;
  });
  for (const c of agentCallouts) {
    if (!out.some((b) => b.component === 'callout' && b.body === c.body)) {
      out.push(c);
    }
  }
  return out.slice(0, 8);
}

module.exports = {
  ASTRA_UI_COMPONENTS,
  formatAstraUiCatalogForPrompt,
  composeAstraUiFromData,
  normalizeAstraVisuals,
  mergeAstraUiBlocks,
  formatMoney,
};
