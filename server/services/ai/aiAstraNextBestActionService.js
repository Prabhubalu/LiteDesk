'use strict';

/**
 * Deterministic Next Best Action ranker for Astra.
 * Grounded on Attention, stale deals, open cases, resume, and conversation anchors.
 * Writes are always propose→confirm (executeNow: false).
 */

const Deal = require('../../models/Deal');
const Case = require('../../models/Case');
const { buildInboxItemsForUser } = require('../../controllers/inboxController');

const MAX_NBA = 3;
const STALE_DEAL_DAYS = 14;
const CASE_STALE_REPLY_DAYS = 3;
const CLOSED_CASE_STATUSES = ['Resolved', 'Closed'];
const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

function isMongoId(value) {
  return MONGO_ID_RE.test(String(value || '').trim());
}

function daysBetween(from, to = new Date()) {
  const a = from ? new Date(from) : null;
  if (!a || Number.isNaN(a.getTime())) return null;
  return Math.max(0, Math.floor((to.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)));
}

function isDueToday(dueAt, now = new Date()) {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return due >= start && due < end;
}

function trimTitle(value, fallback = 'record', max = 48) {
  const text = String(value || '').trim() || fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function actionKey(action) {
  return [
    String(action?.kind || ''),
    String(action?.moduleKey || ''),
    String(action?.recordId || ''),
  ].join(':');
}

function makeAction({
  label,
  kind,
  moduleKey,
  recordId,
  rationale,
  priority = 'medium',
  fields = null,
  executeNow = undefined,
  targetLabel = '',
}) {
  const mk = String(moduleKey || '').trim().toLowerCase();
  const rid = String(recordId || '').trim();
  const k = String(kind || 'review_record').trim();
  // create_record proposes a new row — recordId optional (related deal lives in fields).
  if (!mk) return null;
  if (k !== 'create_record' && !isMongoId(rid)) return null;
  if (k === 'create_record' && rid && !isMongoId(rid)) return null;
  const action = {
    label: String(label || '').trim().slice(0, 120),
    kind: k,
    moduleKey: mk,
    rationale: String(rationale || '').trim().slice(0, 200),
    priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
    targetLabel: String(targetLabel || '').trim().slice(0, 80),
  };
  if (isMongoId(rid)) action.recordId = rid;
  if (!action.label) return null;
  if (fields && typeof fields === 'object') action.fields = fields;
  if (action.kind === 'update_record' || action.kind === 'create_record') {
    action.executeNow = false;
  } else if (executeNow === false) {
    action.executeNow = false;
  }
  return action;
}

function attentionToAction(item) {
  if (!item || !isMongoId(item.id)) return null;
  const title = trimTitle(item.title, item.kind === 'event' ? 'Event' : 'Task');
  const overdueDays = item.isOverdue ? daysBetween(item.dueAt) : null;
  if (item.kind === 'task') {
    return makeAction({
      label: item.isOverdue ? `Complete overdue: ${title}` : `Complete: ${title}`,
      kind: 'complete_task',
      moduleKey: 'tasks',
      recordId: item.id,
      rationale: item.isOverdue
        ? (overdueDays != null ? `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}` : 'Overdue task')
        : (item.attentionLabel || 'Due today'),
      priority: item.isOverdue ? 'high' : 'high',
      targetLabel: title,
    });
  }
  if (item.kind === 'event') {
    return makeAction({
      label: item.isOverdue ? `Review overdue event: ${title}` : `Review event: ${title}`,
      kind: 'review_record',
      moduleKey: 'events',
      recordId: item.id,
      rationale: item.isOverdue
        ? (overdueDays != null ? `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}` : 'Overdue event')
        : (item.attentionLabel || 'Due today'),
      priority: item.isOverdue ? 'high' : 'medium',
      targetLabel: title,
    });
  }
  return null;
}

function staleDealToActions(deal, { proposeFollowUpTask = true } = {}) {
  if (!deal || !isMongoId(deal._id || deal.id)) return [];
  const id = String(deal._id || deal.id);
  const name = trimTitle(deal.name, 'Deal');
  const touch = deal.lastActivityDate || deal.updatedAt;
  const staleDays = daysBetween(touch);
  const rationale = staleDays != null
    ? `No activity for ${staleDays} day${staleDays === 1 ? '' : 's'}`
    : 'Stale open deal';
  const out = [];
  const follow = makeAction({
    label: `Follow up: ${name}`,
    kind: 'follow_up',
    moduleKey: 'deals',
    recordId: id,
    rationale,
    priority: 'medium',
    targetLabel: name,
  });
  if (follow) out.push(follow);
  if (proposeFollowUpTask) {
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 3);
    const create = makeAction({
      label: `Propose follow-up task: ${name}`,
      kind: 'create_record',
      moduleKey: 'tasks',
      recordId: '',
      rationale: `${rationale} — confirm to create a task`,
      priority: 'medium',
      targetLabel: name,
      fields: {
        title: `Follow up: ${name}`.slice(0, 200),
        description: `Follow up on ${name} — proposed by Astra.`,
        status: 'todo',
        priority: 'high',
        dueDate: due.toISOString(),
        relatedTo: { type: 'deal', id },
      },
    });
    if (create) out.push(create);
  }
  return out;
}

function openCaseToAction(row) {
  if (!row || !isMongoId(row._id || row.id)) return null;
  const id = String(row._id || row.id);
  const title = trimTitle(row.title || row.caseId, 'Case');
  let rationale = 'Open case needs attention';
  if (row.slaBreached) rationale = 'SLA breached';
  else {
    const quiet = daysBetween(row.lastAgentReplyAt || row.updatedAt);
    if (quiet != null) rationale = `No agent reply for ${quiet} day${quiet === 1 ? '' : 's'}`;
  }
  return makeAction({
    label: `Review case: ${title}`,
    kind: 'review_record',
    moduleKey: 'cases',
    recordId: id,
    rationale,
    priority: row.slaBreached ? 'high' : 'medium',
    targetLabel: title,
  });
}

function resumeToAction(item) {
  if (!item || !isMongoId(item.id)) return null;
  const mk = String(item.moduleKey || '').trim().toLowerCase();
  if (!mk) return null;
  const title = trimTitle(item.title, mk);
  return makeAction({
    label: `Continue: ${title}`,
    kind: 'review_record',
    moduleKey: mk,
    recordId: item.id,
    rationale: 'Recently updated — resume where you left off',
    priority: 'low',
    targetLabel: title,
  });
}

function conversationAnchorAction({ moduleKey, recordId, title = '' }) {
  const mk = String(moduleKey || '').trim().toLowerCase();
  const rid = String(recordId || '').trim();
  if (!mk || !isMongoId(rid)) return null;
  const labelTitle = trimTitle(title, mk === 'people' ? 'this contact' : mk);
  let label = `Follow up on ${labelTitle}`;
  let rationale = 'Best next move on the record you have open';
  if (mk === 'people' || mk === 'contacts') {
    label = `Email ${labelTitle} with one clear ask`;
    rationale = 'Warm follow-up — open compose when ready';
  } else if (mk === 'deals') {
    label = `Email to advance ${labelTitle}`;
    rationale = 'Push this deal one concrete step forward';
  } else if (mk === 'cases') {
    label = `Unblock ${labelTitle}`;
    rationale = 'Resolve the open case issue';
  } else if (mk === 'organizations' || mk === 'organization') {
    label = `Email check-in on ${labelTitle}`;
    rationale = 'Keep the account moving';
  }
  return makeAction({
    label,
    kind: 'follow_up',
    moduleKey: mk,
    recordId: rid,
    rationale,
    priority: 'high',
    targetLabel: labelTitle,
  });
}

function attentionLinkedToRecord(item, recordId) {
  const rid = String(recordId || '').trim();
  if (!rid || !item) return false;
  const bags = [
    item.id,
    item.recordId,
    item.relatedId,
    item.relatedToId,
    item.relatedTo?.id,
    item.linkPeopleId,
    item.dealId,
    item.contactId,
    item.accountId,
    item.organizationId,
  ];
  return bags.some((v) => String(v || '').trim() === rid);
}

function citationActionsFromPreview(preview, moduleKey = '') {
  const rows = preview?.result?.rows || preview?.rows || [];
  if (!Array.isArray(rows) || !rows.length) return [];
  const mk = String(moduleKey || '').trim().toLowerCase() || 'deals';
  const out = [];
  for (const row of rows.slice(0, 3)) {
    const id = String(row._id || row.id || row.recordId || '').trim();
    if (!isMongoId(id)) continue;
    const name = trimTitle(row.name || row.title || row.eventName || id, mk);
    const touch = row.lastActivityDate || row.updatedAt;
    const staleDays = daysBetween(touch);
    if (mk === 'deals' && (staleDays == null || staleDays >= STALE_DEAL_DAYS)) {
      out.push(...staleDealToActions({
        _id: id,
        name,
        lastActivityDate: touch,
        updatedAt: row.updatedAt,
      }, { proposeFollowUpTask: false }));
    } else {
      const a = makeAction({
        label: `Review: ${name}`,
        kind: 'review_record',
        moduleKey: mk,
        recordId: id,
        rationale: staleDays != null ? `From current results · last touch ${staleDays}d ago` : 'From current results',
        priority: 'low',
        targetLabel: name,
      });
      if (a) out.push(a);
    }
  }
  return out;
}

/**
 * Pure ranker — fixtures for tests. Cap MAX_NBA.
 * Priority: overdue attention → due today → stale deals → cases → conversation → citations → resume.
 */
function rankNextBestActions({
  attentionItems = [],
  resumeItems = [],
  staleDeals = [],
  openCases = [],
  moduleKey = '',
  recordId = '',
  recordTitle = '',
  crmPreview = null,
  crmModuleKey = '',
  limit = MAX_NBA,
  dismissedFingerprints = [],
  preferOpenFirst = true,
  preferRecordContext = false,
} = {}) {
  const now = new Date();
  const candidates = [];
  const dismissed = new Set(
    (Array.isArray(dismissedFingerprints) ? dismissedFingerprints : []).map((s) => String(s || '')),
  );
  // On a record page, ground Do Next on this record first (match in-product Astra context).
  const recordScoped = preferRecordContext && isMongoId(recordId);

  const attention = Array.isArray(attentionItems) ? attentionItems : [];
  for (const item of attention.filter((i) => i?.isOverdue)) {
    const a = attentionToAction(item);
    if (a) candidates.push({ score: recordScoped ? 55 : 100, action: a });
  }
  for (const item of attention.filter((i) => !i?.isOverdue && isDueToday(i?.dueAt, now))) {
    const a = attentionToAction(item);
    if (a) {
      candidates.push({
        score: recordScoped ? 48 : (preferOpenFirst ? 92 : 90),
        action: a,
      });
    }
  }

  for (const deal of (Array.isArray(staleDeals) ? staleDeals : []).slice(0, 2)) {
    const actions = staleDealToActions(deal, { proposeFollowUpTask: false });
    if (actions[0]) candidates.push({ score: preferOpenFirst ? 78 : 75, action: actions[0] });
  }
  // One propose follow-up task from the top stale deal (confirm-gated).
  const topStale = Array.isArray(staleDeals) && staleDeals[0] ? staleDeals[0] : null;
  if (topStale) {
    const withTask = staleDealToActions(topStale, { proposeFollowUpTask: true })
      .filter((a) => a.kind === 'create_record');
    if (withTask[0]) candidates.push({ score: 68, action: withTask[0] });
  }

  for (const row of (Array.isArray(openCases) ? openCases : []).slice(0, 2)) {
    const a = openCaseToAction(row);
    if (a) candidates.push({ score: 70, action: a });
  }

  const anchor = conversationAnchorAction({ moduleKey, recordId, title: recordTitle });
  if (anchor) candidates.push({ score: recordScoped ? 112 : 65, action: anchor });

  for (const a of citationActionsFromPreview(crmPreview, crmModuleKey || moduleKey)) {
    candidates.push({ score: 55, action: a });
  }

  for (const item of (Array.isArray(resumeItems) ? resumeItems : []).slice(0, 4)) {
    const a = resumeToAction(item);
    if (a) candidates.push({ score: 40, action: a });
  }

  candidates.sort((a, b) => b.score - a.score);

  const out = [];
  const seen = new Set();
  for (const { action } of candidates) {
    if (!action) continue;
    const relatedDealId = action.fields?.relatedTo?.type === 'deal'
      ? String(action.fields.relatedTo.id || '')
      : '';
    const key = action.kind === 'create_record'
      ? `create_record:tasks:${relatedDealId || action.recordId || action.label}`
      : actionKey(action);
    // Skip durable dismissals (fingerprint without trigger suffix match via prefix)
    const fpBase = `${action.kind}:${action.moduleKey}:${action.recordId || relatedDealId}`;
    if ([...dismissed].some((d) => d === key || d.startsWith(`${fpBase}:`) || d === fpBase)) {
      continue;
    }
    if (seen.has(key)) continue;
    const navKey = `${action.moduleKey}:${action.recordId || relatedDealId}`;
    if (action.kind !== 'create_record' && action.recordId && seen.has(`nav:${navKey}`)) continue;
    seen.add(key);
    if (action.kind !== 'create_record' && action.recordId) seen.add(`nav:${navKey}`);
    out.push(action);
    if (out.length >= Math.max(1, Number(limit) || MAX_NBA)) break;
  }
  return out;
}

async function loadStaleDeals({ organizationId, userId, staleDays = STALE_DEAL_DAYS, limit = 3 }) {
  if (!organizationId || !userId) return [];
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
  return Deal.find({
    organizationId,
    deletedAt: null,
    status: 'Open',
    assignedTo: userId,
    $or: [
      { lastActivityDate: { $lt: cutoff } },
      { lastActivityDate: null, updatedAt: { $lt: cutoff } },
    ],
  })
    .sort({ lastActivityDate: 1, updatedAt: 1 })
    .limit(limit)
    .select('name amount lastActivityDate updatedAt stage')
    .lean();
}

async function loadOpenCasesNeedingAttention({ organizationId, userId, limit = 2 }) {
  if (!organizationId || !userId) return [];
  const quietCutoff = new Date(Date.now() - CASE_STALE_REPLY_DAYS * 24 * 60 * 60 * 1000);
  return Case.find({
    organizationId,
    deletedAt: null,
    assignedTo: userId,
    status: { $nin: CLOSED_CASE_STATUSES },
    $or: [
      { slaBreached: true },
      { lastAgentReplyAt: { $lt: quietCutoff } },
      { lastAgentReplyAt: null, updatedAt: { $lt: quietCutoff } },
    ],
  })
    .sort({ slaBreached: -1, lastAgentReplyAt: 1, updatedAt: 1 })
    .limit(limit)
    .select('title caseId status slaBreached lastAgentReplyAt lastCustomerReplyAt updatedAt')
    .lean();
}

/**
 * Load live signals + rank. Optional overrides for tests.
 */
async function buildNextBestActions({
  organizationId,
  userId,
  moduleKey = '',
  recordId = '',
  recordTitle = '',
  crmPreview = null,
  crmModuleKey = '',
  limit = MAX_NBA,
  attentionItems = null,
  resumeItems = null,
  staleDeals = null,
  openCases = null,
} = {}) {
  if (!organizationId || !userId) return [];

  let attention = attentionItems;
  let resume = resumeItems;
  let stale = staleDeals;
  let cases = openCases;

  if (!Array.isArray(attention)) {
    try {
      attention = await buildInboxItemsForUser(userId, organizationId);
    } catch (_) {
      attention = [];
    }
  }
  if (!Array.isArray(resume)) {
    try {
      const { getResumeItems } = require('../platformHomeService');
      resume = await getResumeItems(userId, organizationId, null);
    } catch (_) {
      resume = [];
    }
  }
  if (!Array.isArray(stale)) {
    try {
      stale = await loadStaleDeals({ organizationId, userId });
    } catch (_) {
      stale = [];
    }
  }
  if (!Array.isArray(cases)) {
    try {
      cases = await loadOpenCasesNeedingAttention({ organizationId, userId });
    } catch (_) {
      cases = [];
    }
  }

  let memory = {
    preferOpenFirst: true,
    dismissedFingerprints: [],
    lastModuleKey: '',
    lastRecordId: '',
    lastRecordTitle: '',
  };
  try {
    const { getUserMemory } = require('./aiUserMemoryService');
    memory = await getUserMemory({ organizationId, userId });
  } catch (_) { /* non-fatal */ }

  const resolvedModule = String(moduleKey || memory.lastModuleKey || '').trim();
  const resolvedRecord = String(recordId || memory.lastRecordId || '').trim();
  const resolvedTitle = String(recordTitle || memory.lastRecordTitle || '').trim();
  const recordScoped = Boolean(moduleKey && isMongoId(recordId));

  // Record pages: only keep attention/stale/cases tied to THIS record — no org-wide junk.
  if (recordScoped) {
    attention = (Array.isArray(attention) ? attention : [])
      .filter((item) => attentionLinkedToRecord(item, recordId));
    stale = (Array.isArray(stale) ? stale : [])
      .filter((d) => String(d?._id || d?.id || '') === String(recordId));
    cases = (Array.isArray(cases) ? cases : [])
      .filter((c) => String(c?._id || c?.id || '') === String(recordId));
    resume = (Array.isArray(resume) ? resume : [])
      .filter((r) => String(r?.id || r?.recordId || '') === String(recordId));
  }

  if (moduleKey && recordId) {
    try {
      const { rememberRecordFocus } = require('./aiUserMemoryService');
      await rememberRecordFocus({
        organizationId,
        userId,
        moduleKey,
        recordId,
        recordTitle,
      });
    } catch (_) { /* non-fatal */ }
  }

  return rankNextBestActions({
    attentionItems: attention,
    resumeItems: resume,
    staleDeals: stale,
    openCases: cases,
    moduleKey: resolvedModule,
    recordId: resolvedRecord,
    recordTitle: resolvedTitle,
    crmPreview,
    crmModuleKey,
    limit,
    dismissedFingerprints: memory.dismissedFingerprints,
    preferOpenFirst: memory.preferOpenFirst !== false,
    preferRecordContext: recordScoped || Boolean(moduleKey && recordId),
  });
}

/** Merge NBA into existing structured actions: writes → NBA → pin. */
function mergeNbaIntoStructuredActions(existingActions = [], nbaActions = [], { max = 8 } = {}) {
  const list = Array.isArray(existingActions) ? existingActions.filter(Boolean) : [];
  const nba = Array.isArray(nbaActions) ? nbaActions.filter(Boolean) : [];
  const pins = list.filter((a) => a.kind === 'pin_report_to_dashboard');
  const nonPins = list.filter((a) => a.kind !== 'pin_report_to_dashboard');
  const seen = new Set(nonPins.map(actionKey));
  const mergedNba = [];
  for (const a of nba) {
    const key = actionKey(a);
    if (seen.has(key)) continue;
    seen.add(key);
    mergedNba.push(a);
  }
  return [...nonPins, ...mergedNba, ...pins].slice(0, Math.max(1, max));
}

function collectPreviewRecordIds(crmPreview) {
  const ids = new Set();
  const rows = Array.isArray(crmPreview?.result?.rows)
    ? crmPreview.result.rows
    : (Array.isArray(crmPreview?.rows)
      ? crmPreview.rows
      : (Array.isArray(crmPreview?.data) ? crmPreview.data : []));
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of ['_id', 'id', 'recordId']) {
      const v = String(row[key] || '').trim();
      if (isMongoId(v)) ids.add(v);
    }
  }
  return ids;
}

/**
 * Named-deal / small preview answers must not dump global Attention overdue.
 * Only scopes when a CRM preview actually exists (otherwise record-page NBA would be wiped).
 */
function isCrmAnswerScopedToPreview(question = '', crmPreview = null) {
  const ids = collectPreviewRecordIds(crmPreview);
  if (!ids.size) {
    // No preview rows — do not treat "this deal/record" as preview-scoped (keeps record NBA).
    return false;
  }
  if (extractQuotedRecordNameFromQuestion(question)) return true;
  if (ids.size > 0 && ids.size <= 5) return true;
  const q = String(question || '')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .toLowerCase();
  if (/['"][^'"]{2,}['"]/.test(q)) return true;
  if (/\b(this deal|this record|summarize .{0,60}deal|risks?.{0,40}next action)\b/.test(q)) {
    return true;
  }
  return false;
}

/** Prefer matching preview rows / actions to a quoted name. */
function extractQuotedRecordNameFromQuestion(question = '') {
  try {
    const { extractQuotedRecordName } = require('./aiAstraReportBuilderService');
    return extractQuotedRecordName(question);
  } catch (_) {
    const q = String(question || '')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .trim();
    const m = q.match(/["']([^"']{2,80})["']/);
    const name = String(m?.[1] || '').trim();
    if (!name || /^(open|won|lost|high|medium|low)$/i.test(name)) return '';
    return name;
  }
}

function filterPreviewIdsByQuotedName(crmPreview, quotedName) {
  const needle = String(quotedName || '').trim().toLowerCase();
  if (!needle) return collectPreviewRecordIds(crmPreview);
  const ids = new Set();
  const rows = Array.isArray(crmPreview?.result?.rows)
    ? crmPreview.result.rows
    : (Array.isArray(crmPreview?.rows)
      ? crmPreview.rows
      : (Array.isArray(crmPreview?.data) ? crmPreview.data : []));
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const label = String(row.name || row.title || row.eventName || '').trim().toLowerCase();
    if (!label.includes(needle) && needle !== label) continue;
    for (const key of ['_id', 'id', 'recordId']) {
      const v = String(row[key] || '').trim();
      if (isMongoId(v)) ids.add(v);
    }
  }
  return ids;
}

function filterActionsToPreviewIds(actions, previewIds) {
  if (!previewIds?.size) return [];
  return (Array.isArray(actions) ? actions : []).filter((a) => {
    if (!a) return false;
    const rid = String(a.recordId || '').trim();
    const related = String(a.fields?.relatedTo?.id || '').trim();
    return (rid && previewIds.has(rid)) || (related && previewIds.has(related));
  });
}

async function attachNbaToStructured(structured, ctx = {}) {
  if (!structured || typeof structured !== 'object') return structured;
  try {
    const quoted = extractQuotedRecordNameFromQuestion(ctx.question);
    const previewOnly = ctx.previewOnly === true || Boolean(ctx.crmPreview);

    // Named-record coaching asks: at most one action for that record — never org-wide stale NBA.
    if (quoted) {
      const previewIds = filterPreviewIdsByQuotedName(ctx.crmPreview, quoted);
      let nba = [];
      if (previewIds.size) {
        nba = citationActionsFromPreview(
          ctx.crmPreview,
          ctx.crmModuleKey || ctx.moduleKey || '',
        ).filter((a) => previewIds.has(String(a?.recordId || '').trim()));
        if (!nba.length && !previewOnly) {
          nba = await buildNextBestActions(ctx);
          nba = filterActionsToPreviewIds(nba, previewIds);
        }
      }
      nba = nba.slice(0, 1);
      if (!nba.length) return structured;
      structured.actions = mergeNbaIntoStructuredActions(
        structured.actions,
        nba,
        { max: 1 },
      );
      structured.nbaMode = true;
      return structured;
    }

    // When a CRM preview is present, stay inside those rows — never inject inbox overdue.
    if (previewOnly) {
      const previewIds = collectPreviewRecordIds(ctx.crmPreview);
      let nba = citationActionsFromPreview(
        ctx.crmPreview,
        ctx.crmModuleKey || ctx.moduleKey || '',
      ).filter((a) => {
        const rid = String(a?.recordId || '').trim();
        return !previewIds.size || previewIds.has(rid);
      }).slice(0, Math.max(1, Number(ctx.limit) || MAX_NBA));
      if (!nba.length) return structured;
      structured.actions = mergeNbaIntoStructuredActions(
        structured.actions,
        nba,
        { max: Math.max(1, Number(ctx.limit) || MAX_NBA) },
      );
      structured.nbaMode = true;
      return structured;
    }

    let nba = await buildNextBestActions(ctx);
    if (isCrmAnswerScopedToPreview(ctx.question, ctx.crmPreview)) {
      const previewIds = collectPreviewRecordIds(ctx.crmPreview);
      if (previewIds.size) {
        nba = filterActionsToPreviewIds(nba, previewIds);
        if (!nba.length) {
          nba = citationActionsFromPreview(
            ctx.crmPreview,
            ctx.crmModuleKey || ctx.moduleKey || '',
          ).filter((a) => {
            const rid = String(a?.recordId || '').trim();
            return previewIds.has(rid);
          }).slice(0, Math.max(1, Number(ctx.limit) || MAX_NBA));
        }
      }
    }
    // Record-page asks with no preview: keep record-scoped NBA (anchor / follow-up).
    if (!nba.length && ctx.moduleKey && isMongoId(ctx.recordId)) {
      nba = await buildNextBestActions(ctx);
    }
    if (!nba.length) return structured;
    structured.actions = mergeNbaIntoStructuredActions(
      structured.actions,
      nba,
      { max: Math.max(1, Number(ctx.limit) || MAX_NBA) },
    );
    structured.nbaMode = true;
  } catch (_) {
    /* non-fatal */
  }
  return structured;
}

module.exports = {
  MAX_NBA,
  STALE_DEAL_DAYS,
  isMongoId,
  rankNextBestActions,
  buildNextBestActions,
  mergeNbaIntoStructuredActions,
  attachNbaToStructured,
  citationActionsFromPreview,
  collectPreviewRecordIds,
  isCrmAnswerScopedToPreview,
  filterActionsToPreviewIds,
  loadStaleDeals,
  loadOpenCasesNeedingAttention,
  attentionToAction,
  staleDealToActions,
};
