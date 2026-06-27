const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { canManageRoles } = require('../middleware/permissionMiddleware');
const {
    getRoles,
    getRole,
    getRoleHierarchy,
    getExternalRoles,
    createRole,
    updateRole,
    moveRole,
    deleteRole,
    getPermissionModules,
    initializeDefaultRoles,
    seedRolesForOrganization,
    seedExternalRoles
} = require('../controllers/roleController');

// Apply auth and organization middleware to all routes
// Roles & Permissions is platform-level, NOT app-specific
// These routes do NOT require app context, app entitlement, or app-specific initialization
router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);

// Public routes (any authenticated user can view roles)
router.get('/modules', getPermissionModules);
router.get('/external', getExternalRoles);
router.get('/hierarchy', getRoleHierarchy);
router.get('/', getRoles);
router.get('/:id', getRole);

// Protected routes (requires manageRoles permission)
router.post('/', canManageRoles(), createRole);
router.post('/initialize', canManageRoles(), initializeDefaultRoles);
router.post('/seed', canManageRoles(), seedRolesForOrganization);
router.post('/seed-external', canManageRoles(), seedExternalRoles);
router.patch('/:id/move', canManageRoles(), moveRole);
router.put('/:id', canManageRoles(), updateRole);
router.delete('/:id', canManageRoles(), deleteRole);

module.exports = router;

