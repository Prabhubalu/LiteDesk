const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Question Schema (nested in subsections)
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
        enum: ['Text', 'Dropdown', 'Rating', 'File', 'Signature', 'Yes-No'],
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
    scoringLogic: {
        passValue: Schema.Types.Mixed, // e.g., "Yes" or 4
        failValue: Schema.Types.Mixed, // e.g., "No" or < 4
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
    subsections: [subsectionSchema]
}, { _id: false });

// Form Schema Definition
const FormSchema = new Schema({
    // 🏢 ORGANIZATION REFERENCE (Multi-tenancy)
    // **********************************
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
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
    formType: {
        type: String,
        enum: ['Audit', 'Survey', 'Feedback', 'Inspection', 'Custom'],
        required: true,
        default: 'Custom'
    },

    // 📝 FORM DETAILS TAB
    // **********************************
    linkedModule: {
        type: String,
        enum: ['Organization', 'Deal', 'Task', 'Event', 'Lead', 'Contact', null],
        default: null
    },
    visibility: {
        type: String,
        enum: ['Internal', 'Partner', 'Public'],
        default: 'Internal'
    },
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Closed'],
        default: 'Draft'
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
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
    linkedReport: {
        type: Schema.Types.ObjectId,
        ref: 'Report'
    },
    attachments: [{
        type: String // File URLs
    }],
    notes: {
        type: String,
        trim: true
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
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true
        }
    },

    // 📄 RESPONSE TEMPLATE
    // **********************************
    responseTemplate: {
        templateId: {
            type: Schema.Types.ObjectId,
            ref: 'ResponseTemplate'
        },
        customTemplate: {
            layout: Schema.Types.Mixed, // Drag-drop structure
            includeComparison: {
                type: Boolean,
                default: false
            },
            includeTrends: {
                type: Boolean,
                default: false
            },
            includeCharts: {
                type: Boolean,
                default: false
            },
            includeCorrectiveActions: {
                type: Boolean,
                default: false
            }
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
FormSchema.pre('save', async function(next) {
    if (!this.formId) {
        // Generate formId: FRM-001, FRM-002, etc.
        const count = await mongoose.model('Form').countDocuments({ organizationId: this.organizationId });
        this.formId = `FRM-${String(count + 1).padStart(3, '0')}`;
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
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
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
    if (!this.sections || this.sections.length === 0) {
        return { valid: false, error: 'Form must have at least one section' };
    }
    
    let hasQuestions = false;
    this.sections.forEach(section => {
        if (section.subsections && section.subsections.length > 0) {
            section.subsections.forEach(subsection => {
                if (subsection.questions && subsection.questions.length > 0) {
                    hasQuestions = true;
                }
            });
        }
    });
    
    if (!hasQuestions) {
        return { valid: false, error: 'Form must have at least one question' };
    }
    
    return { valid: true };
};

// Enable virtuals in JSON
FormSchema.set('toJSON', { virtuals: true });
FormSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Form', FormSchema);

