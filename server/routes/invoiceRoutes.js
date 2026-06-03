const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission, filterByOwnership } = require('../middleware/permissionMiddleware');
const {
  getInvoices,
  createInvoiceHandler,
  getInvoiceById,
  patchInvoiceHandler,
  deleteInvoiceHandler,
  convertFromSalesOrderHandler,
  submitInvoiceHandler,
  approveInvoiceHandler,
  rejectInvoiceHandler,
  postInvoiceHandler,
  voidInvoiceHandler,
  getInvoiceCreditSummaryHandler,
  createCreditNoteHandler,
  sendInvoiceEmailHandler,
  multiSoReadinessHandler,
  convertFromMultipleSalesOrdersHandler
} = require('../controllers/invoiceController');
const {
  listInvoicePaymentAllocationsHandler,
  getInvoicePaymentSummaryHandler
} = require('../controllers/paymentController');
const invoiceDocumentController = require('../controllers/invoiceDocumentController');
const {
  addInvoiceLine,
  patchInvoiceLineHandler,
  deleteInvoiceLineHandler
} = require('../controllers/invoiceLineController');
const {
  listSections,
  createSection,
  patchSection,
  deleteSection
} = require('../controllers/invoiceSectionController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/', filterByOwnership('invoices'), checkPermission('invoices', 'view'), getInvoices);
router.post('/', checkPermission('invoices', 'create'), createInvoiceHandler);
router.post(
  '/from-sales-order/:salesOrderId',
  checkPermission('invoices', 'create'),
  convertFromSalesOrderHandler
);
router.post(
  '/from-invoice/:invoiceId/credit-note',
  checkPermission('invoices', 'createCreditNote'),
  createCreditNoteHandler
);
router.post(
  '/from-sales-orders',
  checkPermission('invoices', 'create'),
  convertFromMultipleSalesOrdersHandler
);
router.post(
  '/multi-so-readiness',
  checkPermission('invoices', 'view'),
  multiSoReadinessHandler
);

router.get('/:id/credit-summary', checkPermission('invoices', 'view'), getInvoiceCreditSummaryHandler);
router.get(
  '/:id/payment-summary',
  checkPermission('invoices', 'view'),
  getInvoicePaymentSummaryHandler
);
router.get(
  '/:id/payment-allocations',
  checkPermission('invoices', 'view'),
  listInvoicePaymentAllocationsHandler
);

router.get('/:id/documents', checkPermission('invoices', 'view'), invoiceDocumentController.listDocuments);
router.post(
  '/:id/documents/generate',
  checkPermission('invoices', 'export'),
  invoiceDocumentController.generateDocument
);
router.post(
  '/:id/send-email',
  checkPermission('invoices', 'export'),
  sendInvoiceEmailHandler
);

router.get('/:id', checkPermission('invoices', 'view'), getInvoiceById);
router.patch('/:id', checkPermission('invoices', 'edit'), patchInvoiceHandler);
router.put('/:id', checkPermission('invoices', 'edit'), patchInvoiceHandler);
router.delete('/:id', checkPermission('invoices', 'delete'), deleteInvoiceHandler);

router.post('/:id/submit', checkPermission('invoices', 'submit'), submitInvoiceHandler);
router.post('/:id/approve', checkPermission('invoices', 'approve'), approveInvoiceHandler);
router.post('/:id/reject', checkPermission('invoices', 'approve'), rejectInvoiceHandler);
router.post('/:id/post', checkPermission('invoices', 'post'), postInvoiceHandler);
router.post('/:id/void', checkPermission('invoices', 'void'), voidInvoiceHandler);

router.get('/:id/sections', checkPermission('invoices', 'view'), listSections);
router.post('/:id/sections', checkPermission('invoices', 'edit'), createSection);
router.patch('/:id/sections/:sectionId', checkPermission('invoices', 'edit'), patchSection);
router.delete('/:id/sections/:sectionId', checkPermission('invoices', 'edit'), deleteSection);

router.post('/:id/lines', checkPermission('invoices', 'edit'), addInvoiceLine);
router.patch('/:id/lines/:lineId', checkPermission('invoices', 'edit'), patchInvoiceLineHandler);
router.delete('/:id/lines/:lineId', checkPermission('invoices', 'edit'), deleteInvoiceLineHandler);

module.exports = router;
