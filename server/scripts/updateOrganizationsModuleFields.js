const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const ModuleDefinition = require('../models/ModuleDefinition');
const OrganizationV2 = require('../models/OrganizationV2');
const Organization = require('../models/Organization');

// Field mappings from JSON - map to actual schema field keys
const organizationFieldMappings = {
  'name': { type: 'Text', label: 'Name' },
  'types': { type: 'Multi-Picklist', label: 'Types', enum: ['Customer', 'Partner', 'Vendor', 'Distributor', 'Dealer'] },
  'website': { type: 'URL', label: 'Website' },
  'phone': { type: 'Phone', label: 'Phone' },
  'address': { type: 'Text-Area', label: 'Address' },
  'industry': { type: 'Picklist', label: 'Industry' },
  'assignedTo': { type: 'Lookup (Relationship)', label: 'Assigned To (Owner)' },
  'primaryContact': { type: 'Lookup (Relationship)', label: 'Primary Contact' },
  'customerStatus': { type: 'Picklist', label: 'Customer Status', enum: ['Active', 'Prospect', 'Churned', 'Lead Customer'] },
  'customerTier': { type: 'Picklist', label: 'Customer Tier', enum: ['Gold', 'Silver', 'Bronze'] },
  'slaLevel': { type: 'Picklist', label: 'SLA Level' },
  'paymentTerms': { type: 'Text', label: 'Payment Terms' },
  'creditLimit': { type: 'Currency', label: 'Credit Limit' },
  'accountManager': { type: 'Lookup (Relationship)', label: 'Account Manager' },
  'annualRevenue': { type: 'Currency', label: 'Annual Revenue' },
  'numberOfEmployees': { type: 'Integer', label: 'Number of Employees' },
  'partnerStatus': { type: 'Picklist', label: 'Partner Status', enum: ['Active', 'Onboarding', 'Inactive'] },
  'partnerTier': { type: 'Picklist', label: 'Partner Tier', enum: ['Platinum', 'Gold', 'Silver', 'Bronze'] },
  'partnerType': { type: 'Picklist', label: 'Partner Type', enum: ['Reseller', 'System Integrator', 'Referral', 'Technology Partner'] },
  'partnerSince': { type: 'Date', label: 'Partner Since' },
  'partnerOnboardingSteps': { type: 'Multi-Picklist', label: 'Partner Onboarding Steps' },
  'territory': { type: 'Picklist', label: 'Territory' }, // Changed from Multi-Picklist to Picklist per spec
  'discountRate': { type: 'Decimal', label: 'Discount Rate' },
  'vendorStatus': { type: 'Picklist', label: 'Vendor Status', enum: ['Approved', 'Pending', 'Suspended'] },
  'vendorRating': { type: 'Integer', label: 'Vendor Rating' },
  'vendorContract': { type: 'URL', label: 'Vendor Contract' }, // File/Attachment -> URL for now
  'preferredPaymentMethod': { type: 'Picklist', label: 'Preferred Payment Method' },
  'taxId': { type: 'Text', label: 'VAT/GSTIN/Tax ID' },
  'channelRegion': { type: 'Picklist', label: 'Channel Region' },
  'distributionTerritory': { type: 'Multi-Picklist', label: 'Distribution Territory' },
  'distributionCapacityMonthly': { type: 'Integer', label: 'Distribution Capacity (Monthly)' },
  'dealerLevel': { type: 'Picklist', label: 'Dealer Level', enum: ['Authorized', 'Franchise', 'Retailer'] },
  'terms': { type: 'Rich Text', label: 'Terms' },
  'shippingAddress': { type: 'Text-Area', label: 'Shipping Address' },
  'logisticsPartner': { type: 'Lookup (Relationship)', label: 'Logistics Partner' }
};

// Get OrganizationV2 schema field order
const organizationFieldOrder = [
  'name',
  'types',
  'website',
  'phone',
  'address',
  'industry',
  'assignedTo',
  'primaryContact',
  'customerStatus',
  'customerTier',
  'slaLevel',
  'paymentTerms',
  'creditLimit',
  'accountManager',
  'annualRevenue',
  'numberOfEmployees',
  'partnerStatus',
  'partnerTier',
  'partnerType',
  'partnerSince',
  'partnerOnboardingSteps',
  'territory',
  'discountRate',
  'vendorStatus',
  'vendorRating',
  'vendorContract',
  'preferredPaymentMethod',
  'taxId',
  'channelRegion',
  'distributionTerritory',
  'distributionCapacityMonthly',
  'dealerLevel',
  'terms',
  'shippingAddress',
  'logisticsPartner'
];

// Generate field definitions from mappings
function generateOrganizationFields() {
  const fields = [];
  let order = 0;

  // Process fields in the defined order
  for (const key of organizationFieldOrder) {
    const mapping = organizationFieldMappings[key];
    if (!mapping) continue;

    const field = {
      key: key,
      label: mapping.label,
      dataType: mapping.type,
      required: false,
      options: mapping.enum ? [...mapping.enum] : [],
      defaultValue: null,
      placeholder: '',
      index: false,
      visibility: { list: true, detail: true },
      order: order++,
      validations: [],
      dependencies: [],
      picklistDependencies: []
    };

    // Set lookup target module for relationship fields
    if (mapping.type === 'Lookup (Relationship)') {
      field.lookupSettings = {
        targetModule: '',
        displayField: ''
      };
      
      // Set specific target modules
      if (key === 'assignedTo' || key === 'accountManager') {
        field.lookupSettings.targetModule = 'users'; // Will be handled specially like assignedTo
      } else if (key === 'primaryContact') {
        field.lookupSettings.targetModule = 'people';
      } else if (key === 'logisticsPartner') {
        field.lookupSettings.targetModule = 'organizations';
      }
    }

    fields.push(field);
  }

  return fields;
}

async function updateOrganizationsModuleFields() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/litedesk';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations`);

    // Generate field definitions
    const fields = generateOrganizationFields();

    console.log(`\nGenerated ${fields.length} field definitions:`);
    fields.forEach(f => {
      console.log(`  - ${f.key} (${f.label}) -> ${f.dataType}${f.lookupSettings ? ` [lookup: ${f.lookupSettings.targetModule}]` : ''}`);
    });

    // Update or create ModuleDefinition for each organization
    let updated = 0;
    let created = 0;

    for (const org of organizations) {
      const existing = await ModuleDefinition.findOne({
        organizationId: org._id,
        key: 'organizations'
      });

      const fieldsToSave = JSON.parse(JSON.stringify(fields)); // Deep copy

      if (existing) {
        // Create a map of new fields by key for easy lookup
        const newFieldsMap = new Map();
        fieldsToSave.forEach(f => {
          newFieldsMap.set(f.key.toLowerCase(), f);
        });

        // Merge: preserve existing field configurations but update types and labels
        const mergedFields = [];
        const processedKeys = new Set();

        // First, add/update fields from our mapping (in order)
        for (const newField of fieldsToSave) {
          const keyLower = newField.key.toLowerCase();
          const existingField = existing.fields.find(f => f.key?.toLowerCase() === keyLower);
          
          if (existingField) {
            // Preserve existing field but update type and label
            existingField.label = newField.label;
            existingField.dataType = newField.dataType;
            existingField.order = mergedFields.length;
            // Update lookup settings if provided
            if (newField.lookupSettings) {
              existingField.lookupSettings = newField.lookupSettings;
            }
            // Update options - replace with new enum values if provided
            if (newField.options && newField.options.length > 0) {
              // Replace options with the new enum values (from schema)
              existingField.options = [...newField.options];
            } else if (existingField.dataType === 'Picklist' || existingField.dataType === 'Multi-Picklist') {
              // If it's a picklist but has no options, keep existing or set empty
              existingField.options = existingField.options || [];
            }
            mergedFields.push(existingField);
          } else {
            // New field - add it
            mergedFields.push(newField);
          }
          processedKeys.add(keyLower);
        }

        // Add any existing fields that aren't in our mapping (custom fields)
        existing.fields.forEach(existingField => {
          const keyLower = existingField.key?.toLowerCase();
          if (!processedKeys.has(keyLower)) {
            existingField.order = mergedFields.length;
            mergedFields.push(existingField);
          }
        });

        existing.fields = mergedFields;
        existing.name = 'Organizations';
        existing.type = 'system';
        existing.enabled = existing.enabled !== false;
        await existing.save();
        updated++;
        console.log(`✓ Updated Organizations module for organization: ${org.name || org._id}`);
      } else {
        // Create new
        await ModuleDefinition.create({
          organizationId: org._id,
          key: 'organizations',
          name: 'Organizations',
          type: 'system',
          enabled: true,
          fields: fieldsToSave,
          relationships: [],
          quickCreate: [],
          quickCreateLayout: { version: 1, rows: [] }
        });
        created++;
        console.log(`✓ Created Organizations module for organization: ${org.name || org._id}`);
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
  updateOrganizationsModuleFields()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = updateOrganizationsModuleFields;

