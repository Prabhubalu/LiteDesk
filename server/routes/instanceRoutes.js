const express = require('express');
const router = express.Router();
const {
    getAllInstances,
    getInstanceDetails,
    updateInstanceStatus,
    updateInstanceSubscription,
    updateInstanceHealth,
    getInstanceAnalytics,
    deleteInstance
} = require('../controllers/instanceController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin, requireOwner } = require('../middleware/permissionMiddleware');

// All routes require authentication and owner/admin role
router.use(protect);

// Get all instances (with filters)
router.get('/', requireAdmin(), getAllInstances);

// Get analytics
router.get('/analytics', requireAdmin(), getInstanceAnalytics);

// Get single instance details
router.get('/:id', requireAdmin(), getInstanceDetails);

// Update instance status
router.patch('/:id/status', requireAdmin(), updateInstanceStatus);

// Update instance subscription
router.patch('/:id/subscription', requireAdmin(), updateInstanceSubscription);

// Update instance health (typically called by monitoring service)
router.patch('/:id/health', updateInstanceHealth);

// Delete/Terminate instance (Owner only)
router.delete('/:id', requireOwner(), deleteInstance);

module.exports = router;

