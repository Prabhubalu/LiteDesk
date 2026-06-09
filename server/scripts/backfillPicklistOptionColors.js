#!/usr/bin/env node
/**
 * Backfill distinct Tailwind palette colors on picklist options that are missing
 * a color or still use the platform default blue (#3B82F6).
 *
 * Preserves user-customized colors and semantic field mappings.
 *
 * Usage:
 *   node server/scripts/backfillPicklistOptionColors.js [--dry-run]
 *   node server/scripts/backfillPicklistOptionColors.js --org <organizationId> [--dry-run]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');
const ModuleDefinition = require('../models/ModuleDefinition');
const {
    backfillPicklistOptionColors,
    normalizePicklistColorHex,
    isPlatformDefaultPicklistColor,
} = require('../utils/picklistColorPalette');

const PICKLIST_TYPES = new Set(['Picklist', 'Multi-Picklist', 'Radio Button']);

function optionsNeedBackfill(options) {
    if (!Array.isArray(options) || options.length === 0) return false;
    return options.some((opt) => {
        if (typeof opt === 'string') return true;
        if (!opt || typeof opt !== 'object') return false;
        const stored = normalizePicklistColorHex(opt.color);
        return !stored || isPlatformDefaultPicklistColor(stored);
    });
}

function backfillModuleFields(fields, moduleKey) {
    if (!Array.isArray(fields) || fields.length === 0) return { fields, changed: false };

    let changed = false;
    const nextFields = fields.map((field) => {
        if (!field || typeof field !== 'object') return field;
        const dataType = String(field.dataType || '');
        if (!PICKLIST_TYPES.has(dataType)) return field;
        if (!optionsNeedBackfill(field.options)) return field;

        const nextOptions = backfillPicklistOptionColors(field.options, field.key, moduleKey);
        changed = true;
        return { ...field, options: nextOptions };
    });

    return { fields: nextFields, changed };
}

async function run() {
    const dryRun = process.argv.includes('--dry-run');
    const orgArgIdx = process.argv.indexOf('--org');
    const orgFilter = orgArgIdx >= 0 ? process.argv[orgArgIdx + 1] : null;

    let uri;
    try {
        uri = getMasterDatabaseUri();
    } catch (err) {
        console.error(
            'Missing Mongo URI. Set MONGODB_URI, MONGO_URI, or MONGO_URI_LOCAL in server/.env (or repo root .env).'
        );
        console.error(err.message);
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log(dryRun ? '[backfillPicklistOptionColors] DRY RUN' : '[backfillPicklistOptionColors] Applying writes');

    const query = orgFilter ? { organizationId: orgFilter } : {};
    const modules = await ModuleDefinition.find(query).select('+fields organizationId key moduleKey').lean();

    let updatedModules = 0;
    let updatedFields = 0;

    for (const mod of modules) {
        const moduleKey = String(mod.moduleKey || mod.key || '').toLowerCase();
        const { fields, changed } = backfillModuleFields(mod.fields, moduleKey);
        if (!changed) continue;

        updatedModules += 1;
        updatedFields += fields.filter((field, idx) => field !== mod.fields[idx]).length;

        if (!dryRun) {
            await ModuleDefinition.updateOne(
                { _id: mod._id },
                { $set: { fields, updatedAt: new Date() } }
            );
        }

        console.log(
            `[backfillPicklistOptionColors] ${dryRun ? 'Would update' : 'Updated'} module ${moduleKey} org=${mod.organizationId}`
        );
    }

    console.log(
        `[backfillPicklistOptionColors] Done. ${dryRun ? 'Would update' : 'Updated'} ${updatedModules} module definition(s).`
    );
    await mongoose.connection.close();
}

run().catch((err) => {
    console.error('[backfillPicklistOptionColors] Fatal:', err);
    process.exit(1);
});
