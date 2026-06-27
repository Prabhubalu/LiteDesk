const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const {
  getImportHistory,
  getImportHistoryListMeta,
  getImportById,
  getImportStats,
  deleteImportHistory,
  getImportedRecords
} = require('../controllers/importHistoryController');
const {
  listImportMappingTemplates,
  getImportMappingTemplate,
  createImportMappingTemplate,
  updateImportMappingTemplate,
  deleteImportMappingTemplate,
  applyImportMappingTemplate,
} = require('../controllers/importMappingTemplateController');

// Apply middleware to all routes
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize CRM if needed
router.use(requireSalesApp); // Enforce CRM-only access
router.use(organizationIsolation);
router.use(checkTrialStatus);

// Import mapping templates (must be registered before /:id)
router.get('/mapping-templates', checkPermission('imports', 'view'), listImportMappingTemplates);
router.get('/mapping-templates/:id', checkPermission('imports', 'view'), getImportMappingTemplate);
router.post('/mapping-templates', checkPermission('imports', 'create'), createImportMappingTemplate);
router.patch('/mapping-templates/:id', checkPermission('imports', 'create'), updateImportMappingTemplate);
router.delete('/mapping-templates/:id', checkPermission('imports', 'delete'), deleteImportMappingTemplate);
router.post('/mapping-templates/:id/apply', checkPermission('imports', 'view'), applyImportMappingTemplate);

// Import history routes
router.get('/meta', checkPermission('imports', 'view'), getImportHistoryListMeta);
router.get('/', checkPermission('imports', 'view'), getImportHistory);
router.get('/stats/summary', checkPermission('imports', 'view'), getImportStats);
router.get('/:id', checkPermission('imports', 'view'), getImportById);
router.get('/:id/records/:type', checkPermission('imports', 'view'), getImportedRecords);
router.delete('/:id', checkPermission('imports', 'delete'), deleteImportHistory);

module.exports = router;

