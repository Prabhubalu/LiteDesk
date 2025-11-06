const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin, requireMasterOrganization } = require('../middleware/permissionMiddleware');
const {
    submitDemoRequest,
    getDemoRequests,
    getDemoRequest,
    updateDemoRequest,
    convertToOrganization,
    deleteDemoRequest,
    getStats
} = require('../controllers/demoController');

// --- Public Routes ---
router.post('/request', submitDemoRequest);

// --- Protected Routes (Master Organization Only) ---
// Only application owner (LiteDesk Master organization) can access these
router.get('/requests', protect, requireAdmin(), requireMasterOrganization(), getDemoRequests);
router.get('/requests/stats', protect, requireAdmin(), requireMasterOrganization(), getStats);
router.get('/requests/:id', protect, requireAdmin(), requireMasterOrganization(), getDemoRequest);
router.patch('/requests/:id', protect, requireAdmin(), requireMasterOrganization(), updateDemoRequest);
router.post('/requests/:id/convert', protect, requireAdmin(), requireMasterOrganization(), convertToOrganization);
router.delete('/requests/:id', protect, requireAdmin(), requireMasterOrganization(), deleteDemoRequest);

module.exports = router;

