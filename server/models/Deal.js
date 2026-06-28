const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

// Deal Schema Definition
const DealSchema = new Schema({
    // 🏢 ORGANIZATION REFERENCE (Multi-tenancy)
    // **********************************
    organizationId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Organization',
        required: true,
        index: true
    },
    
    // 🎯 CORE DEAL INFORMATION
    // **********************************
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    amount: { 
        type: Number, 
        required: true,
        min: 0,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD',
        trim: true
    },
    pipeline: {
        type: String,
        trim: true,
        default: null
    },
    
    // 📊 SALES PIPELINE (config-driven; no hardcoded stages)
    // **********************************
    stage: {
        type: String,
        trim: true,
        required: true
    },
    /** Order within the same stage (for Kanban same-column reorder). Lower = higher in column. */
    stageOrder: {
        type: Number,
        default: 0
    },
    probability: {
        type: Number,
        min: 0,
        max: 100,
        default: 25 // Percentage probability of closing
    },
    
    // 📅 TIMING
    // **********************************
    expectedCloseDate: { 
        type: Date,
        required: true
    },
    actualCloseDate: { 
        type: Date 
    },
    
    // 🔗 RELATIONSHIPS
    // **********************************
    // Legacy relationship fields (maintained for backward compatibility)
    contactId: {
        type: Schema.Types.ObjectId,
        ref: 'People',
        index: true
    },
    accountId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization'
    },
    
    // Role-based relationships (additive, supports multiple contacts/orgs with roles)
    dealPeople: [{
        personId: {
            type: Schema.Types.ObjectId,
            ref: 'People',
            required: true
        },
        role: {
            type: String,
            trim: true,
            required: true
            // e.g., 'primary_contact', 'decision_maker', 'influencer', 'partner_contact'
        },
        isPrimary: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    
    dealOrganizations: [{
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        role: {
            type: String,
            trim: true,
            required: true
            // e.g., 'customer', 'partner', 'reseller'
        },
        isPrimary: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // 📝 DETAILS
    // **********************************
    description: { 
        type: String, 
        trim: true 
    },
    descriptionVersions: [{
        content: {
            type: String,
            default: ''
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    type: {
        type: String,
        enum: ['New Business', 'Existing Customer', 'Existing Business', 'Upsell', 'Renewal', 'Cross-Sell', null],
        default: null
    },
    source: {
        type: String,
        enum: RECORD_SOURCE_VALUES,
        default: DEFAULT_RECORD_SOURCE
    },
    nextStep: {
        type: String,
        trim: true,
        default: ''
    },
    
    // 💾 METADATA
    // **********************************
    status: {
        type: String,
        enum: ['Open', 'Won', 'Lost', 'Stalled', 'Active', 'Abandoned'],
        default: 'Open'
    },
    
    // Derived Status (computed from Configuration Registry)
    // This field is computed from lifecycle mappings and is nullable
    // If no config exists or computation fails, this remains null
    derivedStatus: {
        type: String,
        trim: true,
        default: null,
        index: true
    },
    lostReason: {
        type: String,
        trim: true
    },
    tags: [{ type: String, trim: true }],
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    
    // 📈 TRACKING
    // **********************************
    lastActivityDate: { 
        type: Date,
        default: Date.now
    },
    nextFollowUpDate: { 
        type: Date 
    },
    stageHistory: [{
        stage: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    }],
    playbookState: {
        stageKey: { type: String, default: null },
        stageName: { type: String, default: null },
        pipelineKey: { type: String, default: null },
        startedAt: { type: Date, default: null },
        mode: { type: String, enum: ['sequential', 'non_sequential'], default: 'non_sequential' },
        exitCriteriaType: { type: String, default: null },
        exitCriteriaCustomDescription: { type: String, default: '' },
        exitCriteriaMet: { type: Boolean, default: false },
        exitCriteriaMetAt: { type: Date, default: null },
        autoAdvanceEnabled: { type: Boolean, default: false },
        autoAdvancedAt: { type: Date, default: null },
        autoAdvancedToStageKey: { type: String, default: null },
        actions: [{
            actionKey: { type: String, required: true },
            title: { type: String, default: '' },
            actionType: { type: String, default: 'task' },
            dueAt: { type: Date, default: null },
            required: { type: Boolean, default: true },
            status: { type: String, enum: ['pending', 'completed', 'blocked'], default: 'pending' },
            completedAt: { type: Date, default: null },
            dependencies: [{ type: String }],
            blockedBy: [{ type: String }],
            createdActivityId: { type: Schema.Types.ObjectId, default: null },
            createdActivityType: { type: String, enum: ['task', 'event', null], default: null },
            resources: [{
                name: { type: String, default: '' },
                type: { type: String, default: 'document' },
                url: { type: String, default: '' },
                description: { type: String, default: '' }
            }]
        }],
        executionLog: [{
            stageKey: { type: String, required: true },
            actionKey: { type: String, required: true },
            createdActivityId: { type: Schema.Types.ObjectId, default: null },
            createdActivityType: { type: String, default: null },
            createdAt: { type: Date, default: Date.now }
        }]
    },
    
    // 💬 NOTES & ACTIVITIES
    // **********************************
    notes: [{
        text: { type: String, required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        createdAt: { type: Date, default: Date.now },
        editedAt: { type: Date, default: null },
        editedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
    }],
    activityLogs: [{
        user: { type: String, required: true },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        action: { type: String, required: true },
        details: { type: Schema.Types.Mixed },
        timestamp: {
            type: Date,
            default: Date.now,
            required: true
        }
    }],
    lineItems: {
        type: Schema.Types.Mixed,
        default: []
    },
    
    // 🔧 CUSTOM FIELDS
    // **********************************
    customFields: { 
        type: Schema.Types.Mixed, 
        default: {} 
    },
    
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    modifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    // Trash (soft delete) - See docs/TRASH_IMPLEMENTATION_SPEC.md
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletionReason: { type: String, trim: true, maxlength: 500 },
    importHistoryId: { type: Schema.Types.ObjectId, ref: 'ImportHistory', default: null, index: true }

}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Compound index for organization
DealSchema.index({ organizationId: 1, stage: 1 });
DealSchema.index({ organizationId: 1, assignedTo: 1 });
DealSchema.index({ organizationId: 1, status: 1 });
DealSchema.index({ organizationId: 1, expectedCloseDate: 1 });
DealSchema.index({ organizationId: 1, deletedAt: 1 });
DealSchema.index({ organizationId: 1, importHistoryId: 1 });

// Virtual for weighted value (amount * probability)
DealSchema.virtual('weightedValue').get(function() {
    return (this.amount * this.probability) / 100;
});

// Method to check if deal is overdue
DealSchema.methods.isOverdue = function() {
    if (this.status !== 'Open') return false;
    if (!this.expectedCloseDate) return false;
    return new Date() > this.expectedCloseDate;
};

// Method to advance stage
// Stage progression is config-driven (pipeline + stages). No hardcoded stages.
// When using config, advance by setting stage via API; this method is retained for compatibility.
DealSchema.methods.advanceStage = async function(userId) {
    return this;
};

// Pre-save middleware: stage history only. No hardcoded stage/status normalization.
DealSchema.pre('save', function(next) {
    if (this.type === 'Existing Business') {
        this.type = 'Existing Customer';
    }

    if (this.isModified('stage') && !this.isNew) {
        const lastHistory = this.stageHistory[this.stageHistory.length - 1];
        if (!lastHistory || lastHistory.stage !== this.stage) {
            this.stageHistory.push({
                stage: this.stage,
                changedAt: new Date()
            });
        }
    }
    next();
});

// Static method to get pipeline summary
DealSchema.statics.getPipelineSummary = async function(organizationId) {
    // Convert organizationId to ObjectId if it's a string
    const orgId = mongoose.Types.ObjectId.isValid(organizationId) 
        ? (organizationId instanceof mongoose.Types.ObjectId ? organizationId : new mongoose.Types.ObjectId(organizationId))
        : organizationId;
    
    return await this.aggregate([
        { $match: { organizationId: orgId, status: { $in: ['Open', 'Active'] } } },
        {
            $group: {
                _id: '$stage',
                count: { $sum: 1 },
                totalValue: { $sum: '$amount' },
                avgProbability: { $avg: '$probability' }
            }
        },
        {
            $project: {
                stage: '$_id',
                count: 1,
                totalValue: 1,
                weightedValue: { $multiply: ['$totalValue', { $divide: ['$avgProbability', 100] }] },
                avgProbability: 1
            }
        },
        { $sort: { stage: 1 } }
    ]);
};

// Enable virtuals in JSON
DealSchema.set('toJSON', { virtuals: true });
DealSchema.set('toObject', { virtuals: true });

module.exports = wrapTenantModel(mongoose.model('Deal', DealSchema));

