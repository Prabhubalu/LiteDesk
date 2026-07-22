'use strict';

/**
 * Coworker-style synthesis helpers — priority focus + next steps from
 * grounded CRM facts (never invents records).
 */

const MS_DAY = 86400000;

function money(amount) {
  if (amount == null || amount === '') return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return n;
}

function fmtMoney(amount) {
  const n = money(amount);
  if (n == null) return null;
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n}`;
}

function daysFromNow(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / MS_DAY);
}

function daysSince(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / MS_DAY);
}

/**
 * Rank open deals for "near-term focus".
 * Higher score = more urgent attention.
 */
function scoreDeal(deal) {
  let score = 0;
  const amount = money(deal.amount) || 0;
  const untilClose = daysFromNow(deal.expectedCloseDate);
  const sinceActivity = daysSince(deal.lastActivityDate || deal.updatedAt);

  if (amount >= 50000) score += 3;
  else if (amount >= 10000) score += 2;
  else if (amount > 0) score += 1;

  if (untilClose != null && untilClose <= 7) score += 5;
  else if (untilClose != null && untilClose <= 21) score += 3;
  else if (untilClose != null && untilClose < 0) score += 4; // overdue close

  if (sinceActivity != null && sinceActivity >= 21) score += 4;
  else if (sinceActivity != null && sinceActivity >= 10) score += 2;

  const stage = String(deal.stage || deal.subtitle || '').toLowerCase();
  if (/negotiat|contract|proposal|verbal/.test(stage)) score += 2;

  return score;
}

function describeDealFocus(deal) {
  const bits = [];
  const amt = fmtMoney(deal.amount);
  const stage = deal.stage || (deal.subtitle || '').split('·')[0]?.trim();
  if (amt) bits.push(amt);
  if (stage) bits.push(stage);

  const reasons = [];
  const untilClose = daysFromNow(deal.expectedCloseDate);
  const sinceActivity = daysSince(deal.lastActivityDate || deal.updatedAt);
  if (untilClose != null && untilClose < 0) {
    reasons.push(`close date was ${Math.abs(untilClose)} day${Math.abs(untilClose) === 1 ? '' : 's'} ago`);
  } else if (untilClose != null && untilClose <= 14) {
    reasons.push(`close date is in ${untilClose} day${untilClose === 1 ? '' : 's'}`);
  }
  if (sinceActivity != null && sinceActivity >= 10) {
    reasons.push(sinceActivity >= 21 ? 'no recent activity' : `${sinceActivity} days since last activity`);
  }
  return {
    label: bits.length ? `${deal.title || deal.name} (${bits.join(', ')})` : (deal.title || deal.name),
    reasons,
  };
}

/**
 * Build a coworker narrative + action chips from a status-brief related payload.
 */
function synthesizeOrgStatusNarrative({ title, related }) {
  const contacts = related.people?.items || [];
  const deals = [...(related.openDeals?.items || [])].sort((a, b) => scoreDeal(b) - scoreDeal(a));
  const cases = related.openCases?.items || [];
  const tasks = related.openTasks?.items || [];
  const overdue = Number(related.openTasks?.overdue || 0);
  const recentClosed = related.recentClosed?.items || [];
  const status = related.record?.derivedStatus || related.record?.customerStatus || related.record?.status;
  const industry = related.record?.industry;

  const primaryContact = contacts[0];
  const focusDeal = deals[0] ? describeDealFocus(deals[0]) : null;

  const paragraphs = [];
  const actions = [];

  // Opening — judgment, not a metric dump
  if (deals.length === 0 && cases.length === 0 && tasks.length === 0) {
    const who = primaryContact
      ? `${primaryContact.title}${primaryContact.subtitle ? ` (${primaryContact.subtitle})` : ''}`
      : null;
    let open = `${title} looks quiet right now — no open deals, cases, or tasks on the books`;
    if (status || industry) {
      open += ` (${[status, industry].filter(Boolean).join(', ')})`;
    }
    open += '.';
    if (who) {
      open += ` You do have ${contacts.length === 1 ? 'a linked contact' : `${contacts.length} linked contacts`}: ${who}.`;
    } else {
      open += ' There isn’t even a linked contact yet, so this account is essentially cold.';
    }
    if (recentClosed.length) {
      open += ` Last closed motion I see: ${recentClosed[0].title}${recentClosed[0].subtitle ? ` — ${recentClosed[0].subtitle}` : ''}.`;
    }
    paragraphs.push(open);

    paragraphs.push(
      who
        ? `I’d treat this as a re-engage play: warm up ${primaryContact.title.split(' ')[0]}, then open a real opportunity so the account isn’t just sitting in the directory.`
        : `I’d start by attaching a primary contact, then create a first opportunity so Astra (and your pipeline) have something real to work.`,
    );

    if (who) {
      actions.push(`Draft a short check-in email to ${primaryContact.title}`);
      actions.push(`Create a deal for ${title}`);
      actions.push(`Open ${title}`);
    } else {
      actions.push(`Add a contact for ${title}`);
      actions.push(`Create a deal for ${title}`);
      actions.push(`Open ${title}`);
    }
  } else {
    const countLine = [];
    if (deals.length) {
      countLine.push(`${related.openDeals.total} open deal${related.openDeals.total === 1 ? '' : 's'}`);
      if (related.openDeals.amount > 0) countLine.push(`${fmtMoney(related.openDeals.amount)} in pipeline`);
    }
    if (cases.length) countLine.push(`${related.openCases.total} open case${related.openCases.total === 1 ? '' : 's'}`);
    if (tasks.length) {
      countLine.push(`${related.openTasks.total} open task${related.openTasks.total === 1 ? '' : 's'}`);
      if (overdue) countLine.push(`${overdue} overdue`);
    }

    let open = `Here’s how ${title} looks: ${countLine.join(', ')}.`;
    if (focusDeal) {
      open += ` The strongest near-term focus is ${focusDeal.label}`;
      if (focusDeal.reasons.length) open += ` — ${focusDeal.reasons.join(' and ')}`;
      open += '.';
    }
    paragraphs.push(open);

    const suggestBits = [];
    if (focusDeal) {
      suggestBits.push(`Send a short check-in on ${deals[0].title}`);
      suggestBits.push('Book a 20-min call this week');
      if (deals.length > 1) suggestBits.push('Review stage risk on the other open deals');
      actions.push(`Draft a follow-up for ${deals[0].title}`);
      actions.push(`Tell me more about ${deals[0].title}`);
      if (deals.length > 1) actions.push('Show open deals for this account');
    }
    if (overdue && tasks[0]) {
      suggestBits.push(`Clear overdue task “${tasks[0].title}” first`);
      actions.push(`Open task ${tasks[0].title}`);
    }
    if (cases[0]) {
      suggestBits.push(`Don’t let case “${cases[0].title}” stall the commercial conversation`);
      actions.push(`Summarize ${cases[0].title}`);
    }
    if (primaryContact && !focusDeal) {
      suggestBits.push(`Ping ${primaryContact.title} with a concrete next step`);
      actions.push(`Draft a short check-in email to ${primaryContact.title}`);
    }

    if (suggestBits.length) {
      paragraphs.push(`I’d suggest:\n${suggestBits.slice(0, 3).map((s) => `• ${s}`).join('\n')}`);
    }
  }

  // Ensure unique actions
  const seen = new Set();
  const suggestions = actions.filter((a) => {
    const k = a.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 4);

  return {
    lead: paragraphs.join('\n\n'),
    draft: [
      'COWORKER BRIEF (grounded facts — narrate like a sharp teammate, not a database):',
      ...paragraphs,
      '',
      'FACTS:',
      `org=${title}`,
      status ? `status=${status}` : null,
      industry ? `industry=${industry}` : null,
      `openDeals=${related.openDeals?.total ?? 0} pipeline=${related.openDeals?.amount ?? 0}`,
      `openCases=${related.openCases?.total ?? 0}`,
      `openTasks=${related.openTasks?.total ?? 0} overdue=${overdue}`,
      `contacts=${contacts.map((c) => c.title).join('; ') || '(none)'}`,
      focusDeal ? `focusDeal=${focusDeal.label}` : null,
      recentClosed[0] ? `recentClosed=${recentClosed[0].title}` : null,
      '',
      'Write 2 short paragraphs + an “I’d suggest:” list with 2–3 bullets. Plain text. Name real people/deals from FACTS only.',
    ].filter((line) => line != null).join('\n'),
    suggestions,
    focusDeal: deals[0] || null,
  };
}

/**
 * Pipeline list coaching for open-deals style answers.
 */
function synthesizePipelineNarrative({ hits = [], total = 0 }) {
  const deals = hits.map((h) => ({
    ...h,
    name: h.title,
    stage: (h.subtitle || '').split('·')[0]?.trim(),
    expectedCloseDate: h.expectedCloseDate || null,
    lastActivityDate: h.lastActivityDate || null,
  })).sort((a, b) => scoreDeal(b) - scoreDeal(a));

  const focus = deals[0] ? describeDealFocus(deals[0]) : null;
  const amountSum = deals.reduce((s, d) => s + (money(d.amount) || 0), 0);
  const paragraphs = [];
  const suggestions = [];

  if (!deals.length) {
    return {
      lead: "You don't have any open deals in pipeline right now. Want me to help spin up the next opportunity, or review recently closed ones?",
      draft: 'No open deals. Suggest creating a deal or reviewing won/lost.',
      suggestions: ['Create a new deal', 'Show won deals instead', 'Which accounts need a first opportunity?'],
    };
  }

  let open = `You have ${total || deals.length} open deal${(total || deals.length) === 1 ? '' : 's'}`;
  if (amountSum > 0) open += ` (~${fmtMoney(amountSum)} showing here)`;
  open += '.';
  if (focus) {
    open += ` The strongest near-term focus is ${focus.label}`;
    if (focus.reasons.length) open += ` — ${focus.reasons.join(' and ')}`;
    open += '.';
  }
  paragraphs.push(open);

  const bullets = [];
  if (focus) {
    bullets.push(`Send a short check-in on ${deals[0].title}`);
    bullets.push('Book a 20-min call this week');
    if (deals.length > 1) bullets.push('Review stage risks on the other deals');
    suggestions.push(`Draft a follow-up for ${deals[0].title}`);
    suggestions.push(`Tell me more about ${deals[0].title}`);
    suggestions.push('List my open deals');
  }
  paragraphs.push(`I’d suggest:\n${bullets.map((b) => `• ${b}`).join('\n')}`);

  return {
    lead: paragraphs.join('\n\n'),
    draft: [
      'COWORKER PIPELINE BRIEF (narrate — do not dump rows):',
      ...paragraphs,
      '',
      'Key deals for narration:',
      ...deals.slice(0, 8).map((d) => `• ${d.title}${d.amount != null ? ` · $${d.amount}` : ''}${d.stage ? ` · ${d.stage}` : ''}`),
      '',
      'Rewrite as a sharp teammate: context first, weave in names/amounts, then “I’d suggest:” with 2–3 bullets. Name the focus deal. No Markdown headings. No numbered inventory.',
    ].join('\n'),
    suggestions: suggestions.slice(0, 4),
    focusDeal: deals[0] || null,
  };
}

module.exports = {
  scoreDeal,
  describeDealFocus,
  synthesizeOrgStatusNarrative,
  synthesizePipelineNarrative,
  fmtMoney,
  daysFromNow,
  daysSince,
};
