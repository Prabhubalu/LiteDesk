const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const CONTRA_ENTRY_STATUSES = ['draft', 'posted', 'void'];
const CONTRA_ENTRY_SOURCES = ['manual', 'tally_mirror', 'system'];

const ContraEntryLineSchema = new Schema({
  contraEntryLineId: { type: String, required: true, trim: true },
  ledgerName: { type: String, required: true, trim: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  costCentre: { type: String, trim: true, default: null },
  narration: { type: String, trim: true, default: null }
}, { _id: false });

const ContraEntrySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  contraEntryId: { type: String, required: true, unique: true, trim: true, index: true },
  contraNumber: { type: String, required: true, trim: true, index: true },
  contraDate: { type: Date, required: true, index: true },
  narration: { type: String, trim: true, default: null },
  lines: { type: [ContraEntryLineSchema], default: [] },
  status: {
    type: String,
    enum: CONTRA_ENTRY_STATUSES,
    default: 'draft',
    index: true
  },
  source: {
    type: String,
    enum: CONTRA_ENTRY_SOURCES,
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

ContraEntrySchema.index({ organizationId: 1, contraNumber: 1 }, { unique: true });
ContraEntrySchema.index(
  { organizationId: 1, externalReferenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalReferenceId: { $type: 'string', $ne: '' } }
  }
);

ContraEntrySchema.pre('validate', function assignContraIds(next) {
  if (!this.contraEntryId) {
    this.contraEntryId = crypto.randomUUID();
  }
  if (Array.isArray(this.lines)) {
    for (const line of this.lines) {
      if (!line.contraEntryLineId) {
        line.contraEntryLineId = crypto.randomUUID();
      }
    }
  }
  return next();
});

module.exports = {
  ContraEntry: wrapTenantModel(mongoose.model('ContraEntry', ContraEntrySchema)),
  ContraEntryLineSchema,
  CONTRA_ENTRY_STATUSES,
  CONTRA_ENTRY_SOURCES
};
