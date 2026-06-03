const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const {
  listBankTransferInstructionsHandler,
  getBankTransferInstructionHandler
} = require('../controllers/bankTransferInstructionAdminController');

const router = express.Router();

router.use(protect);

router.get('/', checkPermission('payments', 'view'), listBankTransferInstructionsHandler);
router.get('/:id', checkPermission('payments', 'view'), getBankTransferInstructionHandler);

module.exports = router;
