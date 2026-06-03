const {
  listPendingInstructions,
  getInstructionById,
  listInstructionsForInvoice
} = require('../services/bankTransferInstructionService');

function getOrganizationId(req) {
  return req.user?.organizationId;
}

async function listBankTransferInstructionsHandler(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const invoiceMongoId = req.query.invoiceMongoId;
    const paymentLinkId = req.query.paymentLinkId;

    const rows = invoiceMongoId
      ? await listInstructionsForInvoice({ organizationId, invoiceMongoId })
      : await listPendingInstructions({ organizationId, paymentLinkId });

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getBankTransferInstructionHandler(req, res) {
  try {
    const instruction = await getInstructionById({
      organizationId: getOrganizationId(req),
      bankTransferInstructionId: req.params.id
    });
    if (!instruction) {
      return res.status(404).json({ success: false, message: 'Instruction not found' });
    }
    res.json({ success: true, data: instruction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listBankTransferInstructionsHandler,
  getBankTransferInstructionHandler
};
