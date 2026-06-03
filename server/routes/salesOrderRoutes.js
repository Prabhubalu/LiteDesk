const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission, filterByOwnership } = require('../middleware/permissionMiddleware');
const {
  convertFromQuote,
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  confirmSalesOrderHandler,
  cancelSalesOrderHandler,
  listFulfillments,
  postFulfillment,
  reverseFulfillment,
  splitSalesOrderHandler,
  mergeSalesOrdersHandler,
  listInvoiceAllocations,
  getInvoiceReadiness,
  getBillingCoverage
} = require('../controllers/salesOrderController');
const { addSalesOrderLine, patchSalesOrderLine, deleteSalesOrderLine } = require('../controllers/salesOrderLineController');
const {
  listSections,
  createSection,
  patchSection,
  deleteSection
} = require('../controllers/salesOrderSectionController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.post(
  '/from-quote/:quoteId',
  checkPermission('sales_orders', 'convertFromQuote'),
  convertFromQuote
);
router.get('/', filterByOwnership('sales_orders'), checkPermission('sales_orders', 'view'), getSalesOrders);
router.post('/merge', checkPermission('sales_orders', 'merge'), mergeSalesOrdersHandler);
router.post('/', checkPermission('sales_orders', 'create'), createSalesOrder);
router.get('/:id', checkPermission('sales_orders', 'view'), getSalesOrderById);
router.post('/:id/confirm', checkPermission('sales_orders', 'confirm'), confirmSalesOrderHandler);
router.post('/:id/cancel', checkPermission('sales_orders', 'cancel'), cancelSalesOrderHandler);
router.get('/:id/fulfillments', checkPermission('sales_orders', 'view'), listFulfillments);
router.post('/:id/fulfillments', checkPermission('sales_orders', 'fulfill'), postFulfillment);
router.post(
  '/:id/fulfillments/:fulfillmentId/reverse',
  checkPermission('sales_orders', 'fulfill'),
  reverseFulfillment
);
router.post('/:id/split', checkPermission('sales_orders', 'split'), splitSalesOrderHandler);
router.get('/:id/invoice-allocations', checkPermission('sales_orders', 'view'), listInvoiceAllocations);
router.get('/:id/invoice-readiness', checkPermission('sales_orders', 'view'), getInvoiceReadiness);
router.get('/:id/billing-coverage', checkPermission('sales_orders', 'view'), getBillingCoverage);
router.post('/:id/lines', checkPermission('sales_orders', 'edit'), addSalesOrderLine);
router.patch('/:id/lines/:lineId', checkPermission('sales_orders', 'edit'), patchSalesOrderLine);
router.delete('/:id/lines/:lineId', checkPermission('sales_orders', 'edit'), deleteSalesOrderLine);
router.get('/:id/sections', checkPermission('sales_orders', 'view'), listSections);
router.post('/:id/sections', checkPermission('sales_orders', 'edit'), createSection);
router.patch('/:id/sections/:sectionId', checkPermission('sales_orders', 'edit'), patchSection);
router.delete('/:id/sections/:sectionId', checkPermission('sales_orders', 'edit'), deleteSection);

module.exports = router;
