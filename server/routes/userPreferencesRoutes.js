const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const {
    saveWidgetLayout,
    getWidgetLayout,
    saveMetricsConfig,
    getMetricsConfig,
    saveListSavedViews,
    getListSavedViews
} = require('../controllers/userPreferencesController');

// Apply auth and organization middleware to all routes
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize CRM if needed
router.use(requireSalesApp); // Enforce CRM-only access
router.use(organizationIsolation);

// Widget Layout Routes
router.post('/widget-layout', saveWidgetLayout);
router.get('/widget-layout', getWidgetLayout);

// Metrics Config Routes
router.post('/metrics-config', saveMetricsConfig);
router.get('/metrics-config', getMetricsConfig);

// List saved views (custom views per module)
router.post('/list-saved-views', saveListSavedViews);
router.get('/list-saved-views', getListSavedViews);

module.exports = router;

