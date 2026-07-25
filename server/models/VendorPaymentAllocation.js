const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const VENDOR_PAYMENT_ALLOCATION_STATUSES = ['applied', 'reversed'];

const VendorPaymentAllocationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  vendorPaymentAllocationId: { type: String, required: true, unique: true, trim: true, index: true },
  vendorPaymentId: { type: String, required: true, trim: true, index: true },
  vendorPaymentMongoId: {
    type: Schema.Types.ObjectId,
    ref: 'VendorPayment',
    required: true,
    index: true
  },
  purchaseBillId: { type: String, required: true, trim: true, index: true },
  purchaseBillMongoId: {
    type: Schema.Types.ObjectId,
    ref: 'PurchaseBill',
    required: true,
    index: true
  },
  amountApplied: { type: Number, required: true, min: 0.01 },
  billCurrency: { type: String, trim: true, default: 'INR' },
  paymentCurrency: { type: String, trim: true, default: 'INR' },
  exchangeRateSnapshot: { type: Schema.Types.Mixed, default: null },
  status: {
    type: String,
    enum: VENDOR_PAYMENT_ALLOCATION_STATUSES,
    default: 'applied',
    index: true
  },
  appliedAt: { type: Date, default: Date.now, index: true },
  appliedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reversedAt: { type: Date, default: null },
  reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reversalReason: { type: String, trim: true, maxlength: 500, default: null },
  externalReferenceId: { type: String, trim: true, default: null, index: true },
  syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
  lastSyncAt: { type: Date, default: null }
}, { timestamps: true });

VendorPaymentAllocationSchema.index({ organizationId: 1, vendorPaymentId: 1, status: 1 });
VendorPaymentAllocationSchema.index({ organizationId: 1, purchaseBillId: 1, status: 1 });

VendorPaymentAllocationSchema.pre('validate', function assignAllocationId(next) {
  if (!this.vendorPaymentAllocationId) {
    this.vendorPaymentAllocationId = crypto.randomUUID();
  }
  return next();
});

module.exports = {
  VendorPaymentAllocation: wrapTenantModel(
    mongoose.model('VendorPaymentAllocation', VendorPaymentAllocationSchema)
  ),
  VENDOR_PAYMENT_ALLOCATION_STATUSES
};
