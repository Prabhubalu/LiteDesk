'use strict';

/**
 * Calendar conflict + duplicate detection for Astra event creates.
 * Tenant-scoped to organizationId + assignedTo (the acting user).
 */

const mongoose = require('mongoose');

function toObjectId(value) {
  const raw = String(value || '');
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return raw;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesLookDuplicate(a, b) {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 8 && (left.includes(right) || right.includes(left))) return true;
  return false;
}

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function toHit(row) {
  const id = String(row._id || row.id || '');
  const title = row.eventName || row.title || 'Meeting';
  const start = row.startDateTime ? new Date(row.startDateTime).toISOString() : null;
  const end = row.endDateTime ? new Date(row.endDateTime).toISOString() : null;
  return {
    id,
    title,
    status: row.status || null,
    eventType: row.eventType || null,
    startDateTime: start,
    endDateTime: end,
    subtitle: [row.eventType, row.status, formatWhen(start)].filter(Boolean).join(' · '),
  };
}

/**
 * @returns {Promise<{ conflicts: object[], duplicates: object[], hits: object[] }>}
 */
async function findCalendarConflicts({
  Event,
  organizationId,
  userId,
  title,
  startDateTime,
  endDateTime,
} = {}) {
  const empty = { conflicts: [], duplicates: [], hits: [] };
  if (!Event || typeof Event.find !== 'function' || !organizationId || !userId) {
    return empty;
  }
  const start = startDateTime ? new Date(startDateTime) : null;
  const end = endDateTime ? new Date(endDateTime) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return empty;
  }

  const base = {
    organizationId: toObjectId(organizationId),
    assignedTo: toObjectId(userId),
    deletedAt: null,
    status: { $ne: 'Cancelled' },
  };

  // Time overlap for this user: existing.start < newEnd && existing.end > newStart
  let overlapQuery = Event.find({
    ...base,
    startDateTime: { $lt: end },
    endDateTime: { $gt: start },
  }).sort({ startDateTime: 1 }).limit(12);
  if (typeof overlapQuery.lean === 'function') overlapQuery = overlapQuery.lean();
  const overlapRows = await overlapQuery;

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(23, 59, 59, 999);

  let sameDayQuery = Event.find({
    ...base,
    startDateTime: { $gte: dayStart, $lte: dayEnd },
    eventName: { $regex: escapeRegex(String(title || '').trim() || 'Meeting'), $options: 'i' },
  }).sort({ startDateTime: 1 }).limit(12);
  if (typeof sameDayQuery.lean === 'function') sameDayQuery = sameDayQuery.lean();
  const sameDayRows = await sameDayQuery;

  const byId = new Map();
  for (const row of [...(overlapRows || []), ...(sameDayRows || [])]) {
    const hit = toHit(row);
    if (!hit.id) continue;
    byId.set(hit.id, hit);
  }

  const hits = [...byId.values()];
  const conflicts = (overlapRows || []).map(toHit).filter((h) => h.id);
  const duplicates = hits.filter((h) => titlesLookDuplicate(title, h.title));

  return { conflicts, duplicates, hits };
}

function buildConflictLead({ title, when, durationMinutes, conflicts, duplicates }) {
  const lines = [];
  if (conflicts.length) {
    const first = conflicts[0];
    lines.push(
      `You already have ${conflicts.length === 1 ? 'another meeting' : `${conflicts.length} meetings`} at that time`
      + (first?.title ? ` — "${first.title}" (${first.subtitle || formatWhen(first.startDateTime)})` : '')
      + '.',
    );
    if (conflicts.length > 1) {
      for (const c of conflicts.slice(0, 4)) {
        lines.push(`• ${c.title}${c.subtitle ? ` — ${c.subtitle}` : ''}`);
      }
    }
  }
  if (duplicates.length) {
    const dup = duplicates[0];
    lines.push(
      `This also looks like a duplicate of "${dup.title}"`
      + (dup.subtitle ? ` (${dup.subtitle})` : '')
      + '.',
    );
  }
  lines.push(
    `I can still create "${title}" for ${when} (${durationMinutes} min) if you want to override, or cancel to keep your current schedule.`,
  );
  return lines.join('\n');
}

module.exports = {
  findCalendarConflicts,
  buildConflictLead,
  titlesLookDuplicate,
  formatWhen,
  toHit,
};
