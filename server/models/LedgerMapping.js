const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const LEDGER_ROLE_KEYS = [
  'sales',
  'purchase',
  'cgst',
  'sgst',
  'igst',
  'bank',
  'cash',
  'round_off'
];

const LedgerMappingSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  ledgerMappingId: { type: String, required: true, unique: true, trim: true, index: true },
  roleKey: {
    type: String,
    enum: LEDGER_ROLE_KEYS,
    required: true,
    index: true
  },
  tallyLedgerName: { type: String, required: true, trim: true },
  externalReferenceId: { type: String, trim: true, default: null, index: true },
  syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
  lastSyncAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

LedgerMappingSchema.index({ organizationId: 1, roleKey: 1 }, { unique: true });

LedgerMappingSchema.pre('validate', function assignLedgerMappingId(next) {
  if (!this.ledgerMappingId) {
    this.ledgerMappingId = crypto.randomUUID();
  }
  return next();
});

module.exports = {
  LedgerMapping: wrapTenantModel(mongoose.model('LedgerMapping', LedgerMappingSchema)),
  LEDGER_ROLE_KEYS
};
