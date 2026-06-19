const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const requirePermission = require('../middleware/requirePermission');
const { applySharingFilter } = require('../middleware/permissionMiddleware');
const PEOPLE_PERMISSIONS = require('../permissions/peoplePermissions');
const controller = require('../controllers/peopleController');
const resolverController = require('../controllers/peopleResolverController');

// Helper middleware to extract appKey from request body and check attach permission
const requireAttachPermission = (req, res, next) => {
  const appKey = req.body?.appKey?.toUpperCase();
  if (!appKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'appKey is required'
    });
  }
  const permission = PEOPLE_PERMISSIONS.ATTACH[appKey] || PEOPLE_PERMISSIONS.ATTACH.BASE;
  return requirePermission(permission)(req, res, next);
};

// Helper middleware to extract appKey from request body and check edit participation permission
const requireEditParticipationPermission = (req, res, next) => {
  const appKey = req.body?.appKey?.toUpperCase();
  if (!appKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'appKey is required'
    });
  }
  const permission = PEOPLE_PERMISSIONS.EDIT_PARTICIPATION[appKey] || PEOPLE_PERMISSIONS.EDIT_PARTICIPATION.BASE;
  return requirePermission(permission)(req, res, next);
};

// Helper middleware to extract appKey from request body and check lifecycle permission
const requireLifecyclePermission = (req, res, next) => {
  const appKey = req.body?.appKey?.toUpperCase();
  if (!appKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'appKey is required'
    });
  }
  const permission = PEOPLE_PERMISSIONS.LIFECYCLE[appKey] || PEOPLE_PERMISSIONS.LIFECYCLE.BASE;
  return requirePermission(permission)(req, res, next);
};

// Resolver endpoints (accessible without Sales app requirement)
// These are used by the read-only People list to resolve app context and types
router.post('/resolve-context', protect, resolverController.resolveContext);
router.post('/resolve-types', protect, resolverController.resolveTypes);
router.post('/resolve-quick-create', protect, resolverController.resolveQuickCreate);
router.post('/create', protect, resolverController.createOrAttach);
// Guard: Attach to App - check permission before allowing attachment
router.post('/:id/attach', protect, requireAttachPermission, resolverController.attachAppParticipation);
// Guard: Convert Lead to Contact - check lifecycle permission (always SALES)
router.post('/:id/convert-lead-to-contact', protect, requirePermission(PEOPLE_PERMISSIONS.LIFECYCLE.SALES), resolverController.convertLeadToContact);
// Guard: Detach from App - check lifecycle permission AND detach policy
router.post('/:id/detach', protect, requireLifecyclePermission, resolverController.detachFromApp);
router.get('/:id/profile', protect, resolverController.composeProfile);
router.put('/:id/update-core', protect, resolverController.updateCore);
// Guard: Edit Participation Details - check edit participation permission
router.put('/:id/update-app-fields', protect, requireEditParticipationPermission, resolverController.updateAppFields);

// Standard CRUD routes
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(organizationIsolation);

// Conditional middleware: Allow PLATFORM appKey for GET requests (list view)
// Require Sales app only for modifications and Sales-specific operations
router.use((req, res, next) => {
  if (req.method === 'GET' && req.appKey === 'PLATFORM') {
    // For GET requests with PLATFORM appKey, allow platform-level access
    // This enables the People list to show all people regardless of participation
    return next();
  }
  
  // For other requests or non-PLATFORM appKeys, require Sales app
  return requireAppEntitlement(req, res, () => {
    return lazySalesInitialization(req, res, () => {
      return requireSalesApp(req, res, next);
    });
  });
});

router.post('/', controller.create);
router.get('/', applySharingFilter('people'), controller.list);

// Activity logs (must be before /:id route)
router.get('/:id/activity-logs', controller.getActivityLogs);
router.post('/:id/activity-logs', controller.addActivityLog);

router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;


