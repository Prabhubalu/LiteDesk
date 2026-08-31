'use strict';

/**
 * Web research helpers for Astra (competitor intel, general search).
 *
 * Providers:
 *   - Default: DuckDuckGo HTML (no key)
 *   - Override: ASTRA_WEB_RESEARCH_PROVIDER=tavily|brave|auto
 *     (auto = DDG first, then Tavily/Brave if keyed)
 *
 * Kill-switch: ASTRA_WEB_RESEARCH=false
 */

function readBool(value, fallback = true) {
  if (value == null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function isWebResearchEnabled() {
  return readBool(process.env.ASTRA_WEB_RESEARCH, true);
}

function stripHtml(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url, { timeoutMs = 12000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Arivu-AstraWebResearch/1.0',
        ...headers,
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, opts);
  return JSON.parse(text);
}

/**
 * @returns {Promise<Array<{ title: string, url: string, snippet: string }>|null>}
 */
async function searchTavily(query, limit = 5) {
  const key = String(process.env.TAVILY_API_KEY || '').trim();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: String(query || '').slice(0, 400),
        search_depth: 'basic',
        include_answer: false,
        max_results: Math.min(8, Math.max(1, limit)),
      }),
    });
    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
    const data = await res.json();
    return (data.results || []).slice(0, limit).map((r) => ({
      title: String(r.title || '').trim(),
      url: String(r.url || '').trim(),
      snippet: String(r.content || '').trim().slice(0, 400),
    })).filter((r) => r.title || r.snippet);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<Array<{ title: string, url: string, snippet: string }>|null>}
 */
async function searchBrave(query, limit = 5) {
  const key = String(process.env.BRAVE_SEARCH_API_KEY || '').trim();
  if (!key) return null;
  const url =
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(String(query || '').slice(0, 400))}`
    + `&count=${Math.min(8, Math.max(1, limit))}`;
  const data = await fetchJson(url, {
    timeoutMs: 15000,
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': key,
    },
  });
  const rows = data?.web?.results || [];
  return rows.slice(0, limit).map((r) => ({
    title: String(r.title || '').trim(),
    url: String(r.url || '').trim(),
    snippet: String(r.description || '').trim().slice(0, 400),
  })).filter((r) => r.title || r.snippet);
}

/**
 * Best-effort DuckDuckGo HTML scrape (no API key).
 * @returns {Promise<Array<{ title: string, url: string, snippet: string }>>}
 */
async function searchDuckDuckGo(query, limit = 5) {
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(String(query || '').slice(0, 400))}`,
    { timeoutMs: 15000 },
  );
  const results = [];
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) && results.length < limit) {
    let href = m[1];
    const title = stripHtml(m[2]).slice(0, 160);
    // DDG redirect URLs: //duckduckgo.com/l/?uddg=<encoded>
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try {
        href = decodeURIComponent(uddg[1]);
      } catch {
        // keep href
      }
    }
    if (href.startsWith('//')) href = `https:${href}`;
    const after = html.slice(m.index, m.index + 800);
    const snipMatch = after.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/i);
    const snippet = snipMatch ? stripHtml(snipMatch[1]).slice(0, 400) : '';
    if (!title && !snippet) continue;
    results.push({ title, url: href, snippet });
  }
  return results;
}

/**
 * Unified web search.
 * Default provider: DuckDuckGo. Override with ASTRA_WEB_RESEARCH_PROVIDER=tavily|brave|auto
 * (auto = DDG first, then Tavily/Brave fallback).
 * @returns {Promise<{ ok: boolean, provider?: string, results: Array, error?: string, disabled?: boolean }>}
 */
async function webSearch(query, { limit = 5 } = {}) {
  if (!isWebResearchEnabled()) {
    return { ok: false, disabled: true, results: [], error: 'WEB_RESEARCH_DISABLED' };
  }
  const q = String(query || '').trim();
  if (!q) return { ok: false, results: [], error: 'query required' };

  const prefer = String(process.env.ASTRA_WEB_RESEARCH_PROVIDER || 'duckduckgo')
    .trim()
    .toLowerCase();

  const tryProvider = async (name, fn) => {
    try {
      const rows = await fn(q, limit);
      if (rows == null) return null; // provider not configured
      return { ok: true, provider: name, results: rows };
    } catch (err) {
      console.warn(`[webResearch] ${name} failed:`, err?.message || err);
      return { ok: false, provider: name, results: [], error: err?.message || String(err) };
    }
  };

  // Default: DuckDuckGo only
  if (prefer === 'duckduckgo' || prefer === 'ddg' || prefer === '') {
    const ddg = await tryProvider('duckduckgo', searchDuckDuckGo);
    if (ddg?.ok && ddg.results.length) return ddg;
    return {
      ok: false,
      results: [],
      error: ddg?.error || 'NO_RESULTS',
      provider: 'duckduckgo',
    };
  }

  if (prefer === 'tavily') {
    const tavily = await tryProvider('tavily', searchTavily);
    if (tavily?.ok && tavily.results.length) return tavily;
    return {
      ok: false,
      results: [],
      error: tavily?.error || 'NO_RESULTS',
      provider: 'tavily',
    };
  }

  if (prefer === 'brave') {
    const brave = await tryProvider('brave', searchBrave);
    if (brave?.ok && brave.results.length) return brave;
    return {
      ok: false,
      results: [],
      error: brave?.error || 'NO_RESULTS',
      provider: 'brave',
    };
  }

  // auto: DuckDuckGo first, then paid fallbacks
  const ddg = await tryProvider('duckduckgo', searchDuckDuckGo);
  if (ddg?.ok && ddg.results.length) return ddg;

  const tavily = await tryProvider('tavily', searchTavily);
  if (tavily?.ok && tavily.results.length) return tavily;

  const brave = await tryProvider('brave', searchBrave);
  if (brave?.ok && brave.results.length) return brave;

  return {
    ok: false,
    results: [],
    error: ddg?.error || tavily?.error || brave?.error || 'NO_RESULTS',
    provider: ddg?.provider || tavily?.provider || brave?.provider,
  };
}

const SKIP_NAME_RE =
  /^(wikipedia|linkedin|youtube|reddit|facebook|twitter|x\.com|glassdoor|crunchbase|g2\.com|capterra|alternativeto|trustradius|forbes|techradar)$/i;

const JUNK_COMPETITOR_RE =
  /^(top|best|vs|versus|alternatives?|competitors?|software|crm|in|of|for|the|and|202\d|list|guide|review|comparison|platforms?|advisor)$/i;

/** Well-known CRM peers when SERP titles are listicles without named brands. */
const DEFAULT_CRM_PEERS = Object.freeze([
  'Salesforce',
  'HubSpot',
  'Zoho CRM',
  'Pipedrive',
  'Freshworks',
  'Microsoft Dynamics 365',
  'Copper',
  'Close',
]);

/**
 * Pull likely competitor / product names from search titles & snippets.
 */
function extractCompetitorNames(results = [], subject = '') {
  const subjectTokens = String(subject || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const names = [];
  const seen = new Set();

  const push = (raw) => {
    let name = String(raw || '').trim().replace(/[™®]/g, '');
    name = name.replace(/\s+[–—|-]\s+.*$/, '').trim();
    // Drop listicle debris: "Alternatives In 2026", "Competitors of 2026"
    if (/\b20\d{2}\b/i.test(name)) return;
    if (/\b(alternatives?|competitors?|best|top)\b/i.test(name)) return;
    if (name.length < 2 || name.length > 40) return;
    if (SKIP_NAME_RE.test(name)) return;
    if (JUNK_COMPETITOR_RE.test(name)) return;
    const words = name.split(/\s+/);
    if (words.length > 4) return;
    if (words.some((w) => JUNK_COMPETITOR_RE.test(w))) return;
    const lower = name.toLowerCase();
    if (subjectTokens.length && subjectTokens.every((t) => lower.includes(t))) return;
    if (seen.has(lower)) return;
    seen.add(lower);
    names.push(name);
  };

  for (const r of results) {
    const blob = `${r.title || ''} ${r.snippet || ''}`;
    // "X vs Y"
    const vs = blob.match(/\b([A-Z][A-Za-z0-9&.]{1,24})\s+vs\.?\s+([A-Z][A-Za-z0-9&.]{1,24})\b/);
    if (vs) {
      push(vs[1]);
      push(vs[2]);
    }
    // "alternatives: Salesforce, HubSpot, Zoho"
    const altList = blob.match(
      /(?:alternatives?(?:\s+to)?|competitors?(?:\s+(?:to|for|of))?|similar\s+to)\s*[:\-]?\s*([^.]{3,120})/i,
    );
    if (altList?.[1]) {
      for (const part of altList[1].split(/,|\/|&|\band\b/i)) {
        const token = part.trim().replace(/^the\s+/i, '');
        if (/^[A-Z]/.test(token)) push(token.split(/\s+/).slice(0, 2).join(' '));
      }
    }
    // Known CRM brands appearing in text
    const brands = blob.match(
      /\b(Salesforce|HubSpot|Zoho(?:\s+CRM)?|Pipedrive|Freshworks|Freshsales|Copper|Close(?:\.com)?|Insightly|Nutshell|Vtiger|SugarCRM|Microsoft Dynamics(?:\s+365)?|Dynamics 365|Oracle NetSuite|SAP CRM|Monday\.com|Keap|ActiveCampaign)\b/gi,
    );
    if (brands) {
      for (const b of brands) push(b.replace(/\s+/g, ' ').trim());
    }
  }

  return names.slice(0, 8);
}

function defaultPeersForIndustry(industry = '', brand = '') {
  const ind = String(industry || '').toLowerCase();
  const peers = /crm|sales|customer/i.test(ind) || !ind ? [...DEFAULT_CRM_PEERS] : [...DEFAULT_CRM_PEERS];
  const brandRe = brand
    ? new RegExp(`^${String(brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    : null;
  return peers.filter((n) => !brandRe || !brandRe.test(n)).slice(0, 5);
}

/**
 * Competitor research for OUR product (subject), fit to optional customer context.
 * @returns {Promise<{
 *   ok: boolean,
 *   body: string,
 *   competitors: string[],
 *   sources: Array<{ title: string, url: string }>,
 *   provider?: string,
 *   error?: string,
 * }>}
 */
async function researchCompetitors({
  subject = '',
  customer = '',
  industry = '',
  productHints = [],
  knownCompetitors = [],
  limit = 5,
} = {}) {
  if (!isWebResearchEnabled()) {
    return { ok: false, body: '', competitors: [], sources: [], error: 'WEB_RESEARCH_DISABLED' };
  }
  const brand = String(subject || '').trim();
  if (!brand || brand.length < 2) {
    return { ok: false, body: '', competitors: [], sources: [], error: 'MISSING_SUBJECT' };
  }
  const account = String(customer || '').trim();
  const hints = (Array.isArray(productHints) ? productHints : []).filter(Boolean).slice(0, 3);
  const known = (Array.isArray(knownCompetitors) ? knownCompetitors : [])
    .map(String)
    .filter((n) => n && !/\b(alternatives?|competitors?)\b/i.test(n))
    .slice(0, 4);

  const industryHint = industry || hints[0] || 'CRM';
  const queries = [
    `${brand} ${industryHint} competitors alternatives Salesforce HubSpot Zoho`,
    `best ${industryHint} software competitors Salesforce HubSpot Zoho Pipedrive Freshworks`,
    account
      ? `${industryHint} alternatives for companies evaluating ${brand} vs Salesforce`
      : `${brand} vs Salesforce HubSpot Zoho CRM comparison`,
    known.length ? `${brand} vs ${known[0]}` : null,
  ].filter(Boolean);

  /** @type {Array<{ title: string, url: string, snippet: string }>} */
  let merged = [];
  let provider = '';
  for (const q of queries.slice(0, 3)) {
    const hit = await webSearch(q, { limit });
    if (hit.ok && hit.results?.length) {
      provider = hit.provider || provider;
      for (const r of hit.results) {
        if (!merged.some((x) => x.url && x.url === r.url)) merged.push(r);
      }
    }
    if (merged.length >= limit) break;
  }
  merged = merged.slice(0, Math.max(limit, 6));

  if (!merged.length) {
    return { ok: false, body: '', competitors: [], sources: [], provider, error: 'NO_RESULTS' };
  }

  const extracted = extractCompetitorNames(merged, brand);
  let competitors = [...new Set([...known, ...extracted])]
    .filter((n) => !new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(n))
    .filter((n) => !/\b(alternatives?|competitors?|best|top|202\d)\b/i.test(n))
    .slice(0, 6);

  // Never dump listicle titles as "competitors" — seed peer brands when SERP is title-only
  if (!competitors.length) {
    competitors = defaultPeersForIndustry(industryHint, brand);
  }

  const lines = [];
  lines.push('Current Situation');
  lines.push(
    account
      ? `Public alternatives to ${brand} that may compete for ${account} (and similar customers).`
      : `Public alternatives to ${brand} in the ${industryHint} space.`,
  );
  lines.push('Key Competitors');

  for (const name of competitors) {
    const related = merged.find((r) =>
      new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(`${r.title} ${r.snippet}`),
    );
    const note = related?.snippet
      ? related.snippet.slice(0, 140)
      : `Common ${industryHint} alternative buyers evaluate alongside ${brand}`;
    lines.push(`• Competitor: ${name} — ${note}`);
  }

  const sources = merged
    .filter((r) => r.url && /^https?:\/\//i.test(r.url))
    .slice(0, 4)
    .map((r) => ({
      title: String(r.title || r.url)
        .replace(/\s+[–—|-]\s+(TrustRadius|Forbes|TechRadar|G2|Capterra).*$/i, '')
        .slice(0, 48),
      url: r.url,
    }));

  if (sources.length) {
    lines.push('Sources');
    for (const s of sources) {
      // Keep URL on the line so the canvas can render a real link
      lines.push(`• Source: ${s.title || 'Research'} — ${s.url}`);
    }
  }

  return {
    ok: true,
    body: lines.join('\n').slice(0, 2500),
    competitors,
    sources,
    provider,
  };
}

module.exports = {
  isWebResearchEnabled,
  webSearch,
  researchCompetitors,
  extractCompetitorNames,
  searchDuckDuckGo,
  searchTavily,
  searchBrave,
  stripHtml,
};
