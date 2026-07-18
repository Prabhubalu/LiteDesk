'use strict';

/**
 * Fill CRM mutation fields from app context so Astra asks staff
 * only for truly mandatory gaps.
 */

const mongoose = require('mongoose');

/** Create-required fields per module (after system defaults). */
const TASK_NAME_ALIASES = ['title', 'name', 'subject', 'taskName'];
const CREATE_REQUIRED = {
  events: ['eventName', 'startDateTime', 'endDateTime'],
  tasks: ['title'],
  people: [],
  organizations: ['name'],
  deals: ['name'],
  cases: ['subject'],
  quotes: ['name'],
  items: ['name'],
};
const DEAL_NAME_ALIASES = ['name', 'dealName', 'title'];
const CASE_SUBJECT_ALIASES = ['subject', 'title', 'name'];

function firstNonEmpty(obj, keys) {
  for (const key of keys) {
    const v = obj?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function extractWebsite(contextText = '') {
  const m = String(contextText).match(/\bwebsite:\s*(\S+)/i);
  return m?.[1] ? String(m[1]).replace(/[>,);]+$/, '') : '';
}

function extractPrimaryLabel(contextText = '') {
  const m = String(contextText).match(/^Label:\s*(.+)$/im)
    || String(contextText).match(/\b(?:Person|name|Organization name|Deal):\s*(.+)$/im);
  return m?.[1] ? String(m[1]).trim().slice(0, 120) : '';
}

function extractEmail(contextText = '') {
  const m = String(contextText).match(/\bEmail:\s*([^\s]+@[^\s]+)/i)
    || String(contextText).match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  return m?.[1] ? String(m[1]).trim() : '';
}

function extractPhone(contextText = '') {
  const m = String(contextText).match(/\bPhone:\s*(.+)$/im);
  return m?.[1] ? String(m[1]).trim().slice(0, 40) : '';
}

/**
 * Lightweight relative datetime parse for common staff phrases.
 * Returns { startDateTime, endDateTime } ISO strings or nulls.
 */
function parseScheduleFromQuestion(question = '', now = new Date()) {
  const q = String(question || '').toLowerCase();
  if (!q) return { startDateTime: null, endDateTime: null };

  const base = new Date(now.getTime());
  let dayOffset = null;
  if (/\btoday\b/.test(q)) dayOffset = 0;
  else if (/\btomorrow\b/.test(q)) dayOffset = 1;
  else if (/\bday after tomorrow\b/.test(q)) dayOffset = 2;
  else if (/\bnext week\b/.test(q)) dayOffset = 7;

  const ampm = q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const hour24 = q.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  let hours = null;
  let minutes = 0;
  if (ampm) {
    hours = Number(ampm[1]);
    minutes = Number(ampm[2] || 0);
    const mer = String(ampm[3]).toLowerCase();
    if (mer === 'pm' && hours < 12) hours += 12;
    if (mer === 'am' && hours === 12) hours = 0;
  } else if (hour24) {
    hours = Number(hour24[1]);
    minutes = Number(hour24[2] || 0);
    if (hours > 23) hours = null;
  }

  // Duration
  let durationMin = 60;
  const dur = q.match(/\bfor\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/);
  if (dur) {
    const n = Number(dur[1]);
    const unit = dur[2];
    durationMin = /hour|hr/.test(unit) ? n * 60 : n;
  }

  if (dayOffset === null && hours === null) {
    return { startDateTime: null, endDateTime: null };
  }

  const start = new Date(base);
  if (dayOffset !== null) {
    start.setDate(start.getDate() + dayOffset);
  }
  if (hours !== null) {
    start.setHours(hours, minutes, 0, 0);
  } else {
    // Default mid-morning if only a day was given
    start.setHours(10, 0, 0, 0);
  }

  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return {
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
  };
}

function inferEventName(question = '', pageLabel = '') {
  const q = String(question || '').trim();
  const named = q.match(/\b(?:called|named|title[d]?)\s+["']?([^"',.]+)["']?/i)
    || q.match(/\b(?:meeting|call|event)\s+(?:with|for)\s+([^,.]+)/i);
  if (named?.[1]) return named[1].trim().slice(0, 120);
  if (/\bdiscovery\b/i.test(q)) {
    return pageLabel ? `Discovery call — ${pageLabel}`.slice(0, 120) : 'Discovery call';
  }
  if (/\bdemo\b/i.test(q)) {
    return pageLabel ? `Product demo — ${pageLabel}`.slice(0, 120) : 'Product demo';
  }
  if (/\bcall\b/i.test(q)) {
    return pageLabel ? `Call — ${pageLabel}`.slice(0, 120) : 'Call';
  }
  if (/\bmeeting\b/i.test(q)) {
    return pageLabel ? `Meeting — ${pageLabel}`.slice(0, 120) : 'Meeting';
  }
  if (pageLabel) return `Meeting — ${pageLabel}`.slice(0, 120);
  return '';
}

function inferTaskName(question = '', pageLabel = '') {
  const q = String(question || '').trim();
  const named = q.match(/\b(?:called|named|titled)\s+["']?([^"',.]+)["']?/i);
  if (named?.[1]) return named[1].trim().slice(0, 120);
  if (/follow[- ]?up/i.test(q) && pageLabel) return `Follow up — ${pageLabel}`.slice(0, 120);
  if (pageLabel) return `Task — ${pageLabel}`.slice(0, 120);
  return q.replace(/^(please\s+)?(create|add|make|schedule)\s+(a\s+)?(task|todo)\s*/i, '').trim().slice(0, 120);
}

/**
 * Build fill plan + missing mandatory list for a create/update intent.
 */
function buildAppFillHints({
  question = '',
  moduleKey = '',
  pageModuleKey = '',
  pageRecordId = '',
  contextText = '',
  userId = '',
} = {}) {
  const pageLabel = extractPrimaryLabel(contextText);
  const schedule = parseScheduleFromQuestion(question);
  const hints = {
    actorUserId: userId ? String(userId) : '',
    pageModuleKey: pageModuleKey || '',
    pageRecordId: pageRecordId || '',
    pageLabel,
    website: extractWebsite(contextText),
    email: extractEmail(contextText),
    phone: extractPhone(contextText),
    schedule,
    suggested: {},
  };

  const target = String(moduleKey || '').toLowerCase();
  if (target === 'events' || /\b(event|meeting|call|schedule|appointment)\b/i.test(question)) {
    hints.suggested.moduleKey = 'events';
    hints.suggested.fields = {
      eventName: inferEventName(question, pageLabel),
      eventType: 'Meeting',
      status: 'Planned',
      startDateTime: schedule.startDateTime || '',
      endDateTime: schedule.endDateTime || '',
      assignedTo: hints.actorUserId,
    };
    if (pageRecordId && (pageModuleKey === 'organizations' || pageModuleKey === 'organization')) {
      hints.suggested.fields.relatedToId = pageRecordId;
    }
    // People ↔ Events is people_events relationship — not Event.relatedToId (Organization)
    if (pageRecordId && pageModuleKey === 'people') {
      hints.suggested.fields.linkPeopleId = pageRecordId;
    }
  } else if (target === 'tasks' || /\btask|todo|follow[- ]?up|reminder\b/i.test(question)) {
    hints.suggested.moduleKey = 'tasks';
    const title = inferTaskName(question, pageLabel);
    hints.suggested.fields = {
      title,
      name: title,
      status: 'todo',
      priority: 'medium',
      taskType: 'general_task',
      assignedTo: hints.actorUserId,
      assignedBy: hints.actorUserId,
    };
    if (pageRecordId && pageModuleKey === 'people') {
      hints.suggested.fields.relatedToId = pageRecordId;
      hints.suggested.fields.relatedToType = 'contact';
    }
  } else if (target === 'people' || /\b(person|contact|lead)\b/i.test(question)) {
    hints.suggested.moduleKey = 'people';
    hints.suggested.fields = {
      email: hints.email || '',
      phone: hints.phone || '',
      assignedTo: hints.actorUserId,
    };
  } else if (target === 'organizations' || /\b(organization|company|account)\b/i.test(question)) {
    hints.suggested.moduleKey = 'organizations';
    hints.suggested.fields = {
      name: pageLabel || '',
      website: hints.website || '',
    };
  }

  return hints;
}

function missingMandatoryForCreate(moduleKey, fields = {}) {
  const mod = String(moduleKey || '').toLowerCase();
  const f = fields || {};
  const missing = [];

  if (mod === 'people') {
    const hasIdentity = Boolean(
      firstNonEmpty(f, ['email'])
      || firstNonEmpty(f, ['firstName', 'first_name'])
      || firstNonEmpty(f, ['lastName', 'last_name'])
      || firstNonEmpty(f, ['name']),
    );
    if (!hasIdentity) missing.push('name or email');
    return missing;
  }

  if (mod === 'tasks') {
    if (!firstNonEmpty(f, TASK_NAME_ALIASES)) missing.push('title');
    return missing;
  }

  if (mod === 'deals') {
    if (!firstNonEmpty(f, DEAL_NAME_ALIASES)) missing.push('name');
    return missing;
  }

  if (mod === 'cases') {
    if (!firstNonEmpty(f, CASE_SUBJECT_ALIASES)) missing.push('subject');
    return missing;
  }

  const required = CREATE_REQUIRED[mod] || [];
  for (const key of required) {
    if (!firstNonEmpty(f, [key])) missing.push(key);
  }
  return missing;
}

/**
 * Merge app-inferred fields into a mutation action. Does not invent emails/money.
 */
function fillMutationFromApp(action, {
  question = '',
  pageModuleKey = '',
  pageRecordId = '',
  contextText = '',
  userId = '',
} = {}) {
  if (!action || (action.kind !== 'create_record' && action.kind !== 'update_record')) {
    return { action, missing: [], filledKeys: [] };
  }

  const moduleKey = String(action.moduleKey || '').toLowerCase();
  const hints = buildAppFillHints({
    question,
    moduleKey,
    pageModuleKey,
    pageRecordId,
    contextText,
    userId,
  });

  const fields = { ...(action.fields || {}) };
  const suggested = hints.suggested?.fields || {};
  const filledKeys = [];

  for (const [key, value] of Object.entries(suggested)) {
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const cur = fields[key];
    if (cur === undefined || cur === null || String(cur).trim() === '') {
      fields[key] = value;
      filledKeys.push(key);
    }
  }

  // Alias normalization for tasks/deals
  if (moduleKey === 'tasks') {
    if (!firstNonEmpty(fields, ['title']) && firstNonEmpty(fields, ['name', 'subject', 'taskName'])) {
      fields.title = firstNonEmpty(fields, ['name', 'subject', 'taskName']);
      filledKeys.push('title');
    }
    if (!firstNonEmpty(fields, ['title']) && suggested.title) {
      fields.title = suggested.title;
      filledKeys.push('title');
    }
    if (pageRecordId && pageModuleKey === 'people' && !fields.relatedToId) {
      fields.relatedToId = pageRecordId;
      fields.relatedToType = 'contact';
      filledKeys.push('relatedToId');
    }
  }
  if (moduleKey === 'deals') {
    if (!fields.name && fields.dealName) fields.name = fields.dealName;
  }

  // Always prefer current user as assignee / actor stamps when empty
  if (userId) {
    if (!fields.assignedTo && ['events', 'tasks', 'people', 'deals', 'cases'].includes(moduleKey)) {
      fields.assignedTo = String(userId);
      filledKeys.push('assignedTo');
    }
    if (!fields.modifiedBy) {
      fields.modifiedBy = String(userId);
      filledKeys.push('modifiedBy');
    }
    if (!fields.createdBy) {
      fields.createdBy = String(userId);
      filledKeys.push('createdBy');
    }
    if (!fields.assignedBy && moduleKey === 'tasks') {
      fields.assignedBy = String(userId);
      filledKeys.push('assignedBy');
    }
  }

  // Link to page org for events when empty (Event.relatedToId is Organization)
  if (
    moduleKey === 'events'
    && pageRecordId
    && (pageModuleKey === 'organizations' || pageModuleKey === 'organization')
    && !fields.relatedToId
  ) {
    fields.relatedToId = pageRecordId;
    filledKeys.push('relatedToId');
  }

  // People page → people_events link (never put People id in Event.relatedToId)
  if (moduleKey === 'events' && pageRecordId && pageModuleKey === 'people') {
    if (!fields.linkPeopleId) {
      fields.linkPeopleId = pageRecordId;
      filledKeys.push('linkPeopleId');
    }
    if (fields.relatedToId && String(fields.relatedToId) === String(pageRecordId)) {
      delete fields.relatedToId;
    }
    delete fields.relatedTold;
  }

  // ObjectId-looking strings stay strings; mongoose cast on save
  if (fields.relatedToId && !mongoose.Types.ObjectId.isValid(String(fields.relatedToId))) {
    delete fields.relatedToId;
  }
  if (fields.linkPeopleId && !mongoose.Types.ObjectId.isValid(String(fields.linkPeopleId))) {
    delete fields.linkPeopleId;
  }

  const next = { ...action, fields, moduleKey: moduleKey || action.moduleKey };
  const missing = action.kind === 'create_record'
    ? missingMandatoryForCreate(next.moduleKey, fields)
    : [];

  return { action: next, missing, filledKeys, hints };
}

function formatFillHintsForPrompt(hints) {
  if (!hints?.suggested?.moduleKey) return '';
  const fields = hints.suggested.fields || {};
  const lines = [
    '=== APP-INFERRED DEFAULTS (prefer these; do not re-ask staff) ===',
    `Likely module: ${hints.suggested.moduleKey}`,
  ];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || String(v).trim() === '') continue;
    lines.push(`${k}: ${v}`);
  }
  if (hints.pageModuleKey && hints.pageRecordId) {
    lines.push(`Page record: ${hints.pageModuleKey} ${hints.pageRecordId}`);
  }
  if (hints.pageLabel) lines.push(`Page label: ${hints.pageLabel}`);
  lines.push('Only ask clarifyingQuestions for mandatory fields still empty after using these defaults + CRM context.');
  return lines.join('\n');
}

module.exports = {
  CREATE_REQUIRED,
  buildAppFillHints,
  fillMutationFromApp,
  missingMandatoryForCreate,
  parseScheduleFromQuestion,
  formatFillHintsForPrompt,
  inferEventName,
  extractPrimaryLabel,
};
