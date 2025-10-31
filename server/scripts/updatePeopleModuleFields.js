const mongoose = require('mongoose');
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
  'organizationId': 'Lookup (Relationship)',
  'legacyContactId': 'Lookup (Relationship)'
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
  
  // Check if we have a specific mapping
  if (peopleFieldMappings[fieldName]) {
    return peopleFieldMappings[fieldName];
  }
  
  // Fall back to inference
  switch ((instance || '').toLowerCase()) {
    case 'string': return 'Text';
    case 'number': return 'Decimal';
    case 'boolean': return 'Checkbox';
    case 'date': return 'Date';
    case 'objectid': return 'Lookup (Relationship)';
    default: return 'Text';
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

async function updatePeopleModuleFields() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/litedesk';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations`);

    // Get People model schema
    const peopleSchema = People.schema;
    const schemaTree = peopleSchema.tree || {};
    const excluded = new Set(['_id', '__v', 'createdAt', 'updatedAt']);

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

      fields.push({
        key: fieldName,
        label: label,
        dataType: dataType,
        required: !!path.isRequired,
        options: options,
        defaultValue: path.defaultValue ?? null,
        index: !!path._index || false,
        visibility: { list: true, detail: true },
        order: order++,
        validations: [],
        dependencies: []
      });
    }

    // Sort fields by a logical order (system fields first, then core, then lead/contact specific)
    const fieldOrder = [
      'organizationId',
      'createdBy',
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
      'legacyContactId'
    ];

    fields.sort((a, b) => {
      const indexA = fieldOrder.indexOf(a.key);
      const indexB = fieldOrder.indexOf(b.key);
      if (indexA === -1 && indexB === -1) return a.order - b.order;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // Update order based on sorted position
    fields.forEach((field, index) => {
      field.order = index;
    });

    console.log(`Generated ${fields.length} field definitions:`);
    fields.forEach(f => {
      console.log(`  - ${f.key} (${f.dataType})${f.options.length > 0 ? ` [${f.options.join(', ')}]` : ''}`);
    });

    // Update or create ModuleDefinition for each organization
    let updated = 0;
    let created = 0;

    for (const org of organizations) {
      const existing = await ModuleDefinition.findOne({
        organizationId: org._id,
        key: 'people'
      });

      if (existing) {
        // Update existing
        existing.fields = fields;
        existing.name = 'People';
        existing.type = 'system';
        existing.enabled = existing.enabled !== false;
        await existing.save();
        updated++;
        console.log(`✓ Updated People module for organization: ${org.name || org._id}`);
      } else {
        // Create new
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
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
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

