const express = require('express');
const {
    createForm,
    getForms,
    getFormsListMeta,
    getFormById,
    updateForm,
    deleteForm,
    duplicateForm,
    getFormBySlug,
    getFormAnalytics,
    getFormResponseSummary,
    getFormKPIs,
    linkFormToEvent,
    enablePublicLink,
    getOrganizationAudits
} = require('../controllers/formController');

const {
    submitForm,
    getAllResponses,
    getResponseMeta,
    getResponses,
    getResponseById,
    updateResponseStatus,
    addCorrectiveAction,
    updateCorrectiveActionStatus,
    verifyCorrectiveAction,
    approveResponse,
    rejectResponse,
    deleteResponse,
    archiveResponse,
    invalidateResponse,
    restoreResponse,
    exportResponses,
    getResponseComparison,
    generateReport,
    generateComprehensiveReport,
    exportExcel
} = require('../controllers/formResponseController');

const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { uploadMultiple } = require('../middleware/uploadMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================
// These routes are mounted at /api/public/forms in server.js
router.get('/:slug', getFormBySlug);
router.post('/:slug/submit', submitForm);

// ============================================
// PROTECTED ROUTES (Separate router)
// ============================================
const protectedRouter = express.Router();

// Apply middleware to all protected routes
protectedRouter.use(protect);
protectedRouter.use(resolveAppContext); // After auth, resolve appKey from URL
protectedRouter.use(requireAppEntitlement); // Check user's app entitlements
protectedRouter.use(lazySalesInitialization); // Lazy initialize CRM if needed
protectedRouter.use(requireSalesApp); // Enforce CRM-only access
protectedRouter.use(organizationIsolation);
protectedRouter.use(checkTrialStatus);
protectedRouter.use(checkFeatureAccess('forms'));

protectedRouter.get('/meta', checkPermission('forms', 'view'), getFormsListMeta);

// Organization Audits (must come before /:id routes)
protectedRouter.get('/organization/:organizationId/audits', checkPermission('forms', 'view'), getOrganizationAudits);

// Form Analytics (must come before /:id routes)
protectedRouter.get('/:id/analytics', checkPermission('forms', 'view'), getFormAnalytics);
protectedRouter.get('/:id/response-summary', checkPermission('forms', 'view'), getFormResponseSummary);
protectedRouter.get('/:id/kpis', checkPermission('forms', 'view'), getFormKPIs);
protectedRouter.post('/:id/link-event', checkPermission('forms', 'edit'), linkFormToEvent);
protectedRouter.post('/:id/enable-public', checkPermission('forms', 'edit'), enablePublicLink);

// Form CRUD routes
protectedRouter.route('/')
    .get(checkPermission('forms', 'view'), getForms)
    .post(checkPermission('forms', 'create'), createForm);

protectedRouter.route('/:id')
    .get(checkPermission('forms', 'view'), getFormById)
    .put(checkPermission('forms', 'edit'), updateForm)
    .delete(checkPermission('forms', 'delete'), deleteForm);

// Form actions
protectedRouter.post('/:id/duplicate', checkPermission('forms', 'create'), duplicateForm);

// Form submission (authenticated)
protectedRouter.post('/:id/submit', checkPermission('forms', 'create'), submitForm);

// All responses route (must come before /:id/responses)
protectedRouter.get('/responses/all', checkPermission('forms', 'view'), getAllResponses);
protectedRouter.get('/responses/:responseId/meta', checkPermission('forms', 'view'), getResponseMeta);

// Form responses routes
protectedRouter.route('/:id/responses')
    .get(checkPermission('forms', 'view'), getResponses);

protectedRouter.get('/:id/responses/export', checkPermission('forms', 'view'), exportResponses);

protectedRouter.route('/:id/responses/:responseId')
    .get(checkPermission('forms', 'view'), getResponseById)
    .delete(checkPermission('forms', 'delete'), deleteResponse);

protectedRouter.patch('/:id/responses/:responseId/status', checkPermission('forms', 'edit'), updateResponseStatus);
protectedRouter.post('/:id/responses/:responseId/corrective-action', checkPermission('forms', 'edit'), uploadMultiple('proof', 10), addCorrectiveAction);
protectedRouter.patch('/:id/responses/:responseId/corrective-action/:questionId', checkPermission('forms', 'edit'), uploadMultiple('proof', 10), updateCorrectiveActionStatus);
protectedRouter.post('/:id/responses/:responseId/verify', checkPermission('forms', 'edit'), verifyCorrectiveAction);
protectedRouter.post('/:id/responses/:responseId/approve', checkPermission('forms', 'edit'), approveResponse);
protectedRouter.post('/:id/responses/:responseId/reject', checkPermission('forms', 'edit'), rejectResponse);
protectedRouter.post('/:id/responses/:responseId/archive', checkPermission('forms', 'edit'), archiveResponse);
protectedRouter.post('/:id/responses/:responseId/invalidate', checkPermission('forms', 'edit'), invalidateResponse);
protectedRouter.post('/:id/responses/:responseId/restore', checkPermission('forms', 'edit'), restoreResponse);
protectedRouter.get('/:id/responses/:responseId/compare', checkPermission('forms', 'view'), getResponseComparison);
protectedRouter.post('/:id/responses/:responseId/generate-report', checkPermission('forms', 'view'), generateReport);
protectedRouter.post('/:id/responses/:responseId/generate-comprehensive-report', checkPermission('forms', 'view'), generateComprehensiveReport);
protectedRouter.post('/:id/responses/:responseId/export-excel', checkPermission('forms', 'view'), exportExcel);

// Export both routers
// Create an object that exports both routers
const formRoutes = router;
formRoutes.protected = protectedRouter;
module.exports = formRoutes;

