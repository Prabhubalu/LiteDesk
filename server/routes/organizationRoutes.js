const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const deprecate = require('../middleware/deprecationMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { canManageBilling, requireOwner } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const {
    getOrganization,
    updateOrganization,
    getSubscription,
    upgradeSubscription,
    cancelSubscription,
    getStats,
    enableApp,
    disableApp
} = require('../controllers/organizationController');
const { invalidateCacheOnSuccessfulMutation } = require('../middleware/responseCacheMiddleware');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

// Apply auth and organization middleware to all routes
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize CRM if needed
router.use(requireSalesApp); // Enforce CRM-only access
router.use(organizationIsolation);
router.use(deprecate('/api/organization', '/api/v2/organization'));

// --- Organization Routes ---
router.get('/', getOrganization);
router.put('/', requireOwner(), updateOrganization);
router.get('/stats', getStats);

// --- Subscription Routes ---
const subscriptionsAudit = createSettingsAuditMiddleware({ surface: 'subscriptions' });
router.get('/subscription', getSubscription);
router.post('/subscription/upgrade', canManageBilling(), subscriptionsAudit, upgradeSubscription);
router.post('/subscription/cancel', canManageBilling(), subscriptionsAudit, cancelSubscription);

// --- App Management Routes (Admin only) ---
const invalidateApplicationsSettingsCache = invalidateCacheOnSuccessfulMutation({
    namespace: 'settings:applications:v2',
});
const appsAudit = createSettingsAuditMiddleware({ surface: 'applications' });

router.post('/apps/enable', requireOwner(), appsAudit, invalidateApplicationsSettingsCache, enableApp);
router.post('/apps/disable', requireOwner(), appsAudit, invalidateApplicationsSettingsCache, disableApp);
// Support organization ID in path for admin operations
router.post('/:id/apps/enable', requireOwner(), appsAudit, invalidateApplicationsSettingsCache, enableApp);
router.post('/:id/apps/disable', requireOwner(), appsAudit, invalidateApplicationsSettingsCache, disableApp);

module.exports = router;

