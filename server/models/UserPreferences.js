const mongoose = require('mongoose');

const WidgetLayoutSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },
    x: {
        type: Number,
        required: true
    },
    y: {
        type: Number,
        required: true
    },
    w: {
        type: Number,
        required: true
    },
    h: {
        type: Number,
        required: true
    }
}, { _id: false });

const UserPreferencesSchema = new mongoose.Schema({
    // Organization Reference (Multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    
    // User Reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Widget Layout Preferences
    // Key format: "recordType-recordId" (e.g., "organizations-68fcec7f9f2bf0ba9a8330f8")
    widgetLayouts: {
        type: Map,
        of: {
            widgets: [WidgetLayoutSchema]
        },
        default: new Map()
    },
    
    // Metrics configurations per module (recordType)
    // Key: recordType (e.g., 'people', 'organizations') → value: array of metric configs
    metricsConfigs: {
        type: Map,
        of: [
            new mongoose.Schema({
                id: { type: String, required: true },
                label: { type: String, required: true },
                source: { type: String, enum: ['record', 'stats'], default: 'record' },
                field: { type: String, default: '' },
                agg: { type: String, enum: ['value', 'sum', 'avg', 'count', 'days_since', 'ai_score'], default: 'value' },
                icon: { type: String, default: '' }
            }, { _id: false })
        ],
        default: new Map()
    }
}, {
    timestamps: true
});

// Compound index for organization + user (unique)
UserPreferencesSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserPreferences', UserPreferencesSchema);

