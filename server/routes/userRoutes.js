const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { canManageUsers } = require('../middleware/permissionMiddleware');
const {
    getUsers,
    getUser,
    inviteUser,
    updateUser,
    deleteUser,
    getProfile,
    updateProfile,
    changePassword,
    resetUserPassword
} = require('../controllers/userController');

// Apply auth and organization middleware to all routes
router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

// --- Profile Routes (any authenticated user) ---
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/profile/password', changePassword);

// --- User Management Routes (requires manageUsers permission) ---
router.get('/', canManageUsers(), getUsers);
router.post('/', canManageUsers(), inviteUser);
router.get('/:id', canManageUsers(), getUser);
router.put('/:id', canManageUsers(), updateUser);
router.post('/:id/reset-password', canManageUsers(), resetUserPassword);
router.delete('/:id', canManageUsers(), deleteUser);

module.exports = router;

