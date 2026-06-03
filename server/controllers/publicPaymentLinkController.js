const PaymentLink = require('../models/PaymentLink');
const { isPaymentLinkActive } = require('../constants/paymentGatewayLifecycle');
const { createCheckoutFromPublicPaymentLink } = require('../services/paymentGatewaySessionService');

async function getPublicPaymentLinkHandler(req, res) {
  try {
    const link = await PaymentLink.findOne({
      publicToken: String(req.params.publicToken || '').trim(),
      deletedAt: null
    }).lean();

    if (!link || !isPaymentLinkActive(link)) {
      return res.status(404).json({ success: false, message: 'Payment link not available', code: 'PAYMENT_LINK_EXPIRED' });
    }

    return res.json({
      success: true,
      data: {
        paymentLinkNumber: link.paymentLinkNumber,
        amount: link.fixedAmount,
        currency: link.currency,
        status: link.status,
        brandingSnapshot: link.brandingSnapshot || {},
        allowedMethods: link.allowedMethods || ['card'],
        expiresAt: link.expiresAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function startPublicPaymentLinkCheckoutHandler(req, res) {
  try {
    const { successUrl, cancelUrl } = req.body || {};
    const session = await createCheckoutFromPublicPaymentLink({
      publicToken: req.params.publicToken,
      successUrl,
      cancelUrl
    });
    return res.status(201).json({
      success: true,
      data: {
        paymentGatewaySessionId: session.paymentGatewaySessionId,
        checkoutUrl: session.checkoutUrl,
        status: session.status
      }
    });
  } catch (err) {
    const status =
      err.code === 'PAYMENT_LINK_EXPIRED' || err.code === 'PAYMENT_LINK_REVOKED' ? 404 :
        err.code === 'INVOICE_NOT_PAYABLE' ? 400 :
          err.code === 'GATEWAY_CREDENTIALS_INVALID' ? 422 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

module.exports = {
  getPublicPaymentLinkHandler,
  startPublicPaymentLinkCheckoutHandler
};
