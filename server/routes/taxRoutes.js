const express = require('express');
const {
  listTaxes,
  getTax,
  createTax,
  updateTax,
  setTaxStatus,
  deleteTax,
  listTaxGroups,
  getTaxGroup,
  createTaxGroup,
  updateTaxGroup,
  deleteTaxGroup,
  getTaxDefaults,
  updateTaxDefaults,
  resolveTaxDefaults,
  listRegionalAssignments,
  createRegionalAssignment,
  updateRegionalAssignment,
  deleteRegionalAssignment,
  suggestRegionalTaxes,
  calculateTaxes
} = require('../controllers/taxController');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');

const router = express.Router();

/**
 * Commercial tax settings — shared by Sales + Inventory document consumers.
 * RBAC module: taxes (view/create/edit/delete/manageGroups/configureDefaults).
 */
router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('items'));

router.post('/calculate', checkPermission('taxes', 'view'), calculateTaxes);
router.get('/resolve-defaults', checkPermission('taxes', 'view'), resolveTaxDefaults);
router.get('/suggest-regional', checkPermission('taxes', 'view'), suggestRegionalTaxes);

router.get('/defaults', checkPermission('taxes', 'view'), getTaxDefaults);
router.put('/defaults', checkPermission('taxes', 'configureDefaults'), updateTaxDefaults);

router.get('/groups', checkPermission('taxes', 'view'), listTaxGroups);
router.post('/groups', checkPermission('taxes', 'manageGroups'), createTaxGroup);
router.get('/groups/:id', checkPermission('taxes', 'view'), getTaxGroup);
router.put('/groups/:id', checkPermission('taxes', 'manageGroups'), updateTaxGroup);
router.delete('/groups/:id', checkPermission('taxes', 'manageGroups'), deleteTaxGroup);

router.get('/regional', checkPermission('taxes', 'view'), listRegionalAssignments);
router.post('/regional', checkPermission('taxes', 'edit'), createRegionalAssignment);
router.put('/regional/:id', checkPermission('taxes', 'edit'), updateRegionalAssignment);
router.delete('/regional/:id', checkPermission('taxes', 'edit'), deleteRegionalAssignment);

router.get('/', checkPermission('taxes', 'view'), listTaxes);
router.post('/', checkPermission('taxes', 'create'), createTax);
router.get('/:id', checkPermission('taxes', 'view'), getTax);
router.put('/:id', checkPermission('taxes', 'edit'), updateTax);
router.patch('/:id/status', checkPermission('taxes', 'edit'), setTaxStatus);
router.delete('/:id', checkPermission('taxes', 'delete'), deleteTax);

module.exports = router;
