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
        case 'string': return 'string';
        case 'number': return 'number';
        case 'boolean': return 'boolean';
        case 'date': return 'date';
        case 'objectid': return 'reference';
        default: return 'string';
    }
}

function getBaseFieldsForKey(key) {
    try {
        const modelByKey = {
            people: require('../models/People'),
            organizations: require('../models/OrganizationV2'),
            deals: require('../models/Deal'),
            tasks: require('../models/Task'),
            events: require('../models/Event'),
            imports: require('../models/ImportHistory'),
        };
        const model = modelByKey[key];
        if (!model) return [];
        const excluded = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
        return Object.entries(model.schema.paths)
            .filter(([name]) => !excluded.has(name))
            .map(([name, path]) => ({
                key: name,
                label: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                dataType: inferDataType(path),
                required: !!path.isRequired,
                options: [],
                defaultValue: path.defaultValue ?? null,
                index: !!path._index,
                visibility: { list: true, detail: true },
                order: 0,
                validations: [],
                dependencies: []
            }));
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
            { key: 'reports', name: 'Reports' }
        ].map(m => ({
            _id: `system:${m.key}`,
            organizationId: req.user.organizationId,
            key: m.key,
            name: m.name,
            type: 'system',
            enabled: true,
            fields: getBaseFieldsForKey(m.key),
            fieldCount: 0,
            createdAt: null,
            updatedAt: null
        }));

        const custom = await ModuleDefinition.find({ organizationId: req.user.organizationId }).lean();
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
                merged.push({ ...sys, fields: saved });
                customByKey.delete(sys.key);
            } else {
                // No overrides; ensure base fields have stable order by index
                const withOrder = sys.fields.map((f, i) => ({ ...f, order: i }));
                merged.push({ ...sys, fields: withOrder });
            }
        }
        // Remaining custom modules
        for (const m of customByKey.values()) {
            const fields = Array.isArray(m.fields) ? [...m.fields] : [];
            fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            merged.push({ ...m, fields });
        }

        // Attach field counts for system modules from actual schemas
        try {
            const People = require('../models/People');
            const OrganizationV2 = require('../models/OrganizationV2');
            const Deal = require('../models/Deal');
            const Task = require('../models/Task');
            const Event = require('../models/Event');
            const ImportHistory = require('../models/ImportHistory');
            const modelByKey = {
                people: People,
                organizations: OrganizationV2,
                deals: Deal,
                tasks: Task,
                events: Event,
                imports: ImportHistory,
                reports: null // no direct model
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
        const mod = await ModuleDefinition.findOne({ _id: id, organizationId: req.user.organizationId });
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
        const mod = await ModuleDefinition.findOne({ _id: id, organizationId: req.user.organizationId });
        if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

        const { name, enabled, fields, relationships, quickCreate, quickCreateLayout } = req.body;
        if (name !== undefined) mod.name = String(name).trim();
        if (enabled !== undefined) mod.enabled = !!enabled;
        if (Array.isArray(fields)) mod.fields = fields;
        if (Array.isArray(relationships)) mod.relationships = relationships;
        if (Array.isArray(quickCreate)) mod.quickCreate = quickCreate;
        if (quickCreateLayout && typeof quickCreateLayout === 'object') mod.quickCreateLayout = quickCreateLayout;
        await mod.save();
        res.json({ success: true, data: mod, message: 'Module updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating module', error: error.message });
    }
};

exports.updateSystemModule = async (req, res) => {
    try {
        const { key } = req.params;
        const systemKeys = new Set(['people','organizations','deals','tasks','events','imports','reports']);
        if (!systemKeys.has(key)) return res.status(400).json({ success: false, message: 'Invalid system module key' });
        const { fields, enabled, name, relationships, quickCreate, quickCreateLayout } = req.body;
        const doc = await ModuleDefinition.findOneAndUpdate(
            { organizationId: req.user.organizationId, key },
            {
                $set: {
                    type: 'system',
                    name: name || key,
                    enabled: enabled !== undefined ? !!enabled : true,
                    fields: Array.isArray(fields) ? fields : [],
                    relationships: Array.isArray(relationships) ? relationships : [],
                    quickCreate: Array.isArray(quickCreate) ? quickCreate : [],
                    quickCreateLayout: quickCreateLayout && typeof quickCreateLayout === 'object' ? quickCreateLayout : { version: 1, rows: [] }
                }
            },
            { new: true, upsert: true }
        );
        res.json({ success: true, data: doc, message: 'System module updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating system module', error: error.message });
    }
};


