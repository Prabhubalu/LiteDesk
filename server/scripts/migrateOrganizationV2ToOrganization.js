/**
 * Migration Script: Consolidate OrganizationV2 into Organization
 * 
 * This script merges all OrganizationV2 records into the Organization model.
 * It:
 * 1. Marks existing Organization records as tenants (isTenant: true)
 * 2. Migrates all OrganizationV2 CRM fields to Organization
 * 3. Links records via legacyOrganizationId
 * 4. Removes OrganizationV2 collection (optional)
 */

const path = require('path');
// Try loading .env from multiple locations
const envPaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '.env')
];
for (const envPath of envPaths) {
    try {
        require('dotenv').config({ path: envPath });
        if (process.env.MONGODB_URI || process.env.MONGO_URI) {
            break;
        }
    } catch (e) {
        // Continue to next path
    }
}

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');

// Try to require OrganizationV2 for migration, but handle if it doesn't exist
let OrganizationV2;
try {
    OrganizationV2 = require('../models/OrganizationV2');
} catch (error) {
    // OrganizationV2 model has been removed - migration already complete
    OrganizationV2 = null;
}

// Get MongoDB URI from environment (try multiple variations, same logic as server.js)
const isProduction = process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 
                  (isProduction ? process.env.MONGO_URI_PRODUCTION : process.env.MONGO_URI_LOCAL);

if (!MONGO_URI) {
    console.error('❌ FATAL ERROR: MONGO_URI is not defined in environment variables!');
    console.error('📝 Please check your .env file and ensure MONGO_URI or MONGODB_URI is set.');
    console.error(`   Current NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    process.exit(1);
}

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Step 1: Mark all existing Organization records as tenants
        console.log('📋 Step 1: Marking existing Organizations as tenants...');
        const tenantResult = await Organization.updateMany(
            { isTenant: { $exists: false } },
            { $set: { isTenant: true } }
        );
        console.log(`✅ Marked ${tenantResult.modifiedCount} Organizations as tenants\n`);

        // Step 2: Get all OrganizationV2 records (if model exists)
        if (!OrganizationV2) {
            console.log('📋 Step 2: OrganizationV2 model not found...');
            console.log('✅ Migration already complete - OrganizationV2 model has been removed.');
            console.log('✅ All organizations are now using the unified Organization model.\n');
            await mongoose.connection.close();
            return;
        }

        console.log('📋 Step 2: Fetching OrganizationV2 records...');
        const orgV2Records = await OrganizationV2.find({}).lean();
        console.log(`✅ Found ${orgV2Records.length} OrganizationV2 records\n`);

        if (orgV2Records.length === 0) {
            console.log('✅ No OrganizationV2 records to migrate. Migration complete!');
            await mongoose.connection.close();
            return;
        }

        // Step 3: Migrate each OrganizationV2 record
        console.log('📋 Step 3: Migrating OrganizationV2 records to Organization...');
        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const orgV2 of orgV2Records) {
            try {
                // Check if an Organization already exists with this legacyOrganizationId
                if (orgV2.legacyOrganizationId) {
                    const existingTenant = await Organization.findById(orgV2.legacyOrganizationId);
                    
                    if (existingTenant) {
                        // Update the tenant org with CRM fields (if they don't exist)
                        console.log(`   🔄 Updating tenant org ${existingTenant.name} with CRM fields...`);
                        
                        // Merge CRM fields into tenant org (only if not already set)
                        const updateData = {};
                        Object.keys(orgV2).forEach(key => {
                            // Skip MongoDB internal fields and tenant-only fields
                            if (!['_id', '__v', 'createdAt', 'updatedAt', 'slug', 'subscription', 'limits', 'enabledModules', 'settings'].includes(key)) {
                                if (!existingTenant[key] || existingTenant[key] === null || existingTenant[key] === undefined) {
                                    updateData[key] = orgV2[key];
                                }
                            }
                        });
                        
                        await Organization.findByIdAndUpdate(existingTenant._id, updateData);
                        updated++;
                        continue;
                    }
                }

                // Create new Organization record with CRM data
                const orgData = {
                    ...orgV2,
                    isTenant: false, // This is a CRM organization
                    legacyOrganizationId: orgV2.legacyOrganizationId || orgV2._id,
                    _id: orgV2._id // Preserve the original ID
                };
                
                // Remove fields that shouldn't be copied
                delete orgData.__v;
                
                await Organization.create(orgData);
                created++;
                console.log(`   ✅ Migrated: ${orgV2.name}`);
            } catch (error) {
                if (error.code === 11000) {
                    // Duplicate key - record already exists
                    skipped++;
                    console.log(`   ⚠️  Skipped (duplicate): ${orgV2.name}`);
                } else {
                    console.error(`   ❌ Error migrating ${orgV2.name}:`, error.message);
                }
            }
        }

        console.log(`\n✅ Migration Summary:`);
        console.log(`   Created: ${created}`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Skipped: ${skipped}`);
        console.log(`   Total: ${orgV2Records.length}\n`);

        // Step 4: Verify migration
        console.log('📋 Step 4: Verifying migration...');
        const totalOrgs = await Organization.countDocuments({ isTenant: false });
        console.log(`✅ Total CRM Organizations: ${totalOrgs}`);
        const totalTenants = await Organization.countDocuments({ isTenant: true });
        console.log(`✅ Total Tenant Organizations: ${totalTenants}\n`);

        console.log('✅ Migration completed successfully!\n');
        console.log('⚠️  Note: OrganizationV2 model can now be safely removed from the codebase.');
        console.log('⚠️  The collection will remain in MongoDB but can be dropped after verification.\n');

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run migration
if (require.main === module) {
    migrate();
}

module.exports = migrate;

