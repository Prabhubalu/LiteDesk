'use strict';

const {
  extractConversationEntityAnchors,
  resolveWorkspaceQuestionWithHistory,
} = require('../../aiWorkGraphContextService');

const OPEN_STATUS_RE = /\b(only\s+)?open\b|\bopen\s+(ones|deals|tickets|cases|tasks)\b/i;
const LAST_MONTH_RE = /\blast\s+month\b|\bprevious\s+month\b/i;
const LAST_N_DAYS_RE = /\b(?:in\s+)?(?:the\s+)?(?:last|past)\s+(\d+)\s+days?\b/i;
const LAST_WEEK_RE = /\b(?:in\s+)?(?:the\s+)?last\s+(?:a\s+)?week\b|\bpast\s+week\b/i;
const NEXT_WEEK_RE = /\b(?:within|in)\s+(?:the\s+)?next\s+week\b|\bnext\s+week\b|\bwithin\s+(?:a|one)\s+week\b/i;
const CLOSED_RE = /\b(only\s+)?closed\b|\bclosed\s+(ones|deals|tickets|cases)\b/i;
const WON_RE = /\b(only\s+)?won\b|\bwon\s+(ones|deals)\b/i;
const LOST_RE = /\b(only\s+)?lost\b|\blost\s+(ones|deals)\b/i;
const WRITE_STAGE_RE = /\b(?:set|move|change|update).{0,40}\bstage\b|\b(?:move|set).{0,24}\b(?:to|into)\s+(negotiation|proposal)/i;

const MODULE_RE = [
  [/\bdeals?\b|\bpipeline\b/i, 'deals'],
  [/\btasks?\b/i, 'tasks'],
  [/\bcases?\b|\btickets?\b/i, 'cases'],
  [/\bquotes?\b/i, 'quotes'],
  [/\bevents?\b|\bmeetings?\b/i, 'events'],
  [/\bpeople\b|\bcontacts?\b/i, 'people'],
  [/\borganizations?\b|\baccounts?\b/i, 'organizations'],
];

function detectModuleFromText(text = '') {
  const t = String(text || '');
  for (const [re, key] of MODULE_RE) {
    if (re.test(t)) return key;
  }
  return null;
}

function detectVisualType(text = '') {
  const t = String(text || '').toLowerCase();
  if (/\bpie\b/.test(t)) return 'pie';
  if (/\bdonut\b/.test(t)) return 'donut';
  if (/\bbar\b/.test(t)) return 'bar';
  if (/\bline\b/.test(t)) return 'line';
  if (/\btable\b|\blist\b/.test(t)) return 'table';
  if (/\bchart\b|\bgraph\b/.test(t)) return 'chart';
  return null;
}

function detectAmountGte(text = '') {
  const t = String(text || '').toLowerCase();
  const m = t.match(
    /\b(?:amount|value|over|above|greater than|more than)\s*\$?\s*([\d,.]+)\s*(k|m)?\b/i,
  ) || t.match(/\b([\d,.]+)\s*(k)\s*\$?\b/i);
  if (!m) return null;
  let n = Number(String(m[1]).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const suf = String(m[2] || '').toLowerCase();
  if (suf === 'k') n *= 1000;
  if (suf === 'm') n *= 1e6;
  return n;
}

function scanHistoryForCrmFocus(history = []) {
  const msgs = Array.isArray(history) ? history : [];
  let lastModuleKey = null;
  let lastVisualType = null;
  let amountGte = null;
  let lastCrmQuestion = '';
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i];
    if (!m || (m.role !== 'user' && m.role !== 'User')) continue;
    const content = String(m.content || m.body || '').trim();
    if (!content) continue;
    if (!lastModuleKey) lastModuleKey = detectModuleFromText(content);
    if (!lastVisualType) lastVisualType = detectVisualType(content);
    if (amountGte == null) amountGte = detectAmountGte(content);
    if (!lastCrmQuestion && (lastModuleKey || amountGte != null || lastVisualType)) {
      lastCrmQuestion = content;
    }
    if (lastModuleKey && (amountGte != null || lastVisualType)) break;
  }
  return { lastModuleKey, lastVisualType, amountGte, lastCrmQuestion };
}

/**
 * Conversation memory for sticky focus, filters, module, visual type, and date ranges.
 * Phase 1: derived from ask history only (no new DB collection).
 */
function buildConversationMemory({ question = '', history = [], priorMemory = null } = {}) {
  const resolved = resolveWorkspaceQuestionWithHistory(question, history);
  const anchors = resolved.anchors?.length
    ? resolved.anchors
    : extractConversationEntityAnchors(history);
  const q = String(question || '').trim();
  const prior = priorMemory && typeof priorMemory === 'object' ? priorMemory : {};
  const fromHistory = scanHistoryForCrmFocus(history);

  const filters = { ...(prior.filters && typeof prior.filters === 'object' ? prior.filters : {}) };
  if (OPEN_STATUS_RE.test(q)) filters.status = 'open';
  if (CLOSED_RE.test(q)) filters.status = 'closed';
  if (WON_RE.test(q)) filters.status = 'Won';
  if (LOST_RE.test(q)) filters.status = 'Lost';

  const amountNow = detectAmountGte(q);
  if (amountNow != null) filters.amountGte = amountNow;
  else if (prior.filters?.amountGte != null && !filters.amountGte) {
    filters.amountGte = prior.filters.amountGte;
  } else if (fromHistory.amountGte != null && filters.amountGte == null) {
    filters.amountGte = fromHistory.amountGte;
  }

  let dateRange = prior.dateRange || null;
  if (LAST_MONTH_RE.test(q)) {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    dateRange = { from: from.toISOString(), to: to.toISOString(), label: 'last_month' };
  } else if (LAST_WEEK_RE.test(q)) {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from = new Date(startOfToday);
    from.setUTCDate(from.getUTCDate() - 7);
    const to = new Date(startOfToday);
    to.setUTCDate(to.getUTCDate() + 1);
    dateRange = { from: from.toISOString(), to: to.toISOString(), label: 'last_7_days' };
  } else if (NEXT_WEEK_RE.test(q)) {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const to = new Date(startOfToday);
    to.setUTCDate(to.getUTCDate() + 7);
    dateRange = { from: startOfToday.toISOString(), to: to.toISOString(), label: 'next_7_days' };
  } else {
    const lastN = q.match(LAST_N_DAYS_RE);
    if (lastN) {
      const days = Number(lastN[1]);
      if (Number.isFinite(days) && days > 0) {
        const now = new Date();
        const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const from = new Date(startOfToday);
        from.setUTCDate(from.getUTCDate() - days);
        const to = new Date(startOfToday);
        to.setUTCDate(to.getUTCDate() + 1);
        dateRange = { from: from.toISOString(), to: to.toISOString(), label: `last_${days}_days` };
      }
    }
  }

  let lastWriteProposal = prior.lastWriteProposal || null;
  if (WRITE_STAGE_RE.test(q) || /\b(?:re)?assign\b/i.test(q)) {
    lastWriteProposal = String(q).slice(0, 200);
  }

  const accountHint = String(
    prior.accountHint
    || anchors[0]
    || ''
  ).trim();

  const moduleFromQ = detectModuleFromText(q);
  const lastModuleKey = moduleFromQ
    || prior.lastModuleKey
    || fromHistory.lastModuleKey
    || null;

  const visualFromQ = detectVisualType(q);
  const lastVisualType = visualFromQ
    || prior.lastVisualType
    || fromHistory.lastVisualType
    || null;

  const thinFollowUp = /^(give me |show me |get me )?(the )?same\b/i.test(q)
    || /\b(same|that|it|this)\b.+\b(in |as )?(a )?(bar|pie|donut|line|chart|table)\b/i.test(q)
    || OPEN_STATUS_RE.test(q)
    || CLOSED_RE.test(q)
    || WON_RE.test(q)
    || LOST_RE.test(q)
    || LAST_N_DAYS_RE.test(q)
    || LAST_WEEK_RE.test(q);

  return {
    sticky: Boolean(resolved.sticky) || thinFollowUp,
    explicitSwitch: Boolean(resolved.explicitSwitch),
    anchors,
    accountHint,
    currentAccount: accountHint || prior.currentAccount || '',
    currentOpportunity: prior.currentOpportunity || '',
    filters,
    dateRange,
    lastWriteProposal,
    lastIntent: prior.lastIntent || null,
    lastModuleKey,
    lastVisualType,
    lastCrmQuestion: fromHistory.lastCrmQuestion || prior.lastCrmQuestion || '',
    effectiveQuestion: resolved.question || q,
    searchQueries: Array.isArray(resolved.searchQueries) ? resolved.searchQueries : [],
  };
}

function withLastIntent(memory, intent) {
  return {
    ...(memory && typeof memory === 'object' ? memory : {}),
    lastIntent: intent || null,
  };
}

/**
 * Persist turn outcomes into memory for the next ask (in-process / caller-held).
 */
function withTurnOutcome(memory, {
  intent = null,
  moduleKey = '',
  visualType = '',
  question = '',
  writeProposal = '',
  dateRange = null,
} = {}) {
  const base = memory && typeof memory === 'object' ? memory : {};
  const next = {
    ...base,
    lastIntent: intent || base.lastIntent || null,
  };
  const mod = moduleKey || detectModuleFromText(question) || base.lastModuleKey;
  if (mod) next.lastModuleKey = mod;
  const vis = visualType || detectVisualType(question) || base.lastVisualType;
  if (vis) next.lastVisualType = vis;
  if (question && detectModuleFromText(question)) {
    next.lastCrmQuestion = String(question).slice(0, 240);
  }
  const amount = detectAmountGte(question);
  if (amount != null) {
    next.filters = { ...(next.filters || {}), amountGte: amount };
  }
  if (writeProposal) next.lastWriteProposal = String(writeProposal).slice(0, 200);
  if (dateRange && typeof dateRange === 'object') next.dateRange = dateRange;
  return next;
}

module.exports = {
  buildConversationMemory,
  withLastIntent,
  withTurnOutcome,
  detectModuleFromText,
  detectVisualType,
  detectAmountGte,
  scanHistoryForCrmFocus,
  OPEN_STATUS_RE,
  LAST_MONTH_RE,
  CLOSED_RE,
};
