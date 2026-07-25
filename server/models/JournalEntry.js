const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const JOURNAL_ENTRY_STATUSES = ['draft', 'posted', 'void'];
const JOURNAL_ENTRY_SOURCES = ['manual', 'tally_mirror', 'system'];

const JournalEntryLineSchema = new Schema({
  journalEntryLineId: { type: String, required: true, trim: true },
  ledgerName: { type: String, required: true, trim: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  costCentre: { type: String, trim: true, default: null },
  narration: { type: String, trim: true, default: null }
}, { _id: false });

const JournalEntrySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  journalEntryId: { type: String, required: true, unique: true, trim: true, index: true },
  journalNumber: { type: String, required: true, trim: true, index: true },
  journalDate: { type: Date, required: true, index: true },
  narration: { type: String, trim: true, default: null },
  lines: { type: [JournalEntryLineSchema], default: [] },
  status: {
    type: String,
    enum: JOURNAL_ENTRY_STATUSES,
    default: 'draft',
    index: true
  },
  source: {
    type: String,
    enum: JOURNAL_ENTRY_SOURCES,
    default: 'manual',
    index: true
  },
  postedAt: { type: Date, default: null },
  voidedAt: { type: Date, default: null },
  externalReferenceId: { type: String, trim: true, default: null, index: true },
  syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
  lastSyncAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

JournalEntrySchema.index({ organizationId: 1, journalNumber: 1 }, { unique: true });
JournalEntrySchema.index(
  { organizationId: 1, externalReferenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalReferenceId: { $type: 'string', $ne: '' } }
  }
);

JournalEntrySchema.pre('validate', function assignJournalIds(next) {
  if (!this.journalEntryId) {
    this.journalEntryId = crypto.randomUUID();
  }
  if (Array.isArray(this.lines)) {
    for (const line of this.lines) {
      if (!line.journalEntryLineId) {
        line.journalEntryLineId = crypto.randomUUID();
      }
    }
  }
  return next();
});

module.exports = {
  JournalEntry: wrapTenantModel(mongoose.model('JournalEntry', JournalEntrySchema)),
  JournalEntryLineSchema,
  JOURNAL_ENTRY_STATUSES,
  JOURNAL_ENTRY_SOURCES
};
