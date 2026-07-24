'use strict';

/**
 * Answer fidelity — keep tool hits + UI lists aligned to what the user asked.
 * Never dump a broader portfolio when the ask was semantic/filtered.
 */

/** Late-pipeline stage tokens (config-driven stage names; match flexibly). */
const NEAR_CLOSE_STAGE_RE = /\b(negotiat\w*|propos\w*|contract\w*|closing\w*|close\w*|verbal\w*|commit\w*|final\w*|signature\w*|legal\w*|procurement\w*|awaiting\s*sign\w*)\b/i;

const WON_STAGE_RE = /\b(won|closed[\s-]*won)\b/i;
const LOST_STAGE_RE = /\b(lost|closed[\s-]*lost|disqualif\w*)\b/i;


/**
 * @returns {{
 *   id: string|null,
 *   listTitle: string|null,
 *   stageRe: RegExp|null,
 *   sort: 'amount_desc'|'close_asc'|null,
 *   premiumLead: (n: number, sampleTitles: string[]) => string,
 * } | null}
 */
function interpretDealAsk(query = '') {
  const q = String(query || '').toLowerCase();
  if (!q) return null;

  if (/\b(near|close|closest|closing|about to close|almost closed|late stage|final stage|end of (the )?funnel|ready to close)\b/.test(q)
    || /\b(deals?|pipeline)\b[\s\S]{0,40}\b(near|close|closing)\b/.test(q)
    || /\b(near|close|closing)\b[\s\S]{0,40}\bdeals?\b/.test(q)) {
    return {
      id: 'near_close',
      listTitle: 'Deals near closure',
      stageRe: NEAR_CLOSE_STAGE_RE,
      sort: 'amount_desc',
      premiumLead: (n, titles) => {
        if (n === 0) return 'Nothing in late stages looks ready to close right now.';
        if (n === 1) return `${titles[0]} is the one closest to closing — open it to push the finish line.`;
        const named = titles.slice(0, 2).join(' and ');
        return n === 2
          ? `Two deals sit closest to close: ${named}.`
          : `${n} deals sit closest to close — starting with ${named}.`;
      },
    };
  }

  if (/\b(won|closed won|we won)\b/.test(q) && /\bdeals?\b/.test(q)) {
    return {
      id: 'won',
      listTitle: 'Won deals',
      stageRe: WON_STAGE_RE,
      sort: 'amount_desc',
      premiumLead: (n, titles) => (n
        ? `Here are ${n} won deal${n === 1 ? '' : 's'}${titles[0] ? `, led by ${titles[0]}` : ''}.`
        : 'No won deals match that ask.'),
    };
  }

  if (/\b(lost|closed lost)\b/.test(q) && /\bdeals?\b/.test(q)) {
    return {
      id: 'lost',
      listTitle: 'Lost deals',
      stageRe: LOST_STAGE_RE,
      sort: null,
      premiumLead: (n) => (n ? `${n} lost deal${n === 1 ? '' : 's'} matched.` : 'No lost deals matched.'),
    };
  }

  if (/\b(negotiat)/.test(q) && /\bdeals?\b/.test(q)) {
    return {
      id: 'negotiation',
      listTitle: 'Deals in negotiation',
      stageRe: /\bnegotiat\w*\b/i,
      sort: 'amount_desc',
      premiumLead: (n, titles) => (n
        ? `${n} deal${n === 1 ? '' : 's'} in negotiation${titles[0] ? ` — ${titles[0]} first` : ''}.`
        : 'No deals are in negotiation right now.'),
    };
  }

  if (/\b(proposal)/.test(q) && /\bdeals?\b/.test(q)) {
    return {
      id: 'proposal',
      listTitle: 'Deals in proposal',
      stageRe: /\bpropos\w*\b/i,
      sort: 'amount_desc',
      premiumLead: (n, titles) => (n
        ? `${n} deal${n === 1 ? '' : 's'} in proposal${titles[0] ? ` — lead with ${titles[0]}` : ''}.`
        : 'No proposal-stage deals matched.'),
    };
  }

  return null;
}

function hitStageText(hit) {
  return `${hit?.stage || ''} ${hit?.subtitle || ''} ${hit?.status || ''}`.trim();
}

function sortHits(hits, sort) {
  const list = [...(hits || [])];
  if (sort === 'amount_desc') {
    list.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  }
  return list;
}

function buildRowActions(hit, entity) {
  if (!hit?.title) return [];
  const title = hit.title;
  if (entity === 'deals') {
    return [
      { id: 'brief', label: 'Brief me', prompt: `Summarize the deal "${title}"` },
      { id: 'email', label: 'Draft follow-up', prompt: `Draft a follow-up email for the deal "${title}"` },
      { id: 'next', label: 'Next action', prompt: `What is the next best action for "${title}"?` },
    ];
  }
  if (entity === 'cases') {
    return [
      { id: 'brief', label: 'Brief me', prompt: `Summarize the case "${title}"` },
      { id: 'reply', label: 'Suggest reply', prompt: `Suggest a reply for case "${title}"` },
    ];
  }
  if (entity === 'people') {
    return [
      { id: 'brief', label: 'Brief me', prompt: `What do we know about ${title}?` },
      { id: 'email', label: 'Draft email', prompt: `Draft an email to ${title}` },
    ];
  }
  return [
    { id: 'brief', label: 'Brief me', prompt: `Tell me more about ${title}` },
  ];
}

/**
 * Narrow toolResult.hits to the user's ask; set list title + interactive actions.
 * @returns {object} toolResult (mutated copy)
 */
function applyAskFidelity(toolResult, query = '') {
  if (!toolResult || !Array.isArray(toolResult.hits)) return toolResult;

  const entity = toolResult.entity || 'records';
  const ask = entity === 'deals' ? interpretDealAsk(query) : null;

  let hits = toolResult.hits.map((h) => ({
    ...h,
    actions: buildRowActions(h, entity),
  }));

  if (ask?.stageRe) {
    hits = hits.filter((h) => ask.stageRe.test(hitStageText(h)));
    hits = sortHits(hits, ask.sort);
  }

  const titles = hits.map((h) => h.title).filter(Boolean);
  const total = hits.length;
  const listTitle = ask?.listTitle
    || (toolResult.openOnly && entity === 'deals' ? 'Open deals' : null);

  const leadOverride = ask
    ? ask.premiumLead(total, titles)
    : null;

  return {
    ...toolResult,
    hits,
    counts: {
      ...(toolResult.counts || {}),
      total,
      returned: hits.length,
      matchedAsk: Boolean(ask),
    },
    listTitle: listTitle || toolResult.listTitle || null,
    askFocus: ask?.id || null,
    leadOverride: leadOverride || toolResult.leadOverride || null,
    query: query || toolResult.query || '',
  };
}

/**
 * Mongo stage hint for pre-filter (best-effort; still post-filter hits).
 */
function stageMongoHintFromAsk(query, entity) {
  if (entity !== 'deals') return null;
  const ask = interpretDealAsk(query);
  if (!ask?.stageRe) return null;
  // Broad OR of late-stage tokens for server-side narrowing
  if (ask.id === 'near_close') {
    return {
      stage: {
        $regex: 'negotiat|proposal|propos|contract|closing|verbal|commit|final|signature|legal',
        $options: 'i',
      },
    };
  }
  if (ask.id === 'negotiation') return { stage: { $regex: 'negotiat', $options: 'i' } };
  if (ask.id === 'proposal') return { stage: { $regex: 'propos', $options: 'i' } };
  if (ask.id === 'won') return { stage: { $regex: 'won|closed.?won', $options: 'i' } };
  if (ask.id === 'lost') return { stage: { $regex: 'lost|closed.?lost', $options: 'i' } };
  return null;
}

module.exports = {
  interpretDealAsk,
  applyAskFidelity,
  stageMongoHintFromAsk,
  buildRowActions,
  NEAR_CLOSE_STAGE_RE,
};
