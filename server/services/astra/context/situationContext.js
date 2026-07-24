'use strict';

/**
 * situationContext — rich grounding for a focused CRM record.
 *
 * Loads the record, related records, recent activity (focus + key related),
 * and recent emails so Astra can reason about the *situation* instead of
 * dumping list-query results.
 */

const { getRecordContext } = require('../../recordContextService');
const { resolveModel, getModule, recordPathFor } = require('../tools/moduleCatalog');

const APP_KEY_BY_MODULE = Object.freeze({
  people: 'sales',
  organizations: 'sales',
  deals: 'sales',
  quotes: 'sales',
  tasks: 'sales',
  events: 'sales',
  items: 'sales',
  cases: 'helpdesk',
  documents: 'sales',
});

function appKeyFor(moduleKey) {
  const mk = String(moduleKey || '').toLowerCase();
  const fromCatalog = getModule(mk)?.appKey;
  return String(fromCatalog || APP_KEY_BY_MODULE[mk] || 'sales').toLowerCase();
}

function titleOf(row) {
  if (!row || typeof row !== 'object') return '';
  if (row.name) return String(row.name).trim();
  if (row.title) return String(row.title).trim();
  if (row.label) return String(row.label).trim();
  const person = [row.first_name, row.last_name, row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  if (person) return person;
  if (row.email) return String(row.email).trim();
  if (row.quoteNumber) return String(row.quoteNumber).trim();
  return '';
}

function flattenRelated(relationships = [], { perRel = 6, max = 28 } = {}) {
  const out = [];
  for (const rel of relationships || []) {
    const moduleKey = String(
      rel.targetModuleKey
      || rel.target?.moduleKey
      || rel.moduleKey
      || '',
    ).toLowerCase();
    const records = Array.isArray(rel.records) ? rel.records : [];
    for (const row of records.slice(0, perRel)) {
      const id = String(row._id || row.id || row.recordId || '').trim();
      if (!id) continue;
      out.push({
        relationshipKey: rel.relationshipKey || rel.label || rel.name || '',
        moduleKey: moduleKey || String(row.moduleKey || '').toLowerCase(),
        id,
        title: titleOf(row) || 'Untitled',
        status: row.status || row.stage || null,
        subtitle: [row.quoteNumber, row.stage, row.status, row.email].filter(Boolean).join(' · ') || null,
        href: recordPathFor(moduleKey || row.moduleKey, id),
      });
      if (out.length >= max) return out;
    }
  }
  return out;
}

function compactActivity(entry, source) {
  const at = entry.timestamp || entry.createdAt || entry.at || null;
  const action = entry.action || entry.type || 'activity';
  const message = entry.message
    || entry.payload?.message
    || entry.payload?.body
    || entry.details?.message
    || '';
  const actor = entry.user || entry.actor || entry.userName || '';
  return {
    at: at ? new Date(at).toISOString() : null,
    action: String(action),
    message: String(message || '').slice(0, 180),
    actor: typeof actor === 'string' ? actor : '',
    source,
  };
}

async function loadNativeActivityLogs(moduleKey, recordId, organizationId, deps = {}, limit = 12) {
  const model = resolveModel(moduleKey, deps);
  if (!model || typeof model.findOne !== 'function') return [];
  try {
    // Prefer tenant-scoped, then fall back without org filter (some embeds omit it in query edge cases).
    let row = null;
    try {
      let q = model.findOne({ _id: recordId, organizationId, deletedAt: null }).select('activityLogs email first_name last_name name');
      if (q && typeof q.lean === 'function') q = q.lean();
      row = await q;
    } catch {
      row = null;
    }
    if (!row) {
      let q2 = model.findOne({ _id: recordId, deletedAt: null }).select('activityLogs');
      if (q2 && typeof q2.lean === 'function') q2 = q2.lean();
      row = await q2;
    }
    const logs = Array.isArray(row?.activityLogs) ? row.activityLogs : [];
    return logs
      .slice()
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, limit)
      .map((e) => compactActivity({
        ...e,
        message: e.message || e.action || '',
      }, `${moduleKey}:${recordId}`));
  } catch {
    return [];
  }
}

async function loadRecordActivityCollection(moduleKey, recordId, organizationId, deps = {}, limit = 16) {
  try {
    const RecordActivity = deps?.models?.RecordActivity || require('../../../models/RecordActivity');
    // Schema stores recordId as String (see RecordActivity model).
    const rows = await RecordActivity.find({
      organizationId,
      moduleKey,
      recordId: String(recordId),
      type: 'activity',
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('action message details createdAt type content')
      .lean();
    return (rows || []).map((r) => compactActivity({
      timestamp: r.createdAt,
      action: r.action || r.type || 'activity',
      message: r.message || r.content || r.action || '',
      details: r.details,
    }, `${moduleKey}:${recordId}`));
  } catch {
    return [];
  }
}

async function loadCommunications(moduleKey, recordId, organizationId, deps = {}, limit = 10) {
  try {
    const mongoose = require('mongoose');
    const Communication = deps?.models?.Communication || require('../../../models/Communication');
    const oid = mongoose.Types.ObjectId.isValid(recordId)
      ? new mongoose.Types.ObjectId(recordId)
      : recordId;
    const rows = await Communication.find({
      organizationId,
      $or: [
        { 'relatedTo.moduleKey': moduleKey, 'relatedTo.recordId': oid },
        { 'relatedTo.moduleKey': moduleKey, 'relatedTo.recordId': String(recordId) },
      ],
    })
      .sort({ sentAt: -1, receivedAt: -1, createdAt: -1 })
      .limit(limit)
      .select('subject direction status sentAt receivedAt createdAt')
      .lean();
    return (rows || []).map((r) => ({
      subject: r.subject || '(no subject)',
      direction: r.direction || '',
      status: r.status || '',
      at: (r.sentAt || r.receivedAt || r.createdAt)
        ? new Date(r.sentAt || r.receivedAt || r.createdAt).toISOString()
        : null,
    }));
  } catch {
    return [];
  }
}

async function loadRecordGraph(organizationId, moduleKey, recordId) {
  const candidates = [
    appKeyFor(moduleKey),
    'sales',
    'platform',
    'helpdesk',
    'SALES',
    'PLATFORM',
  ].map((k) => String(k).toLowerCase());
  const tried = new Set();
  for (const appKey of candidates) {
    if (tried.has(appKey)) continue;
    tried.add(appKey);
    try {
      const full = await getRecordContext(organizationId, appKey, moduleKey, recordId);
      const relatedCount = Array.isArray(full?.relationships)
        ? full.relationships.reduce((n, r) => n + (Array.isArray(r.records) ? r.records.length : 0), 0)
        : 0;
      if (full?.record || relatedCount > 0) return full;
    } catch {
      /* try next app key */
    }
  }
  return null;
}

function pickRelatedForDeepActivity(related = []) {
  const priority = ['quotes', 'deals', 'cases', 'organizations', 'events', 'tasks'];
  const picked = [];
  for (const mk of priority) {
    for (const row of related) {
      if (row.moduleKey === mk && !picked.find((p) => p.id === row.id)) {
        picked.push(row);
        if (picked.length >= 4) return picked;
      }
    }
  }
  return picked;
}

function shortLabel(title, max = 36) {
  const t = String(title || '').trim();
  if (!t) return 'this record';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function firstNameFrom(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  const skip = new Set(['mr', 'mrs', 'ms', 'dr', 'miss']);
  while (parts.length) {
    const token = parts[0].toLowerCase().replace(/\./g, '');
    if (skip.has(token)) {
      parts.shift();
      continue;
    }
    break;
  }
  return parts[0] || String(fullName || '').trim() || 'them';
}

function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

function deriveSignals(focus, related, activities, communications) {
  const expiredQuotes = related.filter((r) => {
    if (!String(r.moduleKey || '').includes('quote')) return false;
    return /expir/i.test(`${r.status || ''} ${r.subtitle || ''} ${r.title || ''}`);
  });
  const openQuotes = related.filter((r) => {
    if (!String(r.moduleKey || '').includes('quote')) return false;
    return !/expir|rejected|cancelled|canceled|won|lost/i.test(String(r.status || ''));
  });
  const openDeals = related.filter((r) => r.moduleKey === 'deals'
    && !/won|lost|closed/i.test(String(r.status || '')));
  const negotiationDeals = openDeals.filter((r) => /negotiat|proposal|quote/i.test(`${r.status || ''} ${r.subtitle || ''}`));
  const openCases = related.filter((r) => r.moduleKey === 'cases'
    && !/closed|resolved|done/i.test(String(r.status || '')));
  const upcomingEvents = related.filter((r) => r.moduleKey === 'events');
  const orgs = related.filter((r) => r.moduleKey === 'organizations');
  const openTasks = related.filter((r) => r.moduleKey === 'tasks'
    && !/done|completed|cancelled|canceled/i.test(String(r.status || '')));
  const recentEmail = communications[0] || null;
  const recentInbound = communications.find((c) => String(c.direction || '').toLowerCase() === 'inbound') || null;
  const recentActivity = activities[0] || null;
  const quietDays = daysSince(recentActivity?.at || recentEmail?.at);
  return {
    focusTitle: focus?.title || focus?.name || 'this record',
    focusModule: focus?.moduleKey || '',
    expiredQuotes,
    openQuotes,
    openDeals,
    negotiationDeals,
    openCases,
    upcomingEvents,
    orgs,
    openTasks,
    recentEmail,
    recentInbound,
    recentActivity,
    quietDays,
    relatedCount: related.length,
    activityCount: activities.length,
    emailCount: communications.length,
  };
}

/**
 * Ranked, practical suggestion cards for NBA + follow-up chips.
 * Cards are signal-driven; generic fillers only when signals are thin.
 * @returns {Array<{ id: string, title: string, prompt: string, rationale: string, priority: number, risk: string, iconKey: string }>}
 */
function derivePracticalSuggestionCards(signals) {
  const name = signals.focusTitle || 'this record';
  const first = firstNameFrom(name);
  /** @type {Array<{ id: string, title: string, prompt: string, rationale: string, priority: number, risk: string, iconKey: string }>} */
  const items = [];

  const push = (item) => {
    if (!item?.prompt || !item?.title) return;
    if (items.some((x) => x.prompt === item.prompt || x.id === item.id)) return;
    items.push(item);
  };

  for (const q of signals.expiredQuotes.slice(0, 2)) {
    const label = shortLabel(q.title, 28);
    const num = q.subtitle && /QT-/i.test(q.subtitle) ? ` (${q.subtitle.split('·')[0].trim()})` : '';
    push({
      id: `expired-email-${q.id}`,
      title: `Email ${first} about ${label}`,
      prompt: `Draft an email to ${name} about the expired quote "${q.title}"${num}. Reference the quote, propose revising or renewing it, and suggest a short call.`,
      rationale: 'Quote expired — reopen the conversation before the deal cools.',
      priority: 100,
      risk: 'write',
      iconKey: 'envelope',
    });
    push({
      id: `expired-next-${q.id}`,
      title: `Next step for ${label}`,
      prompt: `Given expired quote "${q.title}"${num} on ${name}, what is the best practical next step — revise, re-send, discount, or close it out?`,
      rationale: 'Decide disposition before pipeline stalls.',
      priority: 96,
      risk: 'read',
      iconKey: 'document',
    });
  }

  for (const d of (signals.negotiationDeals.length ? signals.negotiationDeals : signals.openDeals).slice(0, 2)) {
    const label = shortLabel(d.title, 28);
    push({
      id: `deal-block-${d.id}`,
      title: `Unblock ${label}`,
      prompt: `What's blocking "${d.title}" linked to ${name}? Use related quotes, emails, and activity to recommend the single best next action.`,
      rationale: d.subtitle || d.status || 'Open deal needs a push.',
      priority: 90,
      risk: 'read',
      iconKey: 'briefcase',
    });
    push({
      id: `deal-update-${d.id}`,
      title: `Update email on ${label}`,
      prompt: `Draft a concise status-update email to ${name} about deal "${d.title}"${d.subtitle ? ` (${d.subtitle})` : ''}.`,
      rationale: 'Keep stakeholders aligned on the live deal.',
      priority: 82,
      risk: 'write',
      iconKey: 'envelope',
    });
  }

  for (const c of signals.openCases.slice(0, 1)) {
    const label = shortLabel(c.title, 28);
    push({
      id: `case-reply-${c.id}`,
      title: `Reply on case ${label}`,
      prompt: `Suggest a customer-ready reply for open case "${c.title}" related to ${name}, grounded on recent activity.`,
      rationale: 'Open case still needs a response.',
      priority: 88,
      risk: 'write',
      iconKey: 'ticket',
    });
  }

  for (const e of signals.upcomingEvents.slice(0, 1)) {
    const label = shortLabel(e.title, 32);
    push({
      id: `prep-${e.id}`,
      title: `Prep for ${label}`,
      prompt: `Help me prepare for "${e.title}" with ${name}. Use related deals, quotes, and recent emails for talking points.`,
      rationale: 'Upcoming conversation — walk in prepared.',
      priority: 86,
      risk: 'read',
      iconKey: 'calendar',
    });
  }

  if (signals.recentInbound?.subject) {
    push({
      id: 'reply-inbound',
      title: `Reply: ${shortLabel(signals.recentInbound.subject, 30)}`,
      prompt: `Draft a reply to the inbound email "${signals.recentInbound.subject}" for ${name}, using related deals/quotes and recent activity.`,
      rationale: 'Inbound mail waiting on a response.',
      priority: 93,
      risk: 'write',
      iconKey: 'envelope',
    });
  } else if (signals.recentEmail?.subject) {
    const age = daysSince(signals.recentEmail.at);
    push({
      id: 'follow-email',
      title: age != null && age >= 5
        ? `Nudge on "${shortLabel(signals.recentEmail.subject, 24)}"`
        : `Follow up: ${shortLabel(signals.recentEmail.subject, 28)}`,
      prompt: `Draft a follow-up email to ${name} about "${signals.recentEmail.subject}"${age != null ? ` (last touch ~${age}d ago)` : ''}.`,
      rationale: age != null && age >= 5
        ? `Last email was ~${age} days ago — a nudge is timely.`
        : 'Continue the latest email thread.',
      priority: age != null && age >= 5 ? 91 : 78,
      risk: 'write',
      iconKey: 'envelope',
    });
  }

  if (signals.quietDays != null && signals.quietDays >= 14) {
    push({
      id: 'reengage',
      title: `Re-engage ${first}`,
      prompt: `It's been about ${signals.quietDays} days since meaningful activity on ${name}. Propose a practical re-engagement plan using related deals/quotes.`,
      rationale: `Quiet for ~${signals.quietDays} days — risk of going cold.`,
      priority: 84,
      risk: 'read',
      iconKey: 'user',
    });
  }

  if (signals.orgs[0] && signals.focusModule === 'people') {
    const org = signals.orgs[0];
    push({
      id: `org-pulse-${org.id}`,
      title: `Check ${shortLabel(org.title, 26)}`,
      prompt: `How does ${org.title} look overall for ${name}? Summarize open deals, quotes, and risks.`,
      rationale: 'Account context behind this contact.',
      priority: 70,
      risk: 'read',
      iconKey: 'building',
    });
  }

  for (const t of signals.openTasks.slice(0, 1)) {
    push({
      id: `task-${t.id}`,
      title: `Finish: ${shortLabel(t.title, 28)}`,
      prompt: `What's the status of open task "${t.title}" related to ${name}, and what should I do next?`,
      rationale: 'Open task still on the board.',
      priority: 72,
      risk: 'read',
      iconKey: 'task',
    });
  }

  const signalCount = items.length;
  // Only when the record has no actionable signals — never pad over live cards.
  if (signalCount === 0) {
    push({
      id: 'situation-brief',
      title: `Situation brief: ${shortLabel(name, 24)}`,
      prompt: `Summarize the current situation for ${name} using related records, recent emails, and activity. End with the single best next action.`,
      rationale: 'Full picture before you act.',
      priority: 65,
      risk: 'read',
      iconKey: 'sparkles',
    });
    push({
      id: 'nba',
      title: `Best next action for ${first}`,
      prompt: `What is the single best practical next action for ${name} right now, given related deals, quotes, cases, and recent activity?`,
      rationale: 'One clear move — not a list dump.',
      priority: 60,
      risk: 'read',
      iconKey: 'bolt',
    });
  }

  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, 5);
}

/** @deprecated string prompts for chat chips — prefer suggestionCards */
function derivePracticalSuggestions(signals) {
  return derivePracticalSuggestionCards(signals).map((c) => c.prompt);
}

function formatSituationForLlm(situation) {
  const lines = [];
  const f = situation.focus || {};
  lines.push(`FOCUS: [${f.moduleKey || '?'}] ${f.title || f.name || 'record'}${f.id ? ` id=${f.id}` : ''}`);
  if (f.subtitle) lines.push(`FOCUS DETAIL: ${f.subtitle}`);

  if (situation.related?.length) {
    lines.push('RELATED RECORDS:');
    for (const r of situation.related.slice(0, 16)) {
      lines.push(`- [${r.moduleKey}] ${r.title}${r.subtitle ? ` · ${r.subtitle}` : ''}${r.status ? ` · ${r.status}` : ''}`);
    }
  } else {
    lines.push('RELATED RECORDS: (none loaded)');
  }

  if (situation.communications?.length) {
    lines.push('RECENT EMAILS:');
    for (const c of situation.communications.slice(0, 6)) {
      lines.push(`- ${c.direction || 'email'} · ${c.subject}${c.at ? ` · ${c.at.slice(0, 10)}` : ''}${c.status ? ` · ${c.status}` : ''}`);
    }
  }

  if (situation.activities?.length) {
    lines.push('RECENT ACTIVITY (focus + related):');
    for (const a of situation.activities.slice(0, 12)) {
      const msg = a.message || a.action;
      lines.push(`- ${a.at ? a.at.slice(0, 10) : '?'} · ${a.source || ''} · ${msg}`);
    }
  }

  const s = situation.signals || {};
  lines.push('SITUATION SIGNALS:');
  if (s.expiredQuotes?.length) {
    lines.push(`- Expired quotes: ${s.expiredQuotes.map((q) => q.title).join(', ')}`);
  }
  if (s.openDeals?.length) {
    lines.push(`- Open deals: ${s.openDeals.map((d) => d.title).join(', ')}`);
  }
  if (s.openCases?.length) {
    lines.push(`- Open cases: ${s.openCases.map((c) => c.title).join(', ')}`);
  }
  if (s.recentEmail) {
    lines.push(`- Latest email: ${s.recentEmail.subject}`);
  }
  if (!s.expiredQuotes?.length && !s.openDeals?.length && !s.openCases?.length) {
    lines.push('- No urgent commercial signals detected from related records.');
  }

  lines.push(
    'INSTRUCTION: Use this situation to give practical next-step advice. '
    + 'Do not dump inventories. Prioritize what matters now for the user.',
  );
  return lines.join('\n');
}

/**
 * @param {{
 *   organizationId: string,
 *   moduleKey: string,
 *   recordId: string,
 *   name?: string,
 *   deps?: object,
 * }} input
 */
async function buildSituationContext(input = {}) {
  const organizationId = input.organizationId;
  const moduleKey = String(input.moduleKey || '').trim().toLowerCase();
  const recordId = String(input.recordId || '').trim();
  const deps = input.deps || {};

  if (!organizationId || !moduleKey || !recordId) {
    return {
      ok: false,
      focus: null,
      related: [],
      activities: [],
      communications: [],
      signals: {},
      suggestions: [],
      llmText: '',
    };
  }

  let related = [];
  let focusTitle = input.name || '';
  let focusSubtitle = '';
  let focusEmail = '';

  try {
    const full = await loadRecordGraph(organizationId, moduleKey, recordId);
    const rec = full?.record || {};
    focusTitle = titleOf(rec) || focusTitle || recordId;
    focusEmail = rec.email || '';
    focusSubtitle = [rec.status, rec.stage, rec.email, rec.quoteNumber].filter(Boolean).join(' · ');
    related = flattenRelated(full?.relationships || []);
  } catch {
    /* fall through */
  }

  if (!focusTitle || focusTitle === recordId) {
    try {
      const model = resolveModel(moduleKey, deps);
      if (model) {
        let q = model.findOne({ _id: recordId, deletedAt: null });
        if (q && typeof q.lean === 'function') q = q.lean();
        const row = await q;
        focusTitle = titleOf(row) || focusTitle || recordId;
        focusEmail = focusEmail || row?.email || '';
        if (focusEmail && !focusSubtitle.includes(focusEmail)) {
          focusSubtitle = [focusSubtitle, focusEmail].filter(Boolean).join(' · ');
        }
      }
    } catch {
      /* ignore */
    }
  }

  const focus = {
    moduleKey,
    id: recordId,
    title: focusTitle,
    name: focusTitle,
    subtitle: focusSubtitle,
    email: focusEmail || null,
    href: recordPathFor(moduleKey, recordId),
  };

  const deepRelated = pickRelatedForDeepActivity(related);
  const [focusEmbedded, focusCollection, communications, ...relatedActivities] = await Promise.all([
    loadNativeActivityLogs(moduleKey, recordId, organizationId, deps, 12),
    loadRecordActivityCollection(moduleKey, recordId, organizationId, deps, 16),
    loadCommunications(moduleKey, recordId, organizationId, deps, 10),
    ...deepRelated.map((r) => loadNativeActivityLogs(r.moduleKey, r.id, organizationId, deps, 4)),
  ]);

  // Promote email subjects from activity messages when Communication rows are sparse.
  const activities = [...focusCollection, ...focusEmbedded, ...relatedActivities.flat()]
    .filter((a) => a && (a.message || a.action))
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 24);

  let emails = communications;
  if (!emails.length) {
    const fromActivity = activities
      .filter((a) => /email|mail|sent|received/i.test(`${a.action} ${a.message}`))
      .slice(0, 8)
      .map((a) => ({
        subject: a.message || a.action,
        direction: /received|inbound/i.test(`${a.action} ${a.message}`) ? 'inbound' : 'outbound',
        status: 'activity',
        at: a.at,
      }));
    emails = fromActivity;
  }

  const signals = deriveSignals(focus, related, activities, emails);
  const suggestionCards = derivePracticalSuggestionCards(signals);
  const suggestions = suggestionCards.map((c) => c.prompt);
  const situation = {
    ok: true,
    focus,
    related,
    activities,
    communications: emails,
    signals,
    suggestionCards,
    suggestions,
  };
  situation.llmText = formatSituationForLlm(situation);
  // Never claim the record is missing when we resolved a focus title.
  if (!situation.related.length && !situation.activities.length && !situation.communications.length) {
    situation.llmText += `\nNOTE: Focus record "${focus.title}" exists. Related/activity may be sparse — do NOT say the contact is missing or misspelled.`;
  }
  return situation;
}

module.exports = {
  buildSituationContext,
  derivePracticalSuggestions,
  derivePracticalSuggestionCards,
  formatSituationForLlm,
  flattenRelated,
  appKeyFor,
};
