#!/usr/bin/env node

/**
 * Rename legacy owner fields to assignedTo across tenant data and module definitions.
 *
 * Collections:
 * - deals.ownerId → assignedTo
 * - quotes.ownerId → assignedTo
 * - salesorders.ownerId → assignedTo
 * - invoices.ownerId → assignedTo
 * - documents.ownerId → assignedTo
 * - targets.ownerId → assignedTo
 * - cases.caseOwnerId → assignedTo
 * - events.eventOwnerId → assignedTo
 * - appointmentbookingconfigs.ownerId → assignedTo
 * - documentfolders.ownerId → assignedTo
 * - content_templates.ownerId → assignedTo
 *
 * Also rewrites ModuleDefinition field keys and quickCreate entries.
 *
 * Usage: node server/scripts/migrateOwnerFieldsToAssignedTo.js [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getMongoUris, connectMasterWithRetry } = require('../lib/mongoConnect');
const ModuleDefinition = require('../models/ModuleDefinition');

const DRY_RUN = process.argv.includes('--dry-run');

const COLLECTION_RENAMES = [
  { collection: 'deals', from: 'ownerId', to: 'assignedTo' },
  { collection: 'quotes', from: 'ownerId', to: 'assignedTo' },
  { collection: 'salesorders', from: 'ownerId', to: 'assignedTo' },
  { collection: 'invoices', from: 'ownerId', to: 'assignedTo' },
  { collection: 'documents', from: 'ownerId', to: 'assignedTo' },
  { collection: 'targets', from: 'ownerId', to: 'assignedTo' },
  { collection: 'cases', from: 'caseOwnerId', to: 'assignedTo' },
  { collection: 'events', from: 'eventOwnerId', to: 'assignedTo' },
  { collection: 'appointmentbookingconfigs', from: 'ownerId', to: 'assignedTo' },
  { collection: 'documentfolders', from: 'ownerId', to: 'assignedTo' },
  { collection: 'content_templates', from: 'ownerId', to: 'assignedTo' }
];

const MODULE_KEYS_WITH_LEGACY_OWNER_FIELD = new Set([
  'deals',
  'quotes',
  'sales_orders',
  'invoices',
  'documents',
  'targets',
  'cases',
  'events',
  'templates'
]);

const KEY_ALIASES = {
  ownerId: 'assignedTo',
  ownerid: 'assignedTo',
  caseOwnerId: 'assignedTo',
  caseownerid: 'assignedTo',
  eventOwnerId: 'assignedTo',
  eventownerid: 'assignedTo'
};

function rewriteFieldKey(key) {
  if (!key) return key;
  const direct = KEY_ALIASES[key];
  if (direct) return direct;
  const lower = String(key).toLowerCase();
  return KEY_ALIASES[lower] || key;
}

function rewriteModuleFields(fields) {
  if (!Array.isArray(fields)) return fields;
  const seen = new Set();
  const next = [];
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    const rewritten = { ...field, key: rewriteFieldKey(field.key) };
    const normalized = String(rewritten.key || '').toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(rewritten);
  }
  return next;
}

function rewriteQuickCreate(quickCreate) {
  if (!Array.isArray(quickCreate)) return quickCreate;
  const seen = new Set();
  const next = [];
  for (const key of quickCreate) {
    const rewritten = rewriteFieldKey(key);
    const normalized = String(rewritten || '').toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(rewritten);
  }
  return next;
}

async function renameCollectionField(db, { collection, from, to }) {
  const coll = db.collection(collection);
  const filter = { [from]: { $exists: true } };
  const count = await coll.countDocuments(filter);
  if (count === 0) {
    console.log(`  ⏭  ${collection}: no documents with ${from}`);
    return { collection, renamed: 0 };
  }
  if (DRY_RUN) {
    console.log(`  [dry-run] ${collection}: would rename ${from} → ${to} on ${count} document(s)`);
    return { collection, renamed: count };
  }
  const result = await coll.updateMany(filter, [
    { $set: { [to]: `$${from}` } },
    { $unset: from }
  ]);
  console.log(`  ✅ ${collection}: renamed ${from} → ${to} on ${result.modifiedCount} document(s)`);
  return { collection, renamed: result.modifiedCount };
}

function normalizeAssignedToFieldLabels(fields) {
  if (!Array.isArray(fields)) return { fields, changed: false };
  let changed = false;
  const next = fields.map((field) => {
    if (!field || String(field.key || '').toLowerCase() !== 'assignedto') return field;
    const labelLower = String(field.label || '').toLowerCase().trim();
    const legacyLabels = new Set([
      'owner',
      'deal owner',
      'event owner',
      'case owner',
      'case owner id',
      'assigned to (owner)'
    ]);
    if (field.label === 'Assigned To') return field;
    if (!legacyLabels.has(labelLower) && labelLower !== 'assigned to') return field;
    changed = true;
    return { ...field, label: 'Assigned To' };
  });
  return { fields: changed ? next : fields, changed };
}

async function migrateModuleDefinitions() {
  const modules = await ModuleDefinition.find({}).lean();
  let updated = 0;
  for (const mod of modules) {
    const moduleKey = String(mod.moduleKey || mod.key || '').toLowerCase();
    let fields = Array.isArray(mod.fields) ? [...mod.fields] : mod.fields;
    let quickCreate = mod.quickCreate;

    if (MODULE_KEYS_WITH_LEGACY_OWNER_FIELD.has(moduleKey)) {
      fields = rewriteModuleFields(fields);
      quickCreate = rewriteQuickCreate(quickCreate);
    }

    const labelResult = normalizeAssignedToFieldLabels(fields);
    fields = labelResult.fields;

    const fieldsChanged = JSON.stringify(fields) !== JSON.stringify(mod.fields || []);
    const quickCreateChanged = JSON.stringify(quickCreate) !== JSON.stringify(mod.quickCreate || []);
    if (!fieldsChanged && !quickCreateChanged) continue;

    if (DRY_RUN) {
      console.log(`  [dry-run] ModuleDefinition ${mod._id} (${mod.moduleKey || mod.key}): would rewrite field keys`);
      updated += 1;
      continue;
    }

    await ModuleDefinition.updateOne(
      { _id: mod._id },
      {
        $set: {
          ...(fieldsChanged ? { fields } : {}),
          ...(quickCreateChanged ? { quickCreate } : {})
        }
      }
    );
    updated += 1;
    console.log(`  ✅ ModuleDefinition ${mod._id} (${mod.moduleKey || mod.key})`);
  }
  return updated;
}

async function run() {
  console.log(`🚀 migrateOwnerFieldsToAssignedTo${DRY_RUN ? ' (dry-run)' : ''}\n`);
  const { masterUri } = getMongoUris();
  await connectMasterWithRetry(masterUri);
  const db = mongoose.connection.db;

  console.log('📦 Record collections');
  for (const spec of COLLECTION_RENAMES) {
    await renameCollectionField(db, spec);
  }

  console.log('\n📋 Module definitions');
  const moduleUpdates = await migrateModuleDefinitions();
  console.log(`\n✅ Module definitions updated: ${moduleUpdates}`);

  await mongoose.connection.close();
  console.log('\nDone.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
