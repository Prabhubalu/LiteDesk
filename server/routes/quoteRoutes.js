const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission, filterByOwnership } = require('../middleware/permissionMiddleware');

const {
  createQuote,
  getQuotes,
  getQuoteById,
  updateQuote,
  deleteQuote,
  transitionQuoteStatus,
  submitQuoteForApproval,
  approveQuote,
  rejectQuote,
  shareQuote,
  revokeQuoteShare,
  convertQuote,
  getQuoteConversion,
  recalculateQuote,
  reviseQuote,
  getQuoteRevisions,
  getQuoteRevisionCompare,
  getQuoteApprovalWorkspaceHandler,
  getQuoteApprovalHistoryHandler,
  getQuoteProcessApprovals,
  sendQuoteEmail,
  patchQuoteDiscounts,
  patchQuoteTaxesCharges
} = require('../controllers/quoteController');

const {
  addQuoteLine,
  addQuoteBundle,
  patchBundleOptionalComponents,
  patchQuoteLine,
  deleteQuoteLine,
  reorderQuoteLines
} = require('../controllers/quoteLineController');
const {
  listSections,
  createSection,
  patchSection,
  patchSectionDiscounts,
  reorderSections,
  deleteSection
} = require('../controllers/quoteSectionController');
const quoteDocumentController = require('../controllers/quoteDocumentController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);

// Quotes is a platform-native module, but until a dedicated commerce appKey exists,
// we ship it under the SALES app context while keeping it domain-decoupled from Deals.
router.use(lazySalesInitialization);
router.use(requireSalesApp);

router.use(organizationIsolation);
router.use(checkTrialStatus);

router.route('/')
  .post(checkPermission('quotes', 'create'), createQuote)
  .get(filterByOwnership('quotes'), checkPermission('quotes', 'view'), getQuotes);

router.get('/:id', checkPermission('quotes', 'view'), getQuoteById);
router.get('/:id/revisions', checkPermission('quotes', 'view'), getQuoteRevisions);
router.get('/:id/revisions/compare', checkPermission('quotes', 'view'), getQuoteRevisionCompare);
router.get('/:id/approval-workspace', checkPermission('quotes', 'view'), getQuoteApprovalWorkspaceHandler);
router.get('/:id/approval-history', checkPermission('quotes', 'view'), getQuoteApprovalHistoryHandler);
router.get('/:id/process-approvals', checkPermission('quotes', 'view'), getQuoteProcessApprovals);
router.get('/:id/conversion', checkPermission('quotes', 'view'), getQuoteConversion);
router.put('/:id', checkPermission('quotes', 'edit'), updateQuote);
router.delete('/:id', checkPermission('quotes', 'delete'), deleteQuote);
router.patch('/:id/status', checkPermission('quotes', 'edit'), transitionQuoteStatus);
router.post('/:id/submit-for-approval', checkPermission('quotes', 'edit'), submitQuoteForApproval);
router.post('/:id/approve', checkPermission('quotes', 'edit'), approveQuote);
router.post('/:id/reject', checkPermission('quotes', 'edit'), rejectQuote);
router.post('/:id/send-email', checkPermission('quotes', 'edit'), sendQuoteEmail);
router.post('/:id/share', checkPermission('quotes', 'edit'), shareQuote);
router.post('/:id/share/revoke', checkPermission('quotes', 'edit'), revokeQuoteShare);
router.post('/:id/convert', checkPermission('quotes', 'edit'), convertQuote);
router.post('/:id/recalculate', checkPermission('quotes', 'edit'), recalculateQuote);
router.patch('/:id/discounts', checkPermission('quotes', 'edit'), patchQuoteDiscounts);
router.patch('/:id/taxes-charges', checkPermission('quotes', 'edit'), patchQuoteTaxesCharges);
router.post('/:id/revise', checkPermission('quotes', 'edit'), reviseQuote);
router.get('/:id/sections', checkPermission('quotes', 'view'), listSections);
router.post('/:id/sections', checkPermission('quotes', 'edit'), createSection);
router.patch('/:id/sections/reorder', checkPermission('quotes', 'edit'), reorderSections);
router.patch('/:id/sections/:sectionId/discounts', checkPermission('quotes', 'edit'), patchSectionDiscounts);
router.patch('/:id/sections/:sectionId', checkPermission('quotes', 'edit'), patchSection);
router.delete('/:id/sections/:sectionId', checkPermission('quotes', 'edit'), deleteSection);
router.post('/:id/lines', checkPermission('quotes', 'edit'), addQuoteLine);
router.post('/:id/bundles', checkPermission('quotes', 'edit'), addQuoteBundle);
router.patch('/:id/bundles/:parentLineId/optionals', checkPermission('quotes', 'edit'), patchBundleOptionalComponents);
router.patch('/:id/lines/reorder', checkPermission('quotes', 'edit'), reorderQuoteLines);
router.patch('/:id/lines/:lineId', checkPermission('quotes', 'edit'), patchQuoteLine);
router.delete('/:id/lines/:lineId', checkPermission('quotes', 'edit'), deleteQuoteLine);

router.get('/:id/documents', checkPermission('quotes', 'view'), quoteDocumentController.listDocuments);
router.post('/:id/documents/preview', checkPermission('quotes', 'view'), quoteDocumentController.generateDocument);
router.post('/:id/documents/generate', checkPermission('quotes', 'edit'), quoteDocumentController.generateDocument);

module.exports = router;
