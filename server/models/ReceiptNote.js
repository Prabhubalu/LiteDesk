const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { RN_STATUS_VALUES, RN_STATUSES } = require('../constants/procurementLifecycle');

const ReceiptNoteLineSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  receiptNoteId: { type: Schema.Types.ObjectId, ref: 'ReceiptNote', required: true, index: true },
  purchaseOrderLineId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrderLine', required: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true, index: true },
  skuSnapshot: { type: String, default: null },
  itemNameSnapshot: { type: String, default: null },
  quantityOrdered: { type: Number, default: 0 },
  quantityPreviouslyReceived: { type: Number, default: 0 },
  quantityPending: { type: Number, default: 0 },
  quantityReceived: { type: Number, default: 0 },
  quantityAccepted: { type: Number, default: 0 },
  quantityRejected: { type: Number, default: 0 },
  quantityReturned: { type: Number, default: 0 },
  unitOfMeasure: { type: String, default: null },
  unitPrice: { type: Number, default: 0 },
  taxSnapshot: { type: Schema.Types.Mixed, default: {} },
  chargeSnapshot: { type: Schema.Types.Mixed, default: {} },
  inventoryLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  remarks: { type: String, default: null }
}, { timestamps: true });

const ReceiptNoteSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  receiptNoteNumber: { type: String, required: true, trim: true, index: true },
  receiptDate: { type: Date, default: Date.now },
  vendorId: { type: Schema.Types.ObjectId, required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
  receiptLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  receivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  vendorDeliveryChallanNo: { type: String, default: null },
  transportDetails: { type: String, default: null },
  status: { type: String, enum: RN_STATUS_VALUES, default: RN_STATUSES.DRAFT, index: true },
  notes: { type: String, default: null },
  externalReferenceId: { type: String, default: null, index: true },
  syncStatus: { type: String, default: 'not_synced' },
  lastSyncAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

ReceiptNoteSchema.index({ organizationId: 1, receiptNoteNumber: 1 }, { unique: true });

module.exports = {
  ReceiptNote: wrapTenantModel(mongoose.model('ReceiptNote', ReceiptNoteSchema)),
  ReceiptNoteLine: wrapTenantModel(mongoose.model('ReceiptNoteLine', ReceiptNoteLineSchema))
};
