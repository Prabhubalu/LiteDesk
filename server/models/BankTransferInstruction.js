const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  BANK_TRANSFER_INSTRUCTION_STATUSES,
  BANK_TRANSFER_INSTRUCTION_STATUS_DEFAULT,
  generateReferenceCode
} = require('../constants/paymentGatewayLifecycle');

const { Schema } = mongoose;

const InvoiceTargetSchema = new Schema(
  {
    invoiceId: { type: String, trim: true, required: true },
    invoiceMongoId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    amountRequested: { type: Number, required: true }
  },
  { _id: false }
);

const BankTransferInstructionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    bankTransferInstructionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    paymentLinkId: { type: String, trim: true, default: null, index: true },
    organizationRefId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    contactId: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },

    beneficiaryName: { type: String, trim: true, required: true },
    bankName: { type: String, trim: true, default: null },
    accountNumberMasked: { type: String, trim: true, default: null },
    routingOrIfsc: { type: String, trim: true, default: null },
    referenceCode: { type: String, trim: true, required: true, index: true },
    instructionsText: { type: String, trim: true, maxlength: 4000, default: null },

    amount: { type: Number, required: true },
    currency: { type: String, trim: true, default: 'USD', index: true },
    invoiceTargets: { type: [InvoiceTargetSchema], default: [] },

    status: {
      type: String,
      enum: BANK_TRANSFER_INSTRUCTION_STATUSES,
      default: BANK_TRANSFER_INSTRUCTION_STATUS_DEFAULT,
      index: true
    },
    expiresAt: { type: Date, default: null, index: true },

    matchedPaymentId: { type: String, trim: true, default: null, index: true },
    matchedAt: { type: Date, default: null },
    matchedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    proofAttachmentIds: { type: [String], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    canceledAt: { type: Date, default: null },
    canceledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

BankTransferInstructionSchema.index({ organizationId: 1, referenceCode: 1 }, { unique: true });
BankTransferInstructionSchema.index({ organizationId: 1, paymentLinkId: 1, status: 1 });

BankTransferInstructionSchema.pre('validate', function assignInstructionIds(next) {
  if (!this.bankTransferInstructionId) {
    this.bankTransferInstructionId = crypto.randomUUID();
  }
  if (!this.referenceCode) {
    this.referenceCode = generateReferenceCode();
  }
  next();
});

module.exports = wrapTenantModel(
  mongoose.model('BankTransferInstruction', BankTransferInstructionSchema)
);
