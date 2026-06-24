#!/usr/bin/env node

/**
 * Cleanup Incorrect Module Definitions
 * 
 * Removes module definitions that shouldn't exist:
 * - Core entities (people, organizations, tasks, events, items, forms) with appKey other than 'platform'
 * 
 * Usage: node scripts/cleanupIncorrectModuleDefinitions.js [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;
const DRY_RUN = process.argv.includes('--dry-run');

// Core entity module keys that should ONLY have appKey: 'platform'
const CORE_ENTITY_KEYS = ['people', 'organizations', 'tasks', 'events', 'items', 'forms', 'responses', 'quotes'];

async function cleanupIncorrectModuleDefinitions() {
    try {
        console.log('🧹 Cleaning Up Incorrect Module Definitions\n');
        console.log('='.repeat(60));

        if (!MONGO_URI) {
            console.error('❌ Error: MONGODB_URI is not set in .env file!');
            process.exit(1);
        }

        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log(`✅ Connected to MongoDB: ${mongoose.connection.name}\n`);

        if (DRY_RUN) {
            console.log('🔍 DRY RUN MODE - No changes will be made\n');
        }

        // Find all core entity modules with incorrect appKey
        const incorrectModules = [];
        
        for (const moduleKey of CORE_ENTITY_KEYS) {
            const modules = await ModuleDefinition.find({
                moduleKey: moduleKey,
                appKey: { $ne: 'platform' }
            }).lean();

            if (modules.length > 0) {
                console.log(`\n⚠️  Found ${modules.length} incorrect ${moduleKey} module(s) with wrong appKey:`);
                modules.forEach(m => {
                    console.log(`  - _id: ${m._id}, appKey: '${m.appKey}', organizationId: ${m.organizationId || 'null'}`);
                    incorrectModules.push(m);
                });
            }
        }

        if (incorrectModules.length === 0) {
            console.log('\n✅ No incorrect module definitions found. Database is clean!\n');
            await mongoose.connection.close();
            return;
        }

        console.log(`\n📊 Summary: Found ${incorrectModules.length} incorrect module definition(s)\n`);

        if (!DRY_RUN) {
            console.log('🗑️  Deleting incorrect module definitions...');
            const idsToDelete = incorrectModules.map(m => m._id);
            const result = await ModuleDefinition.deleteMany({
                _id: { $in: idsToDelete }
            });
            console.log(`✅ Deleted ${result.deletedCount} incorrect module definition(s)\n`);
        } else {
            console.log('🔍 DRY RUN: Would delete the following modules:');
            incorrectModules.forEach(m => {
                console.log(`  - ${m.moduleKey} (appKey: ${m.appKey}, _id: ${m._id})`);
            });
            console.log('\n💡 Run without --dry-run to actually delete these modules\n');
        }

        console.log('='.repeat(60));
        await mongoose.connection.close();
        console.log('✅ Cleanup complete\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        await mongoose.connection.close();
        process.exit(1);
    }
}

cleanupIncorrectModuleDefinitions();
