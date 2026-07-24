const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

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
    // Links to related entities
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: false // Optional for backward compatibility
    },
    responseId: {
        type: Schema.Types.ObjectId,
        ref: 'FormResponse',
        required: false // Optional for backward compatibility
    },
    sectionId: {
        type: String,
        required: false // Optional for backward compatibility
    },
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
            enum: ['open', 'in_progress', 'completed'],
            default: 'open'
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

/**
 * ============================================================================
 * Form Response Model - Execution Domain
 * ============================================================================
 * 
 * Execution lifecycle:
 * executionStatus: Not Started → In Progress → Submitted
 *
 * Review lifecycle (only after Submitted):
 * reviewStatus computed via computeReviewStatus():
 * - Pending Corrective Action
 * - Needs Auditor Review
 * - Approved
 * - Rejected
 * - Closed
 *
 * NOTE:
 * - Platform is the sole authority for FormResponse state transitions
 * - Audit App and Portal consume this state read-only
 * - Response lifecycle logic lives only inside FormResponse model
 * - No logic duplication - all state transitions handled here
 * ============================================================================
 */

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
    responseNumber: {
        type: String,
        trim: true,
        index: true,
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
        ref: 'User'
        // index: true removed - using explicit index below instead
    },
    submittedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    /** System-managed creation channel (set server-side only) */
    source: {
        type: String,
        enum: RECORD_SOURCE_VALUES,
        default: DEFAULT_RECORD_SOURCE
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

    // 🚀 EXECUTION STATUS (Execution Phase)
    // **********************************
    executionStatus: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Submitted'],
        default: 'Not Started',
        index: true
    },

    // 🔄 REVIEW STATUS (Review Phase - only applies after submission)
    // NOTE: This field is now computed automatically based on business rules
    // It is stored for indexing purposes but should not be manually set
    // **********************************
    reviewStatus: {
        type: String,
        enum: ['Pending Corrective Action', 'Needs Auditor Review', 'Approved', 'Rejected', 'Closed'],
        default: null, // null until executionStatus = 'Submitted'
        index: true
    },
    
    // ✅ APPROVAL TRACKING (explicit approval by auditor)
    // **********************************
    approved: {
        type: Boolean,
        default: false
    },
    approvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    approvedAt: {
        type: Date,
        default: null
    },

    // ✅ REVIEWER TRACKING (who performed the review action)
    // **********************************
    reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    selfReviewed: {
        type: Boolean,
        default: false
    },

    // ✅ CORRECTIVE ACTIONS
    // **********************************
    // Phase 0I.1: Portal Access Clarification
    // Portal App:
    // - Does NOT access responses directly
    // - Corrective Actions derive state from FormResponse.reviewStatus
    // - No Response CRUD in Portal
    // - Portal interacts with correctiveActions array only
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
    },

    // 🗄️ ARCHIVE & INVALIDATION (for Audit Integrity)
    // **********************************
    archived: {
        type: Boolean,
        default: false,
        index: true
    },
    archivedAt: {
        type: Date,
        default: null
    },
    archivedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    archiveReason: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    
    invalidated: {
        type: Boolean,
        default: false,
        index: true
    },
    invalidatedAt: {
        type: Date,
        default: null
    },
    invalidatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    invalidationReason: {
        type: String,
        trim: true,
        maxlength: 1000,
        required: function() {
            return this.invalidated === true;
        }
    }
}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Compound indexes
FormResponseSchema.index({ formId: 1, reviewStatus: 1 });
FormResponseSchema.index({ formId: 1, executionStatus: 1 });
FormResponseSchema.index({ organizationId: 1, submittedAt: -1 });
FormResponseSchema.index({ organizationId: 1, reviewStatus: 1 });
FormResponseSchema.index({ organizationId: 1, executionStatus: 1 });
FormResponseSchema.index({ 'linkedTo.type': 1, 'linkedTo.id': 1 });
FormResponseSchema.index({ submittedBy: 1 });
FormResponseSchema.index({ archived: 1, invalidated: 1 });

FormResponseSchema.index({ organizationId: 1, responseNumber: 1 }, { unique: true, sparse: true });

// Pre-save middleware to auto-generate responseId / responseNumber
FormResponseSchema.pre('save', async function(next) {
    if (!this.responseId || !this.responseNumber) {
        try {
            if (!this.responseNumber) {
                const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
                await assignModuleRecordNumber(this, { moduleKey: 'responses', fieldKey: 'responseNumber' });
            }
            if (!this.responseId && this.responseNumber) {
                this.responseId = this.responseNumber;
            }
            if (!this.responseId) {
                const count = await mongoose.model('FormResponse').countDocuments({ organizationId: this.organizationId });
                this.responseId = `RSP-${String(count + 1).padStart(3, '0')}`;
                if (!this.responseNumber) this.responseNumber = this.responseId;
            }
        } catch (err) {
            return next(err);
        }
    }
    next();
});

// Pre-save middleware to enforce immutability for submitted responses
FormResponseSchema.pre('save', function(next) {
    // If this is an update (not a new document) and executionStatus is 'Submitted'
    if (!this.isNew && this.executionStatus === 'Submitted') {
        // If already approved, reviewer metadata must not change
        // Allow setting reviewedBy/selfReviewed during the approval operation itself (when approvedAt is being set).
        if (this.approvedAt && !this.isModified('approvedAt')) {
            if (this.isModified('reviewedBy') || this.isModified('selfReviewed')) {
                return next(new Error('Cannot modify review metadata after approval.'));
            }
        }

        // Allow transition from 'In Progress' to 'Submitted' (form submission after check-in)
        // Check if executionStatus is being modified to 'Submitted'
        const isTransitioningToSubmitted = this.isModified('executionStatus') && 
                                          this.executionStatus === 'Submitted';
        
        // If transitioning to Submitted, allow all field updates (this handles In Progress -> Submitted)
        // This is safe because we only allow this transition, not modifications to already-Submitted responses
        if (isTransitioningToSubmitted) {
            console.log('[FormResponse] Allowing transition to Submitted status - form submission after check-in');
            return next();
        }
        
        // Allow only specific fields to be updated (archive/invalidate, approval, corrective actions, finalReport)
        const allowedFieldPrefixes = [
            'archived', 'archivedAt', 'archivedBy', 'archiveReason',
            'invalidated', 'invalidatedAt', 'invalidatedBy', 'invalidationReason',
            'reviewStatus', // Computed automatically, but can be set to 'Rejected' manually
            'approved', 'approvedBy', 'approvedAt', // Approval tracking
            'reviewedBy', 'selfReviewed', // Review metadata (set on approval)
            'correctiveActions', 'finalReport', 'updatedAt', // finalReport allows nested fields
            'reportGenerated', 'reportUrl' // Legacy report fields for backward compatibility
        ];
        
        // Check if any restricted fields are being modified
        const modifiedFields = this.modifiedPaths();
        const restrictedFields = modifiedFields.filter(field => {
            // Check if field matches any allowed prefix (handles nested fields like 'finalReport.reportUrl')
            return !allowedFieldPrefixes.some(prefix => 
                field === prefix || field.startsWith(prefix + '.')
            );
        });
        
        if (restrictedFields.length > 0) {
            return next(new Error(`Cannot modify submitted response. Restricted fields: ${restrictedFields.join(', ')}`));
        }
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
        // Corrective-action completion is owned by the corrective action owner.
        // Auditor verification is a separate step and should NOT block moving to "Needs Auditor Review".
        return action.managerAction.status === 'completed';
    });
};

// Method to get failed questions count
FormResponseSchema.methods.getFailedQuestionsCount = function() {
    return this.responseDetails.filter(detail => detail.passFail === 'Fail').length;
};

// Method to get failed scorable questions count
FormResponseSchema.methods.getFailedScorableQuestionsCount = function() {
    // Failed scorable questions are those with passFail === 'Fail' (not 'N/A')
    return this.responseDetails.filter(detail => detail.passFail === 'Fail').length;
};

// Method to check if there are any incomplete corrective actions
// NOTE: This should only be called when there ARE failed questions
// Returns true if corrective actions are needed but not completed
FormResponseSchema.methods.hasIncompleteCorrectiveActions = function() {
    // If there are no corrective actions, they need to be added (incomplete)
    if (!this.correctiveActions || this.correctiveActions.length === 0) {
        return true; // No corrective actions means they're incomplete (need to be added)
    }
    
    // A corrective action is incomplete if:
    // - managerAction.status is not 'completed'
    return this.correctiveActions.some(action => {
        return action.managerAction.status !== 'completed';
    });
};

/**
 * Compute review status based on business rules
 * Rules:
 * 1. If there are one or more failed scorable questions AND at least one corrective action is not completed → status = "Pending Corrective Action"
 * 2. If there are failed questions but all corrective actions are completed → status = "Needs Auditor Review"
 * 3. If there are no failed questions AND response is not yet reviewed → status = "Needs Auditor Review"
 * 4. If auditor has approved the response → status = "Approved"
 * 5. If response is approved and finalized (all corrective actions completed) → status = "Closed"
 * 6. Status must NEVER be "Pending Corrective Action" when there are zero failed questions
 */
FormResponseSchema.methods.computeReviewStatus = function() {
    // If not submitted, status is null
    if (this.executionStatus !== 'Submitted') {
        return null;
    }
    
    const failedScorableQuestionsCount = this.getFailedScorableQuestionsCount();
    const hasIncompleteActions = this.hasIncompleteCorrectiveActions();
    const allActionsComplete = this.areCorrectiveActionsComplete();
    
    // Rule 5: If approved and all corrective actions are completed → "Closed"
    if (this.approved && allActionsComplete) {
        return 'Closed';
    }
    
    // Rule 4: If auditor has approved the response → "Approved"
    if (this.approved) {
        return 'Approved';
    }
    
    // Rule 6: Status must NEVER be "Pending Corrective Action" when there are zero failed questions
    // Rule 1: If there are failed scorable questions AND at least one corrective action is not completed → "Pending Corrective Action"
    // IMPORTANT: Only check hasIncompleteActions if there are actually failed questions
    if (failedScorableQuestionsCount > 0) {
        // If there are failed questions but no corrective actions added yet, or incomplete actions
        if (hasIncompleteActions) {
            return 'Pending Corrective Action';
        }
    }
    
    // Rule 2: If there are failed questions but all corrective actions are completed → "Needs Auditor Review"
    if (failedScorableQuestionsCount > 0 && allActionsComplete) {
        return 'Needs Auditor Review';
    }
    
    // Rule 3: If there are no failed questions AND response is not yet reviewed → "Needs Auditor Review"
    if (failedScorableQuestionsCount === 0) {
        return 'Needs Auditor Review';
    }
    
    // Default fallback (should not reach here based on rules above)
    return 'Needs Auditor Review';
};

// Pre-save hook to automatically compute reviewStatus
FormResponseSchema.pre('save', function(next) {
    // Only compute status for submitted responses
    if (this.executionStatus === 'Submitted') {
        // Preserve 'Rejected' status if it was explicitly set (it's the only manually settable status)
        // Otherwise, compute status based on business rules
        if (this.reviewStatus !== 'Rejected') {
            const computedStatus = this.computeReviewStatus();
            this.reviewStatus = computedStatus;
        }
    }
    next();
});

// Enable virtuals in JSON
FormResponseSchema.set('toJSON', { virtuals: true });
FormResponseSchema.set('toObject', { virtuals: true });

// ===== AUDIT APP SYNC HOOKS =====
// Post-save hook: Sync execution context when form response is submitted
FormResponseSchema.post('save', async function (doc) {
    try {
        // Only sync if submitted
        if (doc.executionStatus === 'Submitted') {
            // Sync AuditExecutionContext (non-blocking)
            const auditSyncService = require('../services/auditSyncService');
            await auditSyncService.syncAuditExecutionContextFromFormResponse(doc);
        }
    } catch (error) {
        // Never throw - log and continue (don't block CRM execution)
        console.error('[FormResponse Model] Error in post-save sync hook:', error.message);
    }
});

module.exports = wrapTenantModel(mongoose.model('FormResponse', FormResponseSchema));

