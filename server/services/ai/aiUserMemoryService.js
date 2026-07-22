'use strict';

/**
 * Durable Astra user memory — prefs that outlive a single chat.
 */

const AiUserMemory = require('../../models/AiUserMemory');

const MAX_DISMISSED = 40;

function serializeMemory(doc) {
  if (!doc) {
    return {
      preferOpenFirst: true,
      amountThreshold: null,
      preferredChart: '',
      preferredLlmModel: '',
      dismissedFingerprints: [],
      lastModuleKey: '',
      lastRecordId: '',
      lastRecordTitle: '',
      preferCoachingSummary: true,
      preferSummaryNotEmail: true,
      summarizeUpCount: 0,
      summarizeDownCount: 0,
    };
  }
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    preferOpenFirst: plain.preferOpenFirst !== false,
    amountThreshold: plain.amountThreshold != null && Number.isFinite(Number(plain.amountThreshold))
      ? Number(plain.amountThreshold)
      : null,
    preferredChart: String(plain.preferredChart || ''),
    preferredLlmModel: String(plain.preferredLlmModel || ''),
    dismissedFingerprints: Array.isArray(plain.dismissedFingerprints)
      ? plain.dismissedFingerprints.map(String).slice(0, MAX_DISMISSED)
      : [],
    lastModuleKey: String(plain.lastModuleKey || ''),
    lastRecordId: String(plain.lastRecordId || ''),
    lastRecordTitle: String(plain.lastRecordTitle || ''),
    preferCoachingSummary: plain.preferCoachingSummary !== false,
    preferSummaryNotEmail: plain.preferSummaryNotEmail !== false,
    summarizeUpCount: Number(plain.summarizeUpCount || 0),
    summarizeDownCount: Number(plain.summarizeDownCount || 0),
  };
}

async function getUserMemory({ organizationId, userId } = {}) {
  if (!organizationId || !userId) return serializeMemory(null);
  const doc = await AiUserMemory.findOne({ organizationId, userId }).lean();
  return serializeMemory(doc);
}

async function upsertUserMemory({ organizationId, userId, patch = {} } = {}) {
  if (!organizationId || !userId) {
    const err = new Error('organizationId and userId required');
    err.statusCode = 400;
    throw err;
  }
  const $set = {};
  if (typeof patch.preferOpenFirst === 'boolean') $set.preferOpenFirst = patch.preferOpenFirst;
  if (patch.amountThreshold === null) $set.amountThreshold = null;
  else if (patch.amountThreshold != null && Number.isFinite(Number(patch.amountThreshold))) {
    $set.amountThreshold = Number(patch.amountThreshold);
  }
  if (patch.preferredChart !== undefined) {
    const chart = String(patch.preferredChart || '').trim().toLowerCase();
    $set.preferredChart = ['pie', 'bar', 'donut', 'table'].includes(chart) ? chart : '';
  }
  if (patch.preferredLlmModel !== undefined) {
    $set.preferredLlmModel = String(patch.preferredLlmModel || '').trim().slice(0, 120);
  }
  if (Array.isArray(patch.dismissedFingerprints)) {
    $set.dismissedFingerprints = patch.dismissedFingerprints.map(String).filter(Boolean).slice(-MAX_DISMISSED);
  }
  if (patch.lastModuleKey !== undefined) $set.lastModuleKey = String(patch.lastModuleKey || '').trim().slice(0, 64);
  if (patch.lastRecordId !== undefined) $set.lastRecordId = String(patch.lastRecordId || '').trim().slice(0, 64);
  if (patch.lastRecordTitle !== undefined) {
    $set.lastRecordTitle = String(patch.lastRecordTitle || '').trim().slice(0, 120);
  }
  if (typeof patch.preferCoachingSummary === 'boolean') {
    $set.preferCoachingSummary = patch.preferCoachingSummary;
  }
  if (typeof patch.preferSummaryNotEmail === 'boolean') {
    $set.preferSummaryNotEmail = patch.preferSummaryNotEmail;
  }

  const doc = await AiUserMemory.findOneAndUpdate(
    { organizationId, userId },
    { $set, $setOnInsert: { organizationId, userId } },
    { upsert: true, new: true },
  );
  return serializeMemory(doc);
}

async function rememberDismissedFingerprint({ organizationId, userId, fingerprint } = {}) {
  const fp = String(fingerprint || '').trim();
  if (!organizationId || !userId || !fp) return serializeMemory(null);
  const doc = await AiUserMemory.findOneAndUpdate(
    { organizationId, userId },
    {
      $addToSet: { dismissedFingerprints: fp },
      $setOnInsert: { organizationId, userId },
    },
    { upsert: true, new: true },
  );
  if (doc.dismissedFingerprints?.length > MAX_DISMISSED) {
    doc.dismissedFingerprints = doc.dismissedFingerprints.slice(-MAX_DISMISSED);
    await doc.save();
  }
  return serializeMemory(doc);
}

async function rememberRecordFocus({
  organizationId,
  userId,
  moduleKey = '',
  recordId = '',
  recordTitle = '',
} = {}) {
  return upsertUserMemory({
    organizationId,
    userId,
    patch: {
      lastModuleKey: moduleKey,
      lastRecordId: recordId,
      lastRecordTitle: recordTitle,
    },
  });
}

/**
 * Learn from thumbs: dismiss action fingerprints + reinforce summarize prefs.
 */
async function applyFeedbackLearning({
  organizationId,
  userId,
  rating = '',
  abilityKey = '',
  actionFingerprint = '',
  comment = '',
} = {}) {
  if (!organizationId || !userId) return serializeMemory(null);
  const r = String(rating || '').toLowerCase();
  const ability = String(abilityKey || '').toLowerCase();
  const isSummarize = /summar|tenant_agent|work_graph|ask/.test(ability);

  if (r === 'down' && actionFingerprint) {
    await rememberDismissedFingerprint({
      organizationId,
      userId,
      fingerprint: actionFingerprint,
    });
  }

  const $inc = {};
  const $set = {};
  if (r === 'down' && isSummarize) {
    $set.preferCoachingSummary = true;
    $set.preferSummaryNotEmail = true;
    $inc.summarizeDownCount = 1;
  }
  if (r === 'up' && isSummarize) {
    $inc.summarizeUpCount = 1;
  }
  // Optional free-text signals
  const note = String(comment || '').toLowerCase();
  if (r === 'down' && /email|too long|fields?|robot|generic/.test(note)) {
    $set.preferCoachingSummary = true;
    $set.preferSummaryNotEmail = true;
  }

  if (!Object.keys($set).length && !Object.keys($inc).length) {
    return getUserMemory({ organizationId, userId });
  }

  const update = { $setOnInsert: { organizationId, userId } };
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($inc).length) update.$inc = $inc;

  const doc = await AiUserMemory.findOneAndUpdate(
    { organizationId, userId },
    update,
    { upsert: true, new: true },
  );
  return serializeMemory(doc);
}

module.exports = {
  getUserMemory,
  upsertUserMemory,
  rememberDismissedFingerprint,
  rememberRecordFocus,
  applyFeedbackLearning,
  serializeMemory,
  MAX_DISMISSED,
};
