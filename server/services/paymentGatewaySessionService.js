/**
 * PAY3 — Create hosted checkout sessions (shared by Payment Link + Portal Pay Now).
 */

const PaymentGatewaySession = require('../models/PaymentGatewaySession');
const PaymentLink = require('../models/PaymentLink');
const { roundMoney } = require('../constants/paymentLifecycle');
const { assertCaptureTargets } = require('./gatewayAllocationValidationService');
const { assertProviderHealthy } = require('./gatewayCredentialHealthService');
const {
  assertPaymentLinkUsable,
  incrementLinkUseCount
} = require('./paymentLinkService');
const { getGatewayAdapter } = require('./gateways/gatewayAdapterRegistry');

async function createGatewayCheckoutSession({
  organizationId,
  organizationRefId,
  contactId = null,
  paymentLinkId = null,
  payTargetType = 'single_invoice',
  invoiceTargets = [],
  amount,
  currency = 'USD',
  userId = null,
  successUrl,
  cancelUrl,
  provider = 'stripe',
  productName = 'Invoice payment'
}) {
  const settings = await assertProviderHealthy({ organizationId, provider });
  const adapter = getGatewayAdapter(provider);

  const sessionDraft = {
    organizationId,
    organizationRefId,
    contactId,
    currency,
    amount: roundMoney(amount),
    invoiceTargets
  };

  await assertCaptureTargets(sessionDraft);

  const metadata = {
    organizationId: String(organizationId),
    paymentGatewaySessionId: '',
    paymentLinkId: paymentLinkId || '',
    organizationRefId: String(organizationRefId),
    productName
  };

  const checkout = await adapter.createCheckoutSession({
    organizationId,
    settings: settings.toObject(),
    amount: sessionDraft.amount,
    currency: sessionDraft.currency,
    successUrl,
    cancelUrl,
    metadata
  });

  const session = await PaymentGatewaySession.create({
    organizationId,
    paymentLinkId,
    organizationRefId,
    contactId,
    provider,
    providerSessionId: checkout.providerSessionId,
    amount: sessionDraft.amount,
    currency: sessionDraft.currency,
    payTargetType,
    invoiceTargets: sessionDraft.invoiceTargets,
    checkoutUrl: checkout.checkoutUrl,
    successUrl,
    cancelUrl,
    expiresAt: checkout.expiresAt || null,
    metadata,
    createdBy: userId || null
  });

  metadata.paymentGatewaySessionId = session.paymentGatewaySessionId;
  session.metadata = metadata;
  await session.save();

  if (paymentLinkId) {
    await PaymentLink.updateOne(
      { organizationId, paymentLinkId },
      { $set: { paymentGatewaySessionId: session.paymentGatewaySessionId } }
    );
  }

  return session.toObject();
}

async function createCheckoutFromPaymentLink({
  organizationId,
  paymentLinkId,
  userId = null,
  successUrl,
  cancelUrl,
  provider = 'stripe'
}) {
  const link = await PaymentLink.findOne({ organizationId, paymentLinkId, deletedAt: null });
  assertPaymentLinkUsable(link?.toObject?.() || link);

  const invoiceTargets = await buildSessionTargetsFromLink(link);

  return createGatewayCheckoutSession({
    organizationId,
    organizationRefId: link.organizationRefId,
    contactId: link.contactId,
    paymentLinkId: link.paymentLinkId,
    payTargetType: link.payTargetType,
    invoiceTargets,
    amount: roundMoney(link.fixedAmount),
    currency: link.currency,
    userId,
    successUrl,
    cancelUrl,
    provider,
    productName: `Payment ${link.paymentLinkNumber}`
  });
}

async function createCheckoutFromPublicPaymentLink({
  publicToken,
  successUrl,
  cancelUrl,
  provider = 'stripe'
}) {
  const link = await PaymentLink.findOne({
    publicToken: String(publicToken || '').trim(),
    deletedAt: null
  });
  assertPaymentLinkUsable(link?.toObject?.() || link);

  const invoiceTargets = await buildSessionTargetsFromLink(link);

  return createGatewayCheckoutSession({
    organizationId: link.organizationId,
    organizationRefId: link.organizationRefId,
    contactId: link.contactId,
    paymentLinkId: link.paymentLinkId,
    payTargetType: link.payTargetType,
    invoiceTargets,
    amount: roundMoney(link.fixedAmount),
    currency: link.currency,
    userId: null,
    successUrl,
    cancelUrl,
    provider: link.preferredProvider || provider,
    productName: `Payment ${link.paymentLinkNumber}`
  });
}

async function buildSessionTargetsFromLink(link) {
  const Invoice = require('../models/Invoice');
  const targets = [];

  for (const invoiceId of link.invoiceIds || []) {
    const invoice = await Invoice.findOne({
      organizationId: link.organizationId,
      invoiceId,
      deletedAt: null
    }).lean();

    if (!invoice) continue;

    targets.push({
      invoiceId: invoice.invoiceId,
      invoiceMongoId: invoice._id,
      amountRequested: roundMoney(invoice.amountDue)
    });
  }

  return targets;
}

async function getSessionById({ organizationId, paymentGatewaySessionId }) {
  return PaymentGatewaySession.findOne({ organizationId, paymentGatewaySessionId }).lean();
}

async function markSessionFailed(session, { failureCode, failureMessage }) {
  await PaymentGatewaySession.updateOne(
    {
      organizationId: session.organizationId,
      paymentGatewaySessionId: session.paymentGatewaySessionId
    },
    {
      $set: {
        status: 'failed',
        failureCode: failureCode || 'CAPTURE_FAILED',
        failureMessage: failureMessage || 'Capture failed',
        completedAt: new Date()
      }
    }
  );
}

async function markSessionSucceeded(session, { paymentId, paymentMongoId, providerPaymentId }) {
  await PaymentGatewaySession.updateOne(
    { paymentGatewaySessionId: session.paymentGatewaySessionId, organizationId: session.organizationId },
    {
      $set: {
        status: 'succeeded',
        paymentId,
        paymentMongoId,
        providerPaymentId: providerPaymentId || session.providerPaymentId,
        completedAt: new Date(),
        failureCode: null,
        failureMessage: null
      }
    }
  );

  if (session.paymentLinkId) {
    await incrementLinkUseCount({
      organizationId: session.organizationId,
      paymentLinkId: session.paymentLinkId
    });
  }
}

module.exports = {
  createGatewayCheckoutSession,
  createCheckoutFromPaymentLink,
  createCheckoutFromPublicPaymentLink,
  buildSessionTargetsFromLink,
  getSessionById,
  markSessionFailed,
  markSessionSucceeded
};
