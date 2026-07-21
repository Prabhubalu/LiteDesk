'use strict';

const {
  ASTRA_PIPELINE_INTENTS,
  emptyIntentResult,
} = require('../orchestrator/pipelineTypes');

const PRODUCT_HOWTO_RE = /\b(how\s+do\s+i|how\s+to|where\s+(do|can)\s+i|what\s+is\s+the\s+(way|process)|help\s+me\s+(set\s+up|configure|create|convert)|product\s+help|user\s+guide|documentation)\b/i;
const PRODUCT_EXPERTISE_RE = /\b(what\s+(apps?|modules?|fields?|apis?|endpoints?|features?|permissions?|roles?|profiles?|settings?|automations?|processes?|sla|policies)\b|which\s+(apps?|modules?|fields?|roles?|apis?)\b|list\s+(apps?|modules?|fields?|roles?|automations?|processes?|apis?)\b|does\s+(this|the)\s+(product|crm|app|platform)\b|explain\s+(the\s+)?(module|field|app|api|feature|permission|role|automation|process|sla)\b|how\s+does\s+.+\s+work\b|what\s+is\s+(a\s+)?(deal|quote|case|module|field|app|process|sla|role)\b|field\s+key|module\s+key|enabled\s+apps?|sharing\s+rules?|assignment\s+rules?|process\s+designer|business\s+rules?)\b/i;
const HEALTH_RE = /\b(health|healthy|at\s+risk|churn|account\s+health|customer\s+health|how\s+healthy\s+is)\b/i;
const STALLED_DEALS_RE = /\b(stalled|stuck|not\s+moving|no\s+progress|idle)\b.+\bdeals?\b|\bdeals?\b.+\b(stalled|stuck|not\s+moving|idle)\b/i;
const AT_RISK_SCAN_RE = /\b(accounts?|customers?)\s+(at\s+risk|churning|churn\s+risk)\b|\bat[- ]risk\s+(accounts?|customers?)\b|\bwhich\s+accounts?\s+(are\s+)?at\s+risk\b/i;
const STICKY_FILTER_RE = /\b(only\s+open|open\s+ones|only\s+closed|closed\s+ones|last\s+month|previous\s+month|only\s+won|won\s+ones|only\s+lost|lost\s+ones)\b/i;
const EMAIL_OR_WRITE_RE = /\b(draft|write|compose|send)\s+(an?\s+)?email\b|\bemail\s+to\b/i;
/** Amount / metric / stage analytics — must use legacy runCrmDataAsk, not keyword SearchDeals. */
const CRM_ANALYTICS_RE = /\b(\d+\s*k\b|\$\s*[\d,.]+|\d+[\d,.]*\s*\$|amount|value|revenue|greater\s+than|less\s+than|over\s*\$?\s*[\d,.]+|under\s*\$?\s*[\d,.]+|pipeline|by\s+stage|in\s+closure|closing|won|lost|forecast|(?:pie|bar|donut|line)\s*charts?)\b/i;
const ACCOUNT_STOPWORDS = new Set([
  'this', 'that', 'the', 'my', 'our', 'their', 'a', 'an', 'customer', 'account',
  'company', 'org', 'organization', 'deal', 'deals', 'them', 'it', 'crm',
  'list', 'show', 'give', 'me', 'which', 'having',
]);

function extractAccountHint(question = '', memory = {}) {
  const fromMemory = String(memory.accountHint || memory.currentAccount || '').trim();
  const q = String(question || '').trim();
  const quoted = q.match(/[“”"']([^“”"']{2,80})[“”"']/);
  if (quoted?.[1]) return quoted[1].trim();

  // "Show Vtiger CRM deals" / "list Acme Corp deals"
  const showDeals = q.match(
    /\b(?:show|list|get|give\s+me)\s+(?:the\s+)?(.+?)\s+deals?\b/i,
  );
  if (showDeals?.[1]) {
    const raw = showDeals[1]
      .replace(/\b(me|the|all|my|our)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (raw.length >= 2 && !ACCOUNT_STOPWORDS.has(raw.toLowerCase())) {
      return raw;
    }
  }

  const named = q.match(/\b(?:for|about|of|with)\s+([A-Z][\w&.-]{1,40}(?:\s+[A-Z][\w&.-]{1,40}){0,3})\b/);
  if (named?.[1] && !ACCOUNT_STOPWORDS.has(named[1].toLowerCase())) return named[1].trim();
  const healthName = q.match(/\b(?:how\s+is|how's|how\s+healthy\s+is)\s+([A-Za-z][\w&.-]{1,40}(?:\s+[A-Za-z][\w&.-]{1,40}){0,2})\b/i);
  if (healthName?.[1]) {
    const hint = healthName[1].trim();
    const first = hint.split(/\s+/)[0].toLowerCase();
    if (!ACCOUNT_STOPWORDS.has(first) && !ACCOUNT_STOPWORDS.has(hint.toLowerCase())) {
      return hint;
    }
  }
  const atRisk = q.match(
    /\b(?:is|how's|how\s+is)\s+([A-Z][\w&.-]{1,40}(?:\s+[A-Z][\w&.-]{1,40}){0,2})\s+at\s+risk\b/i,
  );
  if (atRisk?.[1] && !ACCOUNT_STOPWORDS.has(atRisk[1].split(/\s+/)[0].toLowerCase())) {
    return atRisk[1].trim();
  }
  return fromMemory;
}

function needsLegacyCrmDataAsk(question = '') {
  const q = String(question || '').trim();
  if (!q) return false;
  if (CRM_ANALYTICS_RE.test(q)) return true;
  const crmModule = /\b(deals?|tasks?|cases?|tickets?|quotes?|events?|people|contacts?|organizations?|accounts?)\b/i;
  // Primary "show/list …" CRM module asks → legacy analytics planner
  if (/\b(show|list|give\s+me|get)\b/i.test(q) && crmModule.test(q) && !STICKY_FILTER_RE.test(q)) {
    return true;
  }
  if (/\b(which|what)\s+(deals?|tasks?|cases?|tickets?|quotes?)\b/i.test(q)) return true;
  if (/\b(open|won|lost)\s+deals?\b/i.test(q) || /\bdeals?\s+(?:that\s+are\s+|which\s+are\s+)?(open|won|lost)\b/i.test(q)) {
    return true;
  }
  // Diagnostic closure asks (avoid matching sticky "only closed ones")
  if (
    /\bdeals?\b/i.test(q)
    && /\b(why|still|expedite|closure\s+state).{0,60}\b(closed|closure|closing)\b/i.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * Deterministic Intent Analyzer for Phase-1 MVP intents.
 * Returns structured IntentResult (no LLM required for fixtures).
 */
function analyzeIntent({ question = '', memory = {}, routeIntent = null } = {}) {
  const q = String(question || '').trim();
  const accountHint = extractAccountHint(q, memory);
  const filters = { ...(memory.filters || {}) };
  const dateRange = memory.dateRange || null;

  if (EMAIL_OR_WRITE_RE.test(q)) {
    return {
      ...emptyIntentResult({
        intent: '__defer__',
        understanding: 'Non-MVP intent (email/write)',
        route_hint: 'legacy',
      }),
      deferToLegacy: true,
    };
  }

  // Amount / stage / "show X deals" → legacy runCrmDataAsk (correct filters + org scope)
  // Product how-to wins even when the question mentions deals/fields.
  if (PRODUCT_HOWTO_RE.test(q) && !HEALTH_RE.test(q)) {
    return emptyIntentResult({
      intent: 'ProductHowTo',
      entities: [],
      filters: {},
      dateRange: null,
      required_information: ['ProductDocumentation', 'ProductCatalog'],
      needs_clarification: false,
      clarifying_question: null,
      route_hint: 'product_knowledge',
      understanding: 'Product how-to / documentation question',
      accountHint: '',
    });
  }

  if (needsLegacyCrmDataAsk(q)) {
    return {
      ...emptyIntentResult({
        intent: '__defer__',
        understanding: 'CRM analytics / filtered list — use legacy crm_data path',
        route_hint: 'crm_data',
        accountHint,
      }),
      deferToLegacy: true,
    };
  }

  if (
    memory.sticky
    && (memory.lastIntent === 'CrmListFilter' || memory.anchors?.length || memory.lastModuleKey)
    && STICKY_FILTER_RE.test(q)
  ) {
    return emptyIntentResult({
      intent: 'CrmListFilter',
      entities: accountHint ? ['Account'] : [],
      filters,
      dateRange,
      required_information: [memory.lastModuleKey === 'cases' ? 'SupportTickets' : 'Deals'],
      accountHint,
      route_hint: 'crm_data',
      understanding: 'Apply conversation filters to the current CRM list focus',
      moduleKey: memory.lastModuleKey || 'deals',
    });
  }

  // Stalled / stuck deals → legacy CRM diagnostic list (closing stages + coaching)
  if (STALLED_DEALS_RE.test(q) || (/\bstalled\b|\bstuck\b/i.test(q) && /\bdeals?\b/i.test(q))) {
    return {
      ...emptyIntentResult({
        intent: '__defer__',
        understanding: 'Stalled/stuck deals — list late-stage open deals with next steps',
        route_hint: 'crm_data',
        accountHint,
      }),
      deferToLegacy: true,
    };
  }

  // Plural at-risk accounts scan (no single account) — proactive multi-hop
  if (AT_RISK_SCAN_RE.test(q) && !accountHint) {
    return emptyIntentResult({
      intent: 'CustomerHealthAnalysis',
      entities: ['Account'],
      filters: {},
      dateRange,
      required_information: ['Account', 'SupportTickets', 'Activities', 'Deals'],
      needs_clarification: false,
      clarifying_question: null,
      route_hint: 'hybrid',
      understanding: 'Proactive at-risk account scan across open tickets and stalled deals',
      accountHint: '',
      proactiveScan: true,
    });
  }

  if (PRODUCT_EXPERTISE_RE.test(q) && !HEALTH_RE.test(q) && !needsLegacyCrmDataAsk(q)) {
    return emptyIntentResult({
      intent: 'ProductExpertise',
      entities: [],
      filters: {},
      dateRange: null,
      required_information: ['ProductCatalog', 'ProductDocumentation'],
      needs_clarification: false,
      clarifying_question: null,
      route_hint: 'product_knowledge',
      understanding: 'Product structure / apps / modules / fields / APIs question',
      accountHint: '',
    });
  }

  if (HEALTH_RE.test(q) || /\b(customer|account)\s+health\b/i.test(q)) {
    // "accounts at risk" without a name is handled above as proactiveScan
    const needsClarify = !accountHint && !AT_RISK_SCAN_RE.test(q);
    return emptyIntentResult({
      intent: 'CustomerHealthAnalysis',
      entities: ['Account'],
      filters: accountHint ? { account: accountHint } : {},
      dateRange,
      required_information: ['Account', 'SupportTickets', 'Activities', 'Deals'],
      needs_clarification: needsClarify,
      clarifying_question: needsClarify
        ? 'Which account should I analyze?'
        : null,
      route_hint: 'hybrid',
      understanding: accountHint
        ? `Analyze customer health for ${accountHint}`
        : 'Customer health analysis (account missing)',
      accountHint,
    });
  }

  // Also defer when legacy router already marked crm_data
  if (routeIntent?.route === 'crm_data') {
    return {
      ...emptyIntentResult({
        intent: '__defer__',
        understanding: routeIntent.understanding || 'CRM data (legacy)',
        route_hint: 'crm_data',
        accountHint,
      }),
      deferToLegacy: true,
    };
  }

  if (routeIntent?.route === 'general' && PRODUCT_HOWTO_RE.test(q)) {
    return emptyIntentResult({
      intent: 'ProductHowTo',
      required_information: ['ProductDocumentation'],
      route_hint: 'product_knowledge',
      understanding: routeIntent.understanding || 'Product how-to',
    });
  }

  return {
    ...emptyIntentResult({
      intent: '__defer__',
      understanding: 'Not a Phase-1 pipeline intent',
      route_hint: 'legacy',
    }),
    deferToLegacy: true,
  };
}

function isMvpPipelineIntent(intentResult) {
  if (!intentResult || intentResult.deferToLegacy) return false;
  return ASTRA_PIPELINE_INTENTS.includes(intentResult.intent);
}

module.exports = {
  analyzeIntent,
  isMvpPipelineIntent,
  extractAccountHint,
  needsLegacyCrmDataAsk,
  PRODUCT_HOWTO_RE,
  PRODUCT_EXPERTISE_RE,
  HEALTH_RE,
  STICKY_FILTER_RE,
  CRM_ANALYTICS_RE,
  STALLED_DEALS_RE,
  AT_RISK_SCAN_RE,
};
