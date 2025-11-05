const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GroupSchema = new Schema({
    // Multi-tenancy
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    
    // Core Information
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    
    // Group Type (optional: 'Team', 'Department', 'Project Team', etc.)
    type: {
        type: String,
        enum: ['Team', 'Department', 'Project', 'Custom'],
        default: 'Team'
    },
    
    // Members - array of User references
    members: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Group Lead/Manager
    lead: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    
    // Role & Permissions - Assign multiple roles to this group
    roleIds: [{
        type: Schema.Types.ObjectId,
        ref: 'Role'
    }],
    
    // Metadata
    color: {
        type: String,
        default: '#3B82F6', // Default blue
        trim: true
    },
    icon: {
        type: String,
        default: 'users',
        trim: true
    },
    
    // Activity Logs
    activityLogs: [{
        user: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        action: { type: String, required: true },
        details: { type: Schema.Types.Mixed },
        timestamp: { type: Date, default: Date.now, required: true }
    }],
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Created/Updated tracking
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound index for organization + name (unique within organization)
GroupSchema.index({ organizationId: 1, name: 1 }, { unique: true });

// Index for members (for efficient queries)
GroupSchema.index({ organizationId: 1, members: 1 });

// Virtual for member count
GroupSchema.virtual('memberCount').get(function() {
    return this.members ? this.members.length : 0;
});

// Ensure virtuals are included in JSON output
GroupSchema.set('toJSON', { virtuals: true });
GroupSchema.set('toObject', { virtuals: true });

// Helper method to add member
GroupSchema.methods.addMember = function(userId) {
    if (!this.members.includes(userId)) {
        this.members.push(userId);
        return true;
    }
    return false;
};

// Helper method to remove member
GroupSchema.methods.removeMember = function(userId) {
    const index = this.members.indexOf(userId);
    if (index > -1) {
        this.members.splice(index, 1);
        return true;
    }
    return false;
};

// Helper method to add activity log
GroupSchema.methods.addActivityLog = function(user, userId, action, details) {
    this.activityLogs.push({
        user,
        userId,
        action,
        details: details || {},
        timestamp: new Date()
    });
};

module.exports = mongoose.model('Group', GroupSchema);

