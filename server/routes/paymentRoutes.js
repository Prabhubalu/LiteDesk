const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const {
  createPaymentHandler,
  listPaymentsHandler,
  getPaymentByIdHandler,
  applyPaymentAllocationsHandler,
  reversePaymentHandler,
  createRefundHandler,
  listPaymentRefundsHandler,
  getPaymentRefundEligibilityHandler
} = require('../controllers/paymentController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/', checkPermission('payments', 'view'), listPaymentsHandler);
router.post('/', checkPermission('payments', 'record'), createPaymentHandler);
router.get('/:id', checkPermission('payments', 'view'), getPaymentByIdHandler);
router.get('/:id/refund-eligibility', checkPermission('payments', 'view'), getPaymentRefundEligibilityHandler);
router.get('/:id/refunds', checkPermission('payments', 'view'), listPaymentRefundsHandler);
router.post('/:id/refunds', checkPermission('payments', 'refund'), createRefundHandler);
router.post('/:id/allocations', checkPermission('payments', 'allocate'), applyPaymentAllocationsHandler);
router.post('/:id/reversals', checkPermission('payments', 'reverse'), reversePaymentHandler);

module.exports = router;
