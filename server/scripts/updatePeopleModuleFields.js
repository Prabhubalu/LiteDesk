const mongoose = require('mongoose');
const Schema = mongoose.Schema;
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const ModuleDefinition = require('../models/ModuleDefinition');
const People = require('../models/People');
const Organization = require('../models/Organization');

// Field-specific data type mappings for People module
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
  'preferred_contact_method': 'Radio Button',
  'organizationId': 'Lookup (Relationship)'
};

// Enum values from People schema
const enumMappings = {
  'type': ['Lead', 'Contact'],
  'lead_status': ['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage'],
  'contact_status': ['Active', 'Inactive', 'DoNotContact'],
  'role': ['Decision Maker', 'Influencer', 'Support', 'Other'],
  'preferred_contact_method': ['Email', 'Phone', 'WhatsApp', 'SMS', 'None']
};

function inferDataType(path, fieldName) {
  const instance = path.instance || (path.options && path.options.type && path.options.type.name);
  const fieldNameLower = fieldName.toLowerCase();
  
  // Check if we have a specific mapping
  if (peopleFieldMappings[fieldName]) {
    return peopleFieldMappings[fieldName];
  }
  
  // Smart inference based on field name patterns
  // URL fields
  if (fieldNameLower.includes('url') || fieldNameLower.includes('website') || fieldNameLower.includes('link')) {
    return 'URL';
  }
  
  // DateTime fields (vs just Date)
  if (fieldNameLower.includes('datetime') || fieldNameLower.includes('date_time') || 
      fieldNameLower.includes('timestamp') || fieldNameLower.includes('updated_at') || 
      fieldNameLower.includes('created_at')) {
    return 'Date-Time';
  }
  
  // Rich text fields (long form content)
  if (fieldNameLower.includes('description') || fieldNameLower.includes('content') || 
      fieldNameLower.includes('body') || 
      (fieldNameLower.includes('notes') && fieldNameLower.includes('rich'))) {
    return 'Rich Text';
  }
  
  // Email fields
  if (fieldNameLower.includes('email')) {
    return 'Email';
  }
  
  // Phone fields
  if (fieldNameLower.includes('phone') || fieldNameLower.includes('mobile') || 
      fieldNameLower.includes('telephone')) {
    return 'Phone';
  }
  
  // Fall back to instance-based inference
  switch ((instance || '').toLowerCase()) {
    case 'string': 
      // Check if it's an array (for Multi-Picklist)
      if (Array.isArray(path.options?.type) || path.options?.type === Array) {
        return 'Multi-Picklist';
      }
      return 'Text';
    case 'number': 
      // Check field name for integer vs decimal/currency
      if (fieldNameLower.includes('currency') || fieldNameLower.includes('price') || 
          fieldNameLower.includes('cost') || 
          (fieldNameLower.includes('value') && fieldNameLower.includes('estimated'))) {
        return 'Currency';
      }
      if (fieldNameLower.includes('score') || fieldNameLower.includes('count') || 
          fieldNameLower.includes('quantity') || 
          (fieldNameLower.includes('amount') && !fieldNameLower.includes('currency'))) {
        return 'Integer';
      }
      return 'Decimal';
    case 'boolean': return 'Checkbox';
    case 'date': return 'Date';
    case 'objectid': return 'Lookup (Relationship)';
    default: 
      // Array types
      if (Array.isArray(path.options?.type) || path.instance === 'Array') {
        // Check array element type
        const arrayType = path.caster?.instance || path.options?.type?.[0];
        if (arrayType === String || arrayType?.toLowerCase?.() === 'string') {
          return 'Multi-Picklist';
        }
        if (arrayType === mongoose.Schema.Types.ObjectId || arrayType?.name === 'ObjectId') {
          return 'Multi-Picklist'; // Multi-lookup would be Multi-Picklist type
        }
        return 'Multi-Picklist';
      }
      return 'Text';
  }
}

function extractEnumValues(fieldName, path, schemaTree) {
  // Check schema tree first
  const treeDef = schemaTree[fieldName];
  if (treeDef && treeDef.enum && Array.isArray(treeDef.enum)) {
    return [...treeDef.enum];
  }
  
  // Check if we have a manual mapping
  if (enumMappings[fieldName]) {
    return [...enumMappings[fieldName]];
  }
  
  // Try path properties
  const enumValues = path.enumValues || (path.options && path.options.enum);
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    return [...enumValues];
  }
  
  return [];
}

// Normalize options to the correct format (objects with value and color, or keep as strings)
function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return [];
  }
  
  // If options are already objects, return as is
  if (options[0] && typeof options[0] === 'object' && options[0].value) {
    return options;
  }
  
  // Convert string options to object format
  // The schema supports both formats, but we'll use object format for consistency
  return options.map(option => {
    if (typeof option === 'string') {
      return { value: option, color: '#3B82F6' }; // Default blue color
    }
    // If it's already an object, ensure it has value and color
    return {
      value: option.value || option,
      color: option.color || '#3B82F6'
    };
  });
}

async function updatePeopleModuleFields(organizationId = null) {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/litedesk';
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB');
    }

    // Get organizations to process (specific one or all)
    let organizations;
    if (organizationId) {
      organizations = await Organization.find({ _id: organizationId });
      console.log(`Found 1 organization (filtered by ID)`);
    } else {
      organizations = await Organization.find({});
      console.log(`Found ${organizations.length} organizations`);
    }

    // Get People model schema
    const peopleSchema = People.schema;
    const schemaTree = peopleSchema.tree || {};
    // Exclude system fields and legacy fields that shouldn't appear in module definitions
    const excluded = new Set([
      '_id', '__v', 'createdAt', 'updatedAt', 
      'activityLogs', // System field - activity logs are managed internally
      'legacyContactId', // Legacy migration field
      'account_id', // Legacy field - use 'organization' instead
      'owner_id' // Legacy field - use 'assignedTo' instead
    ]);

    // Build field definitions
    const fields = [];
    let order = 0;

    for (const [fieldName, path] of Object.entries(peopleSchema.paths)) {
      if (excluded.has(fieldName)) continue;

      const dataType = inferDataType(path, fieldName);
      const options = extractEnumValues(fieldName, path, schemaTree);
      
      const label = fieldName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      // Define lead-specific fields that should only be visible when type is 'Lead'
      const leadSpecificFields = ['lead_status', 'lead_owner', 'lead_score', 'interest_products'];
      
      // Define contact-specific fields that should only be visible when type is 'Contact'
      const contactSpecificFields = ['contact_status', 'role', 'birthday', 'preferred_contact_method'];
      
      // Build dependencies for lead-specific and contact-specific fields
      const dependencies = [];
      if (leadSpecificFields.includes(fieldName)) {
        dependencies.push({
          type: 'visibility',
          logic: 'AND',
          conditions: [
            {
              fieldKey: 'type',
              operator: 'equals',
              value: 'Lead'
            }
          ]
        });
      }
      
      if (contactSpecificFields.includes(fieldName)) {
        dependencies.push({
          type: 'visibility',
          logic: 'AND',
          conditions: [
            {
              fieldKey: 'type',
              operator: 'equals',
              value: 'Contact'
            }
          ]
        });
      }

      const fieldDef = {
        key: fieldName,
        label: label,
        dataType: dataType,
        required: !!path.isRequired,
        options: normalizeOptions(options),
        defaultValue: path.defaultValue ?? null,
        index: !!path._index || false,
        visibility: { 
          list: true, // Default to visible in list/table
          detail: true 
        },
        order: order++,
        validations: [],
        dependencies: dependencies
      };

      // Ensure organization field is always visible in table
      if (fieldName === 'organization' || fieldName === 'organizationId') {
        fieldDef.visibility.list = true;
        fieldDef.visibility.detail = true;
      }
      
      // Ensure createdBy is visible in table and detail (but not editable)
      if (fieldName === 'createdBy' || fieldName.toLowerCase() === 'createdby') {
        fieldDef.visibility.list = true;
        fieldDef.visibility.detail = true;
      }
      
      // Hide activitylogs from table and detail views (system field)
      if (fieldName === 'activityLogs' || fieldName.toLowerCase() === 'activitylogs') {
        fieldDef.visibility.list = false;
        fieldDef.visibility.detail = false;
      }

      // Set lookup target module for relationship fields
      if (dataType === 'Lookup (Relationship)') {
        fieldDef.lookupSettings = {
          targetModule: '',
          displayField: ''
        };
        
        // Set specific target modules
        if (fieldName === 'assignedTo' || fieldName === 'lead_owner' || fieldName === 'createdBy') {
          fieldDef.lookupSettings.targetModule = 'users';
          fieldDef.lookupSettings.displayField = 'name';
        } else if (fieldName === 'organization' || fieldName === 'organizationId') {
          fieldDef.lookupSettings.targetModule = 'organizations';
          fieldDef.lookupSettings.displayField = 'name';
        }
      }

      fields.push(fieldDef);
    }

    // Sort fields by a logical order (system fields first, then core, then lead/contact specific)
    const fieldOrder = [
      'organizationId',
      'assignedTo',
      'type',
      'source',
      'first_name',
      'last_name',
      'email',
      'phone',
      'mobile',
      'organization',
      'tags',
      'do_not_contact',
      'lead_status',
      'lead_owner',
      'lead_score',
      'interest_products',
      'qualification_date',
      'qualification_notes',
      'estimated_value',
      'contact_status',
      'role',
      'birthday',
      'preferred_contact_method',
      'createdBy'  // Move createdBy to the end
    ];

    fields.sort((a, b) => {
      const indexA = fieldOrder.indexOf(a.key);
      const indexB = fieldOrder.indexOf(b.key);
      if (indexA === -1 && indexB === -1) return a.order - b.order;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // Update order based on sorted position (this is the default order for new modules)
    fields.forEach((field, index) => {
      field.order = index;
    });

    console.log(`\nGenerated ${fields.length} field definitions:`);
    fields.forEach(f => {
      let info = `  - ${f.key} (${f.dataType})`;
      if (f.options.length > 0) {
        info += ` [${f.options.join(', ')}]`;
      }
      if (f.lookupSettings && f.lookupSettings.targetModule) {
        info += ` [lookup: ${f.lookupSettings.targetModule}]`;
      }
      if (f.dependencies && f.dependencies.length > 0) {
        info += ` [has dependencies]`;
      }
      console.log(info);
    });

    // Update or create ModuleDefinition for each organization
    let updated = 0;
    let created = 0;

    for (const org of organizations) {
      const existing = await ModuleDefinition.findOne({
        organizationId: org._id,
        key: 'people'
      });

      if (existing && existing.fields && existing.fields.length > 0) {
        // Update existing - preserve custom field orders from UI
        // Create a map of existing fields by key for quick lookup
        const existingFieldMap = new Map();
        existing.fields.forEach(existingField => {
          const key = existingField.key?.toLowerCase();
          if (key) {
            existingFieldMap.set(key, existingField);
          }
        });

        // Create a map of new fields by key
        const newFieldMap = new Map();
        fields.forEach(newField => {
          const key = newField.key?.toLowerCase();
          if (key) {
            newFieldMap.set(key, newField);
          }
        });

        // Merge: preserve existing order, update field definitions, add new fields at end
        const mergedFields = [];
        const processedKeys = new Set();
        
        // First, process existing fields in their current order (preserves UI order)
        existing.fields.forEach(existingField => {
          const key = existingField.key?.toLowerCase();
          if (!key) return;
          
          // Skip legacy fields that shouldn't be in module definitions
          if (excluded.has(existingField.key)) {
            console.log(`  ⚠️  Skipping legacy field: ${existingField.key}`);
            return;
          }
          
          const newField = newFieldMap.get(key);
          if (newField) {
            // Field exists in both - update definition but preserve order and visibility
            const mergedField = {
              ...newField,
              order: existingField.order ?? newField.order, // Preserve existing order
              // Ensure organization is always visible, otherwise preserve existing visibility
              visibility: (key === 'organization' || key === 'organizationid') 
                ? { list: true, detail: true } 
                : (existingField.visibility || newField.visibility)
            };
            mergedFields.push(mergedField);
            processedKeys.add(key);
          } else {
            // Field no longer exists in schema - skip it (deprecated field)
            // Only log if it's not in our excluded list (in case we missed something)
            if (!excluded.has(existingField.key)) {
              console.log(`  ⚠️  Skipping deprecated field: ${existingField.key}`);
            }
          }
        });

        // Then, add any new fields that weren't in existing (at end, maintaining default order)
        const existingOrders = mergedFields.map(f => f.order ?? 0);
        let maxOrder = existingOrders.length > 0 ? Math.max(...existingOrders) : -1;
        fields.forEach(newField => {
          const key = newField.key?.toLowerCase();
          if (!key || processedKeys.has(key)) return;
          
          maxOrder++;
          mergedFields.push({
            ...newField,
            order: maxOrder
          });
        });

        // Sort by order to ensure consistency
        mergedFields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        existing.fields = mergedFields;
        existing.name = 'People';
        existing.type = 'system';
        existing.enabled = existing.enabled !== false;
        await existing.save();
        updated++;
        console.log(`✓ Updated People module for organization: ${org.name || org._id} (preserved field order)`);
      } else {
        // Create new - use default order
        await ModuleDefinition.create({
          organizationId: org._id,
          key: 'people',
          name: 'People',
          type: 'system',
          enabled: true,
          fields: fields,
          relationships: [],
          quickCreate: [],
          quickCreateLayout: { version: 1, rows: [] }
        });
        created++;
        console.log(`✓ Created People module for organization: ${org.name || org._id}`);
      }
    }

    console.log(`\n✅ Complete! Updated: ${updated}, Created: ${created}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    // Only disconnect if we connected in this function (when called as standalone script)
    if (organizationId === null && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run the script
if (require.main === module) {
  updatePeopleModuleFields()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = updatePeopleModuleFields;

