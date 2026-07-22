'use strict';

const MAX_CONTEXT_CHARS = 12000;

function formatToolBlock(result) {
  if (!result?.ok) {
    return `Tool ${result?.tool || '?'} failed: ${result?.error || 'unknown error'}`;
  }
  const data = result.data || {};
  const lines = [`### ${result.tool} (${result.stepId})`];

  if (Array.isArray(data.records)) {
    if (!data.records.length) {
      lines.push('(no records)');
    } else {
      for (const row of data.records.slice(0, 12)) {
        lines.push(`- [${row.type || result.tool}] ${row.title || row.name || row.id}${row.subtitle ? ` — ${row.subtitle}` : ''}`);
      }
    }
  }
  if (Array.isArray(data.tasks) || Array.isArray(data.events)) {
    for (const row of (data.tasks || []).slice(0, 8)) {
      lines.push(`- [task] ${row.title || row.id}${row.subtitle ? ` — ${row.subtitle}` : ''}`);
    }
    for (const row of (data.events || []).slice(0, 8)) {
      lines.push(`- [event] ${row.title || row.id}${row.subtitle ? ` — ${row.subtitle}` : ''}`);
    }
  }
  if (Array.isArray(data.excerpts)) {
    if (!data.excerpts.length) {
      lines.push('(no knowledge excerpts)');
    } else {
      for (const ex of data.excerpts.slice(0, 8)) {
        lines.push(`[${ex.index || '?'}] (${ex.sourceType}/${ex.sourceId}) score=${Number(ex.score || 0).toFixed(3)}`);
        lines.push(String(ex.excerpt || '').slice(0, 400));
      }
    }
  }
  if (data.catalogText) {
    lines.push(String(data.catalogText).slice(0, 6000));
  }
  if (Array.isArray(data.requiredFields) && data.requiredFields.length) {
    lines.push('REQUIRED FIELDS (from live catalog):');
    for (const f of data.requiredFields.slice(0, 20)) {
      lines.push(
        `- [${f.moduleKey || '?'}] ${f.key} (${f.label || f.key}) type=${f.dataType || '?'}`,
      );
    }
  }
  if (data.catalogSummary) {
    lines.push(`Permission catalog summary: ${JSON.stringify(data.catalogSummary)}`);
  }
  return lines.join('\n');
}

/**
 * Build a minimal grounded context pack for the reasoning model.
 */
function buildContextPack({
  question = '',
  intentResult = null,
  memory = null,
  toolResults = [],
} = {}) {
  const citations = [];
  const seen = new Set();
  const missingInformation = [];

  for (const tr of toolResults) {
    for (const c of tr.citations || []) {
      const key = `${c.sourceType}:${c.sourceId}`;
      if (!c.sourceId || seen.has(key)) continue;
      seen.add(key);
      citations.push({
        ...c,
        index: citations.length + 1,
      });
    }
    if (!tr.ok && !tr.optional) {
      missingInformation.push(`${tr.tool} unavailable`);
    }
    if (tr.ok && tr.tool === 'SearchKnowledgeBase') {
      const n = tr.data?.excerpts?.length || tr.data?.citations?.length || 0;
      if (!n) missingInformation.push('ProductDocumentation');
    }
    if (tr.ok && tr.tool === 'SearchProductCatalog') {
      const n = (tr.data?.modules?.length || 0) + (tr.data?.fields?.length || 0) + (tr.data?.apps?.length || 0);
      if (!n) missingInformation.push('ProductCatalog');
      if (
        intentResult?.intent === 'ProductHowTo'
        && /\b(required|convert|fields)\b/i.test(String(question || ''))
        && !(tr.data?.requiredFields || []).length
      ) {
        missingInformation.push('RequiredFields');
      }
    }
    if (tr.ok && ['SearchAutomations', 'SearchProcessGraphs', 'SearchPermissions', 'SearchBusinessRules', 'SearchApiMap'].includes(tr.tool)) {
      const n = tr.data?.records?.length || 0;
      if (!n && tr.tool === 'SearchApiMap') {
        // API map should almost always return mounts; treat empty as missing
        missingInformation.push('ApiMap');
      }
    }
    if (tr.ok && tr.tool === 'SearchAccounts') {
      const n = tr.data?.records?.length || 0;
      if (!n) missingInformation.push('Account');
    }
    if (tr.ok && tr.tool === 'SearchTickets') {
      const n = tr.data?.records?.length || 0;
      if (!n) missingInformation.push('SupportTickets');
    }
    if (tr.ok && tr.tool === 'SearchActivities') {
      const n = (tr.data?.tasks?.length || 0) + (tr.data?.events?.length || 0);
      if (!n) missingInformation.push('Activities');
    }
    if (tr.ok && tr.tool === 'SearchDeals') {
      const n = tr.data?.records?.length || 0;
      if (!n) missingInformation.push('Deals');
    }
  }

  // Only keep required_information misses that the plan asked for
  const required = new Set(intentResult?.required_information || []);
  const filteredMissing = missingInformation.filter((m) => {
    if (required.size === 0) return true;
    if (m === 'ProductDocumentation') return required.has('ProductDocumentation');
    if (m === 'ProductCatalog') return required.has('ProductCatalog');
    if (m === 'Account') return required.has('Account');
    if (m === 'SupportTickets') return required.has('SupportTickets');
    if (m === 'Activities') return required.has('Activities');
    if (m === 'Deals') return required.has('Deals');
    return true;
  });

  // Product asks: only flag docs missing if catalog also empty
  const hasCatalog = toolResults.some(
    (tr) => tr.ok && tr.tool === 'SearchProductCatalog'
      && ((tr.data?.modules?.length || 0) + (tr.data?.fields?.length || 0) + (tr.data?.apps?.length || 0)) > 0,
  );
  const cleanedMissing = filteredMissing.filter((m) => {
    if (m === 'ProductDocumentation' && hasCatalog) return false;
    return true;
  });

  const parts = [
    `User question: ${question}`,
    intentResult?.understanding ? `Intent: ${intentResult.intent} — ${intentResult.understanding}` : `Intent: ${intentResult?.intent || 'unknown'}`,
    memory?.anchors?.length ? `Conversation focus: ${memory.anchors.join('; ')}` : '',
    memory?.filters && Object.keys(memory.filters).length
      ? `Active filters: ${JSON.stringify(memory.filters)}`
      : '',
    memory?.dateRange ? `Date range: ${JSON.stringify(memory.dateRange)}` : '',
    '',
    'GROUNDING RULE: Answer ONLY from retrieved evidence below. If evidence is insufficient, say what is missing. Never invent apps, modules, fields, APIs, or CRM records.',
    'Retrieved evidence (facts only — do not invent beyond this):',
    ...toolResults.map(formatToolBlock),
  ].filter(Boolean);

  let contextText = parts.join('\n');
  if (contextText.length > MAX_CONTEXT_CHARS) {
    contextText = `${contextText.slice(0, MAX_CONTEXT_CHARS)}\n…[truncated]`;
  }

  return {
    question,
    contextText,
    citations,
    missingInformation: [...new Set(cleanedMissing)],
    memory: memory || {},
  };
}

module.exports = {
  buildContextPack,
  formatToolBlock,
  MAX_CONTEXT_CHARS,
};
