/**
 * Vendor Catalog — Vendor ↔ sellable variant supply relationship.
 * Lightweight procurement reference (not transactional history).
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const VENDOR_CATALOG_STATUS = Object.freeze(['Active', 'Inactive']);

const VendorCatalogEntrySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    /** Business organization that supplies the variant (Vendor). */
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true
    },
    /** Sellable unit — aligns with PO / Receipt lines. */
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ItemVariant',
      required: true,
      index: true
    },
    vendorItemCode: { type: String, trim: true, default: null },
    vendorItemName: { type: String, trim: true, default: null },
    /** User-maintained negotiated default price for POs. */
    purchasePrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, default: 'USD' },
    /** Preferred supplier for this variant among vendors. */
    preferredVendor: { type: Boolean, default: false },
    /** Minimum order quantity for this vendor–item link. */
    minOrderQty: { type: Number, default: null, min: 0 },
    /** Supplier lead time in calendar days. */
    leadTimeDays: { type: Number, default: null, min: 0 },
    /** Internal notes for this catalog link. */
    remarks: { type: String, default: null },
    /** System: unit price from latest completed receipt. */
    lastPurchasePrice: { type: Number, default: null },
    /** System: date of latest completed receipt line. */
    lastPurchaseDate: { type: Date, default: null },
    /** System: date of latest completed purchase return. */
    lastReturnDate: { type: Date, default: null },
    /** System: completed return line count (not unit count). */
    returnCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: VENDOR_CATALOG_STATUS,
      default: 'Active',
      index: true
    },
    customFields: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

VendorCatalogEntrySchema.index(
  { organizationId: 1, vendorId: 1, variantId: 1 },
  { unique: true }
);
VendorCatalogEntrySchema.index({ organizationId: 1, vendorId: 1, status: 1 });

module.exports = wrapTenantModel(
  mongoose.model('VendorCatalogEntry', VendorCatalogEntrySchema)
);
module.exports.VENDOR_CATALOG_STATUS = VENDOR_CATALOG_STATUS;
