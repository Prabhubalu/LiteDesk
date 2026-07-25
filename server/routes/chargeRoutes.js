const express = require('express');
const {
  listCharges,
  getCharge,
  createCharge,
  updateCharge,
  setChargeStatus,
  deleteCharge,
  getChargeDefaults,
  updateChargeDefaults,
  resolveChargeDefaults,
  calculateCharges
} = require('../controllers/chargeController');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('items'));

router.post('/calculate', checkPermission('charges', 'view'), calculateCharges);
router.get('/resolve-defaults', checkPermission('charges', 'view'), resolveChargeDefaults);
router.get('/defaults', checkPermission('charges', 'view'), getChargeDefaults);
router.put('/defaults', checkPermission('charges', 'configureDefaults'), updateChargeDefaults);

router.get('/', checkPermission('charges', 'view'), listCharges);
router.post('/', checkPermission('charges', 'create'), createCharge);
router.get('/:id', checkPermission('charges', 'view'), getCharge);
router.put('/:id', checkPermission('charges', 'edit'), updateCharge);
router.patch('/:id/status', checkPermission('charges', 'edit'), setChargeStatus);
router.delete('/:id', checkPermission('charges', 'delete'), deleteCharge);

module.exports = router;
