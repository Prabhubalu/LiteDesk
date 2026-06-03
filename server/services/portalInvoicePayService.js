/**
 * PAY3.1 — Portal invoice pay (reuses PaymentGatewaySession).
 */

const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const People = require('../models/People');
const { roundMoney, PAYABLE_INVOICE_STATUSES } = require('../constants/paymentLifecycle');
const { getOrCreateSettings } = require('./gatewayCredentialHealthService');
const { createGatewayCheckoutSession, getSessionById } = require('./paymentGatewaySessionService');
const { getPortalUserEmail } = require('../platform/mailroom/connectors/portal/portalSafety');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolvePortalOrganizationRefIds(organizationId, user) {
  const email = getPortalUserEmail(user);
  const refs = new Set();

  if (email) {
    const people = await People.find({
      organizationId,
      deletedAt: null,
      email: new RegExp(`^${escapeRegex(email)}$`, 'i')
    })
      .select('_id organizationId')
      .lean();

    for (const person of people) {
      if (person.organizationId) refs.add(String(person.organizationId));
    }
  }

  return [...refs];
}

async function findPortalAccessibleInvoice(organizationId, invoiceId, user) {
  const id = String(invoiceId || '').trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const allowedRefs = await resolvePortalOrganizationRefIds(organizationId, user);
  if (!allowedRefs.length) return null;

  return Invoice.findOne({
    _id: id,
    organizationId,
    deletedAt: null,
    invoiceType: 'standard',
    organizationRefId: { $in: allowedRefs.map((r) => new mongoose.Types.ObjectId(r)) }
  }).lean();
}

async function getPortalPayEligibility(organizationId, invoiceId, user) {
  const invoice = await findPortalAccessibleInvoice(organizationId, invoiceId, user);
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const settings = await getOrCreateSettings(organizationId);
  const portalPayEnabled = settings.portalPayEnabled !== false;

  const status = String(invoice.status || '').trim();
  const payable =
    portalPayEnabled &&
    PAYABLE_INVOICE_STATUSES.includes(status) &&
    roundMoney(invoice.amountDue) > 0;

  return {
    invoiceId: invoice.invoiceId,
    invoiceMongoId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    amountDue: roundMoney(invoice.amountDue),
    currency: invoice.currency || 'USD',
    status: invoice.status,
    canPay: payable,
    portalPayEnabled,
    defaultProvider: settings.defaultProvider || 'stripe'
  };
}

async function startPortalInvoicePay({
  organizationId,
  user,
  invoiceId,
  successUrl,
  cancelUrl,
  provider = 'stripe'
}) {
  const invoice = await findPortalAccessibleInvoice(organizationId, invoiceId, user);
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const settings = await getOrCreateSettings(organizationId);
  if (settings.portalPayEnabled === false) {
    const err = new Error('Portal pay is not enabled');
    err.code = 'PORTAL_PAY_DISABLED';
    throw err;
  }

  const amountDue = roundMoney(invoice.amountDue);
  if (amountDue <= 0 || !PAYABLE_INVOICE_STATUSES.includes(String(invoice.status || '').trim())) {
    const err = new Error('Invoice is not payable');
    err.code = 'INVOICE_NOT_PAYABLE';
    throw err;
  }

  const invoiceTargets = [
    {
      invoiceId: invoice.invoiceId,
      invoiceMongoId: invoice._id,
      amountRequested: amountDue
    }
  ];

  return createGatewayCheckoutSession({
    organizationId,
    organizationRefId: invoice.organizationRefId,
    contactId: invoice.contactId || null,
    paymentLinkId: null,
    payTargetType: 'single_invoice',
    invoiceTargets,
    amount: amountDue,
    currency: invoice.currency || 'USD',
    userId: user?._id || null,
    successUrl,
    cancelUrl,
    provider,
    productName: `Invoice ${invoice.invoiceNumber || invoice.invoiceId}`
  });
}

async function listPortalPayableInvoices(organizationId, user, { limit = 25, skip = 0 } = {}) {
  const allowedRefs = await resolvePortalOrganizationRefIds(organizationId, user);
  if (!allowedRefs.length) {
    return { rows: [], total: 0 };
  }

  const query = {
    organizationId,
    deletedAt: null,
    invoiceType: 'standard',
    organizationRefId: { $in: allowedRefs.map((r) => new mongoose.Types.ObjectId(r)) },
    status: { $in: PAYABLE_INVOICE_STATUSES },
    amountDue: { $gt: 0 }
  };

  const [rows, total] = await Promise.all([
    Invoice.find(query)
      .select('invoiceId invoiceNumber invoiceDate dueDate currency amountDue status organizationRefId')
      .sort({ dueDate: 1, invoiceDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(query)
  ]);

  return { rows, total };
}

async function getSessionStatusForPortal({ organizationId, paymentGatewaySessionId, user }) {
  const session = await getSessionById({ organizationId, paymentGatewaySessionId });
  if (!session) {
    const err = new Error('Session not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const allowedRefs = await resolvePortalOrganizationRefIds(organizationId, user);
  if (!allowedRefs.includes(String(session.organizationRefId || ''))) {
    const err = new Error('Session not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return {
    paymentGatewaySessionId: session.paymentGatewaySessionId,
    status: session.status,
    paymentId: session.paymentId || null,
    failureCode: session.failureCode || null,
    failureMessage: session.failureMessage || null
  };
}

module.exports = {
  resolvePortalOrganizationRefIds,
  findPortalAccessibleInvoice,
  getPortalPayEligibility,
  startPortalInvoicePay,
  listPortalPayableInvoices,
  getSessionStatusForPortal
};
