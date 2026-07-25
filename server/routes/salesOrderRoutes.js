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
  patchSalesOrderHandler,
  confirmSalesOrderHandler,
  cancelSalesOrderHandler,
  listFulfillments,
  postFulfillment,
  reverseFulfillment,
  splitSalesOrderHandler,
  mergeSalesOrdersHandler,
  listInvoiceAllocations,
  getInvoiceReadiness,
  getBillingCoverage,
  deleteSalesOrderHandler
} = require('../controllers/salesOrderController');
const {
  addSalesOrderLine,
  addSalesOrderBundleHandler,
  patchSalesOrderBundleOptionalsHandler,
  patchSalesOrderLine,
  deleteSalesOrderLine,
  reorderSalesOrderLinesHandler,
  patchSalesOrderDiscountsHandler,
  recalculateSalesOrderHandler,
  patchSalesOrderTaxesChargesHandler
} = require('../controllers/salesOrderLineController');
const {
  listSections,
  createSection,
  patchSection,
  deleteSection,
  reorderSalesOrderSectionsHandler,
  patchSalesOrderSectionDiscountsHandler
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
router.patch('/:id', checkPermission('sales_orders', 'edit'), patchSalesOrderHandler);
router.put('/:id', checkPermission('sales_orders', 'edit'), patchSalesOrderHandler);
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
router.post('/:id/bundles', checkPermission('sales_orders', 'edit'), addSalesOrderBundleHandler);
router.patch(
  '/:id/bundles/:parentLineId/optionals',
  checkPermission('sales_orders', 'edit'),
  patchSalesOrderBundleOptionalsHandler
);
router.post('/:id/lines', checkPermission('sales_orders', 'edit'), addSalesOrderLine);
router.patch('/:id/lines/reorder', checkPermission('sales_orders', 'edit'), reorderSalesOrderLinesHandler);
router.patch('/:id/lines/:lineId', checkPermission('sales_orders', 'edit'), patchSalesOrderLine);
router.delete('/:id/lines/:lineId', checkPermission('sales_orders', 'edit'), deleteSalesOrderLine);
router.patch('/:id/discounts', checkPermission('sales_orders', 'edit'), patchSalesOrderDiscountsHandler);
router.patch('/:id/taxes-charges', checkPermission('sales_orders', 'edit'), patchSalesOrderTaxesChargesHandler);
router.post('/:id/recalculate', checkPermission('sales_orders', 'edit'), recalculateSalesOrderHandler);
router.get('/:id/sections', checkPermission('sales_orders', 'view'), listSections);
router.post('/:id/sections', checkPermission('sales_orders', 'edit'), createSection);
router.patch('/:id/sections/reorder', checkPermission('sales_orders', 'edit'), reorderSalesOrderSectionsHandler);
router.patch('/:id/sections/:sectionId/discounts', checkPermission('sales_orders', 'edit'), patchSalesOrderSectionDiscountsHandler);
router.patch('/:id/sections/:sectionId', checkPermission('sales_orders', 'edit'), patchSection);
router.delete('/:id/sections/:sectionId', checkPermission('sales_orders', 'edit'), deleteSection);
router.delete('/:id', checkPermission('sales_orders', 'delete'), deleteSalesOrderHandler);

module.exports = router;
