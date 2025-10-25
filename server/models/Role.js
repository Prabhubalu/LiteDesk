const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isSystemRole: {
        type: Boolean,
        default: false // System roles (Owner, Admin) cannot be deleted
    },
    level: {
        type: Number,
        default: 0 // For hierarchy: 0 = top level, higher number = lower in hierarchy
    },
    parentRole: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        default: null // For organizational hierarchy
    },
    
    // Module Permissions - CRUD for each module
    permissions: {
        // Contacts Module
        contacts: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            export: { type: Boolean, default: false },
            import: { type: Boolean, default: false },
            scope: { 
                type: String, 
                enum: ['all', 'team', 'own', 'none'], 
                default: 'own' 
            }
        },
        
        // Organizations Module
        organizations: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            export: { type: Boolean, default: false },
            import: { type: Boolean, default: false },
            scope: { 
                type: String, 
                enum: ['all', 'team', 'own', 'none'], 
                default: 'own' 
            }
        },
        
        // Deals Module
        deals: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            export: { type: Boolean, default: false },
            import: { type: Boolean, default: false },
            scope: { 
                type: String, 
                enum: ['all', 'team', 'own', 'none'], 
                default: 'own' 
            }
        },
        
        // Tasks Module
        tasks: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            export: { type: Boolean, default: false },
            scope: { 
                type: String, 
                enum: ['all', 'team', 'own', 'none'], 
                default: 'own' 
            }
        },
        
        // Events Module
        events: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            scope: { 
                type: String, 
                enum: ['all', 'team', 'own', 'none'], 
                default: 'own' 
            }
        },
        
        // Reports Module
        reports: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            export: { type: Boolean, default: false }
        },
        
        // Users Module (User Management)
        users: {
            create: { type: Boolean, default: false },
            read: { type: Boolean, default: false },
            update: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            manageRoles: { type: Boolean, default: false }
        },
        
        // Settings Module
        settings: {
            view: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            manageRoles: { type: Boolean, default: false },
            manageBilling: { type: Boolean, default: false }
        }
    },
    
    // Additional Settings
    canViewAllData: {
        type: Boolean,
        default: false
    },
    canManageTeam: {
        type: Boolean,
        default: false
    },
    canExportData: {
        type: Boolean,
        default: false
    },
    
    // Metadata
    color: {
        type: String,
        default: '#6366f1' // For visual hierarchy display
    },
    icon: {
        type: String,
        default: 'user' // Icon identifier for UI
    },
    userCount: {
        type: Number,
        default: 0 // Track how many users have this role
    }
}, {
    timestamps: true
});

// Compound index for uniqueness within organization
roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

// Pre-save middleware to set level based on parent
roleSchema.pre('save', async function(next) {
    if (this.parentRole && this.isModified('parentRole')) {
        const parent = await this.constructor.findById(this.parentRole);
        if (parent) {
            this.level = parent.level + 1;
        }
    }
    next();
});

// Instance method to check if role has specific permission
roleSchema.methods.hasPermission = function(module, action) {
    if (!this.permissions[module]) return false;
    return this.permissions[module][action] === true;
};

// Static method to get role hierarchy
roleSchema.statics.getHierarchy = async function(organizationId) {
    const roles = await this.find({ organizationId }).sort({ level: 1, name: 1 });
    
    // Build tree structure
    const roleMap = {};
    const rootRoles = [];
    
    roles.forEach(role => {
        roleMap[role._id] = { ...role.toObject(), children: [] };
    });
    
    roles.forEach(role => {
        if (role.parentRole && roleMap[role.parentRole]) {
            roleMap[role.parentRole].children.push(roleMap[role._id]);
        } else {
            rootRoles.push(roleMap[role._id]);
        }
    });
    
    return rootRoles;
};

// Static method to create default roles for new organization
roleSchema.statics.createDefaultRoles = async function(organizationId) {
    const defaultRoles = [
        {
            organizationId,
            name: 'Owner',
            description: 'Full system access with all permissions',
            isSystemRole: true,
            level: 0,
            color: '#9333ea',
            icon: 'crown',
            permissions: {
                contacts: { create: true, read: true, update: true, delete: true, export: true, import: true, scope: 'all' },
                organizations: { create: true, read: true, update: true, delete: true, export: true, import: true, scope: 'all' },
                deals: { create: true, read: true, update: true, delete: true, export: true, import: true, scope: 'all' },
                tasks: { create: true, read: true, update: true, delete: true, export: true, scope: 'all' },
                events: { create: true, read: true, update: true, delete: true, scope: 'all' },
                reports: { create: true, read: true, update: true, delete: true, export: true },
                users: { create: true, read: true, update: true, delete: true, manageRoles: true },
                settings: { view: true, edit: true, manageRoles: true, manageBilling: true }
            },
            canViewAllData: true,
            canManageTeam: true,
            canExportData: true
        },
        {
            organizationId,
            name: 'Admin',
            description: 'Administrative access with most permissions',
            isSystemRole: true,
            level: 1,
            color: '#ef4444',
            icon: 'shield',
            permissions: {
                contacts: { create: true, read: true, update: true, delete: true, export: true, import: true, scope: 'all' },
                organizations: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'all' },
                deals: { create: true, read: true, update: true, delete: true, export: true, import: true, scope: 'all' },
                tasks: { create: true, read: true, update: true, delete: true, export: true, scope: 'all' },
                events: { create: true, read: true, update: true, delete: true, scope: 'all' },
                reports: { create: true, read: true, update: true, delete: false, export: true },
                users: { create: true, read: true, update: true, delete: false, manageRoles: false },
                settings: { view: true, edit: true, manageRoles: false, manageBilling: false }
            },
            canViewAllData: true,
            canManageTeam: true,
            canExportData: true
        },
        {
            organizationId,
            name: 'Manager',
            description: 'Team management with team-level access',
            isSystemRole: false,
            level: 2,
            color: '#3b82f6',
            icon: 'users',
            permissions: {
                contacts: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'team' },
                organizations: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'team' },
                deals: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'team' },
                tasks: { create: true, read: true, update: true, delete: false, export: true, scope: 'team' },
                events: { create: true, read: true, update: true, delete: false, scope: 'team' },
                reports: { create: false, read: true, update: false, delete: false, export: true },
                users: { create: false, read: true, update: false, delete: false, manageRoles: false },
                settings: { view: false, edit: false, manageRoles: false, manageBilling: false }
            },
            canViewAllData: false,
            canManageTeam: true,
            canExportData: true
        },
        {
            organizationId,
            name: 'User',
            description: 'Standard user with own record access',
            isSystemRole: false,
            level: 3,
            color: '#10b981',
            icon: 'user',
            permissions: {
                contacts: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
                organizations: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
                deals: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
                tasks: { create: true, read: true, update: true, delete: false, export: false, scope: 'own' },
                events: { create: true, read: true, update: true, delete: false, scope: 'own' },
                reports: { create: false, read: true, update: false, delete: false, export: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                settings: { view: false, edit: false, manageRoles: false, manageBilling: false }
            },
            canViewAllData: false,
            canManageTeam: false,
            canExportData: false
        },
        {
            organizationId,
            name: 'Viewer',
            description: 'Read-only access to assigned records',
            isSystemRole: false,
            level: 4,
            color: '#6b7280',
            icon: 'eye',
            permissions: {
                contacts: { create: false, read: true, update: false, delete: false, export: false, import: false, scope: 'own' },
                organizations: { create: false, read: true, update: false, delete: false, export: false, import: false, scope: 'own' },
                deals: { create: false, read: true, update: false, delete: false, export: false, import: false, scope: 'own' },
                tasks: { create: false, read: true, update: false, delete: false, export: false, scope: 'own' },
                events: { create: false, read: true, update: false, delete: false, scope: 'own' },
                reports: { create: false, read: true, update: false, delete: false, export: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                settings: { view: false, edit: false, manageRoles: false, manageBilling: false }
            },
            canViewAllData: false,
            canManageTeam: false,
            canExportData: false
        }
    ];
    
    return await this.insertMany(defaultRoles);
};

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;

