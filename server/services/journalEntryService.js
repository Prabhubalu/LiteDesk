/**
 * Journal entry — create (draft) + post.
 */

const ModuleSequence = require('../models/ModuleSequence');
const { JournalEntry } = require('../models/JournalEntry');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function nextDocNumber(organizationId, moduleKey, prefix) {
  const seq = await ModuleSequence.findOneAndUpdate(
    { organizationId, moduleKey, periodKey: '' },
    { $inc: { nextValue: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const n = Number(seq.nextValue) || 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

function assertBalanced(lines) {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += Number(line.debit) || 0;
    credit += Number(line.credit) || 0;
    if ((Number(line.debit) || 0) > 0 && (Number(line.credit) || 0) > 0) {
      throw validationError('A journal line cannot have both debit and credit');
    }
    if (!line.ledgerName) throw validationError('ledgerName is required on each line');
  }
  if (Math.abs(debit - credit) > 0.01) {
    throw validationError('Journal entry must be balanced (debits = credits)');
  }
  if (debit <= 0) throw validationError('Journal entry must have non-zero amounts');
}

async function createJournalEntry({ organizationId, userId, payload }) {
  const lines = Array.isArray(payload?.lines) ? payload.lines : [];
  if (lines.length < 2) throw validationError('At least two journal lines are required');
  assertBalanced(lines);

  const journalNumber =
    payload.journalNumber ||
    (await nextDocNumber(organizationId, 'journal_entries', 'JV'));

  const entry = await JournalEntry.create({
    organizationId,
    journalNumber,
    journalDate: payload.journalDate || new Date(),
    narration: payload.narration || null,
    lines: lines.map((l) => ({
      ledgerName: l.ledgerName,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      costCentre: l.costCentre || null,
      narration: l.narration || null
    })),
    status: 'draft',
    source: payload.source || 'manual',
    externalReferenceId: payload.externalReferenceId || null,
    createdBy: userId,
    modifiedBy: userId
  });

  return entry.toObject();
}

async function postJournalEntry({ organizationId, id, userId }) {
  const entry = await JournalEntry.findOne({ _id: id, organizationId, deletedAt: null });
  if (!entry) throw validationError('Journal entry not found', 'NOT_FOUND');
  if (entry.status !== 'draft') throw validationError('Only draft journal entries can be posted');
  assertBalanced(entry.lines || []);
  entry.status = 'posted';
  entry.postedAt = new Date();
  entry.modifiedBy = userId;
  await entry.save();
  return entry.toObject();
}

async function listJournalEntries({ organizationId, status = null, limit = 50 }) {
  const q = { organizationId, deletedAt: null };
  if (status) q.status = status;
  return JournalEntry.find(q).sort({ createdAt: -1 }).limit(limit).lean();
}

async function getJournalEntry({ organizationId, id }) {
  const entry = await JournalEntry.findOne({ _id: id, organizationId, deletedAt: null }).lean();
  if (!entry) throw validationError('Journal entry not found', 'NOT_FOUND');
  return entry;
}

module.exports = {
  createJournalEntry,
  postJournalEntry,
  listJournalEntries,
  getJournalEntry
};
