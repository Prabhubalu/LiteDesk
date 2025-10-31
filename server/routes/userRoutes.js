const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { canManageUsers } = require('../middleware/permissionMiddleware');
const {
    getUsers,
    getUsersForAssignment,
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

// --- Public user list for assignments (any authenticated user can see org users) ---
// IMPORTANT: Must be before /:id route to avoid route conflict
// Using exact path matching to ensure "list" doesn't get caught by /:id
router.get('/list', (req, res, next) => {
    // Explicitly handle /list route
    getUsersForAssignment(req, res).catch(next);
});

// --- User Management Routes (requires manageUsers permission) ---
router.get('/', canManageUsers(), getUsers);
router.post('/', canManageUsers(), inviteUser);

// --- Single User Routes (requires manageUsers permission) ---
// IMPORTANT: Must be after /list route - validate that id is a valid ObjectId
router.get('/:id', canManageUsers(), async (req, res, next) => {
    // Check if id looks like a MongoDB ObjectId (24 hex characters)
    // If not, skip to next route (shouldn't happen as we have /list above, but safety check)
    const { id } = req.params;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid user ID format'
        });
    }
    next();
}, getUser);

router.put('/:id', canManageUsers(), updateUser);
router.post('/:id/reset-password', canManageUsers(), resetUserPassword);
router.delete('/:id', canManageUsers(), deleteUser);

module.exports = router;

