const express = require('express');
const {
    createForm,
    getForms,
    getFormById,
    updateForm,
    deleteForm,
    duplicateForm,
    getFormBySlug,
    getFormAnalytics,
    getFormKPIs,
    linkFormToEvent,
    enablePublicLink,
    getMyAudits,
    getOrganizationAudits
} = require('../controllers/formController');

const {
    submitForm,
    getResponses,
    getResponseById,
    updateResponseStatus,
    addCorrectiveAction,
    verifyCorrectiveAction,
    approveResponse,
    rejectResponse,
    deleteResponse,
    exportResponses,
    getResponseComparison,
    generateReport,
    exportExcel
} = require('../controllers/formResponseController');

const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { uploadMultiple } = require('../middleware/uploadMiddleware');

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
protectedRouter.use(organizationIsolation);
protectedRouter.use(checkTrialStatus);
protectedRouter.use(checkFeatureAccess('forms'));

// My Audits (must come before /:id routes)
protectedRouter.get('/my-audits', checkPermission('forms', 'view'), getMyAudits);

// Organization Audits (must come before /:id routes)
protectedRouter.get('/organization/:organizationId/audits', checkPermission('forms', 'view'), getOrganizationAudits);

// Form Analytics (must come before /:id routes)
protectedRouter.get('/:id/analytics', checkPermission('forms', 'view'), getFormAnalytics);
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

// Form responses routes
protectedRouter.route('/:id/responses')
    .get(checkPermission('forms', 'view'), getResponses);

protectedRouter.get('/:id/responses/export', checkPermission('forms', 'view'), exportResponses);

protectedRouter.route('/:id/responses/:responseId')
    .get(checkPermission('forms', 'view'), getResponseById)
    .delete(checkPermission('forms', 'delete'), deleteResponse);

protectedRouter.patch('/:id/responses/:responseId/status', checkPermission('forms', 'edit'), updateResponseStatus);
protectedRouter.post('/:id/responses/:responseId/corrective-action', checkPermission('forms', 'edit'), uploadMultiple('proof', 10), addCorrectiveAction);
protectedRouter.post('/:id/responses/:responseId/verify', checkPermission('forms', 'edit'), verifyCorrectiveAction);
protectedRouter.post('/:id/responses/:responseId/approve', checkPermission('forms', 'edit'), approveResponse);
protectedRouter.post('/:id/responses/:responseId/reject', checkPermission('forms', 'edit'), rejectResponse);
protectedRouter.get('/:id/responses/:responseId/compare', checkPermission('forms', 'view'), getResponseComparison);
protectedRouter.post('/:id/responses/:responseId/generate-report', checkPermission('forms', 'view'), generateReport);
protectedRouter.post('/:id/responses/:responseId/export-excel', checkPermission('forms', 'view'), exportExcel);

// Export both routers
// Create an object that exports both routers
const formRoutes = router;
formRoutes.protected = protectedRouter;
module.exports = formRoutes;

