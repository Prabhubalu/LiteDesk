/**
 * Permission-based Access Control Middleware
 * Checks if user has specific permissions to perform actions
 */

const securityLogger = require('./securityLoggingMiddleware');

/**
 * Check if user has permission to perform an action on a module
 * Usage: checkPermission('contacts', 'create')
 */
const checkPermission = (module, action) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            // Owner always has all permissions
            if (user.isOwner) {
                return next();
            }

            // Normalize module aliases (people -> contacts)
            const normalizedModule = module === 'people' ? 'contacts' : module;
            
            // Admins have full access to settings area (UI configuration, modules & fields, etc.)
            if (normalizedModule === 'settings' && String(user.role || '').toLowerCase() === 'admin') {
                return next();
            }
            // Check if user has the specific permission
            const hasPermission = user.permissions?.[normalizedModule]?.[action];
            
            if (!hasPermission) {
                // Log permission denial
                securityLogger.logPermissionDenial(req, normalizedModule, action);
                
                return res.status(403).json({ 
                    message: `You don't have permission to ${action} ${module}`,
                    code: 'INSUFFICIENT_PERMISSIONS',
                    requiredPermission: { module: normalizedModule, action }
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ message: 'Server error during permission verification' });
        }
    };
};

/**
 * Check if user has a specific role (or higher in hierarchy)
 * Role hierarchy: owner > admin > manager > user > viewer
 * Usage: requireRole('admin') // allows owner and admin
 */
const requireRole = (requiredRole) => {
    const roleHierarchy = {
        'owner': 5,
        'admin': 4,
        'manager': 3,
        'user': 2,
        'viewer': 1
    };
    
    return async (req, res, next) => {
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const userRoleLevel = roleHierarchy[user.role] || 0;
            const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
            
            if (userRoleLevel < requiredRoleLevel) {
                return res.status(403).json({ 
                    message: `This action requires ${requiredRole} role or higher`,
                    code: 'INSUFFICIENT_ROLE',
                    userRole: user.role,
                    requiredRole: requiredRole
                });
            }

            next();
        } catch (error) {
            console.error('Role check error:', error);
            res.status(500).json({ message: 'Server error during role verification' });
        }
    };
};

/**
 * Check if user is owner or admin
 * Shorthand for common permission check
 */
const requireAdmin = () => {
    return requireRole('admin');
};

/**
 * Check if user is from the master organization (application owner)
 * Only master organization users can access platform management features
 * like demo requests, instances, etc.
 */
const requireMasterOrganization = () => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            // Get organization details
            const Organization = require('../models/Organization');
            const organization = await Organization.findById(user.organizationId);
            
            if (!organization) {
                return res.status(404).json({ message: 'Organization not found' });
            }

            // Check if this is the master organization
            const isMasterOrg = organization.name === 'LiteDesk Master';
            
            if (!isMasterOrg) {
                return res.status(403).json({ 
                    message: 'This feature is only available to the application owner',
                    code: 'MASTER_ORGANIZATION_REQUIRED'
                });
            }

            next();
        } catch (error) {
            console.error('Master organization check error:', error);
            res.status(500).json({ message: 'Server error during organization verification' });
        }
    };
};

/**
 * Check if user is the owner
 */
const requireOwner = () => {
    return requireRole('owner');
};

/**
 * Check if user can manage other users
 */
const canManageUsers = () => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) return res.status(401).json({ message: 'Authentication required' });
            if (user.isOwner || String(user.role || '').toLowerCase() === 'admin') {
                return next();
            }
            const mw = checkPermission('settings', 'manageUsers');
            return mw(req, res, next);
        } catch (e) {
            console.error('canManageUsers error:', e);
            return res.status(500).json({ message: 'Server error during permission verification' });
        }
    };
};

/**
 * Check if user can manage billing
 */
const canManageBilling = () => {
    return checkPermission('settings', 'manageBilling');
};

/**
 * Check if user can manage roles and permissions
 * For now, requires admin or owner role
 */
const canManageRoles = () => {
    return checkPermission('settings', 'manageRoles');
};

/**
 * Middleware to filter data based on viewAll permission
 * If user doesn't have viewAll, they can only see their own data
 */
const filterByOwnership = (module) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const normalizedModule = module === 'people' ? 'contacts' : module;
            // Owner and users with viewAll can see everything
            if (user.isOwner || user.permissions?.[normalizedModule]?.viewAll) {
                req.viewAll = true;
                return next();
            }

            // Others can only see data assigned to them
            req.viewAll = false;
            req.filterByUser = user._id;
            
            next();
        } catch (error) {
            console.error('Ownership filter error:', error);
            res.status(500).json({ message: 'Server error during ownership filtering' });
        }
    };
};

module.exports = {
    checkPermission,
    requireRole,
    requireAdmin,
    requireOwner,
    requireMasterOrganization,
    canManageUsers,
    canManageBilling,
    canManageRoles,
    filterByOwnership
};

