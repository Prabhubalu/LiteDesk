const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const VENDOR_PAYMENT_STATUSES = ['draft', 'recorded', 'allocated', 'void', 'reversed'];
const VENDOR_PAYMENT_METHODS = ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'other'];

const VendorPaymentInstrumentSnapshotSchema = new Schema(
  {
    method: {
      type: String,
      enum: VENDOR_PAYMENT_METHODS,
      default: 'other'
    },
    referenceNumber: { type: String, trim: true, default: null },
    bankName: { type: String, trim: true, default: null },
    maskedAccount: { type: String, trim: true, default: null },
    provider: { type: String, trim: true, default: 'manual' }
  },
  { _id: false }
);

const VendorPaymentSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  vendorPaymentId: { type: String, required: true, unique: true, trim: true, index: true },
  vendorPaymentNumber: { type: String, required: true, trim: true, index: true },
  vendorId: { type: Schema.Types.ObjectId, required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, trim: true, default: 'INR', index: true },
  exchangeRateSnapshot: { type: Number, default: 1 },
  paymentDate: { type: Date, required: true, index: true },
  valueDate: { type: Date, default: null },
  paymentInstrumentSnapshot: {
    type: VendorPaymentInstrumentSnapshotSchema,
    default: () => ({})
  },
  amountAllocated: { type: Number, default: 0 },
  amountUnallocated: { type: Number, default: 0 },
  status: {
    type: String,
    enum: VENDOR_PAYMENT_STATUSES,
    default: 'recorded',
    index: true
  },
  notes: { type: String, trim: true, maxlength: 2000, default: null },
  externalReferenceId: { type: String, trim: true, default: null, index: true },
  syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
  lastSyncAt: { type: Date, default: null },
  recordedAt: { type: Date, default: null, index: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

VendorPaymentSchema.index({ organizationId: 1, vendorPaymentNumber: 1 }, { unique: true });
VendorPaymentSchema.index({ organizationId: 1, vendorId: 1, paymentDate: -1 });
VendorPaymentSchema.index(
  { organizationId: 1, externalReferenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalReferenceId: { $type: 'string', $ne: '' } }
  }
);

VendorPaymentSchema.pre('validate', function assignVendorPaymentId(next) {
  if (!this.vendorPaymentId) {
    this.vendorPaymentId = crypto.randomUUID();
  }
  return next();
});

module.exports = {
  VendorPayment: wrapTenantModel(mongoose.model('VendorPayment', VendorPaymentSchema)),
  VENDOR_PAYMENT_STATUSES,
  VENDOR_PAYMENT_METHODS
};
