const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/permissionMiddleware');
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

// --- Protected Routes (Admin/Owner Only) ---
router.get('/requests', protect, requireAdmin(), getDemoRequests);
router.get('/requests/stats', protect, requireAdmin(), getStats);
router.get('/requests/:id', protect, requireAdmin(), getDemoRequest);
router.patch('/requests/:id', protect, requireAdmin(), updateDemoRequest);
router.post('/requests/:id/convert', protect, requireAdmin(), convertToOrganization);
router.delete('/requests/:id', protect, requireAdmin(), deleteDemoRequest);

module.exports = router;

