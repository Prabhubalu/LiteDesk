const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const controller = require('../controllers/organizationV2Controller');
const { sessionBootstrapLimiter } = require('../middleware/rateLimitMiddleware');

router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize CRM if needed
router.use(requireSalesApp); // Enforce CRM-only access
router.use(organizationIsolation); // Ensure tenant DB context for converted instances

router.post('/', controller.create);
router.get('/meta', sessionBootstrapLimiter, controller.listMeta);
router.get('/', sessionBootstrapLimiter, controller.list);

// OrganizationSurface endpoint (must be before /:id route)
router.get('/:id/surface', controller.getSurface);

// Activity logs (must be before /:id route)
router.get('/:id/activity-logs', controller.getActivityLogs);
router.post('/:id/activity-logs', controller.addActivityLog);

router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;


