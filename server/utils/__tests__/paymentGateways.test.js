process.env.PAYMENT_GATEWAY_USE_MOCK = '1';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const Payment = require('../../models/Payment');
const PaymentAllocation = require('../../models/PaymentAllocation');
const PaymentLink = require('../../models/PaymentLink');
const PaymentGatewaySession = require('../../models/PaymentGatewaySession');
const PaymentGatewayEvent = require('../../models/PaymentGatewayEvent');
const Invoice = require('../../models/Invoice');

const { createPaymentLink } = require('../../services/paymentLinkService');
const { createCheckoutFromPaymentLink } = require('../../services/paymentGatewaySessionService');
const {
  ingestWebhook,
  ingestAndProcessWebhook,
  processGatewayEvent
} = require('../../services/gatewayWebhookService');
const { assertPaymentLinkUsable } = require('../../services/paymentLinkService');
const { mockStripeGatewayAdapter, mockRazorpayGatewayAdapter } = require('../../services/gateways/gatewayAdapterRegistry');
const {
  seedGatewayContext,
  mockWebhookHeaders,
  mockRazorpayWebhookHeaders,
  createPostedInvoice
} = require('./helpers/paymentGatewayTestHelper');
const { createInstructionFromPaymentLink } = require('../../services/bankTransferInstructionService');
const { recordPayment } = require('../../services/paymentRecordService');
const BankTransferInstruction = require('../../models/BankTransferInstruction');

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function buildCheckoutFlow(ctx, linkOverrides = {}) {
  const link = await createPaymentLink({
    organizationId: ctx.tenant._id,
    organizationRefId: ctx.account._id,
    invoiceIds: [ctx.invoice.invoiceId],
    ...linkOverrides
  });

  const session = await createCheckoutFromPaymentLink({
    organizationId: ctx.tenant._id,
    paymentLinkId: link.paymentLinkId,
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    provider: 'stripe'
  });

  return { link, session };
}

function successWebhookBody(ctx, session, providerPaymentId) {
  return mockStripeGatewayAdapter.buildMockSuccessWebhook({
    organizationId: ctx.tenant._id,
    paymentGatewaySessionId: session.paymentGatewaySessionId,
    paymentLinkId: session.paymentLinkId,
    providerSessionId: session.providerSessionId,
    providerPaymentId,
    amount: session.amount,
    currency: session.currency
  });
}

test('successful capture: link → session → webhook → payment → allocation → amountDue reduced', async () => {
  const ctx = await seedGatewayContext({ amountDue: 250 });
  const { session } = await buildCheckoutFlow(ctx);
  const providerPaymentId = `pi_success_${Date.now()}`;
  const body = successWebhookBody(ctx, session, providerPaymentId);

  const result = await ingestAndProcessWebhook({
    provider: 'stripe',
    rawBody: JSON.stringify(body),
    headers: mockWebhookHeaders()
  });

  assert.equal(result.signatureValid, true);
  assert.equal(result.processing.result.duplicate, false);

  const payment = await Payment.findOne({
    organizationId: ctx.tenant._id,
    externalReference: providerPaymentId
  }).lean();
  assert.ok(payment);
  assert.equal(Number(payment.amount), 250);

  const allocations = await PaymentAllocation.find({
    organizationId: ctx.tenant._id,
    paymentId: payment.paymentId,
    status: 'active'
  }).lean();
  assert.equal(allocations.length, 1);
  assert.equal(Number(allocations[0].amountApplied), 250);

  const invoice = await Invoice.findById(ctx.invoice._id).lean();
  assert.equal(Number(invoice.amountPaid), 250);
  assert.equal(Number(invoice.amountDue), 0);

  const updatedSession = await PaymentGatewaySession.findOne({
    paymentGatewaySessionId: session.paymentGatewaySessionId
  }).lean();
  assert.equal(updatedSession.status, 'succeeded');
  assert.equal(updatedSession.paymentId, payment.paymentId);
});

test('failed capture: failure webhook marks session failed without payment', async () => {
  const ctx = await seedGatewayContext();
  const { session } = await buildCheckoutFlow(ctx);
  const body = mockStripeGatewayAdapter.buildMockFailureWebhook({
    organizationId: ctx.tenant._id,
    paymentGatewaySessionId: session.paymentGatewaySessionId,
    providerSessionId: session.providerSessionId
  });

  await ingestAndProcessWebhook({
    provider: 'stripe',
    rawBody: JSON.stringify(body),
    headers: mockWebhookHeaders()
  });

  const payments = await Payment.countDocuments({ organizationId: ctx.tenant._id });
  assert.equal(payments, 0);

  const updatedSession = await PaymentGatewaySession.findOne({
    paymentGatewaySessionId: session.paymentGatewaySessionId
  }).lean();
  assert.equal(updatedSession.status, 'failed');
});

test('duplicate webhook: same providerEventId is ingested once and processing is idempotent', async () => {
  const ctx = await seedGatewayContext({ amountDue: 100 });
  const { session } = await buildCheckoutFlow(ctx);
  const body = successWebhookBody(ctx, session, `pi_dup_${Date.now()}`);
  const raw = JSON.stringify(body);
  const headers = mockWebhookHeaders();

  const first = await ingestAndProcessWebhook({ provider: 'stripe', rawBody: raw, headers });
  const secondIngest = await ingestWebhook({ provider: 'stripe', rawBody: raw, headers });

  assert.equal(first.processing.result.duplicate, false);
  assert.equal(secondIngest.duplicate, true);

  const paymentCount = await Payment.countDocuments({ organizationId: ctx.tenant._id });
  assert.equal(paymentCount, 1);

  const eventCount = await PaymentGatewayEvent.countDocuments({
    organizationId: ctx.tenant._id,
    providerEventId: body.id
  });
  assert.equal(eventCount, 1);
});

test('invalid signature: event stored ignored, no payment created', async () => {
  const ctx = await seedGatewayContext();
  const { session } = await buildCheckoutFlow(ctx);
  const body = successWebhookBody(ctx, session, `pi_bad_sig_${Date.now()}`);

  const result = await ingestWebhook({
    provider: 'stripe',
    rawBody: JSON.stringify(body),
    headers: { [mockStripeGatewayAdapter.MOCK_SIGNATURE_HEADER]: 'invalid' }
  });

  assert.equal(result.signatureValid, false);
  assert.equal(result.event.processingStatus, 'ignored');

  const paymentCount = await Payment.countDocuments({ organizationId: ctx.tenant._id });
  assert.equal(paymentCount, 0);
});

test('expired payment link: cannot start checkout', async () => {
  const ctx = await seedGatewayContext();
  const link = await createPaymentLink({
    organizationId: ctx.tenant._id,
    organizationRefId: ctx.account._id,
    invoiceIds: [ctx.invoice.invoiceId],
    expiresAt: new Date(Date.now() - 60_000)
  });

  assert.throws(
    () => assertPaymentLinkUsable(link),
    (err) => err.code === 'PAYMENT_LINK_EXPIRED'
  );

  await assert.rejects(
    () =>
      createCheckoutFromPaymentLink({
        organizationId: ctx.tenant._id,
        paymentLinkId: link.paymentLinkId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }),
    (err) => err.code === 'PAYMENT_LINK_EXPIRED'
  );
});

test('voided invoice: capture re-validation fails without payment', async () => {
  const ctx = await seedGatewayContext({ amountDue: 120 });
  const { session } = await buildCheckoutFlow(ctx);

  await Invoice.updateOne({ _id: ctx.invoice._id }, { $set: { status: 'Void', amountDue: 0 } });

  const body = successWebhookBody(ctx, session, `pi_void_${Date.now()}`);

  await assert.rejects(
    () =>
      ingestAndProcessWebhook({
        provider: 'stripe',
        rawBody: JSON.stringify(body),
        headers: mockWebhookHeaders()
      }),
    (err) => err.code === 'INVOICE_NOT_PAYABLE'
  );

  const paymentCount = await Payment.countDocuments({ organizationId: ctx.tenant._id });
  assert.equal(paymentCount, 0);

  const updatedSession = await PaymentGatewaySession.findOne({
    paymentGatewaySessionId: session.paymentGatewaySessionId
  }).lean();
  assert.equal(updatedSession.status, 'failed');
});

test('amountDue changed after session creation: capture blocked', async () => {
  const ctx = await seedGatewayContext({ amountDue: 200 });
  const { session } = await buildCheckoutFlow(ctx);

  await Invoice.updateOne(
    { _id: ctx.invoice._id },
    { $set: { amountDue: 50, amountPaid: 150, status: 'Partially Paid' } }
  );

  const body = successWebhookBody(ctx, session, `pi_partial_${Date.now()}`);

  await assert.rejects(
    () =>
      ingestAndProcessWebhook({
        provider: 'stripe',
        rawBody: JSON.stringify(body),
        headers: mockWebhookHeaders()
      }),
    (err) => err.code === 'AMOUNT_EXCEEDS_DUE'
  );

  const paymentCount = await Payment.countDocuments({ organizationId: ctx.tenant._id });
  assert.equal(paymentCount, 0);
});

test('duplicate provider payment id: second capture rejected', async () => {
  const ctx = await seedGatewayContext({ amountDue: 80 });
  const providerPaymentId = `pi_dup_provider_${Date.now()}`;

  const flow1 = await buildCheckoutFlow(ctx);
  await ingestAndProcessWebhook({
    provider: 'stripe',
    rawBody: JSON.stringify(successWebhookBody(ctx, flow1.session, providerPaymentId)),
    headers: mockWebhookHeaders()
  });

  const invoice2 = await createPostedInvoice({
    organizationId: ctx.tenant._id,
    organizationRefId: ctx.account._id,
    amountDue: 60
  });
  const link2 = await createPaymentLink({
    organizationId: ctx.tenant._id,
    organizationRefId: ctx.account._id,
    invoiceIds: [invoice2.invoiceId]
  });
  const session2 = await createCheckoutFromPaymentLink({
    organizationId: ctx.tenant._id,
    paymentLinkId: link2.paymentLinkId,
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel'
  });
  const body2 = successWebhookBody(
    { ...ctx, invoice: invoice2 },
    session2,
    providerPaymentId
  );

  await assert.rejects(
    () =>
      ingestAndProcessWebhook({
        provider: 'stripe',
        rawBody: JSON.stringify(body2),
        headers: mockWebhookHeaders()
      }),
    (err) => err.code === 'DUPLICATE_PROVIDER_PAYMENT'
  );
});

test('replayed webhook: allowReplay returns prior result without duplicate payment', async () => {
  const ctx = await seedGatewayContext({ amountDue: 90 });
  const { session } = await buildCheckoutFlow(ctx);
  const body = successWebhookBody(ctx, session, `pi_replay_${Date.now()}`);

  const ingestion = await ingestWebhook({
    provider: 'stripe',
    rawBody: JSON.stringify(body),
    headers: mockWebhookHeaders()
  });

  const firstProcess = await processGatewayEvent({
    paymentGatewayEventId: ingestion.event.paymentGatewayEventId,
    organizationId: ctx.tenant._id
  });
  assert.equal(firstProcess.result.duplicate, false);

  const replay = await processGatewayEvent({
    paymentGatewayEventId: ingestion.event.paymentGatewayEventId,
    organizationId: ctx.tenant._id,
    allowReplay: true
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.result.duplicate, true);

  const paymentCount = await Payment.countDocuments({ organizationId: ctx.tenant._id });
  assert.equal(paymentCount, 1);
});

test('razorpay successful capture: order → webhook → payment → allocation', async () => {
  const ctx = await seedGatewayContext({ amountDue: 150, providers: ['razorpay'], currency: 'INR' });
  const link = await createPaymentLink({
    organizationId: ctx.tenant._id,
    organizationRefId: ctx.account._id,
    invoiceIds: [ctx.invoice.invoiceId],
    preferredProvider: 'razorpay'
  });

  const session = await createCheckoutFromPaymentLink({
    organizationId: ctx.tenant._id,
    paymentLinkId: link.paymentLinkId,
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    provider: 'razorpay'
  });

  const providerPaymentId = `pay_rzp_${Date.now()}`;
  const body = mockRazorpayGatewayAdapter.buildMockSuccessWebhook({
    organizationId: ctx.tenant._id,
    paymentGatewaySessionId: session.paymentGatewaySessionId,
    paymentLinkId: session.paymentLinkId,
    providerSessionId: session.providerSessionId,
    providerPaymentId,
    amount: session.amount,
    currency: session.currency
  });

  const result = await ingestAndProcessWebhook({
    provider: 'razorpay',
    rawBody: JSON.stringify(body),
    headers: mockRazorpayWebhookHeaders()
  });

  assert.equal(result.signatureValid, true);
  assert.equal(result.processing.result.duplicate, false);

  const payment = await Payment.findOne({
    organizationId: ctx.tenant._id,
    externalReference: providerPaymentId
  }).lean();
  assert.ok(payment);
  assert.equal(Number(payment.amount), 150);

  const invoice = await Invoice.findById(ctx.invoice._id).lean();
  assert.equal(Number(invoice.amountDue), 0);
});

test('manual bank transfer: instruction → record payment → instruction matched', async () => {
  const ctx = await seedGatewayContext({ amountDue: 200, providers: ['stripe', 'manual'] });
  const link = await createPaymentLink({
    organizationId: ctx.tenant._id,
    organizationRefId: ctx.account._id,
    invoiceIds: [ctx.invoice.invoiceId],
    allowedMethods: ['card', 'bank_transfer']
  });

  const instruction = await createInstructionFromPaymentLink({ publicToken: link.publicToken });
  assert.equal(instruction.status, 'pending');
  assert.ok(instruction.referenceCode);

  await recordPayment({
    organizationId: ctx.tenant._id,
    organizationRefId: ctx.account._id,
    amount: instruction.amount,
    paymentCurrency: instruction.currency,
    paymentPurpose: 'invoice_payment',
    paymentInstrumentSnapshot: {
      method: 'bank_transfer',
      referenceNumber: instruction.referenceCode,
      provider: 'manual'
    },
    autoApply: false,
    allocations: [
      {
        invoiceId: ctx.invoice.invoiceId,
        invoiceMongoId: ctx.invoice._id,
        amountApplied: instruction.amount
      }
    ]
  });

  const updatedInstruction = await BankTransferInstruction.findOne({
    bankTransferInstructionId: instruction.bankTransferInstructionId
  }).lean();
  assert.equal(updatedInstruction.status, 'matched');
  assert.ok(updatedInstruction.matchedPaymentId);

  const invoice = await Invoice.findById(ctx.invoice._id).lean();
  assert.equal(Number(invoice.amountPaid), 200);
  assert.equal(Number(invoice.amountDue), 0);
});
