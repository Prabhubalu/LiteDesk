const ModuleDefinition = require('../models/ModuleDefinition');

// Utility to count fields from a Mongoose model schema (excluding system fields)
function getSchemaFieldCount(model) {
    if (!model || !model.schema) return 0;
    const paths = Object.keys(model.schema.paths || {});
    const excluded = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
    return paths.filter(p => !excluded.has(p)).length;
}

function inferDataType(path) {
    const instance = path.instance || (path.options && path.options.type && path.options.type.name);
    switch ((instance || '').toLowerCase()) {
        case 'string': return 'Text';
        case 'number': return 'Decimal';
        case 'boolean': return 'Checkbox';
        case 'date': return 'Date';
        case 'objectid': return 'Lookup (Relationship)';
        default: return 'Text';
    }
}

// Field-specific data type mappings for People module
function getFieldDataType(key, fieldName, path) {
    const peopleFieldMappings = {
        'createdBy': 'Lookup (Relationship)',
        'assignedTo': 'Lookup (Relationship)',
        'source': 'Picklist',
        'type': 'Picklist',
        'first_name': 'Text',
        'last_name': 'Text',
        'email': 'Email',
        'phone': 'Phone',
        'mobile': 'Phone',
        'organization': 'Lookup (Relationship)',
        'tags': 'Multi-Picklist',
        'do_not_contact': 'Checkbox',
        'lead_status': 'Picklist',
        'lead_owner': 'Lookup (Relationship)',
        'lead_score': 'Integer',
        'interest_products': 'Multi-Picklist',
        'qualification_date': 'Date',
        'qualification_notes': 'Text-Area',
        'estimated_value': 'Currency',
        'contact_status': 'Picklist',
        'role': 'Picklist',
        'birthday': 'Date',
        'preferred_contact_method': 'Radio Button'
    };
    
    const organizationFieldMappings = {
        'name': 'Text',
        'types': 'Multi-Picklist',
        'website': 'URL',
        'phone': 'Phone',
        'address': 'Text-Area',
        'industry': 'Picklist',
        'assignedTo': 'Lookup (Relationship)',
        'primaryContact': 'Lookup (Relationship)',
        'customerStatus': 'Picklist',
        'customerTier': 'Picklist',
        'slaLevel': 'Picklist',
        'paymentTerms': 'Text',
        'creditLimit': 'Currency',
        'accountManager': 'Lookup (Relationship)',
        'annualRevenue': 'Currency',
        'numberOfEmployees': 'Integer',
        'partnerStatus': 'Picklist',
        'partnerTier': 'Picklist',
        'partnerType': 'Picklist',
        'partnerSince': 'Date',
        'partnerOnboardingSteps': 'Multi-Picklist',
        'territory': 'Picklist',
        'discountRate': 'Decimal',
        'vendorStatus': 'Picklist',
        'vendorRating': 'Integer',
        'vendorContract': 'URL',
        'preferredPaymentMethod': 'Picklist',
        'taxId': 'Text',
        'channelRegion': 'Picklist',
        'distributionTerritory': 'Multi-Picklist',
        'distributionCapacityMonthly': 'Integer',
        'dealerLevel': 'Picklist',
        'terms': 'Rich Text',
        'shippingAddress': 'Text-Area',
        'logisticsPartner': 'Lookup (Relationship)'
    };
    
    // Check if this is a People module field with specific mapping
    if (key === 'people' && peopleFieldMappings[fieldName]) {
        return peopleFieldMappings[fieldName];
    }
    
    // Check if this is an Organizations module field with specific mapping
    if (key === 'organizations' && organizationFieldMappings[fieldName]) {
        return organizationFieldMappings[fieldName];
    }
    
    // Fall back to inference based on schema type
    return inferDataType(path);
}

function getBaseFieldsForKey(key) {
    try {
        const modelByKey = {
            people: require('../models/People'),
            organizations: require('../models/Organization'),
            deals: require('../models/Deal'),
            tasks: require('../models/Task'),
            events: require('../models/Event'),
            imports: require('../models/ImportHistory'),
        };
        const model = modelByKey[key];
        if (!model) return [];
        const excluded = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
        // Access both paths and tree to get enum values reliably
        const schemaTree = model.schema.tree || {};
        return Object.entries(model.schema.paths)
            .filter(([name]) => !excluded.has(name))
            .map(([name, path]) => {
                const dataType = getFieldDataType(key, name, path);
                // Extract enum values from Mongoose path and schema tree
                let options = [];
                // Check schema tree first (original definition)
                const treeDef = schemaTree[name];
                if (treeDef && treeDef.enum && Array.isArray(treeDef.enum)) {
                    options = [...treeDef.enum];
                } else {
                    // Fallback to path properties
                    const enumValues = path.enumValues || (path.options && path.options.enum) || (path.caster && path.caster.enumValues) || null;
                    if (Array.isArray(enumValues) && enumValues.length > 0) {
                        options = [...enumValues];
                    }
                    // Special handling for array fields (like tags, interest_products)
                    if (path.schema && path.schema.paths) {
                        // This is an array field, check if the array items have enum
                        const arrayItemPath = path.schema.paths[0] || path.schema.paths['0'];
                        if (arrayItemPath) {
                            const arrayEnum = arrayItemPath.enumValues || (arrayItemPath.options && arrayItemPath.options.enum);
                            if (Array.isArray(arrayEnum) && arrayEnum.length > 0) {
                                options = [...arrayEnum];
                            }
                        }
                        // Also check schema tree for array type
                        if (treeDef && treeDef[0] && treeDef[0].enum && Array.isArray(treeDef[0].enum)) {
                            options = [...treeDef[0].enum];
                        }
                    }
                }
                return {
                    key: name,
                    label: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    dataType: dataType,
                    required: !!path.isRequired,
                    options: options,
                    defaultValue: path.defaultValue ?? null,
                    index: !!path._index,
                    visibility: { list: true, detail: true },
                    order: 0,
                    validations: [],
                    dependencies: []
                };
            });
    } catch (e) {
        return [];
    }
}

exports.listModules = async (req, res) => {
    try {
        // Static system modules (always present)
        const systemModules = [
            { key: 'people', name: 'People' },
            { key: 'organizations', name: 'Organizations' },
            { key: 'deals', name: 'Deals' },
            { key: 'tasks', name: 'Tasks' },
            { key: 'events', name: 'Events' },
            { key: 'imports', name: 'Imports' },
            { key: 'reports', name: 'Reports' },
            { key: 'users', name: 'Users' } // For lookup targets (assignedTo, lead_owner, createdBy)
        ].map(m => ({
            _id: `system:${m.key}`,
            organizationId: req.user.organizationId,
            key: m.key,
            name: m.name,
            type: 'system',
            enabled: true,
            fields: m.key === 'users' ? [] : getBaseFieldsForKey(m.key), // Users module has no fields for lookup purposes
            fieldCount: 0,
            createdAt: null,
            updatedAt: null
        }));

        // Exclude 'groups' from modules list (it's a settings feature, not a module)
        const custom = await ModuleDefinition.find({ 
            organizationId: req.user.organizationId,
            key: { $ne: 'groups' } // Exclude groups
        }).lean();
        const customByKey = new Map(custom.map(m => [m.key, m]));

        // Merge: system base + stored overrides for same key (both custom and system-typed docs are stored in ModuleDefinition)
        const merged = [];
        for (const sys of systemModules) {
            const override = customByKey.get(sys.key);
            if (override) {
                // Respect saved order from override; append any base fields not present, in base order
                const saved = Array.isArray(override.fields) ? [...override.fields] : [];
                saved.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const seen = new Set(saved.map(f => f.key));
                for (const baseField of sys.fields) {
                    if (!seen.has(baseField.key)) {
                        saved.push({ ...baseField, order: saved.length });
                    }
                }
                // Include quickCreate and quickCreateLayout from override if present
                merged.push({ 
                    ...sys, 
                    fields: saved,
                    quickCreate: override.quickCreate || [],
                    quickCreateLayout: override.quickCreateLayout || { version: 1, rows: [] },
                    relationships: override.relationships || [],
                    name: override.name || sys.name,
                    enabled: override.enabled !== undefined ? override.enabled : sys.enabled
                });
                customByKey.delete(sys.key);
            } else {
                // No overrides; ensure base fields have stable order by index
                const withOrder = sys.fields.map((f, i) => ({ ...f, order: i }));
                merged.push({ 
                    ...sys, 
                    fields: withOrder,
                    quickCreate: [],
                    quickCreateLayout: { version: 1, rows: [] },
                    relationships: []
                });
            }
        }
        // Remaining custom modules
        for (const m of customByKey.values()) {
            const fields = Array.isArray(m.fields) ? [...m.fields] : [];
            fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            merged.push({ 
                ...m, 
                fields,
                quickCreate: m.quickCreate || [],
                quickCreateLayout: m.quickCreateLayout || { version: 1, rows: [] },
                relationships: m.relationships || []
            });
        }

        // Attach field counts for system modules from actual schemas
        try {
            const People = require('../models/People');
            const Organization = require('../models/Organization');
            const Deal = require('../models/Deal');
            const Task = require('../models/Task');
            const Event = require('../models/Event');
            const ImportHistory = require('../models/ImportHistory');
            const modelByKey = {
                people: People,
                organizations: Organization,
                deals: Deal,
                tasks: Task,
                events: Event,
                imports: ImportHistory,
                reports: null, // no direct model
                users: null // Users module is for lookup targets only, no fields needed
            };
            const uniqueCount = (fields) => {
                if (!Array.isArray(fields)) return 0;
                const seen = new Set();
                for (const f of fields) {
                    const k = String(f?.key || '').toLowerCase();
                    if (!k) continue;
                    // ignore fields without a valid dataType (incomplete entries)
                    if (!f?.dataType) continue;
                    // ignore explicitly hidden technical fields if any slipped through
                    if (k === '_id' || k === '__v' || k === 'createdat' || k === 'updatedat') continue;
                    if (!seen.has(k)) seen.add(k);
                }
                return seen.size;
            };
            for (const m of merged) {
                m.fieldCount = uniqueCount(m.fields);
            }
        } catch (e) {
            // If any model missing, skip counts gracefully
            for (const m of merged) {
                if (typeof m.fieldCount !== 'number') {
                    m.fieldCount = Array.isArray(m.fields) ? m.fields.length : 0;
                }
            }
        }

        // Sort: system first, then custom; within each, by name
        merged.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'system' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        res.json({ success: true, data: merged });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error listing modules', error: error.message });
    }
};

exports.createModule = async (req, res) => {
    try {
        const { key, name, fields } = req.body;
        if (!key || !name) {
            return res.status(400).json({ success: false, message: 'key and name are required' });
        }
        const doc = await ModuleDefinition.create({
            organizationId: req.user.organizationId,
            key: String(key).toLowerCase().trim(),
            name: String(name).trim(),
            type: 'custom',
            fields: Array.isArray(fields) ? fields : []
        });
        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Module key already exists' });
        }
        res.status(500).json({ success: false, message: 'Error creating module', error: error.message });
    }
};

exports.deleteModule = async (req, res) => {
    try {
        const { id } = req.params;
        const mod = await ModuleDefinition.findOne({ 
            _id: id, 
            organizationId: req.user.organizationId,
            key: { $ne: 'groups' } // Exclude groups
        });
        if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });
        if (mod.type === 'system') return res.status(403).json({ success: false, message: 'Cannot delete system module' });
        await mod.deleteOne();
        res.json({ success: true, message: 'Module deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting module', error: error.message });
    }
};

exports.updateModule = async (req, res) => {
    try {
        const { id } = req.params;
        const mod = await ModuleDefinition.findOne({ 
            _id: id, 
            organizationId: req.user.organizationId,
            key: { $ne: 'groups' } // Exclude groups
        });
        if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

        const { name, enabled, fields, relationships, quickCreate, quickCreateLayout } = req.body;
        
        console.log('🔵 updateModule called:', {
            moduleId: id,
            moduleKey: mod.key,
            bodyKeys: Object.keys(req.body),
            quickCreateProvided: quickCreate !== undefined,
            quickCreateValue: quickCreate,
            quickCreateType: typeof quickCreate,
            quickCreateIsArray: Array.isArray(quickCreate),
            quickCreateLayoutProvided: quickCreateLayout !== undefined,
            quickCreateLayoutValue: quickCreateLayout
        });
        
        if (name !== undefined) mod.name = String(name).trim();
        if (enabled !== undefined) mod.enabled = !!enabled;
        if (Array.isArray(fields)) mod.fields = fields;
        
        // Always update relationships if provided (even if empty array)
        if (relationships !== undefined) {
            const newRelationships = Array.isArray(relationships) ? relationships : [];
            console.log('📝 Setting relationships:', {
                from: mod.relationships?.length || 0,
                to: newRelationships.length,
                relationships: newRelationships
            });
            mod.set('relationships', newRelationships);
            mod.markModified('relationships');
        }
        
        // Always update quickCreate if provided (even if empty array)
        if (quickCreate !== undefined) {
            const newQuickCreate = Array.isArray(quickCreate) ? quickCreate : [];
            console.log('📝 Setting quickCreate:', {
                from: mod.quickCreate,
                to: newQuickCreate,
                length: newQuickCreate.length
            });
            mod.set('quickCreate', newQuickCreate);
        }
        
        // Always update quickCreateLayout if provided
        if (quickCreateLayout !== undefined) {
            const newLayout = (quickCreateLayout && typeof quickCreateLayout === 'object') 
                ? quickCreateLayout 
                : { version: 1, rows: [] };
            console.log('📝 Setting quickCreateLayout:', {
                from: mod.quickCreateLayout,
                to: newLayout,
                rows: newLayout.rows?.length || 0
            });
            mod.set('quickCreateLayout', newLayout);
        }
        
        // Mark as modified to ensure Mongoose saves these fields
        if (quickCreate !== undefined) mod.markModified('quickCreate');
        if (quickCreateLayout !== undefined) mod.markModified('quickCreateLayout');
        
        await mod.save();
        
        // Reload from database to ensure we get the latest data - use lean() for plain object
        const saved = await ModuleDefinition.findById(mod._id).lean();
        
        console.log('✅ Module saved. Verification:', {
            key: saved.key,
            relationships: saved.relationships,
            relationshipsLength: saved.relationships?.length || 0,
            quickCreate: saved.quickCreate,
            quickCreateLength: saved.quickCreate?.length || 0,
            quickCreateType: Array.isArray(saved.quickCreate),
            quickCreateLayout: saved.quickCreateLayout,
            quickCreateLayoutRows: saved.quickCreateLayout?.rows?.length || 0,
            modQuickCreate: mod.quickCreate,
            modQuickCreateLayout: mod.quickCreateLayout
        });
        
        // saved is already a plain object from lean(), but ensure all fields are present
        const responseData = saved || {};
        
        // Always explicitly set these fields from the saved document
        responseData.relationships = saved?.relationships || [];
        responseData.quickCreate = saved?.quickCreate || [];
        responseData.quickCreateLayout = saved?.quickCreateLayout || { version: 1, rows: [] };
        
        // Final check - ensure responseData has the fields before sending
        if (!('relationships' in responseData) || responseData.relationships === undefined) {
            console.warn('⚠️  relationships missing in responseData, forcing set from saved');
            responseData.relationships = saved?.relationships || [];
        }
        if (!('quickCreate' in responseData) || responseData.quickCreate === undefined) {
            console.warn('⚠️  quickCreate missing in responseData, forcing set from saved');
            responseData.quickCreate = saved?.quickCreate || [];
        }
        if (!('quickCreateLayout' in responseData) || responseData.quickCreateLayout === undefined) {
            console.warn('⚠️  quickCreateLayout missing in responseData, forcing set from saved');
            responseData.quickCreateLayout = saved?.quickCreateLayout || { version: 1, rows: [] };
        }
        
        console.log('📤 Sending response (FINAL):', {
            hasQuickCreate: 'quickCreate' in responseData,
            quickCreate: responseData.quickCreate,
            quickCreateLength: responseData.quickCreate?.length || 0,
            hasQuickCreateLayout: 'quickCreateLayout' in responseData,
            quickCreateLayout: responseData.quickCreateLayout,
            quickCreateLayoutRows: responseData.quickCreateLayout?.rows?.length || 0,
            savedQuickCreate: saved?.quickCreate,
            savedQuickCreateType: typeof saved?.quickCreate
        });
        
        res.json({ 
            success: true, 
            data: responseData, 
            message: 'Module updated' 
        });
    } catch (error) {
        console.error('❌ Error updating module:', error);
        res.status(500).json({ success: false, message: 'Error updating module', error: error.message });
    }
};

exports.updateSystemModule = async (req, res) => {
    try {
        const { key } = req.params;
        const systemKeys = new Set(['people','organizations','deals','tasks','events','imports','reports']);
        if (!systemKeys.has(key)) return res.status(400).json({ success: false, message: 'Invalid system module key' });
        const { fields, enabled, name, relationships, quickCreate, quickCreateLayout } = req.body;
        
        console.log('🔵 updateSystemModule called:', {
            moduleKey: key,
            organizationId: req.user.organizationId,
            bodyKeys: Object.keys(req.body),
            quickCreateProvided: quickCreate !== undefined,
            quickCreateValue: quickCreate,
            quickCreateType: typeof quickCreate,
            quickCreateIsArray: Array.isArray(quickCreate),
            quickCreateLayoutProvided: quickCreateLayout !== undefined,
            quickCreateLayoutValue: quickCreateLayout
        });
        
        // Build update object - only include fields that are provided
        const updateObj = {
            type: 'system'
        };
        
        if (name !== undefined) updateObj.name = String(name).trim();
        if (enabled !== undefined) updateObj.enabled = !!enabled;
        if (Array.isArray(fields)) updateObj.fields = fields;
        if (Array.isArray(relationships)) updateObj.relationships = relationships;
        
        // Always update quickCreate if provided (even if empty array)
        if (quickCreate !== undefined) {
            updateObj.quickCreate = Array.isArray(quickCreate) ? quickCreate : [];
            console.log('📝 Setting quickCreate in updateObj:', {
                value: updateObj.quickCreate,
                length: updateObj.quickCreate.length,
                type: typeof updateObj.quickCreate,
                isArray: Array.isArray(updateObj.quickCreate)
            });
        }
        
        // Always update quickCreateLayout if provided
        if (quickCreateLayout !== undefined) {
            updateObj.quickCreateLayout = (quickCreateLayout && typeof quickCreateLayout === 'object') 
                ? quickCreateLayout 
                : { version: 1, rows: [] };
            console.log('📝 Setting quickCreateLayout in updateObj:', {
                version: updateObj.quickCreateLayout?.version,
                rows: updateObj.quickCreateLayout?.rows?.length || 0,
                hasRows: 'rows' in updateObj.quickCreateLayout
            });
        }
        
        console.log('🔧 Update object keys:', Object.keys(updateObj));
        console.log('🔧 Update object quickCreate:', updateObj.quickCreate);
        console.log('🔧 Update object quickCreate type:', typeof updateObj.quickCreate, Array.isArray(updateObj.quickCreate));
        console.log('🔧 Update object quickCreateLayout:', JSON.stringify(updateObj.quickCreateLayout, null, 2));
        
        // Deep copy to ensure we're working with clean data
        const cleanUpdateObj = JSON.parse(JSON.stringify(updateObj));
        console.log('🔧 Clean update object quickCreate:', cleanUpdateObj.quickCreate);
        console.log('🔧 Clean update object quickCreate type:', typeof cleanUpdateObj.quickCreate, Array.isArray(cleanUpdateObj.quickCreate));
        
        // Log the exact update operation
        console.log('🔧 MongoDB Update Operation:', {
            filter: { organizationId: req.user.organizationId.toString(), key },
            update: { $set: cleanUpdateObj },
            updateObjKeys: Object.keys(cleanUpdateObj),
            updateObjHasQuickCreate: 'quickCreate' in cleanUpdateObj,
            updateObjQuickCreateLength: cleanUpdateObj.quickCreate?.length || 0,
            updateObjHasQuickCreateLayout: 'quickCreateLayout' in cleanUpdateObj
        });
        
        // Ensure quickCreate is definitely in the update if provided
        if (quickCreate !== undefined && updateObj.quickCreate) {
            console.log('✅ quickCreate will be saved:', {
                value: updateObj.quickCreate,
                length: updateObj.quickCreate.length,
                isArray: Array.isArray(updateObj.quickCreate),
                keys: updateObj.quickCreate.slice(0, 5) // First 5 keys
            });
        }
        
        // Mongoose updateOne seems to be filtering out quickCreate and fields
        // So we'll use direct MongoDB driver for these critical fields and Mongoose for others
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        const collection = db.collection('moduledefinitions');
        
        // Separate critical fields that Mongoose seems to ignore
        const criticalFields = {};
        const otherFields = {};
        
        Object.keys(cleanUpdateObj).forEach(key => {
            if (key === 'quickCreate' || key === 'quickCreateLayout' || key === 'fields' || key === 'relationships') {
                criticalFields[key] = cleanUpdateObj[key];
            } else {
                otherFields[key] = cleanUpdateObj[key];
            }
        });
        
        // Update non-critical fields with Mongoose first
        let updateResult = { matchedCount: 0, modifiedCount: 0 };
        if (Object.keys(otherFields).length > 0) {
            updateResult = await ModuleDefinition.updateOne(
                { organizationId: req.user.organizationId, key },
                { $set: otherFields },
                { upsert: true, runValidators: false }
            );
            console.log('📊 Mongoose updateOne result (other fields):', {
                matchedCount: updateResult.matchedCount,
                modifiedCount: updateResult.modifiedCount,
                fields: Object.keys(otherFields)
            });
        }
        
        // ALWAYS use direct MongoDB driver for critical fields (quickCreate, fields, quickCreateLayout)
        if (Object.keys(criticalFields).length > 0) {
            console.log('🔧 Using direct MongoDB update for critical fields:', Object.keys(criticalFields));
            
            const directUpdateResult = await collection.updateOne(
                { 
                    organizationId: new mongoose.Types.ObjectId(req.user.organizationId), 
                    key: key.toLowerCase()
                },
                { 
                    $set: criticalFields
                },
                { upsert: false }
            );
            
            console.log('📊 Direct MongoDB update result:', {
                matchedCount: directUpdateResult.matchedCount,
                modifiedCount: directUpdateResult.modifiedCount,
                acknowledged: directUpdateResult.acknowledged,
                fields: Object.keys(criticalFields),
                relationshipsCount: criticalFields.relationships?.length || 0,
                quickCreate: criticalFields.quickCreate?.length || 0,
                fieldsCount: criticalFields.fields?.length || 0
            });
            
            if (directUpdateResult.matchedCount === 0) {
                console.error('🚨 WARNING: Document not found for direct update!', {
                    organizationId: req.user.organizationId.toString(),
                    key: key.toLowerCase()
                });
            }
        }
        
        // Now fetch the document to verify what was saved
        const doc = await ModuleDefinition.findOne({ 
            organizationId: req.user.organizationId, 
            key 
        });
        
        if (!doc) {
            throw new Error('Failed to retrieve document after save');
        }
        
        console.log('📄 Document after updateOne:', {
            docId: doc._id,
            docRelationships: doc.relationships,
            docRelationshipsLength: doc.relationships?.length || 0,
            docQuickCreate: doc.quickCreate,
            docQuickCreateLength: doc.quickCreate?.length || 0,
            docQuickCreateType: typeof doc.quickCreate,
            docQuickCreateIsArray: Array.isArray(doc.quickCreate),
            docHasQuickCreate: 'quickCreate' in doc,
            docQuickCreateLayout: doc.quickCreateLayout,
            docQuickCreateLayoutRows: doc.quickCreateLayout?.rows?.length || 0
        });
        
        console.log('🔍 Immediately after save:', {
            docQuickCreate: doc.quickCreate,
            docQuickCreateLength: doc.quickCreate?.length || 0,
            docHasQuickCreate: 'quickCreate' in doc,
            docQuickCreateType: typeof doc.quickCreate,
            docQuickCreateLayout: doc.quickCreateLayout,
            docQuickCreateLayoutRows: doc.quickCreateLayout?.rows?.length || 0,
            docId: doc._id
        });
        
        // Wait a brief moment for write to complete, then verify
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify what was actually saved by querying directly from MongoDB (bypass Mongoose)
        const verifiedRaw = await collection.findOne({ 
            organizationId: new mongoose.Types.ObjectId(req.user.organizationId), 
            key: key.toLowerCase()
        });
        
        console.log('🔍 Raw MongoDB document keys:', verifiedRaw ? Object.keys(verifiedRaw) : 'Document not found');
        console.log('🔍 Raw MongoDB relationships:', verifiedRaw?.relationships, 'length:', verifiedRaw?.relationships?.length || 0);
        console.log('🔍 Raw MongoDB quickCreate:', verifiedRaw?.quickCreate);
        console.log('🔍 Raw MongoDB fields count:', verifiedRaw?.fields?.length || 0);
        
        // Also verify with Mongoose to compare
        const verified = await ModuleDefinition.findOne({ 
            organizationId: req.user.organizationId, 
            key 
        }).lean(); // Use lean() to get plain JavaScript object
        
        // Also get the Mongoose document to compare
        const verifiedDoc = await ModuleDefinition.findOne({ 
            organizationId: req.user.organizationId, 
            key 
        });
        
        console.log('🔍 After lean query (from database):', {
            verifiedRelationships: verified?.relationships,
            verifiedRelationshipsLength: verified?.relationships?.length || 0,
            verifiedHasRelationships: verified && 'relationships' in verified,
            verifiedQuickCreate: verified?.quickCreate,
            verifiedQuickCreateLength: verified?.quickCreate?.length || 0,
            verifiedHasQuickCreate: verified && 'quickCreate' in verified,
            verifiedQuickCreateLayout: verified?.quickCreateLayout,
            verifiedQuickCreateLayoutRows: verified?.quickCreateLayout?.rows?.length || 0,
            verifiedId: verified?._id,
            verifiedKey: verified?.key,
            allVerifiedKeys: verified ? Object.keys(verified) : []
        });
        
        // Compare with Mongoose document version
        if (verifiedDoc) {
            console.log('🔍 Mongoose document (not lean):', {
                docRelationships: verifiedDoc.relationships,
                docRelationshipsLength: verifiedDoc.relationships?.length || 0,
                docHasRelationships: 'relationships' in verifiedDoc,
                docQuickCreate: verifiedDoc.quickCreate,
                docQuickCreateLength: verifiedDoc.quickCreate?.length || 0,
                docHasQuickCreate: 'quickCreate' in verifiedDoc,
                docQuickCreateLayout: verifiedDoc.quickCreateLayout,
                docQuickCreateLayoutRows: verifiedDoc.quickCreateLayout?.rows?.length || 0
            });
        }
        
        // Use raw MongoDB document if available (most reliable), otherwise fall back to Mongoose verified
        const sourceDoc = verifiedRaw || verified;
        // Ensure verified includes relationships from sourceDoc
        if (verified && sourceDoc?.relationships) {
            verified.relationships = sourceDoc.relationships;
        }
        
        // Verify critical fields were saved correctly
        if (criticalFields.relationships) {
            const savedRelationships = sourceDoc?.relationships || [];
            const savedLength = Array.isArray(savedRelationships) ? savedRelationships.length : 0;
            const expectedLength = Array.isArray(criticalFields.relationships) ? criticalFields.relationships.length : 0;
            
            if (savedLength !== expectedLength) {
                console.error('🚨 CRITICAL: relationships still not saved correctly!', {
                    expected: expectedLength,
                    saved: savedLength,
                    relationships: criticalFields.relationships
                });
            } else {
                console.log('✅ Relationships saved correctly:', {
                    expected: expectedLength,
                    saved: savedLength
                });
            }
        }
        
        if (criticalFields.quickCreate) {
            const savedQuickCreate = sourceDoc?.quickCreate || [];
            const savedLength = Array.isArray(savedQuickCreate) ? savedQuickCreate.length : 0;
            const expectedLength = Array.isArray(criticalFields.quickCreate) ? criticalFields.quickCreate.length : 0;
            
            if (savedLength !== expectedLength) {
                console.error('🚨 CRITICAL: quickCreate still not saved correctly!', {
                    expected: expectedLength,
                    saved: savedLength,
                    expectedArray: criticalFields.quickCreate,
                    savedArray: savedQuickCreate,
                    rawDocHasIt: verifiedRaw && 'quickCreate' in verifiedRaw,
                    mongooseDocHasIt: verified && 'quickCreate' in verified
                });
            } else {
                console.log('✅ quickCreate verified successfully:', {
                    length: savedLength,
                    values: savedQuickCreate
                });
            }
        }
        
        if (criticalFields.fields) {
            const savedFields = sourceDoc?.fields || [];
            const savedCount = Array.isArray(savedFields) ? savedFields.length : 0;
            const expectedCount = Array.isArray(criticalFields.fields) ? criticalFields.fields.length : 0;
            
            if (savedCount !== expectedCount) {
                console.error('🚨 CRITICAL: fields still not saved correctly!', {
                    expected: expectedCount,
                    saved: savedCount
                });
            } else {
                console.log('✅ fields verified successfully:', {
                    count: savedCount
                });
            }
        }
        
        // Update doc and verified from sourceDoc for response
        if (sourceDoc) {
            if (criticalFields.quickCreate) {
                doc.quickCreate = sourceDoc.quickCreate;
                verified.quickCreate = sourceDoc.quickCreate;
                if (criticalFields.quickCreateLayout) {
                    doc.quickCreateLayout = sourceDoc.quickCreateLayout;
                    verified.quickCreateLayout = sourceDoc.quickCreateLayout;
                }
            }
            if (criticalFields.fields) {
                doc.fields = sourceDoc.fields;
                verified.fields = sourceDoc.fields;
            }
        }
        
        console.log('✅ System module saved. Verification:', {
            key: doc.key,
            docQuickCreate: doc.quickCreate,
            docQuickCreateLength: doc.quickCreate?.length || 0,
            docQuickCreateType: typeof doc.quickCreate,
            docQuickCreateIsArray: Array.isArray(doc.quickCreate),
            docQuickCreateLayout: doc.quickCreateLayout,
            verifiedQuickCreate: verified?.quickCreate,
            verifiedQuickCreateLength: verified?.quickCreate?.length || 0,
            verifiedQuickCreateType: typeof verified?.quickCreate,
            verifiedQuickCreateIsArray: Array.isArray(verified?.quickCreate),
            verifiedQuickCreateLayout: verified?.quickCreateLayout,
            updateObjQuickCreate: updateObj.quickCreate,
            updateObjQuickCreateLength: updateObj.quickCreate?.length || 0,
            updateObjQuickCreateLayout: updateObj.quickCreateLayout
        });
        
        // Use verified document or doc - always use the one from database
        const responseDoc = verified || doc;
        
        // Convert to plain object - use JSON serialization to ensure all fields
        let responseData;
        if (responseDoc.toObject) {
            responseData = responseDoc.toObject({ getters: true, virtuals: false });
        } else {
            responseData = JSON.parse(JSON.stringify(responseDoc));
        }
        
        // Always explicitly set these fields - prioritize verified (from lean query)
        // verified is a plain object, so it should have all fields
        // Note: verified was already updated from sourceDoc earlier, so use it directly
        let relationshipsValue = verified?.relationships;
        let quickCreateValue = verified?.quickCreate;
        let quickCreateLayoutValue = verified?.quickCreateLayout;
        
        // If verified doesn't have it, check updateObj (what we tried to save)
        if (!relationshipsValue && updateObj.relationships) {
            console.warn('⚠️  relationships not found in saved doc, using updateObj value');
            relationshipsValue = updateObj.relationships;
        }
        if (!quickCreateValue && updateObj.quickCreate) {
            console.warn('⚠️  quickCreate not found in saved doc, using updateObj value');
            quickCreateValue = updateObj.quickCreate;
        }
        if (!quickCreateLayoutValue && updateObj.quickCreateLayout) {
            console.warn('⚠️  quickCreateLayout not found in saved doc, using updateObj value');
            quickCreateLayoutValue = updateObj.quickCreateLayout;
        }
        
        console.log('🔍 Source document check:', {
            usingVerified: !!verified,
            sourceDocHasQuickCreate: 'quickCreate' in (sourceDoc || {}),
            quickCreateValue: quickCreateValue,
            quickCreateValueType: typeof quickCreateValue,
            quickCreateIsArray: Array.isArray(quickCreateValue),
            sourceDocHasQuickCreateLayout: 'quickCreateLayout' in (sourceDoc || {}),
            quickCreateLayoutValue: quickCreateLayoutValue,
            fallbackToUpdateObj: !sourceDoc?.quickCreate && !!updateObj.quickCreate
        });
        
        // Set the values - always use arrays/objects, never undefined
        responseData.relationships = Array.isArray(relationshipsValue) ? relationshipsValue : (relationshipsValue || []);
        responseData.quickCreate = Array.isArray(quickCreateValue) ? quickCreateValue : (quickCreateValue || []);
        responseData.quickCreateLayout = (quickCreateLayoutValue && typeof quickCreateLayoutValue === 'object') 
            ? quickCreateLayoutValue 
            : (quickCreateLayoutValue || { version: 1, rows: [] });
        
        // Final check - prioritize what was saved, but if empty or missing, use what was requested
        // This handles cases where the save might not have persisted but we still want to return what was requested
        let finalQuickCreate = [];
        if (quickCreateValue && Array.isArray(quickCreateValue)) {
            finalQuickCreate = quickCreateValue; // Use what's in the database
        } else if (updateObj.quickCreate && Array.isArray(updateObj.quickCreate)) {
            finalQuickCreate = updateObj.quickCreate; // Fallback to what was requested
        }
        
        let finalQuickCreateLayout = { version: 1, rows: [] };
        if (quickCreateLayoutValue && typeof quickCreateLayoutValue === 'object' && quickCreateLayoutValue.version) {
            finalQuickCreateLayout = quickCreateLayoutValue; // Use what's in the database
        } else if (updateObj.quickCreateLayout && typeof updateObj.quickCreateLayout === 'object') {
            finalQuickCreateLayout = updateObj.quickCreateLayout; // Fallback to what was requested
        }
        
        // Always set these in responseData
        responseData.quickCreate = finalQuickCreate;
        responseData.quickCreateLayout = finalQuickCreateLayout;
        
        console.log('📤 Sending response (FINAL):', {
            hasQuickCreate: 'quickCreate' in responseData,
            quickCreate: responseData.quickCreate,
            quickCreateLength: responseData.quickCreate?.length || 0,
            hasQuickCreateLayout: 'quickCreateLayout' in responseData,
            quickCreateLayout: responseData.quickCreateLayout,
            quickCreateLayoutRows: responseData.quickCreateLayout?.rows?.length || 0,
            usingUpdateObjValues: (finalQuickCreate === updateObj.quickCreate || finalQuickCreateLayout === updateObj.quickCreateLayout),
            responseDataKeys: Object.keys(responseData)
        });
        
        // Final relationships value - prioritize saved, fallback to updateObj
        let finalRelationships = [];
        if (relationshipsValue && Array.isArray(relationshipsValue)) {
            finalRelationships = relationshipsValue; // Use what's in the database
        } else if (updateObj.relationships && Array.isArray(updateObj.relationships)) {
            finalRelationships = updateObj.relationships; // Fallback to what was requested
        }
        
        // Create a fresh object to ensure no Mongoose document weirdness
        const finalResponse = {
            _id: responseData._id || doc._id,
            organizationId: responseData.organizationId || doc.organizationId,
            key: responseData.key || doc.key,
            name: responseData.name || doc.name,
            type: responseData.type || doc.type || 'system',
            enabled: responseData.enabled !== undefined ? responseData.enabled : doc.enabled,
            fields: responseData.fields || doc.fields || [],
            relationships: finalRelationships,
            quickCreate: finalQuickCreate,
            quickCreateLayout: finalQuickCreateLayout,
            createdAt: responseData.createdAt || doc.createdAt,
            updatedAt: responseData.updatedAt || doc.updatedAt
        };
        
        res.json({ 
            success: true, 
            data: finalResponse, 
            message: 'System module updated' 
        });
    } catch (error) {
        console.error('❌ Error updating system module:', error);
        res.status(500).json({ success: false, message: 'Error updating system module', error: error.message });
    }
};


