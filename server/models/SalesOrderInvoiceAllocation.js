const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  SALES_ORDER_INVOICE_ALLOCATION_TYPES,
  SALES_ORDER_INVOICE_ALLOCATION_STATUSES
} = require('../constants/salesOrderLineage');

const { Schema } = mongoose;

const SalesOrderInvoiceAllocationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true
    },
    salesOrderLineId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    sourceQuoteLineId: { type: String, trim: true, default: null, index: true },

    invoiceId: { type: Schema.Types.ObjectId, default: null, index: true },
    invoiceLineId: { type: String, trim: true, default: null, index: true },

    salesOrderInvoiceAllocationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    quantityAllocated: { type: Number, default: 0, min: 0 },
    amountAllocated: { type: Number, default: 0, min: 0 },
    taxAmountAllocated: { type: Number, default: 0, min: 0 },

    allocationType: {
      type: String,
      enum: SALES_ORDER_INVOICE_ALLOCATION_TYPES,
      default: 'standard',
      index: true
    },
    status: {
      type: String,
      enum: SALES_ORDER_INVOICE_ALLOCATION_STATUSES,
      default: 'active',
      index: true
    },

    allocatedAt: { type: Date, default: Date.now, index: true },
    allocatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, trim: true, maxlength: 500, default: null },
    sourceSalesOrderInvoiceAllocationId: { type: String, trim: true, default: null, index: true }
  },
  { timestamps: true }
);

SalesOrderInvoiceAllocationSchema.index({ organizationId: 1, salesOrderId: 1, createdAt: -1 });
SalesOrderInvoiceAllocationSchema.index(
  { organizationId: 1, salesOrderLineId: 1, status: 1 },
  { name: 'so_line_active_allocations' }
);

SalesOrderInvoiceAllocationSchema.pre('validate', function ensureAllocationId(next) {
  if (this.salesOrderInvoiceAllocationId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.salesOrderInvoiceAllocationId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(
  mongoose.model('SalesOrderInvoiceAllocation', SalesOrderInvoiceAllocationSchema)
);
