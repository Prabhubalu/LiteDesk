const express = require('express');
const router = express.Router();
const {
    getAggregatedMetrics,
    collectInstanceMetrics,
    collectAllMetrics
} = require('../controllers/metricsController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/permissionMiddleware');

// All routes require authentication and owner/admin role
router.use(protect);

// Get aggregated metrics
router.get('/aggregated', requireAdmin(), getAggregatedMetrics);

// Collect metrics for a specific instance
router.post('/collect/:id', requireAdmin(), collectInstanceMetrics);

// Collect metrics for all instances
router.post('/collect-all', requireAdmin(), collectAllMetrics);

module.exports = router;

