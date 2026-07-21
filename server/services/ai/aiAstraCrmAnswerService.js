'use strict';

/**
 * Grounded LLM answer after CRM Analytics preview.
 * Numbers/facts must come from preview rows — never invent CRM fields.
 */

const MAX_ROWS = 15;
const MAX_CONTEXT_CHARS = 6000;
const MAX_BULLET_CHARS = 240;
const MAX_DETAIL_CHARS = 2000;
const MAX_HEADLINE_CHARS = 200;

function emptyUsage() {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function mergeUsage(a = {}, b = {}) {
  return {
    promptTokens: Number(a.promptTokens || 0) + Number(b.promptTokens || 0),
    completionTokens: Number(a.completionTokens || 0) + Number(b.completionTokens || 0),
    totalTokens: Number(a.totalTokens || 0) + Number(b.totalTokens || 0),
  };
}

/** Prefer compact ISO datetimes so bullets are not cut mid "Wed Jul 22…GMT+0530". */
function formatCompactFieldValue(value) {
  if (value == null || value === '') return value;
  if (typeof value === 'object' && value?.name) return String(value.name);
  if (typeof value === 'object' && value?._id && !value.name) return String(value._id);
  if (value instanceof Date || (typeof value === 'string'
    && (/^\d{4}-\d{2}-\d{2}T/.test(value) || /\bGMT[+-]/.test(value) || /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(value)))) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  }
  return value;
}

/**
 * Drop bullets that look cut mid-token (common when maxTokens truncates JSON).
 * e.g. "Start dates range from 2"
 */
function looksAbruptlyTruncated(text = '') {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/[,:;]\s*$/.test(t)) return true;
  if (/\b(the|a|an|and|or|with|for|by|to|from|on|at|of|until|between|range)\s*$/i.test(t)) {
    return true;
  }
  // Ends with a short number that is not a full year / money amount
  if (/\b(from|to|until|on|at|of|between)\s+\d{1,3}$/i.test(t)) return true;
  if (/\s\d{1,2}$/.test(t) && !/\d{4}$/.test(t) && !/\$\d+$/.test(t)) return true;
  // Cut mid-word (lowercase letter ending without punctuation, long-ish, no terminal punct)
  if (/[a-z]$/.test(t) && t.length > 40 && !/[.!?)]$/.test(t) && /\s[a-z]{1,4}$/.test(t)) {
    // Heuristic: ends with a very short trailing word fragment after space — keep most sentences
    return false;
  }
  return false;
}

function sanitizeSynthText(text = '', maxLen = MAX_DETAIL_CHARS) {
  let t = String(text || '').trim();
  if (!t) return '';
  if (t.length > maxLen) {
    // Prefer cutting at sentence boundary, never mid-word.
    const sliced = t.slice(0, maxLen);
    const lastStop = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('! '), sliced.lastIndexOf('? '));
    t = lastStop > Math.floor(maxLen * 0.5)
      ? sliced.slice(0, lastStop + 1).trim()
      : sliced.replace(/\s+\S*$/, '').trim();
  }
  return looksAbruptlyTruncated(t) ? '' : t;
}

function sanitizeSynthBullets(bullets = []) {
  return (Array.isArray(bullets) ? bullets : [])
    .map((b) => sanitizeSynthText(String(b || ''), MAX_BULLET_CHARS))
    .filter(Boolean)
    .slice(0, 8);
}

function compactPreviewRows(preview = {}, limit = MAX_ROWS) {
  const rows = Array.isArray(preview?.result?.rows)
    ? preview.result.rows
    : (Array.isArray(preview?.rows)
      ? preview.rows
      : (Array.isArray(preview?.data) ? preview.data : []));
  const out = [];
  for (const row of rows.slice(0, Math.max(1, limit))) {
    if (!row || typeof row !== 'object') continue;
    const compact = {};
    for (const key of [
      '_id', 'id', 'name', 'title', 'eventName', 'amount', 'stage', 'status',
      'priority', 'expectedCloseDate', 'assignedTo', 'owner', 'dueDate',
      'startDateTime', 'endDateTime', 'subject',
    ]) {
      if (row[key] != null && row[key] !== '') {
        compact[key] = formatCompactFieldValue(row[key]);
      }
    }
    if (Object.keys(compact).length) out.push(compact);
  }
  return out;
}

function buildGroundedUserPayload({
  question = '',
  understanding = '',
  moduleKey = '',
  rowCount = 0,
  rows = [],
  recentTurns = '',
} = {}) {
  let rowsJson = JSON.stringify(rows);
  if (rowsJson.length > MAX_CONTEXT_CHARS) {
    rowsJson = `${rowsJson.slice(0, MAX_CONTEXT_CHARS)}…`;
  }
  return [
    `Question: ${String(question || '').slice(0, 2000)}`,
    understanding ? `Plan understanding: ${String(understanding).slice(0, 400)}` : '',
    recentTurns ? `Recent turns (for follow-ups):\n${String(recentTurns).slice(0, 1200)}` : '',
    `Module: ${moduleKey || 'unknown'}`,
    `Row count: ${Number(rowCount) || 0}`,
    `Preview rows (JSON): ${rowsJson}`,
    'Write as if answering in this chat thread — understand the ask, then answer properly.',
  ].filter(Boolean).join('\n');
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   headline?: string,
 *   bullets?: string[],
 *   detail?: string,
 *   nextAction?: object|null,
 *   usage: object,
 *   promptVersion: string,
 * }>}
 */
async function synthesizeCrmGroundedAnswer({
  question = '',
  plan = null,
  preview = null,
  moduleKey = '',
  config = null,
  redactOpts = {},
  recentTurns = '',
} = {}) {
  const usage = emptyUsage();
  const promptVersion = 'astra_crm_answer_v1';
  if (!config?.apiKey || !config?.provider || !config?.model) {
    return { ok: false, usage, promptVersion };
  }

  try {
    const { getLlmAdapter } = require('./providerRegistry');
    const { redactMessages } = require('./piiRedaction');
    const { parseJsonObject } = require('./aiMarketingService');
    const { getPrompt } = require('./prompts/promptRegistry');
    const adapter = getLlmAdapter(config.provider);
    if (!adapter?.complete) return { ok: false, usage, promptVersion };

    const rows = compactPreviewRows(preview, MAX_ROWS);
    const rowCount = Number(
      preview?.result?.rows?.length
      || preview?.rows?.length
      || preview?.meta?.totalRows
      || rows.length
      || 0,
    );
    const voice = getPrompt('astra_chat_voice_v1').text;
    const system = [
      getPrompt('astra_crm_answer_v1').text
        || 'Return JSON only with headline, bullets, detail, nextAction.',
      voice,
    ].filter(Boolean).join('\n\n');
    const userContent = buildGroundedUserPayload({
      question,
      understanding: plan?.understanding || '',
      moduleKey: moduleKey || plan?.moduleKey || '',
      rowCount,
      rows,
      recentTurns,
    });

    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ], redactOpts),
      temperature: 0.35,
      maxTokens: 2000,
      providerOptions: config.providerOptions,
    });

    const u = completion?.usage || {};
    usage.promptTokens = Number(u.promptTokens || u.prompt_tokens || 0);
    usage.completionTokens = Number(u.completionTokens || u.completion_tokens || 0);
    usage.totalTokens = Number(u.totalTokens || u.total_tokens
      || (usage.promptTokens + usage.completionTokens));

    const text = String(completion?.text || completion?.content || '');
    const parsed = parseJsonObject(text);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, usage, promptVersion };
    }

    const headline = sanitizeSynthText(parsed.headline, MAX_HEADLINE_CHARS)
      || String(plan?.headlineHint || 'Results').trim().slice(0, MAX_HEADLINE_CHARS);
    const bullets = sanitizeSynthBullets(parsed.bullets);
    const detail = sanitizeSynthText(parsed.detail, MAX_DETAIL_CHARS);
    let nextAction = null;
    if (parsed.nextAction && typeof parsed.nextAction === 'object') {
      const label = String(parsed.nextAction.label || '').trim().slice(0, 120);
      if (label) {
        nextAction = {
          label,
          rationale: String(parsed.nextAction.rationale || '').trim().slice(0, 240),
          recordId: String(parsed.nextAction.recordId || '').trim().slice(0, 40),
          moduleKey: String(parsed.nextAction.moduleKey || moduleKey || plan?.moduleKey || '')
            .trim()
            .slice(0, 40),
        };
      }
    }

    if (!headline && !bullets.length && !detail) {
      return { ok: false, usage, promptVersion };
    }

    return {
      ok: true,
      headline: headline || (plan?.headlineHint || 'Results'),
      bullets,
      detail,
      nextAction,
      usage,
      promptVersion,
    };
  } catch (_) {
    return { ok: false, usage, promptVersion };
  }
}

/**
 * Drop meta LLM rationales ("concrete example…") — staff need operational copy.
 */
function looksMetaActionRationale(text = '') {
  const t = String(text || '').toLowerCase();
  if (!t) return true;
  return /\b(example|illustration|demonstrat|sample action|concrete example|for immediate follow-up)\b/i.test(t)
    || /\b(provides? a|as an?)\b.+\b(example|illustration)\b/i.test(t);
}

function defaultActionRationale(moduleKey = '', preview = null, recordId = '') {
  const rows = compactPreviewRows(preview, MAX_ROWS);
  const row = rows.find((r) => previewRowId(r) === String(recordId || '').trim()) || rows[0];
  if (!row) return 'Open this record to review.';
  const bits = [];
  const title = previewRowLabel(row);
  if (title) bits.push(title);
  if (row.status) bits.push(String(row.status));
  if (row.priority) bits.push(`${row.priority} priority`);
  if (row.stage) bits.push(String(row.stage));
  if (row.dueDate) bits.push(`due ${formatCompactFieldValue(row.dueDate)}`);
  if (row.expectedCloseDate) bits.push(`close ${formatCompactFieldValue(row.expectedCloseDate)}`);
  if (row.amount != null && row.amount !== '') bits.push(`$${Number(row.amount).toLocaleString('en-US')}`);
  const mod = String(moduleKey || '').replace(/_/g, ' ') || 'record';
  if (!bits.length) return `Open this ${mod} to review.`;
  return `${bits.slice(0, 3).join(' · ')} — ready to review.`.slice(0, 240);
}

function sanitizeNextActionRationale(raw = '', { moduleKey = '', preview = null, recordId = '' } = {}) {
  const t = String(raw || '').trim().slice(0, 240);
  if (!t || looksMetaActionRationale(t)) {
    return defaultActionRationale(moduleKey, preview, recordId);
  }
  return t;
}

function isMongoId(value = '') {
  return /^[a-f0-9]{24}$/i.test(String(value || '').trim());
}

function previewRowId(row) {
  if (!row || typeof row !== 'object') return '';
  for (const key of ['_id', 'id', 'recordId']) {
    const v = String(row[key] || '').trim();
    if (isMongoId(v)) return v;
  }
  return '';
}

function previewRowLabel(row) {
  if (!row || typeof row !== 'object') return '';
  return String(row.name || row.title || row.eventName || row.subject || '').trim();
}

/**
 * Bind LLM nextAction to a real preview row id (never a draft AnalyticsReport id).
 */
function resolveNextActionRecordId(nextAction = null, preview = null, moduleKey = '') {
  const rows = compactPreviewRows(preview, MAX_ROWS);
  if (!rows.length) return { recordId: '', moduleKey: String(moduleKey || '').trim() };

  const mod = String(nextAction?.moduleKey || moduleKey || '').trim().toLowerCase() || 'deals';
  const claimed = String(nextAction?.recordId || '').trim();
  if (isMongoId(claimed) && rows.some((r) => previewRowId(r) === claimed)) {
    return { recordId: claimed, moduleKey: mod };
  }

  const hay = `${String(nextAction?.label || '')} ${String(nextAction?.rationale || '')}`.toLowerCase();
  let best = null;
  let bestScore = -1;
  for (const row of rows) {
    const id = previewRowId(row);
    if (!id) continue;
    const label = previewRowLabel(row).toLowerCase();
    let score = 0;
    if (label && hay.includes(label)) score += 100;
    if (label) {
      const tokens = label.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      score += tokens.filter((t) => hay.includes(t)).length * 10;
    }
    const amount = Number(row.amount);
    if (Number.isFinite(amount)) score += Math.min(20, amount / 10000);
    if (/qualif/i.test(hay) && /qualif/i.test(String(row.stage || ''))) score += 25;
    if (/negotiat/i.test(hay) && /negotiat/i.test(String(row.stage || ''))) score += 25;
    if (/proposal/i.test(hay) && /proposal/i.test(String(row.stage || ''))) score += 25;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  if (best && bestScore > 0) return { recordId: best, moduleKey: mod };

  // Prefer highest-amount row when the ask is about focus/high-value.
  const byAmount = [...rows].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  const fallback = previewRowId(byAmount[0]) || previewRowId(rows[0]);
  return { recordId: fallback, moduleKey: mod };
}

/**
 * Merge grounded synthesis into structured CRM reply.
 * Prefer LLM nextAction over rule NBA when present.
 */
async function applyCrmGroundedSynthesis(structured, ctx = {}) {
  if (!structured || typeof structured !== 'object') {
    return { structured, usage: emptyUsage(), crmSynthesis: false, promptVersion: '' };
  }

  const synth = await synthesizeCrmGroundedAnswer({
    question: ctx.question || '',
    plan: ctx.plan,
    preview: ctx.preview,
    moduleKey: ctx.moduleKey || '',
    config: ctx.config,
    redactOpts: ctx.redactOpts || {},
    recentTurns: ctx.recentTurns || '',
  });
  if (!synth.ok) {
    return {
      structured,
      usage: synth.usage || emptyUsage(),
      crmSynthesis: false,
      promptVersion: synth.promptVersion || '',
    };
  }

  if (synth.headline) structured.headline = synth.headline;
  if (Array.isArray(synth.bullets) && synth.bullets.length) {
    structured.bullets = synth.bullets;
  }
  if (synth.detail) structured.detail = synth.detail;

  const pinLike = (Array.isArray(structured.actions) ? structured.actions : [])
    .filter((a) => a && [
      'pin_report_to_dashboard',
      'open_report',
      'open_report_builder',
      'create_record',
      'update_record',
    ].includes(a.kind));

  if (synth.nextAction?.label) {
    const resolved = resolveNextActionRecordId(
      synth.nextAction,
      ctx.preview,
      synth.nextAction.moduleKey || ctx.moduleKey || '',
    );
    const mod = resolved.moduleKey || ctx.moduleKey || '';
    const rid = resolved.recordId || '';
    const llmAction = {
      label: synth.nextAction.label,
      kind: rid ? 'review_record' : 'follow_up',
      moduleKey: mod || undefined,
      recordId: rid || undefined,
      executeNow: false,
      priority: 'high',
      rationale: sanitizeNextActionRationale(synth.nextAction.rationale, {
        moduleKey: mod,
        preview: ctx.preview,
        recordId: rid,
      }),
    };
    structured.actions = [llmAction, ...pinLike].slice(0, 4);
    structured.nbaMode = true;
    return {
      structured,
      usage: synth.usage,
      crmSynthesis: true,
      promptVersion: synth.promptVersion,
      hasLlmNextAction: true,
    };
  }

  return {
    structured,
    usage: synth.usage,
    crmSynthesis: true,
    promptVersion: synth.promptVersion,
    hasLlmNextAction: false,
  };
}

module.exports = {
  MAX_ROWS,
  MAX_BULLET_CHARS,
  compactPreviewRows,
  formatCompactFieldValue,
  looksAbruptlyTruncated,
  looksMetaActionRationale,
  sanitizeSynthBullets,
  sanitizeSynthText,
  sanitizeNextActionRationale,
  resolveNextActionRecordId,
  buildGroundedUserPayload,
  synthesizeCrmGroundedAnswer,
  applyCrmGroundedSynthesis,
  mergeUsage,
  emptyUsage,
};
