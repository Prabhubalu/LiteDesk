const {
  createPaymentLink,
  listPaymentLinksForInvoice,
  getPaymentLinkById,
  revokePaymentLink
} = require('../services/paymentLinkService');
const {
  createCheckoutFromPaymentLink,
  getSessionById
} = require('../services/paymentGatewaySessionService');
const {
  getGatewayHealthSummary,
  checkProviderHealth
} = require('../services/gatewayCredentialHealthService');
const {
  ingestAndProcessWebhook,
  processGatewayEvent
} = require('../services/gatewayWebhookService');
const PaymentGatewayEvent = require('../models/PaymentGatewayEvent');
const { mockStripeGatewayAdapter } = require('../services/gateways/gatewayAdapterRegistry');

function getOrganizationId(req) {
  return req.user?.organizationId;
}

async function listPaymentLinksHandler(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const invoiceMongoId = req.query.invoiceMongoId;
    const status = req.query.status || 'active';
    const rows = invoiceMongoId
      ? await listPaymentLinksForInvoice({ organizationId, invoiceMongoId, status })
      : [];
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createPaymentLinkHandler(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const {
      organizationRefId,
      contactId,
      invoiceIds,
      expiresAt,
      maxUses,
      preferredProvider,
      allowedMethods,
      notes
    } = req.body || {};

    const link = await createPaymentLink({
      organizationId,
      userId: req.user?._id,
      organizationRefId,
      contactId,
      invoiceIds,
      expiresAt,
      maxUses,
      preferredProvider,
      allowedMethods,
      notes,
      sourceContext: 'crm',
      sourceRef: req.body?.sourceRef || null
    });

    res.status(201).json({ success: true, data: link });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({
      success: false,
      message: err.message,
      code: err.code || 'ERROR'
    });
  }
}

async function getPaymentLinkHandler(req, res) {
  try {
    const link = await getPaymentLinkById({
      organizationId: getOrganizationId(req),
      paymentLinkId: req.params.id
    });
    if (!link) {
      return res.status(404).json({ success: false, message: 'Payment link not found' });
    }
    res.json({ success: true, data: link });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function revokePaymentLinkHandler(req, res) {
  try {
    const link = await revokePaymentLink({
      organizationId: getOrganizationId(req),
      paymentLinkId: req.params.id,
      userId: req.user?._id
    });
    res.json({ success: true, data: link });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createCheckoutSessionHandler(req, res) {
  try {
    const { paymentLinkId, successUrl, cancelUrl, provider = 'stripe' } = req.body || {};
    const session = await createCheckoutFromPaymentLink({
      organizationId: getOrganizationId(req),
      paymentLinkId,
      userId: req.user?._id,
      successUrl,
      cancelUrl,
      provider
    });
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getGatewaySessionHandler(req, res) {
  try {
    const session = await getSessionById({
      organizationId: getOrganizationId(req),
      paymentGatewaySessionId: req.params.id
    });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getGatewayHealthHandler(req, res) {
  try {
    const data = await getGatewayHealthSummary(getOrganizationId(req));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function checkGatewayHealthHandler(req, res) {
  try {
    const provider = req.body?.provider || 'stripe';
    const result = await checkProviderHealth({
      organizationId: getOrganizationId(req),
      provider
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function stripeWebhookHandler(req, res) {
  return handleProviderWebhook(req, res, 'stripe');
}

async function razorpayWebhookHandler(req, res) {
  return handleProviderWebhook(req, res, 'razorpay');
}

async function handleProviderWebhook(req, res, provider) {
  try {
    const rawBody = req.body;
    const result = await ingestAndProcessWebhook({
      provider,
      rawBody,
      headers: req.headers,
      receivedFromIp: req.ip
    });

    if (!result.signatureValid) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    res.json({ success: true, data: { duplicate: result.duplicate, eventId: result.event?.paymentGatewayEventId } });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getGatewayEventHandler(req, res) {
  try {
    const { getGatewayEventById } = require('../services/gatewayWebhookService');
    const event = await getGatewayEventById({
      organizationId: getOrganizationId(req),
      paymentGatewayEventId: req.params.id
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listGatewayEventsHandler(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const events = await PaymentGatewayEvent.find({ organizationId })
      .sort({ receivedAt: -1 })
      .limit(Number(req.query.limit) || 50)
      .lean();
    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function replayGatewayEventHandler(req, res) {
  try {
    const result = await processGatewayEvent({
      paymentGatewayEventId: req.params.id,
      organizationId: getOrganizationId(req),
      allowReplay: true
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

function mapErrorStatus(err) {
  const code = err?.code;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'VALIDATION' || code === 'INVOICE_NOT_PAYABLE' || code === 'PAYMENT_LINK_EXPIRED') return 400;
  if (code === 'GATEWAY_CREDENTIALS_INVALID') return 422;
  if (code === 'DUPLICATE_PROVIDER_PAYMENT') return 409;
  return 500;
}

module.exports = {
  createPaymentLinkHandler,
  listPaymentLinksHandler,
  getPaymentLinkHandler,
  revokePaymentLinkHandler,
  createCheckoutSessionHandler,
  getGatewaySessionHandler,
  getGatewayHealthHandler,
  checkGatewayHealthHandler,
  stripeWebhookHandler,
  razorpayWebhookHandler,
  listGatewayEventsHandler,
  getGatewayEventHandler,
  replayGatewayEventHandler,
  mockStripeGatewayAdapter
};
