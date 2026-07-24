'use strict';

/**
 * buildUiBlocks — deterministic visual contract for Astra chat replies.
 *
 * List asks → one record list (no chart/metrics spam).
 * Charts only when the user asks for a breakdown.
 */

const { getModule, recordPathFor } = require('../tools/moduleCatalog');

function entityLabel(entity) {
  const mod = getModule(entity);
  if (mod?.label) return mod.label;
  if (entity === 'articles') return 'articles';
  if (entity === 'records') return 'records';
  return String(entity || 'records');
}

function recordPath(entity, id) {
  return recordPathFor(entity, id);
}

function aggregateByField(hits, field) {
  const counts = new Map();
  for (const hit of hits || []) {
    const raw = hit?.[field];
    const key = String(raw || 'Unknown').trim() || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function stageFromSubtitle(subtitle) {
  if (!subtitle) return null;
  const part = String(subtitle).split('·')[0];
  return String(part || '').trim() || null;
}

function wantsChartAsk(query) {
  return /\b(chart|graph|breakdown|by stage|by status|group\s+by|distribution|visuali[sz]e)\b/i.test(String(query || ''));
}

/** Prefer pie/donut/bar from the user ask; default bar. */
function resolveChartType(query) {
  const q = String(query || '');
  if (/\bdonut\b/i.test(q)) return 'donut';
  if (/\bpie\b/i.test(q)) return 'pie';
  if (/\bline\b/i.test(q)) return 'line';
  return 'bar';
}

function buildChartBlock(entity, hits, query) {
  const chartPoints = entity === 'deals'
    ? aggregateByField(
      hits.map((h) => ({ stage: stageFromSubtitle(h.subtitle) || h.status || 'Unknown' })),
      'stage',
    )
    : (entity === 'cases' || entity === 'tasks' || entity === 'events')
      ? aggregateByField(hits.map((h) => ({ status: h.status || stageFromSubtitle(h.subtitle) || 'Unknown' })), 'status')
      : [];

  if (chartPoints.length < 2) return null;
  return {
    type: 'chart',
    chartType: resolveChartType(query),
    title: entity === 'deals' ? 'By stage' : 'By status',
    series: chartPoints.slice(0, 8),
  };
}

/**
 * @returns {{ lead: string, blocks: object[] }}
 */
function buildUiBlocks(intent, toolResult, options = {}) {
  const blocks = [];
  const hits = toolResult?.hits || [];
  const total = toolResult?.counts?.total ?? hits.length;
  const entity = toolResult?.entity || (intent === 'knowledge' ? 'articles' : 'records');
  const openOnly = Boolean(toolResult?.openOnly);
  const overdueOnly = Boolean(toolResult?.overdueOnly);
  const listIntent = toolResult?.listIntent === true || options.listIntent === true;
  const query = options.query || toolResult?.query || '';
  const chartAsk = wantsChartAsk(query);
  const label = entityLabel(entity);

  if (intent === 'chitchat') {
    return {
      lead: toolResult?.lead || "Hey — I'm here. Ask me about deals, tasks, events, cases, or people.",
      blocks: [],
    };
  }

  if (intent !== 'crm_search' && intent !== 'knowledge') {
    return {
      lead: "Hey — I'm here. Ask me about your deals, tasks, events, cases, or people and I'll pull what's actually in Arivu.",
      blocks: [],
    };
  }

  if (!hits.length) {
    const qualifier = overdueOnly
      ? ' overdue'
      : openOnly && entity === 'deals'
        ? ' open'
        : openOnly && entity === 'tasks'
          ? ' open'
          : '';
    return {
      lead: `I couldn't find any${qualifier} ${label} that match that. Want me to widen the search?`,
      blocks: [
        {
          type: 'empty',
          title: `No${qualifier} ${label} found`,
          description: 'Try a different filter, drop open-only, or search by a specific name.',
        },
      ],
    };
  }

  const qualifier = overdueOnly
    ? ' overdue'
    : openOnly && entity === 'deals'
      ? ' open'
      : '';
  const firstName = hits[0]?.title || null;
  const secondName = hits[1]?.title || null;
  let lead;
  if (listIntent) {
    lead = `You have ${total}${qualifier} ${label}.`;
  } else if (total === 1 && firstName) {
    const detail = hits[0]?.subtitle ? ` — ${hits[0].subtitle}` : '';
    lead = `${firstName}${detail}. Details are on the cards below; tell me what to do next.`;
  } else if (firstName && secondName && total >= 2) {
    lead = `Here are your ${total}${qualifier} ${label} worth attention: ${firstName}, ${secondName}${total > 2 ? `, +${total - 2} more` : ''}. Say which to open or act on.`;
  } else if (firstName) {
    lead = `Here are your ${total}${qualifier} ${label}, starting with ${firstName}.`;
  } else {
    lead = `I found ${total}${qualifier} ${label} — cards below have the details.`;
  }

  const maxList = listIntent
    ? Math.min(50, Math.max(hits.length, 1))
    : 8;

  const listTitle = overdueOnly
    ? 'Overdue tasks'
    : openOnly && entity === 'deals'
      ? 'Open deals'
      : label.charAt(0).toUpperCase() + label.slice(1);

  const listItems = hits.slice(0, maxList).map((h) => ({
    id: h.id,
    title: h.title,
    subtitle: h.subtitle || '',
    status: h.status || null,
    amount: h.amount ?? null,
    href: recordPath(entity, h.id),
  })).filter((item) => item.id && item.title);

  // List ask: clickable list; still attach a chart when the user asked for one.
  if (listIntent) {
    if (chartAsk) {
      const chartBlock = buildChartBlock(entity, hits, query);
      if (chartBlock) blocks.push(chartBlock);
    }
    blocks.push({
      type: 'record_list',
      entity,
      title: listTitle,
      total,
      items: listItems,
    });
    return { lead, blocks };
  }

  const totalLabel = overdueOnly
    ? 'Overdue tasks'
    : openOnly && entity === 'deals'
      ? 'Open deals'
      : openOnly && entity === 'tasks'
        ? 'Open tasks'
        : `Total ${label}`;

  blocks.push({
    type: 'metrics',
    items: [
      {
        id: 'total',
        label: totalLabel,
        value: total,
        tone: 'primary',
      },
      {
        id: 'shown',
        label: 'Shown here',
        value: listItems.length,
        tone: 'neutral',
      },
    ],
  });

  // Chart only when the user asked for a breakdown / chart.
  if (chartAsk) {
    const chartBlock = buildChartBlock(entity, hits, query);
    if (chartBlock) blocks.push(chartBlock);
  }

  blocks.push({
    type: 'record_list',
    entity,
    title: listTitle,
    total,
    items: listItems,
  });

  return { lead, blocks };
}

module.exports = {
  buildUiBlocks,
  aggregateByField,
  recordPath,
  wantsChartAsk,
  resolveChartType,
};
