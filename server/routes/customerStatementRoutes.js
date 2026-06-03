const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const {
  getCustomerStatementHandler,
  exportCustomerStatementCsvHandler,
  exportCustomerStatementPdfHandler,
  listCustomerCreditBalancesHandler,
  applyCustomerCreditHandler,
  reverseCustomerCreditApplicationHandler
} = require('../controllers/customerCreditController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/export.csv', checkPermission('payments', 'export'), exportCustomerStatementCsvHandler);
router.get('/export.pdf', checkPermission('payments', 'export'), exportCustomerStatementPdfHandler);
router.get('/credit-balances', checkPermission('payments', 'view'), listCustomerCreditBalancesHandler);
router.post('/credit-applications', checkPermission('payments', 'applyCredit'), applyCustomerCreditHandler);
router.post(
  '/credit-applications/:id/reverse',
  checkPermission('payments', 'applyCredit'),
  reverseCustomerCreditApplicationHandler
);
router.get('/', checkPermission('payments', 'view'), getCustomerStatementHandler);

module.exports = router;
