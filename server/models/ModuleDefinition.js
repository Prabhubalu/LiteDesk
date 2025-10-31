const mongoose = require('mongoose');

const ModuleDefinitionSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['system', 'custom'], default: 'custom', index: true },
    enabled: { type: Boolean, default: true },
    fields: {
        type: [
            new mongoose.Schema({
                key: { type: String, required: true, trim: true, lowercase: true },
                label: { type: String, required: true, trim: true },
                dataType: { type: String, enum: ['Text','Text-Area','Rich Text','Integer','Decimal','Currency','Date','Date-Time','Picklist','Multi-Picklist','Checkbox','Radio Button','Email','Phone','URL','Auto-Number','Lookup (Relationship)','Formula','Rollup Summary'], required: true },
                required: { type: Boolean, default: false },
                // Options can be strings (backward compatibility) or objects with value and color
                options: {
                    type: [
                        {
                            type: new mongoose.Schema({
                                value: { type: String, required: true, trim: true },
                                color: { type: String, default: '#3B82F6', trim: true } // Default blue color
                            }, { _id: false })
                        },
                        String // Support old format for backward compatibility
                    ],
                    default: []
                },
                defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
                placeholder: { type: String, default: '' },
                index: { type: Boolean, default: false },
                visibility: {
                    list: { type: Boolean, default: true },
                    detail: { type: Boolean, default: true }
                },
                order: { type: Number, default: 0 },
                // Field type-specific settings
                numberSettings: {
                    type: new mongoose.Schema({
                        min: { type: Number, default: null },
                        max: { type: Number, default: null },
                        decimalPlaces: { type: Number, min: 0, max: 10, default: 2 },
                        currencySymbol: { type: String, default: '$' }
                    }, { _id: false }),
                    default: null
                },
                textSettings: {
                    type: new mongoose.Schema({
                        maxLength: { type: Number, min: 1, default: null },
                        rows: { type: Number, min: 1, max: 20, default: 4 }
                    }, { _id: false }),
                    default: null
                },
                dateSettings: {
                    type: new mongoose.Schema({
                        format: { type: String, default: 'YYYY-MM-DD' },
                        timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' }
                    }, { _id: false }),
                    default: null
                },
                formulaSettings: {
                    type: new mongoose.Schema({
                        expression: { type: String, default: '' },
                        returnType: { type: String, enum: ['Text', 'Number', 'Date', 'Checkbox'], default: 'Text' }
                    }, { _id: false }),
                    default: null
                },
                lookupSettings: {
                    type: new mongoose.Schema({
                        targetModule: { type: String, default: '' },
                        displayField: { type: String, default: '' }
                    }, { _id: false }),
                    default: null
                },
                validations: {
                    type: [new mongoose.Schema({
                        name: { type: String, trim: true, default: '' },
                        type: { type: String, enum: ['regex','length','range','picklist_single','picklist_multi','email'], default: 'regex' },
                        // regex
                        pattern: { type: String, default: '' },
                        // length
                        minLength: { type: Number, min: 0 },
                        maxLength: { type: Number, min: 0 },
                        // range (numbers)
                        min: { type: Number },
                        max: { type: Number },
                        // picklist
                        allowedValues: { type: [String], default: [] },
                        // error message
                        message: { type: String, default: '' }
                    }, { _id: false })],
                    default: []
                },
                dependencyLogic: { type: String, enum: ['AND','OR'], default: 'AND' },
                dependencies: {
                    type: [new mongoose.Schema({
                        fieldKey: { type: String, trim: true },
                        operator: { type: String, enum: ['equals','in'], default: 'equals' },
                        value: { type: mongoose.Schema.Types.Mixed }
                    }, { _id: false })],
                    default: []
                },
                // For enum/multienum fields: filter allowed options based on another field's value
                picklistDependencies: {
                    type: [new mongoose.Schema({
                        sourceFieldKey: { type: String, trim: true },
                        mappings: {
                            type: [new mongoose.Schema({
                                whenValue: { type: mongoose.Schema.Types.Mixed },
                                allowedOptions: { type: [String], default: [] }
                            }, { _id: false })],
                            default: []
                        }
                    }, { _id: false })],
                    default: []
                },
                // Unified advanced dependency rules to drive visibility, read-only and picklist updates
                advancedDependencies: {
                    type: [new mongoose.Schema({
                        name: { type: String, trim: true, default: '' },
                        type: { type: String, enum: ['visibility','readonly','picklist'], required: true },
                        logic: { type: String, enum: ['AND','OR'], default: 'AND' },
                        conditions: {
                            type: [new mongoose.Schema({
                                fieldKey: { type: String, trim: true, required: true },
                                operator: { type: String, enum: ['equals','not_equals','in','not_in','exists','gt','lt','gte','lte','contains'], default: 'equals' },
                                value: { type: mongoose.Schema.Types.Mixed }
                            }, { _id: false })],
                            default: []
                        },
                        // effect fields
                        // for picklist type, specify allowed options when conditions satisfied
                        allowedOptions: { type: [String], default: [] }
                    }, { _id: false })],
                    default: []
                }
            }, { _id: false })
        ],
        default: []
    }
}, {
    // Relationships: module-level relationships to other modules
    relationships: {
        type: [new mongoose.Schema({
            name: { type: String, required: true, trim: true },
            type: { type: String, enum: ['one_to_one','one_to_many','many_to_many','lookup'], required: true },
            targetModuleKey: { type: String, required: true, trim: true, lowercase: true },
            // storage mapping
            localField: { type: String, trim: true }, // e.g., organizationId
            foreignField: { type: String, trim: true }, // e.g., _id or backref
            // inverse/backref (optional)
            inverseName: { type: String, trim: true },
            inverseField: { type: String, trim: true },
            // constraints/behavior
            required: { type: Boolean, default: false },
            unique: { type: Boolean, default: false },
            index: { type: Boolean, default: true },
            cascadeDelete: { type: Boolean, default: false },
            // UI hints
            label: { type: String, trim: true },
        }, { _id: false })],
        default: []
    },
    // Quick Create layout: list of field keys to include (respects main field order)
    quickCreate: { type: [String], default: [] },
    // Visual quick create layout (12-column grid)
    quickCreateLayout: {
        type: new mongoose.Schema({
            version: { type: Number, default: 1 },
            rows: {
                type: [new mongoose.Schema({
                    cols: {
                        type: [new mongoose.Schema({
                            span: { type: Number, min: 1, max: 12, default: 12 },
                            fieldKey: { type: String, trim: true, default: '' },
                            widget: { type: String, trim: true, default: 'input' },
                            props: { type: mongoose.Schema.Types.Mixed, default: {} }
                        }, { _id: false })],
                        default: []
                    }
                }, { _id: false })],
                default: []
            }
        }, { _id: false }),
        default: { version: 1, rows: [] }
    }
}, { timestamps: true });

ModuleDefinitionSchema.index({ organizationId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('ModuleDefinition', ModuleDefinitionSchema);


