const express = require('express');
const {
  getPublicPaymentLinkHandler,
  startPublicPaymentLinkCheckoutHandler
} = require('../controllers/publicPaymentLinkController');
const {
  createPublicBankTransferHandler,
  getPublicBankTransferHandler
} = require('../controllers/bankTransferInstructionController');

const router = express.Router();

router.get('/:publicToken', getPublicPaymentLinkHandler);
router.post('/:publicToken/checkout', startPublicPaymentLinkCheckoutHandler);
router.post('/:publicToken/bank-transfer', createPublicBankTransferHandler);
router.get('/:publicToken/bank-transfer/:instructionId', getPublicBankTransferHandler);

module.exports = router;
