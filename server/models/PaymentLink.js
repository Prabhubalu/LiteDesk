const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  PAYMENT_LINK_STATUSES,
  PAYMENT_LINK_STATUS_DEFAULT,
  PAYMENT_LINK_PAY_TARGET_TYPES,
  PAYMENT_GATEWAY_PROVIDERS,
  generatePublicToken
} = require('../constants/paymentGatewayLifecycle');

const { Schema } = mongoose;

const BrandingSnapshotSchema = new Schema(
  {
    displayName: { type: String, trim: true, default: null },
    logoUrl: { type: String, trim: true, default: null },
    accentColor: { type: String, trim: true, default: null },
    supportEmail: { type: String, trim: true, default: null },
    footerText: { type: String, trim: true, maxlength: 2000, default: null }
  },
  { _id: false }
);

const PaymentLinkSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    paymentLinkId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    paymentLinkNumber: { type: String, required: true, trim: true, index: true },

    organizationRefId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    contactId: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },

    payTargetType: {
      type: String,
      enum: PAYMENT_LINK_PAY_TARGET_TYPES,
      default: 'single_invoice',
      index: true
    },
    invoiceIds: { type: [String], default: [] },
    fixedAmount: { type: Number, default: null },
    currency: { type: String, trim: true, default: 'USD', index: true },

    allowedMethods: { type: [String], default: ['card'] },
    expiresAt: { type: Date, default: null, index: true },
    maxUses: { type: Number, default: 1 },
    useCount: { type: Number, default: 0 },

    preferredProvider: {
      type: String,
      enum: PAYMENT_GATEWAY_PROVIDERS,
      default: 'stripe',
      index: true
    },
    paymentGatewaySessionId: { type: String, trim: true, default: null, index: true },

    publicToken: { type: String, required: true, unique: true, trim: true, index: true },
    publicUrl: { type: String, trim: true, default: null },

    brandingSnapshot: { type: BrandingSnapshotSchema, default: () => ({}) },

    status: {
      type: String,
      enum: PAYMENT_LINK_STATUSES,
      default: PAYMENT_LINK_STATUS_DEFAULT,
      index: true
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    sourceContext: { type: String, trim: true, default: 'crm', index: true },
    sourceRef: { type: Schema.Types.Mixed, default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: null },

    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

PaymentLinkSchema.index({ organizationId: 1, paymentLinkNumber: 1 }, { unique: true });
PaymentLinkSchema.index({ organizationId: 1, publicToken: 1 }, { unique: true });

PaymentLinkSchema.pre('validate', async function assignPaymentLinkIds(next) {
  try {
    if (!this.paymentLinkId) {
      this.paymentLinkId = crypto.randomUUID();
    }
    if (!this.publicToken) {
      this.publicToken = generatePublicToken();
    }
    if (this.paymentLinkNumber) return next();

    const PaymentLinkModel = this.constructor;
    const count = await PaymentLinkModel.countDocuments({ organizationId: this.organizationId });
    this.paymentLinkNumber = `PLK-${String(count + 1).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('PaymentLink', PaymentLinkSchema));
