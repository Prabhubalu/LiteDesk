const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // Organization Reference (Multi-tenancy)
    organizationId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Organization',
        required: true,
        index: true
    },
    
    // Basic Information
    username: { 
        type: String, 
        required: true
    },
    email: { 
        type: String, 
        required: true,
        lowercase: true,
        trim: true
    },
    password: { 
        type: String, 
        required: true 
    },
    
    // Profile Information
    firstName: String,
    lastName: String,
    phoneNumber: String,
    avatar: String,
    
    // Role & Permissions (RBAC)
    // NEW: Dynamic Role System
    roleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        default: null
    },
    // OLD: Legacy string-based role (keeping for backward compatibility)
    role: { 
        type: String, 
        enum: ['owner', 'admin', 'manager', 'user', 'viewer'],
        default: 'user'
    },
    
    // Granular Permissions (can be customized per user)
    permissions: {
        contacts: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        deals: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        organizations: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: false },
            exportData: { type: Boolean, default: false }
        },
        projects: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true }
        },
        tasks: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: true },
            viewAll: { type: Boolean, default: true }
        },
        imports: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: false },
            delete: { type: Boolean, default: false }
        },
        settings: {
            manageUsers: { type: Boolean, default: false },
            manageBilling: { type: Boolean, default: false },
            manageIntegrations: { type: Boolean, default: false },
            customizeFields: { type: Boolean, default: false }
        },
        reports: {
            viewStandard: { type: Boolean, default: true },
            viewCustom: { type: Boolean, default: false },
            createCustom: { type: Boolean, default: false },
            exportReports: { type: Boolean, default: false }
        }
    },
    
    // Special Flags
    isOwner: { 
        type: Boolean, 
        default: false 
    },  // First user who created the organization
    
    // Status
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    
    // Activity Tracking
    lastLogin: Date,
    
    // Legacy field (keeping for backward compatibility, but not required anymore)
    vertical: String
}, { 
    timestamps: true 
});

// Compound index for organization + email (unique within organization)
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

// Helper method to set default permissions based on role
UserSchema.methods.setPermissionsByRole = function(role) {
    const rolePermissions = {
        owner: {
            contacts: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            deals: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            organizations: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            projects: { view: true, create: true, edit: true, delete: true, viewAll: true },
            tasks: { view: true, create: true, edit: true, delete: true, viewAll: true },
            imports: { view: true, create: true, delete: true },
            settings: { manageUsers: true, manageBilling: true, manageIntegrations: true, customizeFields: true },
            reports: { viewStandard: true, viewCustom: true, createCustom: true, exportReports: true }
        },
        admin: {
            contacts: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            deals: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            organizations: { view: true, create: true, edit: true, delete: false, viewAll: true, exportData: true },
            projects: { view: true, create: true, edit: true, delete: true, viewAll: true },
            tasks: { view: true, create: true, edit: true, delete: true, viewAll: true },
            imports: { view: true, create: true, delete: true },
            settings: { manageUsers: true, manageBilling: false, manageIntegrations: true, customizeFields: true },
            reports: { viewStandard: true, viewCustom: true, createCustom: true, exportReports: true }
        },
        manager: {
            contacts: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: false },
            deals: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: false },
            organizations: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            projects: { view: true, create: true, edit: true, delete: false, viewAll: true },
            tasks: { view: true, create: true, edit: true, delete: true, viewAll: true },
            imports: { view: true, create: true, delete: false },
            settings: { manageUsers: false, manageBilling: false, manageIntegrations: false, customizeFields: false },
            reports: { viewStandard: true, viewCustom: true, createCustom: false, exportReports: false }
        },
        user: {
            contacts: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            deals: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            organizations: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            projects: { view: true, create: true, edit: true, delete: false, viewAll: false },
            tasks: { view: true, create: true, edit: true, delete: true, viewAll: false },
            imports: { view: true, create: false, delete: false },
            settings: { manageUsers: false, manageBilling: false, manageIntegrations: false, customizeFields: false },
            reports: { viewStandard: true, viewCustom: false, createCustom: false, exportReports: false }
        },
        viewer: {
            contacts: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            deals: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            organizations: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            projects: { view: true, create: false, edit: false, delete: false, viewAll: false },
            tasks: { view: true, create: false, edit: false, delete: false, viewAll: false },
            imports: { view: true, create: false, delete: false },
            settings: { manageUsers: false, manageBilling: false, manageIntegrations: false, customizeFields: false },
            reports: { viewStandard: false, viewCustom: false, createCustom: false, exportReports: false }
        }
    };
    
    this.permissions = rolePermissions[role] || rolePermissions.user;
    return this.permissions;
};

// Helper method to check if user has a specific permission
UserSchema.methods.hasPermission = function(module, action) {
    return this.permissions?.[module]?.[action] || false;
};

// Helper method to get full name
UserSchema.methods.getFullName = function() {
    if (this.firstName && this.lastName) {
        return `${this.firstName} ${this.lastName}`;
    }
    return this.username;
};

module.exports = mongoose.model('User', UserSchema);