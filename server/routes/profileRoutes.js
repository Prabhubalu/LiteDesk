const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { canManageRoles } = require('../middleware/permissionMiddleware');
const {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  cloneProfile
} = require('../controllers/profileController');

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/', canManageRoles(), listProfiles);
router.get('/:id', canManageRoles(), getProfile);
router.post('/', canManageRoles(), createProfile);
router.put('/:id', canManageRoles(), updateProfile);
router.delete('/:id', canManageRoles(), deleteProfile);
router.post('/:id/clone', canManageRoles(), cloneProfile);

module.exports = router;
