'use strict';

/**
 * Post-mutation verify: re-read CRM and confirm intended fields stuck.
 * Never invents success — mismatches are returned explicitly.
 */

const mongoose = require('mongoose');
const { getModelForModuleKey } = require('../../utils/assignmentRecordLoader');

function resolveLabel(moduleKey, doc) {
  if (!doc) return '';
  const mod = String(moduleKey || '').toLowerCase();
  if (mod === 'events') return String(doc.eventName || '').trim();
  if (mod === 'tasks') return String(doc.title || doc.name || '').trim();
  if (mod === 'deals') return String(doc.name || doc.dealName || '').trim();
  if (mod === 'cases') return String(doc.title || doc.subject || doc.caseId || '').trim();
  if (mod === 'organizations') return String(doc.name || '').trim();
  if (mod === 'people') {
    const first = doc.firstName || doc.first_name || '';
    const last = doc.lastName || doc.last_name || '';
    return [first, last].filter(Boolean).join(' ').trim() || String(doc.email || '').trim();
  }
  return String(doc.name || doc.title || doc.eventName || '').trim();
}

function normalizeComparable(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.type != null && (value.id != null || value._id != null)) {
      return `${value.type}:${value.id || value._id}`;
    }
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
}

function fieldMatches(expected, actual) {
  const e = normalizeComparable(expected).toLowerCase();
  const a = normalizeComparable(actual).toLowerCase();
  if (!e) return true;
  return e === a;
}

/**
 * @param {{
 *   organizationId: unknown,
 *   op: string,
 *   moduleKey: string,
 *   recordId: string,
 *   expectedFields?: Record<string, unknown>,
 * }} args
 */
async function verifyMutationOutcome({
  organizationId,
  op = '',
  moduleKey = '',
  recordId = '',
  expectedFields = {},
} = {}) {
  const mod = String(moduleKey || '').toLowerCase().trim();
  const id = String(recordId || '').trim();
  const startedAt = Date.now();

  if (!organizationId || !mod || !id || !mongoose.Types.ObjectId.isValid(id)) {
    return {
      verified: false,
      mismatches: ['missing_record_ref'],
      summary: 'Could not verify — missing record reference.',
      nextHint: '',
      latencyMs: Date.now() - startedAt,
    };
  }

  const Model = getModelForModuleKey(mod);
  if (!Model) {
    return {
      verified: false,
      mismatches: ['unknown_module'],
      summary: `Could not verify — unknown module ${mod}.`,
      nextHint: '',
      latencyMs: Date.now() - startedAt,
    };
  }

  const query = { _id: new mongoose.Types.ObjectId(id) };
  if (Model.schema?.paths?.organizationId) {
    query.organizationId = organizationId;
  }
  if (Model.schema?.paths?.deletedAt) query.deletedAt = null;
  if (mod === 'organizations') query.isTenant = false;

  const doc = await Model.findOne(query).lean();
  if (!doc) {
    return {
      verified: false,
      mismatches: ['record_not_found'],
      summary: `Could not verify — ${mod} record not found after ${op || 'mutation'}.`,
      nextHint: 'Open the record and confirm the change manually.',
      latencyMs: Date.now() - startedAt,
    };
  }

  const mismatches = [];
  const expected = expectedFields && typeof expectedFields === 'object' ? expectedFields : {};
  const checkKeys = [
    'status',
    'stage',
    'title',
    'name',
    'priority',
    'assignedTo',
    'relatedTo',
  ];

  for (const key of checkKeys) {
    if (expected[key] === undefined || expected[key] === null || expected[key] === '') continue;
    let actual = doc[key];
    if (key === 'assignedTo' && actual && typeof actual === 'object') {
      actual = actual._id || actual;
    }
    if (key === 'relatedTo' && expected.relatedTo && typeof expected.relatedTo === 'object') {
      const expRel = expected.relatedTo;
      const actRel = doc.relatedTo || {};
      if (expRel.type && !fieldMatches(expRel.type, actRel.type)) {
        mismatches.push(`relatedTo.type`);
      }
      if (expRel.id && !fieldMatches(expRel.id, actRel.id)) {
        mismatches.push(`relatedTo.id`);
      }
      continue;
    }
    if (!fieldMatches(expected[key], actual)) {
      mismatches.push(key);
    }
  }

  const label = resolveLabel(mod, doc) || id;
  const verified = mismatches.length === 0;
  let summary;
  if (verified) {
    summary = op === 'create'
      ? `Verified — ${mod} “${label}” was created as intended.`
      : `Verified — ${mod} “${label}” matches the confirmed update.`;
  } else {
    summary = `Partial verify — ${mod} “${label}” exists but fields differ: ${mismatches.join(', ')}.`;
  }

  let nextHint = '';
  if (verified && mod === 'tasks' && doc.relatedTo?.type === 'deal' && doc.relatedTo?.id) {
    nextHint = 'Next: open the related deal and log the follow-up outcome.';
  } else if (verified && mod === 'deals') {
    nextHint = 'Next: schedule a follow-up or update next activity date.';
  } else if (verified && mod === 'cases') {
    nextHint = 'Next: reply to the customer or update case status.';
  } else if (!verified) {
    nextHint = 'Review the record and re-apply the change if needed.';
  }

  return {
    verified,
    mismatches,
    summary,
    nextHint,
    recordLabel: label,
    moduleKey: mod,
    recordId: id,
    latencyMs: Date.now() - startedAt,
  };
}

module.exports = {
  verifyMutationOutcome,
  fieldMatches,
  normalizeComparable,
};
