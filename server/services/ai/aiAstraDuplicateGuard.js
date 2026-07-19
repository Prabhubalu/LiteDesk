'use strict';

/**
 * Intent-aware duplicate detection for Astra create proposals.
 * Prefer recommending the matching existing record over creating another.
 */

const mongoose = require('mongoose');
const Event = require('../../models/Event');
const Task = require('../../models/Task');
const RelationshipInstance = require('../../models/RelationshipInstance');

const FORCE_CREATE_RE = /\b(force\s+create|create\s+anyway|create\s+a\s+new\s+one|duplicate\s+ok|new\s+meeting\s+anyway)\b/i;

function allowsForceCreate(question = '') {
  return FORCE_CREATE_RE.test(String(question || ''));
}

function tokenizeIntent(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !['with', 'the', 'and', 'for', 'meeting', 'discuss', 'about', 'today', 'schedule', 'create', 'new'].includes(w));
}

function intentOverlapScore(a = '', b = '') {
  const ta = new Set(tokenizeIntent(a));
  const tb = new Set(tokenizeIntent(b));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const w of ta) {
    if (tb.has(w)) hit += 1;
  }
  return hit / Math.max(ta.size, 1);
}

function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function eventIdsLinkedToPerson(organizationId, peopleId) {
  if (!peopleId || !mongoose.Types.ObjectId.isValid(peopleId)) return [];
  const rows = await RelationshipInstance.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    relationshipKey: 'people_events',
    'source.moduleKey': 'people',
    'source.recordId': new mongoose.Types.ObjectId(peopleId),
    'target.moduleKey': 'events',
  })
    .select('target.recordId')
    .limit(50)
    .lean();
  return rows
    .map((r) => String(r?.target?.recordId || ''))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
}

async function findEventIntentDuplicates({ organizationId, fields = {}, userId = null }) {
  const start = parseDate(fields.startDateTime);
  if (!start) return [];

  const end = parseDate(fields.endDateTime) || new Date(start.getTime() + 30 * 60 * 1000);
  const windowStart = new Date(start.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(end.getTime() + 60 * 60 * 1000);
  const eventName = String(fields.eventName || '');
  const linkPeopleId = String(fields.linkPeopleId || '').trim();
  const linkedIds = linkPeopleId
    ? await eventIdsLinkedToPerson(organizationId, linkPeopleId)
    : [];

  const orgOid = new mongoose.Types.ObjectId(organizationId);
  const orClauses = [
    { startDateTime: { $gte: windowStart, $lte: windowEnd } },
  ];
  if (linkedIds.length) {
    orClauses.push({ _id: { $in: linkedIds.map((id) => new mongoose.Types.ObjectId(id)) } });
  }
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    orClauses.push({
      assignedTo: new mongoose.Types.ObjectId(userId),
      startDateTime: { $gte: windowStart, $lte: windowEnd },
    });
  }

  const candidates = await Event.find({
    organizationId: orgOid,
    deletedAt: null,
    status: { $nin: ['Cancelled'] },
    $or: orClauses,
  })
    .select('_id eventName startDateTime endDateTime status assignedTo')
    .sort({ startDateTime: 1 })
    .limit(40)
    .lean();

  const matches = [];
  for (const doc of candidates) {
    const docStart = parseDate(doc.startDateTime);
    if (!docStart) continue;

    const overlapMs = Math.min(end.getTime(), parseDate(doc.endDateTime)?.getTime() || docStart.getTime() + 30 * 60000)
      - Math.max(start.getTime(), docStart.getTime());
    const timeClose = Math.abs(docStart.getTime() - start.getTime()) <= 45 * 60 * 1000;
    const timeOverlap = overlapMs > 0;
    const linked = linkedIds.includes(String(doc._id));
    const nameScore = intentOverlapScore(eventName, doc.eventName);

    // Intent match: same contact link + near time, OR overlapping slot + similar topic
    const isIntentMatch = (linked && (timeClose || timeOverlap))
      || (timeOverlap && nameScore >= 0.34)
      || (timeClose && nameScore >= 0.5);

    if (!isIntentMatch) continue;

    matches.push({
      moduleKey: 'events',
      recordId: String(doc._id),
      label: String(doc.eventName || 'Meeting').slice(0, 120),
      startDateTime: doc.startDateTime,
      score: (linked ? 50 : 0) + (timeOverlap ? 30 : 0) + (timeClose ? 20 : 0) + Math.round(nameScore * 40),
      reason: linked
        ? 'Same contact and overlapping/near time'
        : (nameScore >= 0.34 ? 'Similar topic and overlapping time' : 'Near the same time slot'),
    });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}

async function findTaskIntentDuplicates({ organizationId, fields = {}, userId = null }) {
  const title = String(fields.title || fields.name || '').trim();
  if (!title) return [];
  const due = parseDate(fields.dueDate);
  const assignee = fields.assignedTo || userId;
  const dayStart = due
    ? new Date(due.getFullYear(), due.getMonth(), due.getDate(), 0, 0, 0, 0)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dayEnd = due
    ? new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const query = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    deletedAt: null,
    status: { $nin: ['completed', 'cancelled'] },
  };
  if (assignee && mongoose.Types.ObjectId.isValid(assignee)) {
    query.assignedTo = new mongoose.Types.ObjectId(assignee);
  }
  if (due) {
    query.dueDate = { $gte: dayStart, $lte: dayEnd };
  }

  const candidates = await Task.find(query)
    .select('_id title dueDate status assignedTo')
    .limit(40)
    .lean();

  return candidates
    .map((doc) => {
      const score = intentOverlapScore(title, doc.title);
      if (score < 0.5) return null;
      return {
        moduleKey: 'tasks',
        recordId: String(doc._id),
        label: String(doc.title || 'Task').slice(0, 120),
        score: Math.round(score * 100),
        reason: 'Similar open task for the same assignee/time',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function findIntentDuplicatesForCreate({
  organizationId,
  moduleKey,
  fields = {},
  userId = null,
}) {
  const mod = String(moduleKey || '').toLowerCase();
  if (mod === 'events') {
    return findEventIntentDuplicates({ organizationId, fields, userId });
  }
  if (mod === 'tasks') {
    return findTaskIntentDuplicates({ organizationId, fields, userId });
  }
  return [];
}

/**
 * Rewrite create_record actions into review_record recommendations when intent duplicates exist.
 */
async function applyIntentDuplicateGuard(structured, {
  organizationId,
  userId = null,
  question = '',
} = {}) {
  if (!structured || !organizationId) return structured;
  if (allowsForceCreate(question)) return structured;

  const actions = Array.isArray(structured.actions) ? [...structured.actions] : [];
  if (!actions.length) return structured;

  const nextActions = [];
  const recommendations = [];

  for (const action of actions) {
    if (!action || action.kind !== 'create_record') {
      nextActions.push(action);
      continue;
    }
    const moduleKey = String(action.moduleKey || '').toLowerCase();
    const fields = action.fields && typeof action.fields === 'object' ? action.fields : {};
    // eslint-disable-next-line no-await-in-loop
    const matches = await findIntentDuplicatesForCreate({
      organizationId,
      moduleKey,
      fields,
      userId,
    });
    if (!matches.length) {
      nextActions.push(action);
      continue;
    }

    recommendations.push(...matches);
    for (const match of matches.slice(0, 3)) {
      nextActions.push({
        label: `Open existing: ${match.label}`,
        kind: 'review_record',
        moduleKey: match.moduleKey,
        recordId: match.recordId,
        priority: 'high',
        rationale: match.reason,
        executeNow: false,
      });
    }
  }

  if (!recommendations.length) return structured;

  const next = { ...structured, actions: nextActions };
  const top = recommendations[0];
  next.headline = `Found existing ${top.moduleKey.slice(0, -1) || 'record'}: ${top.label}`;
  next.bullets = [
    `Possible duplicate — ${top.reason}`,
    ...recommendations.slice(0, 3).map((m) => `Existing: ${m.label}`),
    'Open the existing record instead of creating another',
    'Say "create anyway" only if you still need a new one',
  ].slice(0, 8);
  next.detail = [
    String(structured.detail || '').replace(/\bI('ll| will) create\b/gi, 'I found an existing match instead of creating'),
    '',
    'Duplicate prevention: Astra recommends the matching record for this intent rather than creating another.',
  ].filter(Boolean).join('\n').slice(0, 4000);
  next.clarifyingQuestions = [];
  return next;
}

module.exports = {
  allowsForceCreate,
  findIntentDuplicatesForCreate,
  applyIntentDuplicateGuard,
  intentOverlapScore,
};
