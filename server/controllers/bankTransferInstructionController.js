const {
  createInstructionFromPaymentLink,
  getPublicInstruction,
  toPublicInstructionView
} = require('../services/bankTransferInstructionService');

async function createPublicBankTransferHandler(req, res) {
  try {
    const instruction = await createInstructionFromPaymentLink({
      publicToken: req.params.publicToken
    });
    return res.status(201).json({
      success: true,
      data: toPublicInstructionView(instruction)
    });
  } catch (err) {
    const status =
      err.code === 'PAYMENT_LINK_EXPIRED' || err.code === 'PAYMENT_LINK_REVOKED' ? 404 :
        err.code === 'BANK_TRANSFER_NOT_ALLOWED' || err.code === 'MANUAL_BANK_DISABLED' ? 400 :
          err.code === 'MANUAL_BANK_NOT_CONFIGURED' ? 422 :
            err.code === 'INVOICE_NOT_PAYABLE' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function getPublicBankTransferHandler(req, res) {
  try {
    const instruction = await getPublicInstruction({
      publicToken: req.params.publicToken,
      bankTransferInstructionId: req.params.instructionId
    });

    if (!instruction) {
      return res.status(404).json({ success: false, message: 'Bank transfer instruction not found' });
    }

    return res.json({ success: true, data: toPublicInstructionView(instruction) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  createPublicBankTransferHandler,
  getPublicBankTransferHandler
};
