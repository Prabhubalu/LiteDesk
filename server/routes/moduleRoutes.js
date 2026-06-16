const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const controller = require('../controllers/moduleController');
const { sessionBootstrapLimiter } = require('../middleware/rateLimitMiddleware');

// Core entities that are platform-owned (don't require Sales app)
const CORE_ENTITIES = ['people', 'organizations', 'events', 'forms', 'tasks', 'items', 'quotes', 'reports'];

// Helper to check if a module is a core entity
function isCoreEntity(moduleKey) {
  if (!moduleKey) return false;
  return CORE_ENTITIES.includes(moduleKey.toLowerCase());
}

// Helper to extract module key from request
function getModuleKeyFromRequest(req) {
  // For PUT /system/:key routes
  if (req.params.key) {
    return req.params.key;
  }
  // For PUT /:id routes, we'd need to fetch the module to get its key
  // But for now, we'll handle this in the route handler if needed
  return null;
}

// Require auth and organization context
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL

// Conditional middleware: Allow platform-level access for GET requests and core entity modifications
// Require Sales app only for Sales-specific module modifications
router.use((req, res, next) => {
  if (req.method === 'GET') {
    // For GET requests, allow platform-level access (Settings can view modules)
    // Skip app entitlement, Sales app, and lazy initialization checks
    // The settings.edit permission check is sufficient for viewing
    return next();
  }
  
  // For modifications (POST/PUT/DELETE), check if it's a core entity
  const moduleKey = getModuleKeyFromRequest(req);
  if (isCoreEntity(moduleKey)) {
    // Core entities can be modified without Sales app (platform-level access)
    // Skip app entitlement, Sales app, and lazy initialization checks
    return next();
  }
  
  // For Sales-specific modules (like Deals), require Sales app entitlement and initialization
  return requireAppEntitlement(req, res, () => {
    return lazySalesInitialization(req, res, () => {
      return requireSalesApp(req, res, next);
    });
  });
});

router.use(organizationIsolation);

// GET: authenticated tenant users. Field-level read filtering happens in controller
// (filterFieldsByReadAccess). ModuleList and record surfaces need schema read access
// without settings.edit.
// POST/PUT/DELETE: settings administrators only.
router.get('/people/quick-create', sessionBootstrapLimiter, controller.getPeopleQuickCreate);
router.get('/', sessionBootstrapLimiter, controller.listModules);
router.post('/', checkPermission('settings', 'edit'), controller.createModule);
router.delete('/:id', checkPermission('settings', 'edit'), controller.deleteModule);
router.put('/:id', checkPermission('settings', 'edit'), controller.updateModule);
router.put('/system/:key', checkPermission('settings', 'edit'), controller.updateSystemModule);
router.post('/system/:key/fields/:fieldKey/options', checkPermission('settings', 'edit'), controller.addModuleFieldPicklistOption);

module.exports = router;


