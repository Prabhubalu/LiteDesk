const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Chart Configuration Schema
const chartConfigSchema = new Schema({
    type: {
        type: String,
        enum: ['line', 'bar', 'pie'],
        required: true
    },
    dataSource: {
        type: String,
        required: true
    }, // Which KPI to chart
    title: {
        type: String,
        required: true,
        trim: true
    },
    position: {
        type: Number,
        default: 0
    } // Order in layout
}, { _id: false });

// Response Template Schema Definition
const ResponseTemplateSchema = new Schema({
    // 🏢 ORGANIZATION REFERENCE (Multi-tenancy)
    // **********************************
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        index: true
    },

    // 📋 TEMPLATE IDENTIFICATION
    // **********************************
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },

    // 📄 TEMPLATE STRUCTURE (Drag-drop Layout)
    // **********************************
    layout: {
        type: Schema.Types.Mixed // JSON structure defining report layout
    },

    // ⚙️ TEMPLATE OPTIONS
    // **********************************
    includeComparison: {
        type: Boolean,
        default: false
    }, // Current vs Previous
    includeTrends: {
        type: Boolean,
        default: false
    }, // Multi-audit trends
    includeCharts: {
        type: Boolean,
        default: false
    },
    includeCorrectiveActions: {
        type: Boolean,
        default: false
    },

    // 📊 CHART CONFIGURATIONS
    // **********************************
    charts: [chartConfigSchema],

    // 🔧 TEMPLATE METADATA
    // **********************************
    isDefault: {
        type: Boolean,
        default: false
    },
    isPublic: {
        type: Boolean,
        default: false
    }, // Can be used by other orgs

    // 👤 METADATA
    // **********************************
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Indexes
ResponseTemplateSchema.index({ organizationId: 1, isDefault: 1 });
ResponseTemplateSchema.index({ isPublic: 1, isDefault: 1 });

// Method to validate template structure
ResponseTemplateSchema.methods.validateTemplate = function() {
    if (!this.layout) {
        return { valid: false, error: 'Template must have a layout structure' };
    }
    
    // Add more validation logic here if needed
    return { valid: true };
};

// Method to get default template
ResponseTemplateSchema.statics.getDefaultTemplate = async function() {
    return await this.findOne({ isDefault: true, isPublic: true });
};

// Method to duplicate template
ResponseTemplateSchema.methods.duplicate = async function(newName, newOrganizationId) {
    const duplicated = new this.constructor({
        organizationId: newOrganizationId || this.organizationId,
        name: newName || `${this.name} (Copy)`,
        description: this.description,
        layout: this.layout,
        includeComparison: this.includeComparison,
        includeTrends: this.includeTrends,
        includeCharts: this.includeCharts,
        includeCorrectiveActions: this.includeCorrectiveActions,
        charts: this.charts,
        isDefault: false,
        isPublic: false,
        createdBy: this.createdBy
    });
    
    return await duplicated.save();
};

// Enable virtuals in JSON
ResponseTemplateSchema.set('toJSON', { virtuals: true });
ResponseTemplateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ResponseTemplate', ResponseTemplateSchema);

