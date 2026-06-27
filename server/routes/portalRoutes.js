/**
 * ============================================================================
 * Portal Application Routes
 * ============================================================================
 * 
 * Routes for Customer Portal application (App #2).
 * 
 * Base Path: /portal/*
 * App Key: PORTAL
 * 
 * Features:
 * - User profile (GET /portal/me)
 * - Organization summary (GET /portal/org)
 * - Health check (GET /portal/health)
 * 
 * Security:
 * - Requires authentication
 * - Enforces Portal app context (appKey = PORTAL)
 * - Enforces organization isolation
 * - Module permissions from active external role (cases.read, documents.read, …)
 * 
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requirePortalApp } = require('../middleware/requirePortalAppMiddleware');
const {
    getMe,
    getOrg,
    getHealth,
    listAudits,
    getAuditDetail,
    listCorrectiveActions,
    uploadEvidence,
    uploadMiddleware
} = require('../controllers/portalController');
const {
  ingestPortalMessage,
  replyToCaseFromPortal,
  uploadPortalAttachment,
  listPortalConversationAttachments,
  listPortalMessageAttachments,
  uploadMiddleware: portalMailroomUploadMiddleware
} = require('../controllers/portalMailroomController');
const { downloadMailroomAttachmentForPortal } = require('../controllers/mailroomAttachmentController');
const {
  listPortalCases,
  getPortalCase,
  createPortalCase,
  replyPortalCase,
  markPortalCaseReadHandler,
  submitPortalCaseCsatHandler
} = require('../controllers/portalCaseController');
const {
  listPortalInvoicesHandler,
  getPortalPayEligibilityHandler,
  startPortalPayHandler,
  getPortalPaymentSessionStatusHandler
} = require('../controllers/portalPaymentController');
const {
  listPortalKnowledgeArticles,
  getPortalKnowledgeArticle
} = require('../controllers/portalDocumentController');
const { getPortalDashboard } = require('../controllers/portalDashboardController');
const {
  getPortalOrganization
} = require('../controllers/portalOrganizationController');
const {
  listPortalDealsHandler,
  getPortalDealHandler
} = require('../controllers/portalDealController');
const {
  listPortalFormsHandler,
  getPortalFormHandler,
  submitPortalFormHandler,
  getPortalFormResponseHandler,
  getPortalInProgressFormResponseHandler
} = require('../controllers/portalFormController');
const {
  listPortalResponsesHandler,
  getPortalResponseHandler
} = require('../controllers/portalResponseController');
const { getPortalPerson } = require('../controllers/portalPeopleController');
const { mailroomPortalIngestLimiter } = require('../middleware/rateLimitMiddleware');
const requirePortalModuleAccess = require('../middleware/requirePortalModuleAccess');

// Apply middleware to all Portal routes
// Order: auth → app context → app entitlement → organization isolation → portal enforcement
router.use(protect);
router.use(resolveAppContext); // Resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(organizationIsolation); // Organization context
router.use(requirePortalApp); // Enforce Portal-only access

// Portal endpoints
router.get('/me', getMe); // User profile
router.get('/org', getOrg); // Organization summary
router.get('/health', getHealth); // Health check
router.get('/dashboard', getPortalDashboard);

// Business organization linked to the signed-in portal user
router.get('/organization', requirePortalModuleAccess('organizations', 'read'), getPortalOrganization);

// Contact profile linked to the signed-in portal user
router.get('/people/me', requirePortalModuleAccess('people', 'read'), getPortalPerson);

// Deals scoped to portal user's person / business organization
router.get('/deals', requirePortalModuleAccess('deals', 'read'), listPortalDealsHandler);
router.get('/deals/:id', requirePortalModuleAccess('deals', 'read'), getPortalDealHandler);

// Partner/Public forms available in portal
router.get('/forms', requirePortalModuleAccess('forms', 'read'), listPortalFormsHandler);
router.get('/forms/:formId/responses/in-progress', requirePortalModuleAccess('forms', 'read'), getPortalInProgressFormResponseHandler);
router.get('/forms/:formId/responses/:responseId', requirePortalModuleAccess('forms', 'read'), getPortalFormResponseHandler);
router.get('/forms/:formId', requirePortalModuleAccess('forms', 'read'), getPortalFormHandler);
router.post('/forms/:formId/submit', requirePortalModuleAccess('forms', 'create'), submitPortalFormHandler);

router.get('/responses', requirePortalModuleAccess('responses', 'read'), listPortalResponsesHandler);
router.get('/responses/:id', requirePortalModuleAccess('responses', 'read'), getPortalResponseHandler);

// Audit endpoints (customer-safe)
router.get('/audits', requirePortalModuleAccess('events', 'read'), listAudits);
router.get('/audits/:eventId', requirePortalModuleAccess('events', 'read'), getAuditDetail);

// Corrective actions endpoints
router.get('/actions', requirePortalModuleAccess('events', 'read'), listCorrectiveActions);
router.post('/actions/:actionId/evidence', requirePortalModuleAccess('events', 'update'), uploadMiddleware, uploadEvidence);

// Helpdesk cases (Phase 1D) — customer-scoped case APIs
router.get('/cases', requirePortalModuleAccess('cases', 'read'), listPortalCases);
router.post('/cases', requirePortalModuleAccess('cases', 'create'), createPortalCase);
router.get('/cases/:id', requirePortalModuleAccess('cases', 'read'), getPortalCase);
router.post('/cases/:id/read', requirePortalModuleAccess('cases', 'read'), markPortalCaseReadHandler);
router.post('/cases/:id/csat', requirePortalModuleAccess('cases', 'update'), submitPortalCaseCsatHandler);
router.post('/cases/:id/reply', requirePortalModuleAccess('cases', 'update'), mailroomPortalIngestLimiter, replyPortalCase);

// Online payments (PAY3.1) — reuses PaymentGatewaySession
router.get('/invoices', requirePortalModuleAccess('invoices', 'read'), listPortalInvoicesHandler);
router.get('/invoices/:id/pay-eligibility', requirePortalModuleAccess('invoices', 'read'), getPortalPayEligibilityHandler);
router.post('/invoices/:id/pay', requirePortalModuleAccess('invoices', 'read'), startPortalPayHandler);
router.get('/payment-sessions/:id/status', requirePortalModuleAccess('invoices', 'read'), getPortalPaymentSessionStatusHandler);

// Knowledge base (portal-visible published articles)
router.get('/knowledge-base', requirePortalModuleAccess('documents', 'read'), listPortalKnowledgeArticles);
router.get('/knowledge-base/:id', requirePortalModuleAccess('documents', 'read'), getPortalKnowledgeArticle);

// Mailroom connector (M5) — portal-originated messages into the Mailroom pipeline
router.use('/mailroom', mailroomPortalIngestLimiter);
router.post(
  '/mailroom/ingest',
  requirePortalModuleAccess.any('cases', ['create', 'update']),
  ingestPortalMessage
);
router.post(
  '/mailroom/cases/:caseId/reply',
  requirePortalModuleAccess('cases', 'update'),
  replyToCaseFromPortal
);
router.post(
  '/mailroom/attachments',
  requirePortalModuleAccess('cases', 'update'),
  portalMailroomUploadMiddleware,
  uploadPortalAttachment
);
router.get(
  '/mailroom/conversations/:conversationId/attachments',
  requirePortalModuleAccess('cases', 'read'),
  listPortalConversationAttachments
);
router.get(
  '/mailroom/messages/:messageId/attachments',
  requirePortalModuleAccess('cases', 'read'),
  listPortalMessageAttachments
);
router.get(
  '/mailroom/attachments/:id/download',
  requirePortalModuleAccess('cases', 'read'),
  downloadMailroomAttachmentForPortal
);

// Catch-all handler for unknown portal routes (return 404, not 403)
// This prevents frontend routes like /portal/dashboard from being blocked by middleware
// Note: This must be the last route and uses a function to match any unmatched path
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Portal API endpoint not found',
        code: 'NOT_FOUND',
        path: req.originalUrl
    });
});

module.exports = router;

