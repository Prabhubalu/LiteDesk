'use strict';

/**
 * Build one shared CRM situation brief for Living Canvas hydrate,
 * then reuse it across specialist panel fills + timeline/comms seeds.
 */

const { buildSituationContext, formatSituationForLlm } = require('../astra/context/situationContext');

const FOCUS_ORDER = ['people', 'organizations', 'deals', 'cases', 'quotes', 'events', 'tasks'];
const PARTY_MODULES = new Set(['people', 'organizations', 'deals']);
const NOISE_TITLE_RE = /ReportsE2E|\bE2E\s*Event\b|seed\s*data|fixture\s*event/i;
const RELATED_FROM_FOCUS = new Set(['organizations', 'deals', 'cases', 'quotes']);

function normalizeModule(mk = '') {
  const k = String(mk || '').toLowerCase();
  if (k === 'organization' || k === 'org' || k === 'account') return 'organizations';
  if (k === 'person' || k === 'contact') return 'people';
  if (k === 'deal') return 'deals';
  if (k === 'case') return 'cases';
  if (k === 'quote') return 'quotes';
  if (k === 'task') return 'tasks';
  if (k === 'event') return 'events';
  return k;
}

function escapeRegExp(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isNoiseRelated(row = {}) {
  return NOISE_TITLE_RE.test(String(row.title || row.name || row.subtitle || ''));
}

function hasPartyFocus(focus = []) {
  return (Array.isArray(focus) ? focus : []).some((f) => PARTY_MODULES.has(normalizeModule(f.moduleKey)));
}

/** When CRM relationship graph is empty, still surface org/deal already on the canvas focus. */
function seedRelatedFromCanvasFocus(situation, focus = []) {
  if (!situation || typeof situation !== 'object') return situation;
  const related = [...(situation.related || [])];
  const seen = new Set(related.map((r) => `${normalizeModule(r.moduleKey)}:${r.id}`));
  for (const f of Array.isArray(focus) ? focus : []) {
    const mk = normalizeModule(f.moduleKey);
    if (!RELATED_FROM_FOCUS.has(mk)) continue;
    const id = String(f.recordId || '').trim();
    if (!id) continue;
    const key = `${mk}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    related.push({
      moduleKey: mk,
      id,
      title: String(f.recordName || mk),
      subtitle: 'canvas focus',
      status: null,
    });
  }
  situation.related = related.slice(0, 28);
  return situation;
}

/**
 * Drop E2E/fixture events and calendar noise not tied to the named party.
 */
function scrubSituationNoise(situation, partyName = '') {
  if (!situation || typeof situation !== 'object') return situation;
  const tokens = String(partyName || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  const keepRelated = (r) => {
    if (isNoiseRelated(r)) return false;
    // Keep all CRM-linked modules; only fixture/E2E titles are dropped.
    return true;
  };
  const droppedTitles = new Set(
    (situation.related || [])
      .filter((r) => !keepRelated(r))
      .map((r) => String(r.title || r.name || '').trim().toLowerCase())
      .filter(Boolean),
  );
  situation.related = (situation.related || []).filter(keepRelated);
  if (situation.llmText) {
    situation.llmText = String(situation.llmText)
      .split('\n')
      .filter((line) => {
        if (NOISE_TITLE_RE.test(line)) return false;
        const lower = line.toLowerCase();
        for (const title of droppedTitles) {
          if (title.length > 3 && lower.includes(title)) return false;
        }
        // Calendar/task lines without party token when we know the party
        if (tokens.length && /\b(event|meeting|standup|sync|call|task)\b/i.test(line)) {
          const mentionsParty = tokens.some((t) => new RegExp(escapeRegExp(t), 'i').test(line));
          if (!mentionsParty && /\b(scheduled|calendar|agenda for)\b/i.test(line)) return false;
        }
        return true;
      })
      .join('\n')
      .trim();
  }
  return situation;
}

function pickPrimaryFocus(focus = []) {
  const ranked = [...(Array.isArray(focus) ? focus : [])].sort((a, b) => {
    const ai = FOCUS_ORDER.indexOf(normalizeModule(a.moduleKey));
    const bi = FOCUS_ORDER.indexOf(normalizeModule(b.moduleKey));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return ranked[0] || null;
}

/**
 * Merge situation-related records into canvas focus for CRM widget binding.
 */
function mergeFocusFromSituation(focus = [], situation) {
  const out = [...(Array.isArray(focus) ? focus : [])];
  const seen = new Set(out.map((f) => `${normalizeModule(f.moduleKey)}:${f.recordId}`));
  const partyLocked = hasPartyFocus(out);
  const push = (moduleKey, recordId, recordName) => {
    const mk = normalizeModule(moduleKey);
    const id = String(recordId || '').trim();
    if (!mk || !id) return;
    // When party is known, never promote unrelated calendar/task rows into focus
    if (partyLocked && (mk === 'events' || mk === 'tasks')) return;
    if (isNoiseRelated({ title: recordName })) return;
    const key = `${mk}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ moduleKey: mk, recordId: id, recordName: recordName ? String(recordName) : undefined });
  };

  if (situation?.focus?.id) {
    push(situation.focus.moduleKey, situation.focus.id, situation.focus.title || situation.focus.name);
  }
  for (const r of situation?.related || []) {
    if (isNoiseRelated(r)) continue;
    push(r.moduleKey, r.id, r.title);
  }
  return out.sort((a, b) => {
    const ai = FOCUS_ORDER.indexOf(normalizeModule(a.moduleKey));
    const bi = FOCUS_ORDER.indexOf(normalizeModule(b.moduleKey));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function timelineItemsFromSituation(situation, prompt = '') {
  const items = [];
  for (const a of situation?.activities || []) {
    const label = String(a.message || a.action || '').trim();
    if (!label || NOISE_TITLE_RE.test(label)) continue;
    items.push({
      id: `act_${items.length + 1}`,
      label: label.slice(0, 160),
      at: a.at || undefined,
      meta: a.source || undefined,
    });
    if (items.length >= 6) break;
  }
  for (const e of (situation?.related || []).filter((r) => normalizeModule(r.moduleKey) === 'events')) {
    if (isNoiseRelated(e)) continue;
    items.push({
      id: `evt_${items.length + 1}`,
      label: String(e.title || 'Event').slice(0, 160),
      at: undefined,
      meta: e.subtitle || 'event',
    });
    if (items.length >= 8) break;
  }
  // Never invent a synthetic "Review timeline…" row — empty is correct.
  return items;
}

function isOpenTaskStatus(status = '') {
  return !/done|completed|cancelled|canceled|closed/i.test(String(status || ''));
}

/** Open CRM tasks from situation.related → checklist items. */
function openTaskItemsFromSituation(situation) {
  const items = [];
  for (const t of situation?.related || []) {
    if (normalizeModule(t.moduleKey) !== 'tasks') continue;
    if (!isOpenTaskStatus(t.status)) continue;
    const label = String(t.title || t.name || '').trim();
    if (!label || NOISE_TITLE_RE.test(label)) continue;
    items.push({
      id: String(t.id || `task_${items.length + 1}`),
      label: label.slice(0, 200),
      done: false,
      meta: t.status || t.subtitle || undefined,
    });
    if (items.length >= 8) break;
  }
  return items;
}

function relatedByModule(situation, moduleKey) {
  return (situation?.related || []).filter((r) => normalizeModule(r.moduleKey) === moduleKey);
}

/**
 * KPI strip from CRM signals only — no invented Health / Confirm / Check.
 * Relationship score may show Focus-only when that is all CRM has.
 */
function kpiMetricsFromSituation(situation, focus = [], title = '') {
  const metrics = [];
  const push = (label, value) => {
    const v = value == null ? '' : String(value).trim();
    // Reject only placeholder inventions — real CRM stages like "Review" are fine
    if (!v || v === '—' || /^check$/i.test(v) || /^confirm$/i.test(v)) return;
    metrics.push({ label, value: v.slice(0, 40) });
  };

  const dealFocus = (Array.isArray(focus) ? focus : []).find((f) => normalizeModule(f.moduleKey) === 'deals');
  const personFocus = (Array.isArray(focus) ? focus : []).find((f) => normalizeModule(f.moduleKey) === 'people');
  const orgFocus = (Array.isArray(focus) ? focus : []).find((f) => normalizeModule(f.moduleKey) === 'organizations');
  const name =
    dealFocus?.recordName
    || personFocus?.recordName
    || orgFocus?.recordName
    || situation?.focus?.title
    || situation?.focus?.name
    || '';
  if (name) push('Focus', name);

  const deals = relatedByModule(situation, 'deals');
  const dealRow = deals[0];
  let stage = String(dealRow?.status || dealRow?.subtitle || '').trim();
  if (/canvas focus/i.test(stage)) stage = '';
  if (!stage && situation?.focus?.status) {
    stage = String(situation.focus.status).trim();
  }
  // Deal card on canvas often has stage in focus name context — parse llm brief last
  if (!stage && situation?.llmText) {
    const m = String(situation.llmText).match(
      /\b(Negotiation|Proposal|Qualification|Discovery|Demo|Closed Won|Closed Lost|Prospecting|Review)\b/i,
    );
    if (m) stage = m[1];
  }
  if (stage) push('Stage', stage);

  const openTasks = openTaskItemsFromSituation(situation);
  if (situation) {
    push('Open tasks', String(openTasks.length));
  }

  const quotes = relatedByModule(situation, 'quotes');
  if (quotes.length) {
    const q = quotes[0];
    const qLabel = [q.title, q.status].filter(Boolean).join(' · ') || q.subtitle;
    if (qLabel && !/canvas focus/i.test(String(qLabel))) push('Quote', qLabel);
  }

  const emails = situation?.communications || [];
  if (emails.length) push('Emails', String(emails.length));

  const cases = relatedByModule(situation, 'cases').filter(
    (c) => !/closed|resolved|done/i.test(String(c.status || '')),
  );
  if (cases.length) push('Open cases', String(cases.length));

  if (!metrics.length) return [];
  // Relationship / health panels: show whatever CRM signals we have (even Focus + Open tasks)
  if (/relationship|health|score/i.test(String(title || ''))) {
    return metrics.slice(0, 4);
  }
  // Other KPI strips: prefer 2+ signals so we don't show a lonely vanity name
  if (metrics.length < 2) return metrics;
  return metrics.slice(0, 4);
}

/** CRM-grounded buying-signal bullets (quotes, emails, tasks, activity). */
function signalBulletsFromSituation(situation) {
  const lines = [];
  for (const q of relatedByModule(situation, 'quotes').slice(0, 3)) {
    const status = String(q.status || q.subtitle || '').trim();
    const title = String(q.title || 'Quote').trim();
    if (/expir/i.test(`${status} ${title}`)) {
      lines.push(`• Signal: Quote “${title.slice(0, 48)}” expired${status ? ` (${status})` : ''}`);
    } else {
      lines.push(`• Signal: Quote “${title.slice(0, 48)}”${status ? ` — ${status}` : ''}`);
    }
  }
  const inbound = (situation?.communications || []).filter(
    (c) => String(c.direction || '').toLowerCase() === 'inbound',
  );
  for (const c of inbound.slice(0, 2)) {
    const subject = String(c.subject || '').trim();
    if (subject) lines.push(`• Signal: Inbound email — ${subject.slice(0, 80)}`);
  }
  for (const c of (situation?.communications || []).slice(0, 2)) {
    if (String(c.direction || '').toLowerCase() === 'inbound') continue;
    const subject = String(c.subject || '').trim();
    if (subject && lines.length < 6) {
      lines.push(`• Signal: Email — ${subject.slice(0, 80)}`);
    }
  }
  const openTasks = openTaskItemsFromSituation(situation);
  if (openTasks.length) {
    lines.push(`• Signal: ${openTasks.length} open task${openTasks.length === 1 ? '' : 's'} on this account`);
  }
  const act = situation?.activities?.[0];
  if (act?.message && lines.length < 6) {
    lines.push(`• Signal: Recent activity — ${String(act.message).slice(0, 100)}`);
  }
  return lines.slice(0, 6).join('\n');
}

/** CRM-grounded risk bullets (expired quotes, open cases, stale activity). */
function riskBulletsFromSituation(situation) {
  const lines = [];
  for (const q of relatedByModule(situation, 'quotes')) {
    const blob = `${q.title || ''} ${q.status || ''} ${q.subtitle || ''}`;
    if (!/expir|reject|cancel/i.test(blob)) continue;
    lines.push(`• Risk: Quote “${String(q.title || 'Quote').slice(0, 48)}” — ${String(q.status || 'at risk').slice(0, 40)}`);
  }
  for (const c of relatedByModule(situation, 'cases').slice(0, 3)) {
    if (/closed|resolved|done/i.test(String(c.status || ''))) continue;
    lines.push(`• Risk: Open case “${String(c.title || 'Case').slice(0, 48)}”${c.status ? ` (${c.status})` : ''}`);
  }
  const act = situation?.activities?.[0];
  if (act?.at) {
    const days = Math.round((Date.now() - new Date(act.at).getTime()) / 86400000);
    if (Number.isFinite(days) && days >= 14) {
      lines.push(`• Risk: ${days} days since last recorded activity`);
    }
  }
  return lines.slice(0, 6).join('\n');
}

/** People rows from related — never invent roles. */
function stakeholderBulletsFromSituation(situation) {
  const lines = [];
  for (const p of relatedByModule(situation, 'people').slice(0, 6)) {
    const name = String(p.title || p.name || '').trim();
    if (!name || NOISE_TITLE_RE.test(name)) continue;
    const detail = String(p.subtitle || p.status || '').trim();
    lines.push(detail ? `• ${name}: ${detail.slice(0, 80)}` : `• ${name}`);
  }
  return lines.join('\n');
}

/**
 * Competitor lines only when CRM text already names competitors — never invent.
 */
function competitorBulletsFromSituation(situation) {
  const lines = [];
  const blob = [
    situation?.llmText || '',
    ...(situation?.activities || []).map((a) => a.message || ''),
    ...(situation?.related || []).map((r) => `${r.title || ''} ${r.subtitle || ''}`),
  ].join('\n');
  const re = /(?:competitor|competing\s+with|vs\.?|versus)\s*[:\-]?\s*([A-Z][A-Za-z0-9 .&-]{1,40})/gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(blob)) && lines.length < 4) {
    const name = String(m[1] || '').trim().replace(/[.,;]+$/, '');
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    lines.push(`• Competitor: ${name}`);
  }
  return lines.join('\n');
}

function commsItemsFromSituation(situation) {
  const items = [];
  for (const c of situation?.communications || []) {
    const subject = String(c.subject || '').trim();
    if (!subject) continue;
    items.push({
      label: subject.slice(0, 160),
      channel: c.direction === 'inbound' || c.direction === 'outbound' ? 'email' : (c.direction || 'email'),
    });
    if (items.length >= 6) break;
  }
  return items;
}

/**
 * @returns {Promise<{
 *   situation: object|null,
 *   llmText: string,
 *   focus: Array,
 *   timelineItems: Array,
 *   commsItems: Array,
 * }>}
 */
async function buildCanvasSituationBrief({
  organizationId,
  focus = [],
  prompt = '',
  canvasType = '',
  skipOrgExecutive = false,
} = {}) {
  const primary = pickPrimaryFocus(focus);
  const { isOrgScopedCanvas, buildOrgExecutiveBrief } = require('./orgExecutiveBrief');

  // Org-wide executive / board report — no deal/person required
  // (Prefer canvasBriefRegistry; keep for direct callers unless skipOrgExecutive)
  if (
    !skipOrgExecutive
    && organizationId
    && !primary?.recordId
    && isOrgScopedCanvas(canvasType, prompt)
  ) {
    try {
      const orgBrief = await buildOrgExecutiveBrief({ organizationId });
      return {
        situation: orgBrief.situation,
        llmText: orgBrief.llmText || '',
        focus: Array.isArray(focus) ? focus : [],
        timelineItems: [],
        commsItems: [],
        openTasks: orgBrief.openTasks || [],
        kpiMetrics: orgBrief.kpiMetrics || [],
        orgPanelMetrics: orgBrief.orgPanelMetrics || {},
        orgScoped: true,
        signalBullets: orgBrief.signalBullets || '',
        riskBullets: orgBrief.riskBullets || '',
        stakeholderBullets: '',
        competitorBullets: '',
      };
    } catch (err) {
      console.warn('[canvasSituationBrief] org executive brief failed:', err?.message || err);
    }
  }

  if (!organizationId || !primary?.moduleKey || !primary?.recordId) {
    return {
      situation: null,
      llmText: '',
      focus: Array.isArray(focus) ? focus : [],
      timelineItems: [],
      commsItems: [],
      openTasks: [],
      kpiMetrics: [],
      signalBullets: '',
      riskBullets: '',
      stakeholderBullets: '',
      competitorBullets: '',
    };
  }

  try {
    const situation = await buildSituationContext({
      organizationId,
      moduleKey: normalizeModule(primary.moduleKey),
      recordId: String(primary.recordId),
      name: primary.recordName || undefined,
    });

    // If person has linked org in focus, enrich with org situation related (best-effort)
    const orgFocus = (focus || []).find((f) => normalizeModule(f.moduleKey) === 'organizations');
    if (
      orgFocus?.recordId
      && normalizeModule(primary.moduleKey) === 'people'
      && String(orgFocus.recordId) !== String(primary.recordId)
    ) {
      try {
        const orgSit = await buildSituationContext({
          organizationId,
          moduleKey: 'organizations',
          recordId: String(orgFocus.recordId),
          name: orgFocus.recordName || undefined,
        });
        if (orgSit?.ok) {
          const related = [...(situation.related || [])];
          const seen = new Set(related.map((r) => `${r.moduleKey}:${r.id}`));
          for (const r of orgSit.related || []) {
            const key = `${r.moduleKey}:${r.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            related.push(r);
          }
          situation.related = related.slice(0, 28);
          const acts = [...(situation.activities || []), ...(orgSit.activities || [])]
            .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
            .slice(0, 16);
          situation.activities = acts;
          const emails = [...(situation.communications || []), ...(orgSit.communications || [])].slice(0, 8);
          situation.communications = emails;
          // Rebuild llmText after merge — do not concatenate raw org brief (avoids duplicate FOCUS dumps).
        }
      } catch (err) {
        console.warn('[canvasSituationBrief] org enrich failed:', err?.message || err);
      }
    }

    seedRelatedFromCanvasFocus(situation, focus);

    const partyName = primary.recordName
      || situation?.focus?.title
      || situation?.focus?.name
      || '';
    scrubSituationNoise(situation, partyName);
    situation.llmText = formatSituationForLlm(situation);

    const llmText = String(situation?.llmText || '').slice(0, 4500);
    const mergedFocus = mergeFocusFromSituation(focus, situation);

    return {
      situation: situation?.ok === false ? null : situation,
      llmText,
      focus: mergedFocus,
      timelineItems: timelineItemsFromSituation(situation, prompt),
      commsItems: commsItemsFromSituation(situation),
      openTasks: openTaskItemsFromSituation(situation),
      kpiMetrics: kpiMetricsFromSituation(situation, mergedFocus, ''),
      signalBullets: signalBulletsFromSituation(situation),
      riskBullets: riskBulletsFromSituation(situation),
      stakeholderBullets: stakeholderBulletsFromSituation(situation),
      competitorBullets: competitorBulletsFromSituation(situation),
    };
  } catch (err) {
    console.warn('[canvasSituationBrief] failed:', err?.message || err);
    return {
      situation: null,
      llmText: '',
      focus: Array.isArray(focus) ? focus : [],
      timelineItems: [],
      commsItems: [],
      openTasks: [],
      kpiMetrics: [],
      signalBullets: '',
      riskBullets: '',
      stakeholderBullets: '',
      competitorBullets: '',
    };
  }
}

module.exports = {
  buildCanvasSituationBrief,
  mergeFocusFromSituation,
  pickPrimaryFocus,
  timelineItemsFromSituation,
  commsItemsFromSituation,
  openTaskItemsFromSituation,
  kpiMetricsFromSituation,
  signalBulletsFromSituation,
  riskBulletsFromSituation,
  stakeholderBulletsFromSituation,
  competitorBulletsFromSituation,
  scrubSituationNoise,
  isNoiseRelated,
  hasPartyFocus,
  seedRelatedFromCanvasFocus,
};
