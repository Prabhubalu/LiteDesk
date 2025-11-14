const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Response Detail Schema (question-level)
const responseDetailSchema = new Schema({
    questionId: {
        type: String,
        required: true
    },
    sectionId: {
        type: String
    },
    subsectionId: {
        type: String
    },
    answer: {
        type: Schema.Types.Mixed // Can be String, Number, Boolean, [String], File URL
    },
    score: {
        type: Number,
        default: 0
    }, // Calculated score for this question
    passFail: {
        type: String,
        enum: ['Pass', 'Fail', 'N/A'],
        default: 'N/A'
    },
    attachments: [{
        type: String // File URLs
    }],
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

// Section Score Schema
const sectionScoreSchema = new Schema({
    sectionId: {
        type: String,
        required: true
    },
    sectionName: {
        type: String,
        required: true
    },
    passed: {
        type: Number,
        default: 0
    },
    failed: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
    },
    percentage: {
        type: Number,
        default: 0
    },
    score: {
        type: Number,
        default: 0
    }
}, { _id: false });

// Corrective Action Schema
const correctiveActionSchema = new Schema({
    questionId: {
        type: String,
        required: true
    },
    questionText: {
        type: String,
        required: true
    },
    auditorFinding: {
        type: String,
        trim: true
    },
    managerAction: {
        comment: {
            type: String,
            trim: true
        },
        proof: [{
            type: String // File URLs
        }],
        status: {
            type: String,
            enum: ['Resolved', 'In Progress', 'Pending'],
            default: 'Pending'
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date
        }
    },
    auditorVerification: {
        approved: {
            type: Boolean,
            default: false
        },
        comment: {
            type: String,
            trim: true
        },
        verifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        verifiedAt: {
            type: Date
        }
    }
}, { _id: false });

// Form Response Schema Definition
const FormResponseSchema = new Schema({
    // 🏢 ORGANIZATION REFERENCE (Multi-tenancy)
    // **********************************
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    formId: {
        type: Schema.Types.ObjectId,
        ref: 'Form',
        required: true,
        index: true
    },

    // 📋 RESPONSE IDENTIFICATION
    // **********************************
    responseId: {
        type: String,
        unique: true,
        trim: true
    },

    // 🔗 LINKED RECORDS
    // **********************************
    linkedTo: {
        type: {
            type: String,
            enum: ['Organization', 'Deal', 'Task', 'Event', 'Lead', 'Contact', null],
            default: null
        },
        id: {
            type: Schema.Types.ObjectId,
            refPath: 'linkedTo.type'
        }
    },

    // 👤 SUBMITTER INFO
    // **********************************
    submittedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    submittedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    // 📝 RESPONSE DATA (Question-level)
    // **********************************
    responseDetails: [responseDetailSchema],

    // 📊 SECTION-LEVEL KPIs (Calculated)
    // **********************************
    sectionScores: [sectionScoreSchema],

    // 📈 FORM-LEVEL KPIs (Calculated)
    // **********************************
    kpis: {
        compliancePercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        satisfactionPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        totalPassed: {
            type: Number,
            default: 0
        },
        totalFailed: {
            type: Number,
            default: 0
        },
        totalQuestions: {
            type: Number,
            default: 0
        },
        finalScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    },

    // 🔄 STATUS & WORKFLOW
    // **********************************
    status: {
        type: String,
        enum: ['Pending Corrective Action', 'Needs Auditor Review', 'Approved', 'Rejected', 'Closed'],
        default: 'Pending Corrective Action',
        index: true
    },

    // ✅ CORRECTIVE ACTIONS
    // **********************************
    correctiveActions: [correctiveActionSchema],

    // 📄 FINAL REPORT
    // **********************************
    finalReport: {
        reportUrl: {
            type: String // Generated report file URL
        },
        generatedAt: {
            type: Date
        },
        includesComparison: {
            type: Boolean,
            default: false
        },
        previousResponseId: {
            type: Schema.Types.ObjectId,
            ref: 'FormResponse'
        } // For comparison
    },

    // 📍 METADATA
    // **********************************
    ipAddress: {
        type: String,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    }
}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Compound indexes
FormResponseSchema.index({ formId: 1, status: 1 });
FormResponseSchema.index({ organizationId: 1, submittedAt: -1 });
FormResponseSchema.index({ organizationId: 1, status: 1 });
FormResponseSchema.index({ 'linkedTo.type': 1, 'linkedTo.id': 1 });
FormResponseSchema.index({ submittedBy: 1 });

// Pre-save middleware to auto-generate responseId
FormResponseSchema.pre('save', async function(next) {
    if (!this.responseId) {
        // Generate responseId: RSP-001, RSP-002, etc.
        const count = await mongoose.model('FormResponse').countDocuments({ organizationId: this.organizationId });
        this.responseId = `RSP-${String(count + 1).padStart(3, '0')}`;
    }
    next();
});

// Method to get pass/fail status based on KPIs
FormResponseSchema.methods.getPassFailStatus = function(thresholds) {
    if (!thresholds) {
        thresholds = { pass: 80, partial: 50 };
    }
    
    const compliance = this.kpis.compliancePercentage || 0;
    
    if (compliance >= thresholds.pass) {
        return 'Pass';
    } else if (compliance >= thresholds.partial) {
        return 'Partial';
    } else {
        return 'Fail';
    }
};

// Method to check if corrective actions are complete
FormResponseSchema.methods.areCorrectiveActionsComplete = function() {
    if (!this.correctiveActions || this.correctiveActions.length === 0) {
        return true;
    }
    
    return this.correctiveActions.every(action => {
        return action.managerAction.status === 'Resolved' && 
               action.auditorVerification.approved === true;
    });
};

// Method to get failed questions count
FormResponseSchema.methods.getFailedQuestionsCount = function() {
    return this.responseDetails.filter(detail => detail.passFail === 'Fail').length;
};

// Enable virtuals in JSON
FormResponseSchema.set('toJSON', { virtuals: true });
FormResponseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FormResponse', FormResponseSchema);

