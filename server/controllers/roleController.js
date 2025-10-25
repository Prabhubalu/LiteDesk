const Role = require('../models/Role');

// Get all roles for organization
exports.getRoles = async (req, res) => {
    try {
        const roles = await Role.find({ 
            organizationId: req.user.organizationId 
        })
        .populate('parentRole', 'name')
        .sort({ level: 1, name: 1 });

        res.json({
            success: true,
            data: roles,
            total: roles.length
        });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching roles',
            error: error.message
        });
    }
};

// Get role hierarchy tree
exports.getRoleHierarchy = async (req, res) => {
    try {
        const hierarchy = await Role.getHierarchy(req.user.organizationId);

        res.json({
            success: true,
            data: hierarchy
        });
    } catch (error) {
        console.error('Get role hierarchy error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching role hierarchy',
            error: error.message
        });
    }
};

// Get single role
exports.getRole = async (req, res) => {
    try {
        const role = await Role.findOne({ 
            _id: req.params.id,
            organizationId: req.user.organizationId 
        }).populate('parentRole', 'name');

        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        res.json({
            success: true,
            data: role
        });
    } catch (error) {
        console.error('Get role error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching role',
            error: error.message
        });
    }
};

// Create new role
exports.createRole = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            parentRole, 
            permissions,
            color,
            icon,
            canViewAllData,
            canManageTeam,
            canExportData
        } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({ 
                success: false,
                message: 'Role name is required' 
            });
        }

        // Check if role with same name already exists
        const existingRole = await Role.findOne({ 
            organizationId: req.user.organizationId,
            name: name.trim()
        });

        if (existingRole) {
            return res.status(409).json({ 
                success: false,
                message: 'A role with this name already exists' 
            });
        }

        // Create new role
        const newRole = await Role.create({
            organizationId: req.user.organizationId,
            name: name.trim(),
            description,
            parentRole: parentRole || null,
            permissions: permissions || {},
            color: color || '#6366f1',
            icon: icon || 'user',
            canViewAllData: canViewAllData || false,
            canManageTeam: canManageTeam || false,
            canExportData: canExportData || false,
            isSystemRole: false
        });

        await newRole.populate('parentRole', 'name');

        res.status(201).json({
            success: true,
            data: newRole,
            message: 'Role created successfully'
        });

    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error creating role',
            error: error.message
        });
    }
};

// Update role
exports.updateRole = async (req, res) => {
    try {
        const role = await Role.findOne({ 
            _id: req.params.id,
            organizationId: req.user.organizationId 
        });

        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        // Prevent modifying system roles' core properties
        if (role.isSystemRole && (req.body.name || req.body.isSystemRole !== undefined)) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot modify system role name or status',
                code: 'CANNOT_MODIFY_SYSTEM_ROLE'
            });
        }

        // Update fields
        const allowedUpdates = [
            'description', 
            'parentRole', 
            'permissions', 
            'color', 
            'icon',
            'canViewAllData',
            'canManageTeam',
            'canExportData'
        ];

        if (!role.isSystemRole) {
            allowedUpdates.push('name');
        }

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                role[field] = req.body[field];
            }
        });

        await role.save();
        await role.populate('parentRole', 'name');

        res.json({
            success: true,
            data: role,
            message: 'Role updated successfully'
        });

    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating role',
            error: error.message
        });
    }
};

// Delete role
exports.deleteRole = async (req, res) => {
    try {
        const role = await Role.findOne({ 
            _id: req.params.id,
            organizationId: req.user.organizationId 
        });

        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        // Prevent deleting system roles
        if (role.isSystemRole) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot delete system roles',
                code: 'CANNOT_DELETE_SYSTEM_ROLE'
            });
        }

        // Check if any users have this role
        const User = require('../models/User');
        const usersWithRole = await User.countDocuments({ 
            organizationId: req.user.organizationId,
            roleId: role._id
        });

        if (usersWithRole > 0) {
            return res.status(409).json({ 
                success: false,
                message: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role`,
                code: 'ROLE_IN_USE',
                userCount: usersWithRole
            });
        }

        // Check if any roles have this as parent
        const childRoles = await Role.countDocuments({
            organizationId: req.user.organizationId,
            parentRole: role._id
        });

        if (childRoles > 0) {
            return res.status(409).json({ 
                success: false,
                message: `Cannot delete role. ${childRoles} child role(s) depend on this role`,
                code: 'HAS_CHILD_ROLES',
                childCount: childRoles
            });
        }

        await role.deleteOne();

        res.json({
            success: true,
            message: 'Role deleted successfully'
        });

    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting role',
            error: error.message
        });
    }
};

// Get available permission modules
exports.getPermissionModules = async (req, res) => {
    try {
        const modules = [
            {
                key: 'contacts',
                label: 'Contacts',
                description: 'Manage customer contacts and leads',
                actions: ['create', 'read', 'update', 'delete', 'export', 'import'],
                hasScope: true
            },
            {
                key: 'organizations',
                label: 'Organizations',
                description: 'Manage companies and accounts',
                actions: ['create', 'read', 'update', 'delete', 'export', 'import'],
                hasScope: true
            },
            {
                key: 'deals',
                label: 'Deals',
                description: 'Manage sales opportunities and pipeline',
                actions: ['create', 'read', 'update', 'delete', 'export', 'import'],
                hasScope: true
            },
            {
                key: 'tasks',
                label: 'Tasks',
                description: 'Manage tasks and activities',
                actions: ['create', 'read', 'update', 'delete', 'export'],
                hasScope: true
            },
            {
                key: 'events',
                label: 'Events',
                description: 'Manage calendar and events',
                actions: ['create', 'read', 'update', 'delete'],
                hasScope: true
            },
            {
                key: 'reports',
                label: 'Reports',
                description: 'View and create reports',
                actions: ['create', 'read', 'update', 'delete', 'export'],
                hasScope: false
            },
            {
                key: 'users',
                label: 'User Management',
                description: 'Manage users and permissions',
                actions: ['create', 'read', 'update', 'delete', 'manageRoles'],
                hasScope: false
            },
            {
                key: 'settings',
                label: 'Settings',
                description: 'System configuration and settings',
                actions: ['view', 'edit', 'manageRoles', 'manageBilling'],
                hasScope: false
            }
        ];

        res.json({
            success: true,
            data: modules
        });
    } catch (error) {
        console.error('Get permission modules error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching permission modules',
            error: error.message
        });
    }
};

// Initialize default roles for organization (admin only)
exports.initializeDefaultRoles = async (req, res) => {
    try {
        // Check if roles already exist
        const existingRoles = await Role.countDocuments({ 
            organizationId: req.user.organizationId 
        });

        if (existingRoles > 0) {
            return res.status(409).json({ 
                success: false,
                message: 'Roles already initialized for this organization' 
            });
        }

        const roles = await Role.createDefaultRoles(req.user.organizationId);

        res.status(201).json({
            success: true,
            data: roles,
            message: 'Default roles created successfully'
        });

    } catch (error) {
        console.error('Initialize roles error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error initializing default roles',
            error: error.message
        });
    }
};

