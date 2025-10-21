const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { canManageBilling, requireOwner } = require('../middleware/permissionMiddleware');
const {
    getOrganization,
    updateOrganization,
    getSubscription,
    upgradeSubscription,
    cancelSubscription,
    getStats
} = require('../controllers/organizationController');

// Apply auth and organization middleware to all routes
router.use(protect);
router.use(organizationIsolation);

// --- Organization Routes ---
router.get('/', getOrganization);
router.put('/', requireOwner(), updateOrganization);
router.get('/stats', getStats);

// --- Subscription Routes ---
router.get('/subscription', getSubscription);
router.post('/subscription/upgrade', canManageBilling(), upgradeSubscription);
router.post('/subscription/cancel', canManageBilling(), cancelSubscription);

module.exports = router;

