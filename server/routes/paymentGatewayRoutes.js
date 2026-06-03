const {
  createCheckoutSessionHandler,
  getGatewaySessionHandler,
  getGatewayHealthHandler,
  checkGatewayHealthHandler,
  listGatewayEventsHandler,
  getGatewayEventHandler,
  replayGatewayEventHandler
} = require('../controllers/paymentGatewayController');

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/health', checkPermission('payments', 'view'), getGatewayHealthHandler);
router.post('/health/check', checkPermission('payments', 'managePaymentLinks'), checkGatewayHealthHandler);

router.get('/events', checkPermission('payments', 'viewGatewayEvents'), listGatewayEventsHandler);
router.get('/events/:id', checkPermission('payments', 'viewGatewayEvents'), getGatewayEventHandler);
router.post('/events/:id/replay', checkPermission('payments', 'managePaymentLinks'), replayGatewayEventHandler);

router.post('/sessions', checkPermission('payments', 'managePaymentLinks'), createCheckoutSessionHandler);
router.get('/sessions/:id', checkPermission('payments', 'view'), getGatewaySessionHandler);

module.exports = router;
