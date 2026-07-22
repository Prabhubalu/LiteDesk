const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const controller = require('../controllers/groupController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

// Apply auth and organization middleware to all routes
// Groups & Teams is platform-level, NOT app-specific
// These routes do NOT require app context, app entitlement, or app-specific initialization
router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(createSettingsAuditMiddleware({ surface: 'groups', entityType: 'Group' }));

router.post('/', controller.create);
router.get('/', controller.list);

// Member management (before /:id route)
router.post('/:id/members', controller.addMember);
router.delete('/:id/members', controller.removeMember);

// Activity logs (before /:id route)
router.get('/:id/activity-logs', controller.getActivityLogs);

router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;

