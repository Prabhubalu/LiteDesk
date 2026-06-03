/**
 * PAY3 — Webhook ingestion and processing pipeline.
 */

const PaymentGatewayEvent = require('../models/PaymentGatewayEvent');
const PaymentGatewaySession = require('../models/PaymentGatewaySession');
const { getGatewayAdapter } = require('./gateways/gatewayAdapterRegistry');
const { getOrCreateSettings } = require('./gatewayCredentialHealthService');
const {
  captureSucceededSession,
  captureFailedSession,
  findExistingPaymentByExternalReference
} = require('./gatewayCaptureService');

async function ingestWebhook({
  provider,
  rawBody,
  headers = {},
  receivedFromIp = null
}) {
  const adapter = getGatewayAdapter(provider);
  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const parsedForOrg = adapter.parseWebhookEvent(bodyString);
  const organizationId = parsedForOrg.organizationId;

  if (!organizationId) {
    const err = new Error('organizationId missing from webhook metadata');
    err.code = 'VALIDATION';
    throw err;
  }

  const settings = await getOrCreateSettings(organizationId);
  const signatureValid = adapter.verifyWebhookSignature(bodyString, headers, settings.toObject());

  let payload;
  try {
    payload = JSON.parse(bodyString);
  } catch {
    payload = { raw: bodyString };
  }

  const existingEvent = await PaymentGatewayEvent.findOne({
    organizationId,
    provider,
    providerEventId: parsedForOrg.providerEventId
  }).lean();

  if (existingEvent) {
    return {
      duplicate: true,
      event: existingEvent,
      signatureValid
    };
  }

  const event = await PaymentGatewayEvent.create({
    organizationId,
    provider,
    providerEventId: parsedForOrg.providerEventId,
    eventType: parsedForOrg.eventType,
    payload,
    signatureValid,
    receivedFromIp,
    processingStatus: signatureValid ? 'received' : 'ignored',
    paymentGatewaySessionId: parsedForOrg.paymentGatewaySessionId || null,
    paymentLinkId: parsedForOrg.paymentLinkId || null
  });

  if (!signatureValid) {
    event.processingError = { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' };
    await PaymentGatewayEvent.updateOne(
      { _id: event._id },
      { $set: { processingError: event.processingError, processedAt: new Date() } }
    );
    return { duplicate: false, event: event.toObject(), signatureValid: false };
  }

  return { duplicate: false, event: event.toObject(), signatureValid: true };
}

async function resolveSessionForEvent({ organizationId, parsedEvent }) {
  if (parsedEvent.paymentGatewaySessionId) {
    const byId = await PaymentGatewaySession.findOne({
      organizationId,
      paymentGatewaySessionId: parsedEvent.paymentGatewaySessionId
    }).lean();
    if (byId) return byId;
  }

  if (parsedEvent.providerSessionId) {
    return PaymentGatewaySession.findOne({
      organizationId,
      providerSessionId: parsedEvent.providerSessionId
    }).lean();
  }

  return null;
}

async function processGatewayEvent({ paymentGatewayEventId, organizationId, allowReplay = false }) {
  const eventDoc = await PaymentGatewayEvent.findOne({
    paymentGatewayEventId,
    organizationId
  });

  if (!eventDoc) {
    const err = new Error('Gateway event not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (eventDoc.processingStatus === 'processed') {
    return {
      replayed: true,
      event: eventDoc.toObject(),
      result: {
        duplicate: true,
        paymentId: eventDoc.paymentId || null
      }
    };
  }

  if (!eventDoc.signatureValid) {
    return { ignored: true, event: eventDoc.toObject(), reason: 'INVALID_SIGNATURE' };
  }

  const adapter = getGatewayAdapter(eventDoc.provider);
  const parsedEvent = adapter.parseWebhookEvent(JSON.stringify(eventDoc.payload));

  await PaymentGatewayEvent.updateOne(
    { _id: eventDoc._id },
    { $set: { processingStatus: 'processing' } }
  );

  const session = await resolveSessionForEvent({
    organizationId,
    parsedEvent
  });

  if (!session) {
    await PaymentGatewayEvent.updateOne(
      { _id: eventDoc._id },
      {
        $set: {
          processingStatus: 'failed',
          processingError: { code: 'SESSION_NOT_FOUND', message: 'Payment gateway session not found' },
          processedAt: new Date()
        }
      }
    );
    const err = new Error('Payment gateway session not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  try {
    let result;

    if (adapter.isCaptureSuccessEvent(parsedEvent.eventType)) {
      if (session.paymentId) {
        result = { duplicate: true, paymentId: session.paymentId };
      } else {
        const existingPayment = await findExistingPaymentByExternalReference({
          organizationId,
          externalReference: parsedEvent.providerPaymentId
        });
        if (existingPayment) {
          const err = new Error('Payment already recorded for provider payment id');
          err.code = 'DUPLICATE_PROVIDER_PAYMENT';
          throw err;
        }
        result = await captureSucceededSession({
          session,
          gatewayEvent: eventDoc.toObject(),
          parsedEvent,
          adapter
        });
      }
    } else if (adapter.isCaptureFailureEvent(parsedEvent.eventType)) {
      result = await captureFailedSession({
        session,
        parsedEvent,
        failureMessage: 'Provider payment failed'
      });
    } else {
      await PaymentGatewayEvent.updateOne(
        { _id: eventDoc._id },
        { $set: { processingStatus: 'ignored', processedAt: new Date() } }
      );
      return { ignored: true, event: eventDoc.toObject() };
    }

    await PaymentGatewayEvent.updateOne(
      { _id: eventDoc._id },
      {
        $set: {
          processingStatus: 'processed',
          processedAt: new Date(),
          paymentGatewaySessionId: session.paymentGatewaySessionId,
          paymentLinkId: session.paymentLinkId || null,
          paymentId: result?.payment?.paymentId || session.paymentId || null,
          processingError: null
        }
      }
    );

    return { event: eventDoc.toObject(), result };
  } catch (err) {
    await PaymentGatewayEvent.updateOne(
      { _id: eventDoc._id },
      {
        $set: {
          processingStatus: 'failed',
          processingError: { code: err.code || 'PROCESSING_FAILED', message: err.message },
          processedAt: new Date()
        }
      }
    );
    throw err;
  }
}

async function ingestAndProcessWebhook(params) {
  const ingestion = await ingestWebhook(params);
  if (!ingestion.signatureValid) {
    return ingestion;
  }
  if (ingestion.duplicate) {
    const replay = await processGatewayEvent({
      paymentGatewayEventId: ingestion.event.paymentGatewayEventId,
      organizationId: ingestion.event.organizationId,
      allowReplay: false
    });
    return { ...ingestion, processing: replay };
  }

  const processing = await processGatewayEvent({
    paymentGatewayEventId: ingestion.event.paymentGatewayEventId,
    organizationId: ingestion.event.organizationId
  });

  return { ...ingestion, processing };
}

async function getGatewayEventById({ organizationId, paymentGatewayEventId }) {
  return PaymentGatewayEvent.findOne({ organizationId, paymentGatewayEventId }).lean();
}

module.exports = {
  ingestWebhook,
  processGatewayEvent,
  ingestAndProcessWebhook,
  resolveSessionForEvent,
  getGatewayEventById
};
