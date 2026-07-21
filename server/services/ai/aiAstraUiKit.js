'use strict';

/**
 * Curated Astra presentation kit — agents pick only from this allowlist.
 * Not the full Vue codebase (unsafe / unbounded). Mirrors CRM UI patterns.
 */

/** Truncate at word/slash boundary — never mid-token (e.g. mid-URL or mid-CSS). */
function softTruncateDisplay(text = '', maxLen = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s || s.length <= maxLen) return s;
  if (/^https?:\/\//i.test(s)) return s.slice(0, Math.min(s.length, 200));
  const cut = s.slice(0, maxLen);
  const atSpace = cut.lastIndexOf(' ');
  if (atSpace >= Math.floor(maxLen * 0.55)) return `${cut.slice(0, atSpace).trim()}…`;
  const tokenSafe = cut.replace(/[^\s/,.;:!?-]+$/u, '').trim();
  return tokenSafe ? `${tokenSafe}…` : `${cut.trim()}…`;
}

function looksLikeCssOrMarkupJunk(value = '') {
  const t = String(value || '');
  if (!t) return true;
  if (/--[a-z0-9-]+:/i.test(t)) return true;
  if (/\b(?:bing-smtc|b_algo|result__snippet)\b/i.test(t)) return true;
  if (/\bhtml\s*\{/i.test(t) || /\brgba?\s*\(/i.test(t)) return true;
  if (/[{};]{3,}/.test(t)) return true;
  if (/<\/?[a-z][\w:-]*\b/i.test(t)) return true;
  return false;
}

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
  {
    key: 'research_brief',
    when: 'Company / internet research — detailed presentable brief (always use for org web research)',
    props: 'title?, summary?, facts:[{label,value}], sections:[{title,body,bullets?}], sources?:[string]',
  },
];

const ALLOWED = new Set(ASTRA_UI_COMPONENTS.map((c) => c.key));

function formatAstraUiCatalogForPrompt() {
  return [
    '=== ASTRA UI KIT (choose best components; product renders them — never ASCII) ===',
    'Emit visuals as an array of UI blocks using ONLY these keys:',
    ...ASTRA_UI_COMPONENTS.map((c) => `- ${c.key}: ${c.when}. Props: ${c.props}`),
    'RELEVANCE (critical): pick ONLY blocks that directly answer THIS question. Do not add unrelated pipeline KPIs, win rates, or stage distributions the user did not ask about.',
    '- Single-fact / comparison / "which X" questions (e.g. highest value deal): answer in headline + a short data_table of just the compared rows. No KPI strip, no distribution chart unless asked.',
    '- Only build the full stack (kpi_strip + chart + data_table + callout) when the user explicitly asks for a report / dashboard / overview / breakdown.',
    '- WEB / COMPANY RESEARCH: emit research_brief with 4–8 titled sections (Overview, Leadership, Products, Market, Contact, Sources). Do not answer with a tiny snippet. Put the full brief in visuals — not only under detail.',
    'ACCURACY (critical): Never invent, guess, or zero-fill metrics. Every number in visuals/bullets must appear in CRM context aggregates or record fields. If an amount is missing in context, omit it — do not emit 0.',
    'Predictions / next actions: only from CRM facts (stage, probability, dates, open tasks, quotes). Each action must name a real record from context (recordId when known). No speculative forecasts without a probability/date basis.',
    'Never invent metrics — use CRM context / aggregates only. Web research facts must come from the web dossier / leadership facts.',
    'visuals example: [{"component":"kpi_strip","items":[{"label":"Open","value":"14"}]},{"component":"chart","chartType":"pie","points":[{"label":"New","value":5}]}]',
    'research_brief example: {"component":"research_brief","title":"Vtiger CRM","summary":"…","facts":[{"label":"CEO","value":"Sreenivas Kanumuru"}],"sections":[{"title":"Overview","body":"…","bullets":["…"]}]}',
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

function withPinSource(block, { moduleKey = '', groupField = '', metric = 'count', reportType = '', question = '' } = {}) {
  if (!block || !moduleKey) return block;
  return {
    ...block,
    pinSource: {
      moduleKey: String(moduleKey).slice(0, 40),
      groupField: String(groupField || '').slice(0, 40),
      metric: metric === 'amount' ? 'amount' : 'count',
      ...(reportType ? { reportType: String(reportType).slice(0, 20) } : {}),
      ...(question ? { question: String(question).slice(0, 240) } : {}),
    },
  };
}

/**
 * Deterministic premium layout from DB aggregates (authoritative).
 * Agent can refine tone via callout/headline; numbers stay DB-backed.
 */
function mergeSeriesByLabel(series = []) {
  const map = new Map();
  for (const row of Array.isArray(series) ? series : []) {
    const raw = String(row?.label ?? '(empty)').trim() || '(empty)';
    const key = raw.toLowerCase();
    const prev = map.get(key);
    const value = Number(row?.value) || 0;
    const amount = Number(row?.amount) || 0;
    if (!prev) {
      map.set(key, { label: raw, value, amount });
      continue;
    }
    prev.value += value;
    prev.amount += amount;
    // Prefer Title Case / longer display label when merging case variants
    if (/[A-Z]/.test(raw) && !/[A-Z]/.test(prev.label)) prev.label = raw;
    else if (raw.length > prev.label.length) prev.label = raw;
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

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
  const rows = mergeSeriesByLabel(series);
  const totalCount = rows.reduce((s, r) => s + (Number(r.value) || 0), 0) || totalRecords;
  const wantChart = Boolean(chartType)
    || /\b(chart|graph|pie|bar|line|visuali|report|dashboard)\b/i.test(question);
  const pinBase = { moduleKey: mod, groupField: dim };

  if (rows.length) {
    // Any group-by dimension (status, stage, assignedTo, type, …): Total + each bucket.
    const items = [
      { label: 'Total', value: String(totalRecords || totalCount) },
      ...rows.map((r) => ({
        label: String(r.label || '(empty)'),
        value: String(Number(r.value) || 0),
      })),
    ].slice(0, 12);
    blocks.push(withPinSource({
      id: 'kpi_module',
      component: 'kpi_strip',
      title: `${mod} snapshot`,
      items,
    }, { ...pinBase, metric: 'count' }));
  } else if (stats && mod === 'deals') {
    const open = Number(stats.openCount) || 0;
    const won = Number(stats.wonCount) || 0;
    const lost = Number(stats.lostCount) || 0;
    const decided = won + lost;
    const winRate = decided ? `${Math.round((won / decided) * 100)}%` : '—';
    blocks.push(withPinSource({
      id: 'kpi_pipeline',
      component: 'kpi_strip',
      title: 'Pipeline snapshot',
      items: [
        { label: 'Pipeline value', value: formatMoney(stats.pipelineValue), hint: 'Open deals' },
        { label: 'Open deals', value: String(open) },
        { label: 'Won', value: String(won) },
        { label: 'Win rate', value: winRate, hint: 'Won / (Won+Lost)' },
      ],
    }, { ...pinBase, metric: 'count' }));
  } else if (totalCount > 0) {
    blocks.push(withPinSource({
      id: 'kpi_module',
      component: 'kpi_strip',
      title: `${mod} snapshot`,
      items: [
        { label: 'Total', value: String(totalRecords || totalCount) },
      ],
    }, { ...pinBase, metric: 'count' }));
  }

  if (wantChart && rows.length) {
    const hasAmounts = rows.some((r) => Number(r.amount) > 0);
    const chartUseAmount = hasAmounts
      && /\b(value|amount|revenue|pipeline value|\$)\b/i.test(question)
      && !/\b(count|how many)\b/i.test(question);
    const points = rows.map((r) => ({
      label: String(r.label || '(empty)'),
      value: chartUseAmount ? Number(r.amount) || 0 : Number(r.value) || 0,
    }));
    const type = chartType || 'pie';
    blocks.push(withPinSource({
      id: `chart_${dim}`,
      component: 'chart',
      chartType: type,
      title: `${mod} by ${dim}`,
      metricLabel: chartUseAmount ? 'amount' : 'count',
      points,
    }, { ...pinBase, metric: chartUseAmount ? 'amount' : 'count' }));
    // Count share (always when charting)
    blocks.push(withPinSource({
      id: `progress_${dim}`,
      component: 'progress_list',
      title: `Share by ${dim}`,
      items: rows.map((r) => ({
        label: String(r.label || '(empty)'),
        value: Number(r.value) || 0,
        max: totalCount || 1,
      })),
    }, { ...pinBase, metric: 'count' }));
    // Pipeline $ by stage from DB amounts only — never leave this to the LLM
    if (hasAmounts && mod === 'deals') {
      const amountTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) || 1;
      blocks.push(withPinSource({
        id: `progress_amount_${dim}`,
        component: 'progress_list',
        title: 'Pipeline value by stage',
        items: rows.map((r) => ({
          label: String(r.label || '(empty)'),
          value: Number(r.amount) || 0,
          max: amountTotal,
        })),
      }, { ...pinBase, metric: 'amount' }));
    }
  }

  if (rows.length) {
    const useAmount = rows.some((r) => Number(r.amount) > 0);
    blocks.push(withPinSource({
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
    }, { ...pinBase, metric: useAmount ? 'amount' : 'count' }));
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

function normalizePinSource(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const moduleKey = String(raw.moduleKey || '').trim().toLowerCase().slice(0, 40);
  if (!moduleKey) return undefined;
  const reportType = String(raw.reportType || '').trim().toLowerCase().slice(0, 20);
  const question = String(raw.question || '').trim().slice(0, 240);
  return {
    moduleKey,
    groupField: String(raw.groupField || '').trim().slice(0, 40),
    metric: raw.metric === 'amount' ? 'amount' : 'count',
    ...(reportType ? { reportType } : {}),
    ...(question ? { question } : {}),
  };
}

function normalizeAstraVisuals(rawVisuals = []) {
  if (!Array.isArray(rawVisuals)) return [];
  const out = [];
  for (const row of rawVisuals.slice(0, 8)) {
    if (!row || typeof row !== 'object') continue;
    const component = String(row.component || '').trim().toLowerCase();
    if (!ALLOWED.has(component)) continue;
    const id = String(row.id || `${component}_${out.length}`).slice(0, 80);
    const pinSource = normalizePinSource(row.pinSource);

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
        ...(pinSource ? { pinSource } : {}),
      });
      continue;
    }

    if (component === 'kpi_strip') {
      const items = Array.isArray(row.items)
        ? row.items.map((it) => {
          const label = String(it?.label || '').trim().slice(0, 60);
          const rawValue = String(it?.value ?? '').trim();
          const isUrl = /^https?:\/\//i.test(rawValue);
          // Never mid-cut URLs; allow wrapping in UI instead of ellipsis stubs.
          const value = isUrl
            ? rawValue.slice(0, 200)
            : softTruncateDisplay(rawValue, 80);
          const hintRaw = String(it?.hint || '').trim() || (isUrl && rawValue.length > 200 ? rawValue : '');
          return {
            label,
            value,
            hint: hintRaw ? softTruncateDisplay(hintRaw, 200) : '',
          };
        }).filter((it) => it.label && it.value)
        : [];
      if (!items.length) continue;
      out.push({
        id,
        component: 'kpi_strip',
        title: String(row.title || '').trim().slice(0, 120),
        items: items.slice(0, 12),
        ...(pinSource ? { pinSource } : {}),
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
        ...(pinSource ? { pinSource } : {}),
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
        ...(pinSource ? { pinSource } : {}),
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
      continue;
    }

    if (component === 'research_brief') {
      const sections = Array.isArray(row.sections)
        ? row.sections.map((s) => ({
          title: String(s?.title || '').trim().slice(0, 80),
          body: String(s?.body || '').trim().slice(0, 2000),
          bullets: Array.isArray(s?.bullets)
            ? s.bullets.map((b) => String(b || '').trim().slice(0, 280)).filter(Boolean).slice(0, 10)
            : [],
        })).filter((s) => s.title && (s.body || s.bullets.length))
        : [];
      const facts = Array.isArray(row.facts)
        ? row.facts.map((f) => ({
          label: String(f?.label || '').trim().slice(0, 60),
          value: String(f?.value ?? '').trim().slice(0, 120),
        })).filter((f) => f.label && f.value).slice(0, 12)
        : [];
      const sources = Array.isArray(row.sources)
        ? row.sources.map((s) => String(s || '').trim().slice(0, 240)).filter(Boolean).slice(0, 10)
        : [];
      const summary = String(row.summary || '').trim().slice(0, 800);
      if (!sections.length && !facts.length && !summary) continue;
      out.push({
        id,
        component: 'research_brief',
        title: String(row.title || '').trim().slice(0, 120),
        summary,
        facts,
        sections: sections.slice(0, 10),
        sources,
      });
    }
  }
  return out;
}

/**
 * Compose presentable Astra visuals from an LLM-extracted company research brief.
 */
function composeAstraUiFromWebResearch(brief = {}) {
  const blocks = [];
  const title = String(brief.title || brief.headline || 'Company research').trim().slice(0, 120);
  const summary = softTruncateDisplay(String(brief.summary || '').trim(), 360);
  const facts = Array.isArray(brief.facts)
    ? brief.facts.map((f) => ({
      label: String(f?.label || '').trim().slice(0, 60),
      value: String(f?.value ?? '').trim().slice(0, 200),
    })).filter((f) => {
      if (!f.label || !f.value) return false;
      if (looksLikeCssOrMarkupJunk(f.value)) return false;
      // Never show placeholder / "verify on Google" as a key fact
      if (/^general knowledge\b/i.test(f.value)) return false;
      if (/^who is the\b/i.test(f.value)) return false;
      if (/\bverify (on|via|at|with)\b/i.test(f.value)) return false;
      if (/\b(not (listed|found|available|known)|unknown|n\/?a|tbd)\b/i.test(f.value)) return false;
      if (/^(ceo|founder)$/i.test(f.label) && /\b(who|what|the is)\b/i.test(f.value)) return false;
      return true;
    }).slice(0, 8)
    : [];
  const sections = Array.isArray(brief.sections)
    ? brief.sections.map((s) => ({
      title: String(s?.title || '').trim().slice(0, 80),
      body: softTruncateDisplay(
        String(s?.body || '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&#\d+;/g, ' ')
          .replace(/https?:\/\/(?:www\.)?(?:bing|duckduckgo)\.com\/[^\s]+/gi, '')
          .trim(),
        420,
      ),
      bullets: Array.isArray(s?.bullets)
        ? s.bullets
          .map((b) => softTruncateDisplay(String(b || '').trim(), 200))
          .filter((b) => b && !looksLikeCssOrMarkupJunk(b) && !/bing\.com|duckduckgo\.com|key findings|^finding /i.test(b))
          .slice(0, 4)
        : [],
    })).filter((s) => s.title && (s.body || s.bullets.length) && !looksLikeCssOrMarkupJunk(s.body)).slice(0, 3)
    : [];
  const sources = Array.isArray(brief.sources)
    ? brief.sources
      .map((s) => String(s || '').trim().slice(0, 240))
      .filter((s) => s && !/bing\.com\/search|duckduckgo\.com/i.test(s))
      .slice(0, 6)
    : [];

  if (facts.length) {
    blocks.push({
      component: 'kpi_strip',
      title: `${title} · key facts`,
      items: facts.slice(0, 6).map((f) => {
        const isUrl = /^https?:\/\//i.test(f.value);
        return {
          label: f.label,
          value: isUrl ? f.value : softTruncateDisplay(f.value, 80),
          hint: '',
        };
      }),
    });
  }

  if (sections.length || summary || facts.length) {
    blocks.push({
      component: 'research_brief',
      title,
      summary,
      facts: facts.slice(0, 6),
      sections,
      sources,
    });
  }

  // Skip callouts for company research — keeps the card tight.
  return normalizeAstraVisuals(blocks).slice(0, 3);
}

/**
 * Merge agent-chosen blocks with DB-composed premium layout.
 * DB numbers win for kpi/chart/table; keep agent callouts when valid.
 */
function mergeAstraUiBlocks({ composed = [], fromAgent = [] } = {}) {
  const agent = normalizeAstraVisuals(fromAgent);
  const base = normalizeAstraVisuals(composed);
  if (!base.length) return agent;
  if (!agent.length) return dedupeVisualTabs(base);

  // Web research briefs own the layout — keep composed research_brief / kpi, add agent extras lightly.
  if (base.some((b) => b.component === 'research_brief')) {
    const agentCallouts = agent.filter((b) => b.component === 'callout');
    const out = [...base];
    for (const c of agentCallouts) {
      if (!out.some((b) => b.component === 'callout' && b.body === c.body)) out.push(c);
    }
    return dedupeVisualTabs(out).slice(0, 8);
  }

  const agentCallouts = agent.filter((b) => b.component === 'callout');
  const agentCharts = agent.filter((b) => b.component === 'chart');
  // Keep agent tables that add row-level detail (e.g. top deals) — DB owns kpi/chart/progress.
  const agentTables = agent.filter((b) => b.component === 'data_table');
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
  for (const t of agentTables) {
    if (!out.some((b) => b.component === 'data_table' && b.title === t.title)) {
      out.push(t);
    }
  }
  // Prefer DB chart; drop agent charts that only duplicate the same title.
  return dedupeVisualTabs(out).slice(0, 8);
}

function dedupeVisualTabs(blocks = []) {
  const seen = new Set();
  const out = [];
  for (const b of blocks) {
    const titleKey = String(b.title || '').trim().toLowerCase() || b.component;
    const key = `${b.component}:${titleKey}`;
    if (seen.has(key)) continue;
    // Also collapse same title across chart/kpi/progress when labels collide.
    const titleOnly = `title:${titleKey}`;
    if (titleKey && titleKey !== b.component && seen.has(titleOnly) && b.component !== 'data_table') {
      continue;
    }
    seen.add(key);
    if (titleKey && titleKey !== b.component) seen.add(titleOnly);
    out.push(b);
  }
  return out;
}

/** Ensure pinned widgets keep the chat question (filters like amount > 10K). */
function attachPinQuestionToVisuals(visuals = [], question = '', moduleKey = '') {
  const q = String(question || '').trim().slice(0, 240);
  const modHint = String(moduleKey || '').trim().toLowerCase();
  if (!Array.isArray(visuals) || !visuals.length) return visuals;
  return visuals.map((v) => {
    if (!v || typeof v !== 'object') return v;
    const cols = (Array.isArray(v.columns) ? v.columns : []).map((c) => String(c || '').toLowerCase());
    const isRecordList = v.component === 'data_table'
      && cols.some((c) => /deal|name|title|amount|subject/.test(c));
    const existing = v.pinSource && typeof v.pinSource === 'object' ? v.pinSource : null;
    const moduleKeyResolved = String(existing?.moduleKey || modHint || '')
      || (/\bdeals?\b/i.test(String(v.title || '')) ? 'deals' : '')
      || (/\btasks?\b/i.test(String(v.title || '')) ? 'tasks' : '');
    if (!moduleKeyResolved && !q) return v;
    return {
      ...v,
      pinSource: {
        moduleKey: moduleKeyResolved || existing?.moduleKey || 'deals',
        groupField: existing?.groupField || '',
        metric: existing?.metric === 'amount' ? 'amount' : 'count',
        ...(isRecordList
          ? { reportType: 'tabular' }
          : (existing?.reportType ? { reportType: existing.reportType } : {})),
        ...(q || existing?.question ? { question: q || String(existing.question) } : {}),
      },
    };
  });
}

module.exports = {
  ASTRA_UI_COMPONENTS,
  formatAstraUiCatalogForPrompt,
  composeAstraUiFromData,
  composeAstraUiFromWebResearch,
  normalizeAstraVisuals,
  mergeAstraUiBlocks,
  mergeSeriesByLabel,
  attachPinQuestionToVisuals,
  formatMoney,
};
