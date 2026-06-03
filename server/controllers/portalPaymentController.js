const {
  listPortalPayableInvoices,
  getPortalPayEligibility,
  startPortalInvoicePay,
  getSessionStatusForPortal
} = require('../services/portalInvoicePayService');

async function listPortalInvoicesHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const { rows, total } = await listPortalPayableInvoices(organizationId, req.user, { limit, skip });

    return res.json({
      success: true,
      data: rows.map((row) => ({
        _id: row._id,
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceNumber,
        invoiceDate: row.invoiceDate,
        dueDate: row.dueDate,
        currency: row.currency,
        amountDue: row.amountDue,
        status: row.status
      })),
      meta: { total, limit, skip }
    });
  } catch (err) {
    console.error('[portalPaymentController] listPortalInvoices', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getPortalPayEligibilityHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const data = await getPortalPayEligibility(organizationId, req.params.id, req.user);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function startPortalPayHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const { successUrl, cancelUrl, provider } = req.body || {};
    const session = await startPortalInvoicePay({
      organizationId,
      user: req.user,
      invoiceId: req.params.id,
      successUrl,
      cancelUrl,
      provider
    });
    return res.status(201).json({ success: true, data: session });
  } catch (err) {
    const status =
      err.code === 'NOT_FOUND' ? 404 :
        err.code === 'INVOICE_NOT_PAYABLE' || err.code === 'PORTAL_PAY_DISABLED' ? 400 :
          err.code === 'GATEWAY_CREDENTIALS_INVALID' ? 422 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function getPortalPaymentSessionStatusHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const data = await getSessionStatusForPortal({
      organizationId,
      paymentGatewaySessionId: req.params.id,
      user: req.user
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

module.exports = {
  listPortalInvoicesHandler,
  getPortalPayEligibilityHandler,
  startPortalPayHandler,
  getPortalPaymentSessionStatusHandler
};
