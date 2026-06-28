/**
 * Script to add default filter metadata to all core modules
 * 
 * This script updates field definitions with filterable, filterType, and filterPriority
 * for default filters across all core modules (People, Organizations, Tasks, Events, Forms, Items).
 * 
 * Rules:
 * - Maximum 3 default filters per module
 * - Schema-driven only (field metadata)
 * - Cross-app, high-signal filters (ownership, status, time)
 * - Admins can change/disable via Field Configuration UI
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');

// Connect to MongoDB - check multiple environment variable names (same logic as server.js)
const isProduction = process.env.NODE_ENV === 'production';
let MONGO_URI = process.env.MONGODB_URI 
  || process.env.MONGO_URI 
  || (isProduction ? process.env.MONGO_URI_PRODUCTION : process.env.MONGO_URI_LOCAL)
  || process.env.MONGO_URI_ATLAS;

// Check if MongoDB URI is set
if (!MONGO_URI) {
  console.error('❌ Error: MongoDB URI not found in environment variables.');
  console.error('   Please set one of the following in your .env file:');
  console.error('   - MONGODB_URI');
  console.error('   - MONGO_URI');
  console.error('   - MONGO_URI_LOCAL (for local development)');
  console.error('   - MONGO_URI_ATLAS (for MongoDB Atlas)');
  console.error('');
  console.error('   Example format:');
  console.error('   MONGODB_URI=mongodb://username:password@host:port/database?authSource=admin');
  console.error('   or for MongoDB Atlas:');
  console.error('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  process.exit(1);
}

// Extract base URI and connect to arivu_master (same as server.js)
// Preserve query string parameters (important for authentication)
const [mongoUriWithoutQuery, mongoUriQueryPart] = MONGO_URI.split('?');
const mongoQueryString = mongoUriQueryPart ? `?${mongoUriQueryPart}` : '';
const baseUri = mongoUriWithoutQuery.split('/').slice(0, -1).join('/');
const masterDbName = 'arivu_master';
const MONGODB_URI = `${baseUri}/${masterDbName}${mongoQueryString}`;

console.log(`📊 Using database: ${masterDbName}`);
// Show connection info (mask credentials for security)
const maskedUri = baseUri.replace(/:\/\/[^@]+@/, '://***:***@');
const maskedQuery = mongoQueryString ? '?' + mongoQueryString.split('&').map(p => p.split('=')[0] + '=***').join('&') : '';
console.log(`📊 Connection: ${maskedUri}/${masterDbName}${maskedQuery}`);

// Default filter metadata for each module (max 3 per module)
const moduleFilterMetadata = {
  people: {
    'assignedTo': {
      filterable: true,
      filterType: 'user',
      filterPriority: 1
    },
    'type': {
      filterable: true,
      filterType: 'multi-select',
      filterPriority: 2
    },
    'do_not_contact': {
      filterable: true,
      filterType: 'boolean',
      filterPriority: 3
    }
  },
  organizations: {
    'assignedTo': {
      filterable: true,
      filterType: 'user',
      filterPriority: 1
    },
    'isActive': {
      filterable: true,
      filterType: 'boolean',
      filterPriority: 2
    },
    'types': {
      filterable: true,
      filterType: 'multi-select',
      filterPriority: 3
    }
  },
  tasks: {
    'assignedTo': {
      filterable: true,
      filterType: 'user',
      filterPriority: 1
    },
    'status': {
      filterable: true,
      filterType: 'select',
      filterPriority: 2
    },
    'dueDate': {
      filterable: true,
      filterType: 'date',
      filterPriority: 3
    }
  },
  events: {
    'assignedTo': {
      filterable: true,
      filterType: 'user',
      filterPriority: 1
    },
    'startDateTime': {
      filterable: true,
      filterType: 'date',
      filterPriority: 2
    },
    'eventType': {
      filterable: true,
      filterType: 'select',
      filterPriority: 3
    }
  },
  forms: {
    'status': {
      filterable: true,
      filterType: 'select',
      filterPriority: 1
    },
    'type': {
      filterable: true,
      filterType: 'select',
      filterPriority: 2
    }
  },
  items: {
    'item_type': {
      filterable: true,
      filterType: 'select',
      filterPriority: 1
    },
    'status': {
      filterable: true,
      filterType: 'select',
      filterPriority: 2
    }
  }
};

async function updateModuleFilterMetadata(organizationId = null) {
  let shouldDisconnect = false;

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
      shouldDisconnect = true;
      console.log('✅ Connected to MongoDB');
    }

    const orgQuery = organizationId ? { _id: organizationId } : {};
    const organizations = await Organization.find(orgQuery).select('_id name');

    console.log(`Updating filter metadata for ${organizations.length} organization(s)`);

    for (const org of organizations) {
      console.log(`\nProcessing organization: ${org.name || org._id}`);

      for (const [moduleKey, filterMetadata] of Object.entries(moduleFilterMetadata)) {
        // Try to find module by moduleKey first, then fall back to key
        // First try organization-specific module
        let moduleDef = await ModuleDefinition.findOne({
          organizationId: org._id,
          moduleKey: moduleKey,
          type: 'system'
        });
        
        // Fallback: try finding by key if moduleKey doesn't exist
        if (!moduleDef) {
          moduleDef = await ModuleDefinition.findOne({
            organizationId: org._id,
            key: moduleKey,
            type: 'system'
          });
        }
        
        // Fallback: try finding platform-level module (organizationId: null)
        if (!moduleDef) {
          moduleDef = await ModuleDefinition.findOne({
            organizationId: null,
            moduleKey: moduleKey
          });
        }
        
        // Final fallback: try finding platform-level by key
        if (!moduleDef) {
          moduleDef = await ModuleDefinition.findOne({
            organizationId: null,
            key: moduleKey
          });
        }

        if (!moduleDef) {
          console.log(`  ⚠️  Module '${moduleKey}' not found, skipping...`);
          continue;
        }

        const fields = Array.isArray(moduleDef.fields) ? [...moduleDef.fields] : [];
        let fieldsUpdated = false;

        // Update each field with filter metadata
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          if (!field || !field.key) continue;

          const fieldKey = field.key;
          const filterMeta = filterMetadata[fieldKey];

          // Ensure filter metadata properties exist
          if (field.filterable === undefined) {
            field.filterable = false;
            fieldsUpdated = true;
          }
          if (field.filterType === undefined) {
            field.filterType = null;
            fieldsUpdated = true;
          }
          if (field.filterPriority === undefined) {
            field.filterPriority = null;
            fieldsUpdated = true;
          }

          // Apply filter metadata if field is in the metadata map
          if (filterMeta) {
            // Only update if values are different (preserve user customizations if they exist)
            // But if field doesn't have filter settings, apply defaults
            const hasExistingFilterSettings = field.filterable !== false || 
                                             field.filterType !== null || 
                                             field.filterPriority !== null;

            if (!hasExistingFilterSettings) {
              // No existing filter settings, apply defaults
              field.filterable = filterMeta.filterable;
              field.filterType = filterMeta.filterType;
              field.filterPriority = filterMeta.filterPriority;
              fieldsUpdated = true;
              console.log(`    ✅ Applied filter metadata to ${fieldKey}: filterable=${filterMeta.filterable}, filterType=${filterMeta.filterType}, filterPriority=${filterMeta.filterPriority}`);
            } else {
              // Has existing settings - only update if they match the default (user hasn't customized)
              // This preserves user customizations while ensuring defaults are set
              const matchesDefault = field.filterable === filterMeta.filterable &&
                                   field.filterType === filterMeta.filterType &&
                                   field.filterPriority === filterMeta.filterPriority;

              if (!matchesDefault && field.filterable === true) {
                // User has customized - preserve it
                console.log(`    ℹ️  Preserving user customization for ${fieldKey}`);
              } else if (!matchesDefault) {
                // Field has different settings but not customized - update to default
                field.filterable = filterMeta.filterable;
                field.filterType = filterMeta.filterType;
                field.filterPriority = filterMeta.filterPriority;
                fieldsUpdated = true;
                console.log(`    ✅ Updated filter metadata for ${fieldKey} to defaults`);
              }
            }
          } else {
            // Field is not in default filter list - ensure it's marked as not filterable
            if (field.filterable === undefined || field.filterable === null) {
              field.filterable = false;
              fieldsUpdated = true;
            }
          }
        }

        if (fieldsUpdated) {
          // Only update the fields array, don't modify appKey/moduleKey to avoid duplicate key errors
          moduleDef.fields = fields;
          moduleDef.markModified('fields');
          
          // Use updateOne to only update fields, avoiding validation issues with appKey/moduleKey
          await ModuleDefinition.updateOne(
            { _id: moduleDef._id },
            { $set: { fields: fields } }
          );
          console.log(`  ✓ Updated ${moduleKey} module filter metadata`);
        } else {
          console.log(`  - No changes needed for ${moduleKey} module`);
        }
      }
    }

    console.log('\n✅ Filter metadata update completed successfully');
  } catch (error) {
    console.error('❌ Error updating filter metadata:', error);
    throw error;
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run if called directly
if (require.main === module) {
  updateModuleFilterMetadata()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = updateModuleFilterMetadata;
