/**
 * PAY3 — Gateway capture → Payment → PaymentAllocation.
 */

const Payment = require('../models/Payment');
const PaymentGatewaySession = require('../models/PaymentGatewaySession');
const { recordPayment } = require('./paymentRecordService');
const { assertCaptureTargets } = require('./gatewayAllocationValidationService');
const { markSessionFailed, markSessionSucceeded } = require('./paymentGatewaySessionService');
const { getGatewayAdapter } = require('./gateways/gatewayAdapterRegistry');
const { writePaymentActivity } = require('./paymentActivityService');

async function findExistingPaymentByExternalReference({ organizationId, externalReference }) {
  if (!externalReference) return null;
  return Payment.findOne({
    organizationId,
    externalReference: String(externalReference).trim(),
    deletedAt: null
  }).lean();
}

async function captureSucceededSession({ session, gatewayEvent, parsedEvent, adapter }) {
  const activeAdapter = adapter || getGatewayAdapter(session.provider);

  if (session.paymentId) {
    return {
      duplicate: true,
      paymentId: session.paymentId,
      session
    };
  }

  const existing = await findExistingPaymentByExternalReference({
    organizationId: session.organizationId,
    externalReference: parsedEvent.providerPaymentId
  });

  if (existing) {
    const err = new Error('Payment already recorded for provider payment id');
    err.code = 'DUPLICATE_PROVIDER_PAYMENT';
    throw err;
  }

  const liveSession = await PaymentGatewaySession.findOne({
    organizationId: session.organizationId,
    paymentGatewaySessionId: session.paymentGatewaySessionId
  }).lean();

  try {
    await assertCaptureTargets(liveSession || session);
  } catch (validationErr) {
    await markSessionFailed(liveSession || session, {
      failureCode: validationErr.code || 'INVOICE_NOT_PAYABLE',
      failureMessage: validationErr.message
    });
    throw validationErr;
  }

  const targets = liveSession?.invoiceTargets || session.invoiceTargets || [];
  const instrumentSnapshot = activeAdapter.buildInstrumentSnapshot(parsedEvent, gatewayEvent?.payload);

  const result = await recordPayment({
    organizationId: session.organizationId,
    userId: null,
    organizationRefId: session.organizationRefId,
    contactId: session.contactId,
    amount: session.amount,
    paymentCurrency: session.currency,
    paymentDate: new Date(),
    paymentPurpose: 'invoice_payment',
    paymentInstrumentSnapshot: instrumentSnapshot,
    externalReference: parsedEvent.providerPaymentId,
    sourceContext: session.paymentLinkId ? 'payment_link' : 'portal',
    sourceRef: {
      moduleKey: 'payment_gateway_sessions',
      recordId: session.paymentGatewaySessionId
    },
    autoApply: false,
    allocations: targets.map((target) => ({
      invoiceId: target.invoiceId,
      invoiceMongoId: target.invoiceMongoId,
      amountApplied: target.amountRequested
    }))
  });

  await markSessionSucceeded(liveSession || session, {
    paymentId: result.payment.paymentId,
    paymentMongoId: result.payment._id,
    providerPaymentId: parsedEvent.providerPaymentId
  });

  await writePaymentActivity({
    organizationId: session.organizationId,
    paymentId: result.payment.paymentId,
    userId: null,
    action: 'payment_gateway_capture_succeeded',
    message: `Online payment captured for session ${session.paymentGatewaySessionId}`,
    details: {
      paymentGatewaySessionId: session.paymentGatewaySessionId,
      providerPaymentId: parsedEvent.providerPaymentId,
      paymentLinkId: session.paymentLinkId || null
    }
  });

  return {
    duplicate: false,
    payment: result.payment,
    allocations: result.allocations,
    session
  };
}

async function captureFailedSession({ session, parsedEvent, failureMessage }) {
  await markSessionFailed(session, {
    failureCode: parsedEvent?.status === 'failed' ? 'PROVIDER_FAILED' : 'CAPTURE_FAILED',
    failureMessage: failureMessage || 'Provider reported payment failure'
  });

  await writePaymentActivity({
    organizationId: session.organizationId,
    paymentId: null,
    userId: null,
    action: 'payment_gateway_capture_failed',
    message: `Online payment failed for session ${session.paymentGatewaySessionId}`,
    details: {
      paymentGatewaySessionId: session.paymentGatewaySessionId,
      eventType: parsedEvent?.eventType
    }
  });

  return { failed: true, session };
}

module.exports = {
  findExistingPaymentByExternalReference,
  captureSucceededSession,
  captureFailedSession
};
