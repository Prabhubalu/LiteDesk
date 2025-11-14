const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Question-level KPI Schema
const questionKPISchema = new Schema({
    questionId: {
        type: String,
        required: true
    },
    questionText: {
        type: String,
        required: true
    },
    totalResponses: {
        type: Number,
        default: 0
    },
    passed: {
        type: Number,
        default: 0
    },
    failed: {
        type: Number,
        default: 0
    },
    passRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    avgScore: {
        type: Number,
        default: 0
    },
    trend: {
        type: String,
        enum: ['improving', 'declining', 'stable'],
        default: 'stable'
    }
}, { _id: false });

// Section-level KPI Schema
const sectionKPISchema = new Schema({
    sectionId: {
        type: String,
        required: true
    },
    sectionName: {
        type: String,
        required: true
    },
    totalResponses: {
        type: Number,
        default: 0
    },
    avgScore: {
        type: Number,
        default: 0
    },
    avgPassRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    trend: {
        type: String,
        enum: ['improving', 'declining', 'stable'],
        default: 'stable'
    }
}, { _id: false });

// Organization-level KPI Schema (for audits linked to organizations)
const organizationKPISchema = new Schema({
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    organizationName: {
        type: String,
        required: true
    },
    totalAudits: {
        type: Number,
        default: 0
    },
    avgCompliance: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    passRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    trend: {
        type: String,
        enum: ['improving', 'declining', 'stable'],
        default: 'stable'
    }
}, { _id: false });

// Form KPIs Schema Definition
const FormKPISchema = new Schema({
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

    // 📊 QUESTION-LEVEL KPIs
    // **********************************
    questionKPIs: [questionKPISchema],

    // 📊 SECTION-LEVEL KPIs
    // **********************************
    sectionKPIs: [sectionKPISchema],

    // 📊 FORM-LEVEL KPIs
    // **********************************
    formKPIs: {
        totalResponses: {
            type: Number,
            default: 0
        },
        avgCompliance: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        avgRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        passRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        avgCompletionTime: {
            type: Number,
            default: 0
        }, // minutes
        trend: {
            type: String,
            enum: ['improving', 'declining', 'stable'],
            default: 'stable'
        }
    },

    // 📊 ORGANIZATION-LEVEL KPIs (if linked to orgs)
    // **********************************
    organizationKPIs: [organizationKPISchema],

    // ⏰ CALCULATION METADATA
    // **********************************
    calculatedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Compound indexes
FormKPISchema.index({ formId: 1, calculatedAt: -1 });
FormKPISchema.index({ organizationId: 1, formId: 1 });

// Method to update question-level KPIs
FormKPISchema.methods.updateQuestionKPIs = function(questionId, stats) {
    const questionKPI = this.questionKPIs.find(kpi => kpi.questionId === questionId);
    
    if (questionKPI) {
        questionKPI.totalResponses = stats.totalResponses || questionKPI.totalResponses;
        questionKPI.passed = stats.passed || questionKPI.passed;
        questionKPI.failed = stats.failed || questionKPI.failed;
        questionKPI.passRate = stats.passRate || questionKPI.passRate;
        questionKPI.avgScore = stats.avgScore || questionKPI.avgScore;
        questionKPI.trend = stats.trend || questionKPI.trend;
    } else {
        this.questionKPIs.push({
            questionId: questionId,
            questionText: stats.questionText || '',
            totalResponses: stats.totalResponses || 0,
            passed: stats.passed || 0,
            failed: stats.failed || 0,
            passRate: stats.passRate || 0,
            avgScore: stats.avgScore || 0,
            trend: stats.trend || 'stable'
        });
    }
};

// Method to update section-level KPIs
FormKPISchema.methods.updateSectionKPIs = function(sectionId, stats) {
    const sectionKPI = this.sectionKPIs.find(kpi => kpi.sectionId === sectionId);
    
    if (sectionKPI) {
        sectionKPI.totalResponses = stats.totalResponses || sectionKPI.totalResponses;
        sectionKPI.avgScore = stats.avgScore || sectionKPI.avgScore;
        sectionKPI.avgPassRate = stats.avgPassRate || sectionKPI.avgPassRate;
        sectionKPI.trend = stats.trend || sectionKPI.trend;
    } else {
        this.sectionKPIs.push({
            sectionId: sectionId,
            sectionName: stats.sectionName || '',
            totalResponses: stats.totalResponses || 0,
            avgScore: stats.avgScore || 0,
            avgPassRate: stats.avgPassRate || 0,
            trend: stats.trend || 'stable'
        });
    }
};

// Method to update organization-level KPIs
FormKPISchema.methods.updateOrganizationKPIs = function(organizationId, stats) {
    const orgKPI = this.organizationKPIs.find(kpi => kpi.organizationId.toString() === organizationId.toString());
    
    if (orgKPI) {
        orgKPI.totalAudits = stats.totalAudits || orgKPI.totalAudits;
        orgKPI.avgCompliance = stats.avgCompliance || orgKPI.avgCompliance;
        orgKPI.passRate = stats.passRate || orgKPI.passRate;
        orgKPI.trend = stats.trend || orgKPI.trend;
    } else {
        this.organizationKPIs.push({
            organizationId: organizationId,
            organizationName: stats.organizationName || '',
            totalAudits: stats.totalAudits || 0,
            avgCompliance: stats.avgCompliance || 0,
            passRate: stats.passRate || 0,
            trend: stats.trend || 'stable'
        });
    }
};

// Enable virtuals in JSON
FormKPISchema.set('toJSON', { virtuals: true });
FormKPISchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FormKPIs', FormKPISchema);

