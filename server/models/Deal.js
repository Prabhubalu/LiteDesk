const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
        default: 'Default Pipeline'
    },
    
    // 📊 SALES PIPELINE
    // **********************************
    stage: {
        type: String,
        enum: ['Qualification', 'Proposal', 'Negotiation', 'Contract Sent', 'Closed Won', 'Closed Lost', 'Lead', 'Qualified'],
        default: 'Qualification',
        required: true
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
    contactId: {
        type: Schema.Types.ObjectId,
        ref: 'People',
        index: true
    },
    accountId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization'
    },
    ownerId: {
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
    type: {
        type: String,
        enum: ['New Business', 'Existing Customer', 'Existing Business', 'Upsell', 'Renewal', 'Cross-Sell', null],
        default: null
    },
    source: {
        type: String,
        trim: true // e.g., 'Website', 'Referral', 'Cold Call'
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
    
    // 💬 NOTES & ACTIVITIES
    // **********************************
    notes: [{
        text: { type: String, required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        createdAt: { type: Date, default: Date.now }
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
    }

}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Compound index for organization
DealSchema.index({ organizationId: 1, stage: 1 });
DealSchema.index({ organizationId: 1, ownerId: 1 });
DealSchema.index({ organizationId: 1, status: 1 });
DealSchema.index({ organizationId: 1, expectedCloseDate: 1 });

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
DealSchema.methods.advanceStage = async function(userId) {
    const stages = ['Qualification', 'Proposal', 'Negotiation', 'Contract Sent', 'Closed Won'];
    const currentIndex = stages.indexOf(this.stage);
    
    if (currentIndex < stages.length - 1) {
        const newStage = stages[currentIndex + 1];
        
        // Add to history
        this.stageHistory.push({
            stage: newStage,
            changedBy: userId
        });
        
        this.stage = newStage;
        
        // Update probability based on stage
        const probabilities = { 'Qualification': 25, 'Proposal': 50, 'Negotiation': 70, 'Contract Sent': 85, 'Closed Won': 100 };
        this.probability = probabilities[newStage];
        
        if (newStage === 'Closed Won') {
            this.status = 'Won';
            this.actualCloseDate = new Date();
        }
        
        return await this.save();
    }
    
    return this;
};

// Pre-save middleware to update stage history
DealSchema.pre('save', function(next) {
    // Normalize legacy values to new taxonomy
    if (this.stage === 'Lead') {
        this.stage = 'Qualification';
    } else if (this.stage === 'Qualified') {
        this.stage = 'Proposal';
    }

    if (this.status === 'Active') {
        this.status = 'Open';
    } else if (this.status === 'Abandoned') {
        this.status = 'Stalled';
    }

    if (this.type === 'Existing Business') {
        this.type = 'Existing Customer';
    }

    if (this.isModified('stage') && !this.isNew) {
        // Add to stage history if stage changed
        const lastHistory = this.stageHistory[this.stageHistory.length - 1];
        if (!lastHistory || lastHistory.stage !== this.stage) {
            this.stageHistory.push({
                stage: this.stage,
                changedAt: new Date()
            });
        }
    }
    
    // Auto-update status based on stage
    if (this.stage === 'Closed Won' && this.status === 'Open') {
        this.status = 'Won';
        this.actualCloseDate = this.actualCloseDate || new Date();
    } else if (this.stage === 'Closed Lost' && this.status === 'Open') {
        this.status = 'Lost';
        this.actualCloseDate = this.actualCloseDate || new Date();
    }
    
    next();
});

// Static method to get pipeline summary
DealSchema.statics.getPipelineSummary = async function(organizationId) {
    return await this.aggregate([
        { $match: { organizationId: mongoose.Types.ObjectId(organizationId), status: { $in: ['Open', 'Active'] } } },
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

module.exports = mongoose.model('Deal', DealSchema);

