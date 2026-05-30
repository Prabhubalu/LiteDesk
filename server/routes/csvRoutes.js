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
  parseCSVFile,
  checkContactDuplicates,
  checkDealDuplicates,
  checkTaskDuplicates,
  checkOrganizationDuplicates,
  importContacts,
  importDeals,
  importTasks,
  importOrganizations,
  exportContacts,
  exportDeals,
  exportTasks,
  exportOrganizations
} = require('../controllers/csvController');

// Apply authentication to all routes
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize CRM if needed
router.use(requireSalesApp); // Enforce CRM-only access

// Parse CSV file (preview)
router.post('/parse', parseCSVFile);

// Check for duplicates before import
router.post('/check-duplicates/contacts',
  organizationIsolation,
  checkTrialStatus,
  checkPermission('contacts', 'view'),
  checkContactDuplicates
);
// Alias for people
router.post('/check-duplicates/people',
  organizationIsolation,
  checkTrialStatus,
  checkPermission('people', 'view'),
  checkContactDuplicates
);

router.post('/check-duplicates/deals',
  organizationIsolation,
  checkTrialStatus,
  checkPermission('deals', 'view'),
  checkDealDuplicates
);

router.post('/check-duplicates/tasks',
  organizationIsolation,
  checkTrialStatus,
  checkPermission('tasks', 'view'),
  checkTaskDuplicates
);

router.post('/check-duplicates/organizations',
  organizationIsolation,
  checkTrialStatus,
  checkPermission('organizations', 'view'),
  checkOrganizationDuplicates
);

// Import routes (require organization isolation and permissions)
router.post('/import/contacts', 
  organizationIsolation,
  checkTrialStatus,
  checkPermission('imports', 'create'),
  checkPermission('contacts', 'create'),
  importContacts
);
// Alias for people
router.post('/import/people', 
  organizationIsolation,
  checkTrialStatus,
  checkPermission('imports', 'create'),
  checkPermission('people', 'create'),
  importContacts
);

router.post('/import/deals',
  organizationIsolation,
  checkTrialStatus,
  checkPermission('imports', 'create'),
  checkPermission('deals', 'create'),
  importDeals
);

router.post('/import/tasks',
  organizationIsolation,
  checkTrialStatus,
  checkPermission('imports', 'create'),
  checkPermission('tasks', 'create'),
  importTasks
);

router.post('/import/organizations',
  organizationIsolation,
  checkTrialStatus,
  checkPermission('imports', 'create'),
  checkPermission('organizations', 'create'),
  importOrganizations
);

// Export routes
router.get('/export/contacts',
  organizationIsolation,
  checkPermission('contacts', 'view'),
  exportContacts
);
// Alias for people
router.get('/export/people',
  organizationIsolation,
  checkPermission('people', 'view'),
  exportContacts
);

router.get('/export/deals',
  organizationIsolation,
  checkPermission('deals', 'view'),
  exportDeals
);

router.get('/export/tasks',
  organizationIsolation,
  checkPermission('tasks', 'view'),
  exportTasks
);

// Export routes
router.get('/export/organizations',
  organizationIsolation,
  checkPermission('organizations', 'view'),
  exportOrganizations
);

module.exports = router;

