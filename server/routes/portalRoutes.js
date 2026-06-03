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
 * - No CRM permissions required
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
  replyPortalCase
} = require('../controllers/portalCaseController');
const {
  listPortalInvoicesHandler,
  getPortalPayEligibilityHandler,
  startPortalPayHandler,
  getPortalPaymentSessionStatusHandler
} = require('../controllers/portalPaymentController');
const { mailroomPortalIngestLimiter } = require('../middleware/rateLimitMiddleware');

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

// Audit endpoints (customer-safe)
router.get('/audits', listAudits); // List audits
router.get('/audits/:eventId', getAuditDetail); // Audit detail

// Corrective actions endpoints
router.get('/actions', listCorrectiveActions); // List corrective actions
router.post('/actions/:actionId/evidence', uploadMiddleware, uploadEvidence); // Upload evidence

// Helpdesk cases (Phase 1D) — customer-scoped case APIs
router.get('/cases', listPortalCases);
router.post('/cases', createPortalCase);
router.get('/cases/:id', getPortalCase);
router.post('/cases/:id/reply', mailroomPortalIngestLimiter, replyPortalCase);

// Online payments (PAY3.1) — reuses PaymentGatewaySession
router.get('/invoices', listPortalInvoicesHandler);
router.get('/invoices/:id/pay-eligibility', getPortalPayEligibilityHandler);
router.post('/invoices/:id/pay', startPortalPayHandler);
router.get('/payment-sessions/:id/status', getPortalPaymentSessionStatusHandler);

// Mailroom connector (M5) — portal-originated messages into the Mailroom pipeline
router.use('/mailroom', mailroomPortalIngestLimiter);
router.post('/mailroom/ingest', ingestPortalMessage);
router.post('/mailroom/cases/:caseId/reply', replyToCaseFromPortal);
router.post('/mailroom/attachments', portalMailroomUploadMiddleware, uploadPortalAttachment);
router.get('/mailroom/conversations/:conversationId/attachments', listPortalConversationAttachments);
router.get('/mailroom/messages/:messageId/attachments', listPortalMessageAttachments);
router.get('/mailroom/attachments/:id/download', downloadMailroomAttachmentForPortal);

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

