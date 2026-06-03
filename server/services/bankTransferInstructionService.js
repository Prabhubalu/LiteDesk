/**
 * PAY3.2 — Manual bank transfer instructions (fallback capture channel).
 * Instruction creation does NOT create Payment — agent records via POST /api/payments.
 */

const BankTransferInstruction = require('../models/BankTransferInstruction');
const PaymentLink = require('../models/PaymentLink');
const Invoice = require('../models/Invoice');
const { roundMoney } = require('../constants/paymentLifecycle');
const {
  isPaymentLinkActive,
  BANK_TRANSFER_INSTRUCTION_STATUS_DEFAULT
} = require('../constants/paymentGatewayLifecycle');
const { assertCaptureTargets } = require('./gatewayAllocationValidationService');
const { getOrCreateSettings } = require('./gatewayCredentialHealthService');
const { assertPaymentLinkUsable } = require('./paymentLinkService');
const { buildSessionTargetsFromLink } = require('./paymentGatewaySessionService');

function maskAccountNumber(accountNumber = '') {
  const digits = String(accountNumber).replace(/\s/g, '');
  if (digits.length <= 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
}

function resolveManualBankConfig(settings = {}) {
  const manual = settings.manualBankTransfer || {};
  return {
    beneficiaryName: manual.beneficiaryName || settings.beneficiaryName || 'Beneficiary',
    bankName: manual.bankName || null,
    accountNumberMasked: manual.accountNumberMasked || maskAccountNumber(manual.accountNumber || ''),
    routingOrIfsc: manual.routingOrIfsc || manual.ifsc || null,
    instructionsTemplate: manual.instructionsTemplate || null
  };
}

function assertManualBankEnabled(settings) {
  const enabled = settings.enabledProviders || [];
  if (!enabled.includes('manual')) {
    const err = new Error('Manual bank transfer is not enabled for this organization');
    err.code = 'MANUAL_BANK_DISABLED';
    throw err;
  }

  const config = resolveManualBankConfig(settings);
  if (!config.beneficiaryName) {
    const err = new Error('Manual bank transfer beneficiary is not configured');
    err.code = 'MANUAL_BANK_NOT_CONFIGURED';
    throw err;
  }
  return config;
}

async function createInstructionFromPaymentLink({
  publicToken,
  expiresInHours = 168
}) {
  const link = await PaymentLink.findOne({
    publicToken: String(publicToken || '').trim(),
    deletedAt: null
  }).lean();

  assertPaymentLinkUsable(link);
  if (!isPaymentLinkActive(link)) {
    const err = new Error('Payment link is not active');
    err.code = 'PAYMENT_LINK_EXPIRED';
    throw err;
  }

  const allowed = link.allowedMethods || ['card'];
  if (!allowed.includes('bank_transfer')) {
    const err = new Error('Bank transfer is not allowed for this payment link');
    err.code = 'BANK_TRANSFER_NOT_ALLOWED';
    throw err;
  }

  const settings = await getOrCreateSettings(link.organizationId);
  const bankConfig = assertManualBankEnabled(settings.toObject());

  const invoiceTargets = await buildSessionTargetsFromLink(link);
  await assertCaptureTargets({
    organizationId: link.organizationId,
    organizationRefId: link.organizationRefId,
    currency: link.currency,
    amount: roundMoney(link.fixedAmount),
    invoiceTargets
  });

  const expiresAt = link.expiresAt || new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const instructionsText =
    bankConfig.instructionsTemplate?.replace('{{referenceCode}}', '{{reference}}') || null;

  const instruction = await BankTransferInstruction.create({
    organizationId: link.organizationId,
    paymentLinkId: link.paymentLinkId,
    organizationRefId: link.organizationRefId,
    contactId: link.contactId,
    beneficiaryName: bankConfig.beneficiaryName,
    bankName: bankConfig.bankName,
    accountNumberMasked: bankConfig.accountNumberMasked,
    routingOrIfsc: bankConfig.routingOrIfsc,
    amount: roundMoney(link.fixedAmount),
    currency: link.currency,
    invoiceTargets,
    expiresAt,
    instructionsText,
    status: BANK_TRANSFER_INSTRUCTION_STATUS_DEFAULT
  });

  return instruction.toObject();
}

async function createInstructionForInvoice({
  organizationId,
  userId,
  paymentLinkId,
  organizationRefId,
  contactId,
  invoiceTargets,
  amount,
  currency,
  expiresAt = null
}) {
  const settings = await getOrCreateSettings(organizationId);
  const bankConfig = assertManualBankEnabled(settings.toObject());

  await assertCaptureTargets({
    organizationId,
    organizationRefId,
    currency,
    amount: roundMoney(amount),
    invoiceTargets
  });

  const instruction = await BankTransferInstruction.create({
    organizationId,
    paymentLinkId: paymentLinkId || null,
    organizationRefId,
    contactId: contactId || null,
    beneficiaryName: bankConfig.beneficiaryName,
    bankName: bankConfig.bankName,
    accountNumberMasked: bankConfig.accountNumberMasked,
    routingOrIfsc: bankConfig.routingOrIfsc,
    amount: roundMoney(amount),
    currency,
    invoiceTargets,
    expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    instructionsText: bankConfig.instructionsTemplate,
    createdBy: userId || null,
    status: BANK_TRANSFER_INSTRUCTION_STATUS_DEFAULT
  });

  return instruction.toObject();
}

async function getInstructionById({ organizationId, bankTransferInstructionId }) {
  return BankTransferInstruction.findOne({ organizationId, bankTransferInstructionId }).lean();
}

async function getPublicInstruction({ publicToken, bankTransferInstructionId }) {
  const link = await PaymentLink.findOne({
    publicToken: String(publicToken || '').trim(),
    deletedAt: null
  }).lean();

  if (!link) return null;

  return BankTransferInstruction.findOne({
    organizationId: link.organizationId,
    bankTransferInstructionId,
    paymentLinkId: link.paymentLinkId
  }).lean();
}

async function listPendingInstructions({ organizationId, paymentLinkId = null, limit = 25 }) {
  const query = {
    organizationId,
    status: { $in: ['pending', 'proof_submitted'] }
  };
  if (paymentLinkId) query.paymentLinkId = paymentLinkId;

  return BankTransferInstruction.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function listInstructionsForInvoice({ organizationId, invoiceMongoId }) {
  const invoice = await Invoice.findOne({
    _id: invoiceMongoId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!invoice) return [];

  return BankTransferInstruction.find({
    organizationId,
    'invoiceTargets.invoiceMongoId': invoice._id,
    status: { $in: ['pending', 'proof_submitted', 'matched'] }
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
}

async function tryMatchBankTransferInstruction({ organizationId, payment, userId = null }) {
  const referenceNumber = payment?.paymentInstrumentSnapshot?.referenceNumber;
  if (!referenceNumber || payment?.paymentInstrumentSnapshot?.method !== 'bank_transfer') {
    return null;
  }

  const instruction = await BankTransferInstruction.findOne({
    organizationId,
    referenceCode: String(referenceNumber).trim(),
    status: { $in: ['pending', 'proof_submitted'] }
  });

  if (!instruction) return null;

  if (Number(instruction.amount) !== Number(payment.amount)) {
    const err = new Error('Payment amount does not match bank transfer instruction');
    err.code = 'BANK_TRANSFER_AMOUNT_MISMATCH';
    throw err;
  }

  instruction.status = 'matched';
  instruction.matchedPaymentId = payment.paymentId;
  instruction.matchedAt = new Date();
  instruction.matchedBy = userId || null;
  await instruction.save();

  return instruction.toObject();
}

function toPublicInstructionView(instruction) {
  if (!instruction) return null;
  return {
    bankTransferInstructionId: instruction.bankTransferInstructionId,
    beneficiaryName: instruction.beneficiaryName,
    bankName: instruction.bankName,
    accountNumberMasked: instruction.accountNumberMasked,
    routingOrIfsc: instruction.routingOrIfsc,
    referenceCode: instruction.referenceCode,
    amount: instruction.amount,
    currency: instruction.currency,
    status: instruction.status,
    expiresAt: instruction.expiresAt,
    instructionsText: instruction.instructionsText
  };
}

module.exports = {
  maskAccountNumber,
  resolveManualBankConfig,
  assertManualBankEnabled,
  createInstructionFromPaymentLink,
  createInstructionForInvoice,
  getInstructionById,
  getPublicInstruction,
  listPendingInstructions,
  listInstructionsForInvoice,
  tryMatchBankTransferInstruction,
  toPublicInstructionView
};
