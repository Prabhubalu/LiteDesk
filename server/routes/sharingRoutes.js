const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { canManageRoles } = require('../middleware/permissionMiddleware');
const {
  listSharingDefaults,
  updateSharingDefault,
  seedSharingDefaults,
  listSharingRules,
  createSharingRule,
  updateSharingRule,
  deleteSharingRule
} = require('../controllers/sharingController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(createSettingsAuditMiddleware({ surface: 'sharing' }));

router.get('/defaults', canManageRoles(), listSharingDefaults);
router.put('/defaults/:appKey/:moduleKey', canManageRoles(), updateSharingDefault);
router.post('/defaults/seed', canManageRoles(), seedSharingDefaults);

router.get('/rules', canManageRoles(), listSharingRules);
router.post('/rules', canManageRoles(), createSharingRule);
router.put('/rules/:id', canManageRoles(), updateSharingRule);
router.delete('/rules/:id', canManageRoles(), deleteSharingRule);

module.exports = router;
