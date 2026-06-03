const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const {
  createPaymentLinkHandler,
  listPaymentLinksHandler,
  getPaymentLinkHandler,
  revokePaymentLinkHandler
} = require('../controllers/paymentGatewayController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.post('/', checkPermission('payments', 'managePaymentLinks'), createPaymentLinkHandler);
router.get('/', checkPermission('payments', 'view'), listPaymentLinksHandler);
router.get('/:id', checkPermission('payments', 'view'), getPaymentLinkHandler);
router.post('/:id/revoke', checkPermission('payments', 'managePaymentLinks'), revokePaymentLinkHandler);

module.exports = router;
