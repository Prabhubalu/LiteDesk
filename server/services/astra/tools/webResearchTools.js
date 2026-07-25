'use strict';

const { RISK } = require('../governance/risk');
const { webSearch, researchCompetitors, isWebResearchEnabled } = require('./webResearch');

async function runWebSearch(input = {}, _ctx = {}) {
  if (!isWebResearchEnabled()) {
    return { ok: false, error: 'WEB_RESEARCH_DISABLED' };
  }
  const query = String(input.query || input.q || '').trim();
  if (!query) return { ok: false, error: 'query required' };
  const limit = Math.min(8, Math.max(1, Number(input.limit) || 5));
  const result = await webSearch(query, { limit });
  return {
    ok: result.ok,
    provider: result.provider,
    results: result.results || [],
    error: result.error,
    claims: result.ok
      ? [{ text: `Web search (${result.provider}): ${result.results.length} result(s)`, source: 'web.search' }]
      : [],
  };
}

async function runWebCompetitors(input = {}, ctx = {}) {
  if (!isWebResearchEnabled()) {
    return { ok: false, error: 'WEB_RESEARCH_DISABLED' };
  }
  const subject = String(
    input.subject
    || input.company
    || input.account
    || input.dealName
    || ctx.query
    || '',
  ).trim();
  if (!subject) return { ok: false, error: 'subject required' };

  const result = await researchCompetitors({
    subject,
    industry: input.industry || '',
    productHints: Array.isArray(input.productHints) ? input.productHints : [],
    knownCompetitors: Array.isArray(input.knownCompetitors) ? input.knownCompetitors : [],
    limit: Math.min(8, Math.max(1, Number(input.limit) || 5)),
  });

  return {
    ok: result.ok,
    body: result.body || '',
    competitors: result.competitors || [],
    sources: result.sources || [],
    provider: result.provider,
    error: result.error,
    claims: result.ok
      ? [{
          text: `Competitor research via ${result.provider || 'web'}: ${result.competitors.length || result.sources.length} finding(s)`,
          source: 'web.competitors',
        }]
      : [],
  };
}

function registerWebResearchTools(registry) {
  registry.registerTool({
    name: 'web.search',
    family: 'web',
    risk: RISK.READ,
    description: 'Search the public web for factual snippets (Tavily/Brave/DuckDuckGo).',
    run: runWebSearch,
  });
  registry.registerTool({
    name: 'web.competitors',
    family: 'web',
    risk: RISK.READ,
    description:
      'Research competitors / alternatives for a company, deal, or product from public web sources.',
    run: runWebCompetitors,
  });
}

module.exports = {
  registerWebResearchTools,
  runWebSearch,
  runWebCompetitors,
};
