/**
 * Script to update Events module definition with correct field types
 * This fixes picklist fields that are showing as Text
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const isProduction = process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGODB_URI 
  || process.env.MONGO_URI 
  || (isProduction ? process.env.MONGO_URI_PRODUCTION : process.env.MONGO_URI_LOCAL)
  || process.env.MONGO_URI_ATLAS;

if (!MONGO_URI) {
  console.error('❌ Error: MongoDB URI not found.');
  process.exit(1);
}

const [mongoUriWithoutQuery, mongoUriQueryPart] = MONGO_URI.split('?');
const mongoQueryString = mongoUriQueryPart ? `?${mongoUriQueryPart}` : '';
const baseUri = mongoUriWithoutQuery.split('/').slice(0, -1).join('/');
const masterDbName = 'litedesk_master';
const MONGODB_URI = `${baseUri}/${masterDbName}${mongoQueryString}`;

const ModuleDefinition = require('../models/ModuleDefinition');
const Event = require('../models/Event');

async function updateEventsModuleFields() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all organizations
    const Organization = mongoose.model('Organization', new mongoose.Schema({}, { strict: false }), 'organizations');
    const organizations = await Organization.find({}).select('_id').lean();
    console.log(`📊 Found ${organizations.length} organizations\n`);

    // System fields that should be excluded from quick create (auto-generated or system-managed)
    const systemFields = new Set([
      'eventId',        // Auto-generated UUID
      'organizationId', // Auto-filled from user context
      'createdBy',      // Auto-filled from current user
      'createdTime',    // Auto-filled timestamp
      'modifiedBy',      // Auto-filled on update
      'modifiedTime',   // Auto-filled on update
      'auditHistory'    // System-managed audit trail
    ]);

    // Field type mappings for Events
    const eventFieldMappings = {
      'eventId': 'Auto-Number',
      'eventName': 'Text',
      'eventType': 'Picklist',
      'status': 'Picklist',
      'relatedToId': 'Lookup (Relationship)',
      'relatedToType': 'Picklist',
      'eventOwnerId': 'Lookup (Relationship)',
      'startDateTime': 'Date-Time',
      'endDateTime': 'Date-Time',
      'location': 'Text-Area',
      'reminderAt': 'Date-Time',
      'recurrence': 'Rich Text',
      'attendees': 'Multi-Picklist',
      'agendaNotes': 'Text-Area',
      'linkedTaskId': 'Lookup (Relationship)',
      'linkedFormId': 'Lookup (Relationship)',
      'tags': 'Multi-Picklist',
      'auditHistory': 'Rich Text',
      'notes': 'Rich Text',
      'organizationId': 'Lookup (Relationship)',
      'createdBy': 'Lookup (Relationship)',
      'createdTime': 'Date-Time',
      'modifiedBy': 'Lookup (Relationship)',
      'modifiedTime': 'Date-Time'
    };

    // Enum options from schema
    const enumOptions = {
      'eventType': ['Meeting', 'Call', 'Site Visit', 'Demo', 'Training', 'Webinar', 'Other'],
      'status': ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'],
      'relatedToType': ['Person', 'Organization', 'Deal', 'Item']
    };

    let updated = 0;
    let created = 0;

    for (const org of organizations) {
      // Find or create Events module definition
      let moduleDef = await ModuleDefinition.findOne({
        organizationId: org._id,
        key: 'events',
        type: 'system'
      });

      if (!moduleDef) {
        console.log(`  Creating Events module for organization ${org._id}`);
        moduleDef = new ModuleDefinition({
          organizationId: org._id,
          key: 'events',
          name: 'Events',
          type: 'system',
          enabled: true,
          fields: [],
          quickCreate: [],
          quickCreateLayout: { version: 1, rows: [] },
          relationships: []
        });
        created++;
      }

      // Get current fields or initialize
      const fields = Array.isArray(moduleDef.fields) ? [...moduleDef.fields] : [];
      // Create field map with case-insensitive key lookup
      const fieldMap = new Map();
      fields.forEach(f => {
        if (f.key) {
          fieldMap.set(f.key.toLowerCase(), f); // Store with lowercase key for lookup
          fieldMap.set(f.key, f); // Also store with original key
        }
      });

      // Update field types based on mappings (skip system fields - they're excluded from base fields)
      let fieldsUpdated = false;
      let quickCreateUpdated = false;
      for (const [fieldKey, dataType] of Object.entries(eventFieldMappings)) {
        // Skip system fields - they're auto-excluded from getBaseFieldsForKey
        if (systemFields.has(fieldKey)) {
          // Remove system fields if they exist (they shouldn't be in module definition)
          // Check both original and lowercase keys
          const fieldToRemove = fieldMap.get(fieldKey) || fieldMap.get(fieldKey.toLowerCase());
          if (fieldToRemove) {
            const index = fields.findIndex(f => f.key === fieldToRemove.key);
            if (index !== -1) {
              fields.splice(index, 1);
              fieldMap.delete(fieldKey);
              fieldMap.delete(fieldKey.toLowerCase());
              fieldsUpdated = true;
              console.log(`    Removed system field: ${fieldToRemove.key} (should not be in module definition)`);
            }
          }
          continue;
        }
        
        // Try to find existing field (case-insensitive) - check both camelCase and lowercase
        let existingField = fieldMap.get(fieldKey) || fieldMap.get(fieldKey.toLowerCase());
        
        // Also search by iterating through fields if not found (handles any case variations)
        if (!existingField) {
          existingField = fields.find(f => f.key && f.key.toLowerCase() === fieldKey.toLowerCase());
        }
        
        // Find the index in the fields array for direct updates
        let existingFieldIndex = -1;
        if (existingField) {
          existingFieldIndex = fields.findIndex(f => f === existingField);
          // If not found by reference, try by key match
          if (existingFieldIndex === -1 && existingField.key) {
            existingFieldIndex = fields.findIndex(f => f.key && f.key.toLowerCase() === existingField.key.toLowerCase());
            if (existingFieldIndex !== -1) {
              existingField = fields[existingFieldIndex]; // Use the actual field from array
            }
          }
        }
        
        // Custom label for eventOwnerId
        let fieldLabel = fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
        if (fieldKey === 'eventOwnerId') {
          fieldLabel = 'Event Owner';
        }
        
        // Add lookupSettings for User lookup fields
        let lookupSettings = null;
        if (dataType === 'Lookup (Relationship)') {
          if (fieldKey === 'eventOwnerId' || fieldKey === 'createdBy' || fieldKey === 'modifiedBy') {
            lookupSettings = {
              targetModule: 'users'
            };
          }
        }
        
        if (existingField) {
          // Update existing field
          let fieldChanged = false;
          
          // Normalize the field key to match the expected format (camelCase)
          // Update ALL occurrences of this field (there may be duplicates)
          if (existingField.key && existingField.key.toLowerCase() === fieldKey.toLowerCase() && existingField.key !== fieldKey) {
            const oldKey = existingField.key;
            // Find and update ALL fields with matching lowercase key
            let updateCount = 0;
            const fieldsToUpdate = [];
            for (let i = 0; i < fields.length; i++) {
              if (fields[i].key && fields[i].key.toLowerCase() === fieldKey.toLowerCase() && fields[i].key !== fieldKey) {
                fieldsToUpdate.push(i);
              }
            }
            // Update all matching fields
            for (const idx of fieldsToUpdate) {
              fields[idx].key = fieldKey;
              updateCount++;
            }
            // Update the reference we're working with
            if (existingFieldIndex !== -1 && fieldsToUpdate.includes(existingFieldIndex)) {
              existingField = fields[existingFieldIndex];
            } else {
              existingField = fields.find(f => f.key === fieldKey) || existingField;
            }
            console.log(`    Updated field key in ${updateCount} occurrence(s) at indices [${fieldsToUpdate.join(', ')}]: "${oldKey}" → "${fieldKey}"`);
            fieldChanged = true;
          }
          
          if (existingField.dataType !== dataType) {
            existingField.dataType = dataType;
            fieldChanged = true;
            console.log(`    Updated ${fieldKey}: ${existingField.dataType} → ${dataType}`);
          }
          
          // Update label if different (always update for eventOwnerId to ensure correct label)
          const oldLabel = existingField.label || '';
          // Check if this is eventOwnerId (case-insensitive) and label needs updating
          const isEventOwnerId = fieldKey.toLowerCase() === 'eventownerid';
          const targetLabel = isEventOwnerId ? 'Event Owner' : fieldLabel;
          
          // Always update label for eventOwnerId, or if label doesn't match
          if (isEventOwnerId) {
            // Force update label for eventOwnerId - check various possible current values
            const needsUpdate = oldLabel !== 'Event Owner' && 
                               oldLabel !== 'Event owner' && 
                               oldLabel.toLowerCase() !== 'event owner' &&
                               oldLabel.toLowerCase() !== 'event owner id';
            if (needsUpdate) {
              // Update ALL occurrences of this field
              let updateCount = 0;
              for (let i = 0; i < fields.length; i++) {
                if (fields[i].key && fields[i].key.toLowerCase() === fieldKey.toLowerCase()) {
                  fields[i].label = 'Event Owner';
                  updateCount++;
                }
              }
              if (existingFieldIndex !== -1) {
                existingField = fields[existingFieldIndex];
              } else {
                existingField = fields.find(f => f.key && f.key.toLowerCase() === fieldKey.toLowerCase());
              }
              fieldChanged = true;
              console.log(`    ✅ Updated ${fieldKey} label in ${updateCount} occurrence(s): "${oldLabel}" → "Event Owner"`);
            }
          } else if (oldLabel !== fieldLabel) {
            if (existingFieldIndex !== -1) {
              fields[existingFieldIndex].label = fieldLabel;
              existingField = fields[existingFieldIndex];
            } else {
              existingField.label = fieldLabel;
            }
            fieldChanged = true;
            console.log(`    Updated ${fieldKey} label: "${oldLabel}" → "${fieldLabel}"`);
          }
          
          // Update lookupSettings for User lookup fields
          const isUserLookupField = fieldKey.toLowerCase() === 'eventownerid' || 
                                    fieldKey.toLowerCase() === 'createdby' || 
                                    fieldKey.toLowerCase() === 'modifiedby';
          
          if (lookupSettings) {
            const currentLookupSettings = existingField.lookupSettings || {};
            if (!currentLookupSettings.targetModule || currentLookupSettings.targetModule !== lookupSettings.targetModule) {
              existingField.lookupSettings = lookupSettings;
              fieldChanged = true;
              console.log(`    Updated ${fieldKey} lookupSettings: targetModule = "${lookupSettings.targetModule}"`);
            }
          } else if (existingField.lookupSettings && isUserLookupField) {
            // Remove incorrect lookupSettings if field shouldn't have them
            delete existingField.lookupSettings;
            fieldChanged = true;
            console.log(`    Removed incorrect lookupSettings from ${fieldKey}`);
          }
          
          // Ensure lookupSettings exists for User lookup fields
          // Update ALL occurrences of this field
          if (isUserLookupField) {
            const lookupSettingsValue = { targetModule: 'users' };
            let updateCount = 0;
            for (let i = 0; i < fields.length; i++) {
              if (fields[i].key && fields[i].key.toLowerCase() === fieldKey.toLowerCase()) {
                if (!fields[i].lookupSettings || !fields[i].lookupSettings.targetModule) {
                  fields[i].lookupSettings = lookupSettingsValue;
                  updateCount++;
                }
              }
            }
            if (existingFieldIndex !== -1) {
              existingField = fields[existingFieldIndex];
            } else {
              existingField = fields.find(f => f.key && f.key.toLowerCase() === fieldKey.toLowerCase());
            }
            if (updateCount > 0) {
              fieldChanged = true;
              console.log(`    Added/Updated lookupSettings to ${fieldKey} in ${updateCount} occurrence(s): targetModule = "users"`);
            }
          }
          
          // Update options for picklist fields
          if (enumOptions[fieldKey] && (!existingField.options || JSON.stringify(existingField.options) !== JSON.stringify(enumOptions[fieldKey]))) {
            existingField.options = enumOptions[fieldKey].map(val => ({ value: val, color: '#3B82F6' }));
            fieldChanged = true;
            console.log(`    Updated ${fieldKey} options`);
          }
          
          if (fieldChanged) {
            fieldsUpdated = true;
          }
        } else {
          // Add new field
          const newField = {
            key: fieldKey,
            label: fieldLabel,
            dataType: dataType,
            required: false,
            options: enumOptions[fieldKey] ? enumOptions[fieldKey].map(val => ({ value: val, color: '#3B82F6' })) : [],
            visibility: { list: true, detail: true },
            order: fields.length,
            lookupSettings: lookupSettings
          };
          fields.push(newField);
          fieldMap.set(fieldKey, newField);
          fieldsUpdated = true;
          console.log(`    Added field: ${fieldKey} (${dataType})${lookupSettings ? ` with lookupSettings.targetModule="${lookupSettings.targetModule}"` : ''}`);
        }
      }

      // Always set moduleDef.fields to the updated fields array
      // This ensures Mongoose uses the updated array when saving
      moduleDef.fields = fields;
      
      // Set default quickCreate fields if not already configured (do this AFTER fields are updated)
      const defaultQuickCreateFieldNames = [
        'eventName',
        'eventType',
        'status',
        'eventOwnerId',
        'startDateTime',
        'endDateTime',
        'location',
        'agendaNotes'
      ];
      
      // Check if quickCreate needs to be initialized or updated
      const currentQuickCreate = Array.isArray(moduleDef.quickCreate) ? moduleDef.quickCreate : [];
      // Update if empty, only has status, or only has status and location (incomplete list)
      const hasOnlyStatus = currentQuickCreate.length === 1 && currentQuickCreate[0]?.toLowerCase() === 'status';
      const hasOnlyStatusAndLocation = currentQuickCreate.length === 2 && 
                                        currentQuickCreate.some(k => k.toLowerCase() === 'status') &&
                                        currentQuickCreate.some(k => k.toLowerCase() === 'location') &&
                                        currentQuickCreate.length < 5; // Less than expected minimum
      const needsQuickCreateUpdate = currentQuickCreate.length === 0 || hasOnlyStatus || hasOnlyStatusAndLocation;
      
      // Always update quickCreate to use camelCase keys (after fields have been normalized)
      // Use the expected camelCase field names directly since we've normalized all field keys
      const quickCreateFieldMap = {
        'eventname': 'eventName',
        'eventtype': 'eventType',
        'status': 'status',
        'eventownerid': 'eventOwnerId',
        'startdatetime': 'startDateTime',
        'enddatetime': 'endDateTime',
        'location': 'location',
        'agendanotes': 'agendaNotes'
      };
      
      if (needsQuickCreateUpdate) {
        // Build quickCreate using camelCase field keys directly
        const validQuickCreateFields = defaultQuickCreateFieldNames.filter(fieldName => {
          return fields.some(f => f.key && f.key.toLowerCase() === fieldName.toLowerCase());
        });
        
        if (validQuickCreateFields.length > 0) {
          moduleDef.quickCreate = validQuickCreateFields;
          quickCreateUpdated = true;
          fieldsUpdated = true;
          console.log(`    Set default quickCreate fields: ${validQuickCreateFields.join(', ')}`);
        } else {
          console.log(`    ⚠️  No matching fields found for quickCreate. Available fields: ${fields.map(f => f.key).join(', ')}`);
        }
      } else {
        // Update existing quickCreate entries to use camelCase keys
        const updatedQuickCreate = currentQuickCreate.map(qcKey => {
          const qcKeyLower = qcKey.toLowerCase();
          // First try direct mapping
          if (quickCreateFieldMap[qcKeyLower]) {
            return quickCreateFieldMap[qcKeyLower];
          }
          // Then try to find matching field
          const matchingField = fields.find(f => f.key && f.key.toLowerCase() === qcKeyLower);
          return matchingField ? matchingField.key : qcKey;
        });
        
        if (JSON.stringify(updatedQuickCreate) !== JSON.stringify(currentQuickCreate)) {
          moduleDef.quickCreate = updatedQuickCreate;
          quickCreateUpdated = true;
          fieldsUpdated = true;
          console.log(`    Updated quickCreate keys to camelCase: ${currentQuickCreate.join(', ')} → ${updatedQuickCreate.join(', ')}`);
        } else {
          console.log(`    QuickCreate already configured: ${currentQuickCreate.join(', ')}`);
        }
      }

      // Normalize quickCreate keys to camelCase using the mapping (do this AFTER setting default quickCreate)
      // This ensures quickCreate always uses camelCase keys
      if (moduleDef.quickCreate && Array.isArray(moduleDef.quickCreate) && moduleDef.quickCreate.length > 0) {
        const normalizedQuickCreate = moduleDef.quickCreate.map(qcKey => {
          const qcKeyLower = qcKey.toLowerCase();
          // Use quickCreateFieldMap for direct mapping to camelCase
          if (quickCreateFieldMap[qcKeyLower]) {
            return quickCreateFieldMap[qcKeyLower];
          }
          // Try eventFieldMappings as fallback
          for (const [mappedKey] of Object.entries(eventFieldMappings)) {
            if (mappedKey.toLowerCase() === qcKeyLower) {
              return mappedKey;
            }
          }
          // Keep original if no mapping found
          return qcKey;
        });
        
        if (JSON.stringify(normalizedQuickCreate) !== JSON.stringify(moduleDef.quickCreate)) {
          moduleDef.quickCreate = normalizedQuickCreate;
          quickCreateUpdated = true;
          console.log(`    Normalized quickCreate keys: ${moduleDef.quickCreate.join(', ')} → ${normalizedQuickCreate.join(', ')}`);
        }
      }
      
      // Save if fields were updated OR quickCreate was updated
      if (fieldsUpdated || quickCreateUpdated) {
        // Ensure name is set
        if (!moduleDef.name) {
          moduleDef.name = 'Events';
        }
        
        // Mark quickCreate as modified if it was updated
        if (quickCreateUpdated) {
          moduleDef.markModified('quickCreate');
          console.log(`    Marked quickCreate as modified`);
        }
        
        // Mark fields as modified if they were updated
        if (fieldsUpdated) {
          moduleDef.markModified('fields');
        }
        
        // Save the document first
        await moduleDef.save();
        
        // Use raw MongoDB updateOne to ensure both fields and quickCreate are saved (bypass Mongoose)
        // This is necessary because Mongoose might not save nested array changes properly
        const updateDoc = {};
        if (fieldsUpdated && fields.length > 0) {
          // Deep clone fields to ensure all updates are included
          updateDoc.fields = JSON.parse(JSON.stringify(fields));
          // Debug: Check eventOwnerId fields before saving
          const eventOwnerFields = fields.filter(f => f.key && f.key.toLowerCase() === 'eventownerid');
          const camelCaseFields = fields.filter(f => f.key === 'eventOwnerId');
          console.log(`    Before save - Found ${eventOwnerFields.length} lowercase eventOwnerId field(s) and ${camelCaseFields.length} camelCase eventOwnerId field(s)`);
          if (eventOwnerFields.length > 0) {
            eventOwnerFields.forEach((f, i) => {
              console.log(`      Lowercase field ${i}: key="${f.key}", label="${f.label}", lookupSettings=`, f.lookupSettings);
            });
          }
          if (camelCaseFields.length > 0) {
            camelCaseFields.forEach((f, i) => {
              console.log(`      CamelCase field ${i}: key="${f.key}", label="${f.label}", lookupSettings=`, f.lookupSettings);
            });
          }
        }
        if (quickCreateUpdated && moduleDef.quickCreate) {
          updateDoc.quickCreate = moduleDef.quickCreate;
        }
        
        if (Object.keys(updateDoc).length > 0) {
          await mongoose.connection.db.collection('moduledefinitions').updateOne(
            { _id: moduleDef._id },
            { $set: updateDoc }
          );
          if (fieldsUpdated) {
            console.log(`    Explicitly updated fields via raw MongoDB (${fields.length} fields)`);
            // Verify eventOwnerId field was saved correctly
            const verifyDoc = await mongoose.connection.db.collection('moduledefinitions').findOne({ _id: moduleDef._id });
            const verifyEventOwner = verifyDoc?.fields?.find(f => f.key && f.key.toLowerCase() === 'eventownerid');
            if (verifyEventOwner) {
              console.log(`    ✅ Verified eventOwnerId in DB: key="${verifyEventOwner.key}", label="${verifyEventOwner.label}", lookupSettings=`, verifyEventOwner.lookupSettings);
            } else {
              console.log(`    ⚠️  eventOwnerId field not found in saved document`);
            }
          }
          if (quickCreateUpdated) {
            console.log(`    Explicitly set quickCreate via raw MongoDB:`, moduleDef.quickCreate);
            const verifyDoc = await mongoose.connection.db.collection('moduledefinitions').findOne({ _id: moduleDef._id });
            console.log(`    Verified quickCreate in database:`, verifyDoc?.quickCreate);
          }
        }
        updated++;
        console.log(`  ✅ Updated Events module for organization ${org._id}\n`);
      } else {
        console.log(`  ⏭️  No changes needed for organization ${org._id}\n`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  Organizations processed: ${organizations.length}`);
    console.log(`  Modules updated: ${updated}`);
    console.log(`  Modules created: ${created}`);
    console.log('\n✅ Update complete!');

  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  updateEventsModuleFields()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { updateEventsModuleFields };

