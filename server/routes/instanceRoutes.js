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
const { requireAdmin, requireOwner, requireMasterOrganization } = require('../middleware/permissionMiddleware');

// All routes require authentication and owner/admin role
router.use(protect);

// Get all instances (with filters) - Master organization only
router.get('/', requireAdmin(), requireMasterOrganization(), getAllInstances);

// Get analytics - Master organization only
router.get('/analytics', requireAdmin(), requireMasterOrganization(), getInstanceAnalytics);

// Get single instance details - Master organization only
router.get('/:id', requireAdmin(), requireMasterOrganization(), getInstanceDetails);

// Update instance status - Master organization only
router.patch('/:id/status', requireAdmin(), requireMasterOrganization(), updateInstanceStatus);

// Update instance subscription - Master organization only
router.patch('/:id/subscription', requireAdmin(), requireMasterOrganization(), updateInstanceSubscription);

// Update instance health (typically called by monitoring service)
router.patch('/:id/health', updateInstanceHealth);

// Delete/Terminate instance (Owner only)
router.delete('/:id', requireOwner(), deleteInstance);

module.exports = router;

