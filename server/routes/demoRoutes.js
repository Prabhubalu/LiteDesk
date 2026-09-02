const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin, requireMasterOrganization } = require('../middleware/permissionMiddleware');
const { authTokenActionLimiter } = require('../middleware/rateLimitMiddleware');
const {
    submitDemoRequest,
    verifyDemoEmail,
    resendDemoVerification,
    getDemoSetupSession,
    getDemoVerticalPreview,
    completeDemoSetup,
    getDemoRequests,
    getDemoRequest,
    updateDemoRequest,
    previewDemoConversion,
    convertToOrganization,
    resendDemoActivation,
    deleteDemoRequest,
    getStats
} = require('../controllers/demoController');

// --- Public Routes ---
router.post('/request', submitDemoRequest);
router.get('/verify-email', authTokenActionLimiter, verifyDemoEmail);
router.post('/verify-email', authTokenActionLimiter, verifyDemoEmail);
router.post('/resend-verification', authTokenActionLimiter, resendDemoVerification);
router.get('/setup/session', authTokenActionLimiter, getDemoSetupSession);
router.get('/vertical-preview', getDemoVerticalPreview);
router.post('/setup/complete', authTokenActionLimiter, completeDemoSetup);

// --- Protected Routes (Master Organization Only) ---
// Only application owner (Arivu Master organization) can access these
router.get('/requests', protect, requireAdmin(), requireMasterOrganization(), getDemoRequests);
router.get('/requests/stats', protect, requireAdmin(), requireMasterOrganization(), getStats);
router.get('/requests/:id', protect, requireAdmin(), requireMasterOrganization(), getDemoRequest);
router.patch('/requests/:id', protect, requireAdmin(), requireMasterOrganization(), updateDemoRequest);
router.get('/requests/:id/preview', protect, requireAdmin(), requireMasterOrganization(), previewDemoConversion);
router.post('/requests/:id/convert', protect, requireAdmin(), requireMasterOrganization(), convertToOrganization);
router.post('/requests/:id/resend-activation', protect, requireAdmin(), requireMasterOrganization(), resendDemoActivation);
router.delete('/requests/:id', protect, requireAdmin(), requireMasterOrganization(), deleteDemoRequest);

module.exports = router;

