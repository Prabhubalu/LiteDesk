// See docs/architecture/form-settings-doctrine.md
// Form Settings are configuration-only and must respect domain boundaries
//
// See client/src/platform/forms/formSettingsCapabilities.ts
// Capability flags explicitly declare what Form Settings can and cannot do
//
// ARCHITECTURAL RATIONALE:
// - Form Builder owns structure & content (sections, questions, scoring weights)
// - Form Execution owns execution & submission (workflows, state mutations)
// - Form Settings owns configuration only (behavior, lifecycle, access, outcomes)

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { isEngagementFormExpired } = require('../utils/engagementFormLifecycle');
const Schema = mongoose.Schema;

// Question Schema (nested in subsections and sections)
const questionSchema = new Schema({
    questionId: {
        type: String,
        required: true
    },
    questionText: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['Text', 'Textarea', 'Dropdown', 'Rating', 'File', 'Signature', 'Yes-No', 'Number'],
        required: true,
        default: 'Text'
    },
    options: [{
        type: String,
        trim: true
    }], // For dropdown/checkbox
    mandatory: {
        type: Boolean,
        default: false
    },
    helpText: {
        type: String,
        trim: true
    },
    evidence: {
        enabled: {
            type: Boolean,
            default: false
        },
        rules: [{
            when: {
                type: String,
                required: true
            },
            comment: {
                enabled: {
                    type: Boolean,
                    default: true
                },
                required: {
                    type: String,
                    enum: ['hidden', 'optional', 'required'],
                    default: 'optional'
                }
            },
            image: {
                enabled: {
                    type: Boolean,
                    default: true
                },
                required: {
                    type: String,
                    enum: ['hidden', 'optional', 'required'],
                    default: 'optional'
                }
            },
            video: {
                enabled: {
                    type: Boolean,
                    default: false
                },
                required: {
                    type: String,
                    enum: ['hidden', 'optional', 'required'],
                    default: 'hidden'
                }
            }
        }]
    },
    scoring: {
        enabled: {
            type: Boolean,
            default: false
        },
        weight: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        passCondition: Schema.Types.Mixed, // Flexible structure for different question types
        critical: {
            type: Boolean,
            default: false
        }
    },
    // Legacy field for backward compatibility
    scoringLogic: {
        passValue: Schema.Types.Mixed,
        failValue: Schema.Types.Mixed,
        weightage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    },
    conditionalLogic: {
        showIf: {
            questionId: String,
            operator: {
                type: String,
                enum: ['equals', 'not_equals', 'contains']
            },
            value: Schema.Types.Mixed
        }
    },
    attachmentAllowance: {
        type: Boolean,
        default: false
    },
    passFailDefinition: {
        type: String,
        trim: true
    }, // e.g., "Yes = Pass"
    order: {
        type: Number,
        default: 0
    }
}, { _id: false });

// Subsection Schema (nested in sections)
const subsectionSchema = new Schema({
    subsectionId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    weightage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    order: {
        type: Number,
        default: 0
    },
    subsectionScoring: {
        weight: {
            type: Number,
            default: 1,
            min: 0
        },
        threshold: {
            type: Number,
            default: 100,
            min: 0,
            max: 100
        }
    },
    questions: [questionSchema]
}, { _id: false });

// Section Schema
const sectionSchema = new Schema({
    sectionId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    weightage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    order: {
        type: Number,
        default: 0
    },
    _isRootSection: {
        type: Boolean,
        default: false
    },
    sectionScoring: {
        weight: {
            type: Number,
            default: 1,
            min: 0
        },
        threshold: {
            type: Number,
            default: 100,
            min: 0,
            max: 100
        }
    },
    questions: [questionSchema], // Sections can have questions directly (for flat mode)
    subsections: [subsectionSchema]
}, { _id: false });

// Form Schema Definition
const FormSchema = new Schema({
    // 🏢 ORGANIZATION REFERENCE (Multi-tenancy)
    // **********************************
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
        // index: true removed - using compound indexes below instead
    },

    // 📋 FORM IDENTIFICATION
    // **********************************
    formId: {
        type: String,
        unique: true,
        trim: true
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
    descriptionVersions: [{
        content: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now, required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
    }],
    formType: {
        type: String,
        enum: ['Audit', 'Survey', 'Feedback'],
        required: true,
        default: 'Audit'
    },

    // 📝 FORM DETAILS TAB
    // **********************************
    visibility: {
        type: String,
        enum: ['Internal', 'Partner', 'Public'],
        default: 'Internal'
    },
    status: {
        type: String,
        enum: ['Draft', 'Ready', 'Active', 'Archived'],
        default: 'Draft'
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    expiryDate: {
        type: Date
    }, // For Surveys
    tags: [{
        type: String,
        trim: true
    }],
    approvalRequired: {
        type: Boolean,
        default: false
    },

    // 📊 SECTIONS & QUESTIONS (Hierarchical Structure)
    // **********************************
    sections: [sectionSchema],

    // ⚙️ SETTINGS & LOGIC TAB
    // **********************************
    kpiMetrics: {
        compliancePercentage: {
            type: Boolean,
            default: false
        },
        satisfactionPercentage: {
            type: Boolean,
            default: false
        },
        rating: {
            type: Boolean,
            default: false
        }
    },
    scoringFormula: {
        type: String,
        default: '(Passed / Total) × 100',
        trim: true
    },
    thresholds: {
        pass: {
            type: Number,
            default: 80,
            min: 0,
            max: 100
        },
        partial: {
            type: Number,
            default: 50,
            min: 0,
            max: 100
        }
    },
    autoAssignment: {
        enabled: {
            type: Boolean,
            default: false
        },
        linkTo: {
            type: String,
            enum: ['org', 'events'],
            default: 'org'
        }
    },
    workflowOnSubmit: {
        notify: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        createTask: {
            type: Boolean,
            default: false
        },
        updateField: {
            field: String,
            value: Schema.Types.Mixed
        }
    },
    approvalWorkflow: {
        enabled: {
            type: Boolean,
            default: false
        },
        approver: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    formVersion: {
        type: Number,
        default: 1
    },
    publicLink: {
        enabled: {
            type: Boolean,
            default: false
        },
        slug: {
            type: String,
            trim: true,
            lowercase: true
            // unique: true removed - using explicit unique index below instead
        }
    },
    branding: {
        logoUrl: { type: String, trim: true, default: '' },
        themeColor: { type: String, trim: true, default: '#2563eb' },
        backgroundColor: { type: String, trim: true, default: '' },
        fontFamily: { type: String, trim: true, default: 'system' }
    },

    // 📊 OUTCOMES & RULES
    // **********************************
    outcomesAndRules: {
        auditResultRule: {
            type: String,
            enum: ['any_section_fails', 'overall_score_below_threshold', 'critical_question_fails'],
            default: 'overall_score_below_threshold'
        },
        reportingMetrics: {
            overallCompliance: {
                type: Boolean,
                default: true
            },
            sectionWiseCompliance: {
                type: Boolean,
                default: true
            },
            evidenceCompletion: {
                type: Boolean,
                default: false
            },
            averageRating: {
                type: Boolean,
                default: false
            }
        },
        postSubmissionSignals: {
            emitOnAuditFail: {
                type: Boolean,
                default: false
            },
            emitOnSectionFail: {
                type: Boolean,
                default: false
            },
            emitOnCriticalQuestionFail: {
                type: Boolean,
                default: false
            },
            emitOnMissingEvidence: {
                type: Boolean,
                default: false
            }
        }
    },

    // 📄 RESPONSE TEMPLATE
    // **********************************
    responseTemplate: {
        templates: [{
            type: Schema.Types.Mixed
        }],
        activeTemplateId: {
            type: Schema.Types.ObjectId,
            default: null
        }
    },

    // 📈 ANALYTICS (Calculated)
    // **********************************
    totalResponses: {
        type: Number,
        default: 0
    },
    avgRating: {
        type: Number,
        default: 0
    },
    avgCompliance: {
        type: Number,
        default: 0
    },
    responseRate: {
        type: Number,
        default: 0
    },
    lastSubmission: {
        type: Date
    },

    // 🔧 METADATA
    // **********************************
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    modifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Compound indexes
FormSchema.index({ organizationId: 1, status: 1 });
FormSchema.index({ organizationId: 1, formType: 1 });
FormSchema.index({ organizationId: 1, assignedTo: 1 });
FormSchema.index({ 'publicLink.slug': 1 }, { unique: true, sparse: true });

// Pre-save middleware to auto-generate formId
async function generateNextFormId(FormModel) {
    const docs = await FormModel.find({ formId: { $regex: /^FRM-\d+$/i } })
        .select('formId')
        .lean();

    let max = 0;
    for (const doc of docs) {
        const match = typeof doc.formId === 'string' ? doc.formId.match(/^FRM-(\d+)$/i) : null;
        if (match) {
            max = Math.max(max, parseInt(match[1], 10));
        }
    }

    return `FRM-${String(max + 1).padStart(3, '0')}`;
}

FormSchema.pre('save', async function(next) {
    if (!this.formId) {
        const FormModel = mongoose.model('Form');
        let assigned = false;

        for (let attempt = 0; attempt < 10; attempt += 1) {
            const candidate = await generateNextFormId(FormModel);
            const exists = await FormModel.exists({ formId: candidate });
            if (!exists) {
                this.formId = candidate;
                assigned = true;
                break;
            }
        }

        if (!assigned) {
            return next(new Error('Unable to generate unique formId'));
        }
    }
    
    // Auto-increment formVersion on update
    if (!this.isNew && this.isModified('sections')) {
        this.formVersion += 1;
    }
    
    // Set modifiedBy
    if (!this.isNew && this.modifiedBy) {
        // modifiedBy should be set by controller
    }
    
    next();
});

// Method to check if form is expired (for Surveys)
FormSchema.methods.isExpired = function() {
    return isEngagementFormExpired(this.expiryDate);
};

// Method to get total questions count
FormSchema.methods.getTotalQuestions = function() {
    let count = 0;
    this.sections.forEach(section => {
        section.subsections.forEach(subsection => {
            count += subsection.questions.length;
        });
    });
    return count;
};

// Method to validate form structure
FormSchema.methods.validateStructure = function() {
    // Get sections - handle both Mongoose document and plain object
    const sections = this.sections || (this.toObject ? this.toObject().sections : null);
    
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
        return { valid: false, error: 'Form must have at least one section' };
    }
    
    let hasQuestions = false;
    for (const section of sections) {
        if (!section) continue;
        
        // Check for questions directly in sections (flat mode)
        const questions = section.questions;
        if (Array.isArray(questions) && questions.length > 0) {
            hasQuestions = true;
            break; // Early exit if found
        }
        
        // Check for questions in subsections (hierarchical mode)
        const subsections = section.subsections;
        if (Array.isArray(subsections) && subsections.length > 0) {
            for (const subsection of subsections) {
                if (subsection && Array.isArray(subsection.questions) && subsection.questions.length > 0) {
                    hasQuestions = true;
                    break;
                }
            }
            if (hasQuestions) break;
        }
    }
    
    if (!hasQuestions) {
        return { valid: false, error: 'Form must have at least one question' };
    }
    
    return { valid: true };
};

// Enable virtuals in JSON
FormSchema.set('toJSON', { virtuals: true });
FormSchema.set('toObject', { virtuals: true });

module.exports = wrapTenantModel(mongoose.model('Form', FormSchema));

