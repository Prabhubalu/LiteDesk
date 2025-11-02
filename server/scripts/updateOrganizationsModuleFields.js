const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');

// Field mappings from JSON - map to actual schema field keys
const organizationFieldMappings = {
  'name': { type: 'Text', label: 'Name' },
  'createdBy': { type: 'Lookup (Relationship)', label: 'Created By' },
  'types': { type: 'Multi-Picklist', label: 'Types', enum: ['Customer', 'Partner', 'Vendor', 'Distributor', 'Dealer'] },
  'website': { type: 'URL', label: 'Website' },
  'phone': { type: 'Phone', label: 'Phone' },
  'address': { type: 'Text-Area', label: 'Address' },
  'industry': { type: 'Picklist', label: 'Industry' },
  'assignedTo': { type: 'Lookup (Relationship)', label: 'Assigned To' },
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
  'logisticsPartner': { type: 'Lookup (Relationship)', label: 'Logistics Partner' },
  
  // ===== TENANT FIELDS (only visible when isTenant: true) =====
  'slug': { type: 'Text', label: 'Slug' },
  'subscription.status': { type: 'Picklist', label: 'Subscription Status', enum: ['trial', 'active', 'expired', 'cancelled'] },
  'subscription.tier': { type: 'Picklist', label: 'Subscription Tier', enum: ['trial', 'starter', 'professional', 'enterprise'] },
  'subscription.trialStartDate': { type: 'Date', label: 'Trial Start Date' },
  'subscription.trialEndDate': { type: 'Date', label: 'Trial End Date' },
  'subscription.currentPeriodStart': { type: 'Date', label: 'Current Period Start' },
  'subscription.currentPeriodEnd': { type: 'Date', label: 'Current Period End' },
  'subscription.autoRenew': { type: 'Checkbox', label: 'Auto Renew' },
  'limits.maxUsers': { type: 'Integer', label: 'Max Users' },
  'limits.maxContacts': { type: 'Integer', label: 'Max Contacts' },
  'limits.maxDeals': { type: 'Integer', label: 'Max Deals' },
  'limits.maxStorageGB': { type: 'Integer', label: 'Max Storage (GB)' },
  'enabledModules': { type: 'Multi-Picklist', label: 'Enabled Modules' },
  'settings.dateFormat': { type: 'Text', label: 'Date Format' },
  'settings.timeZone': { type: 'Text', label: 'Time Zone' },
  'settings.currency': { type: 'Text', label: 'Currency' },
  'settings.logoUrl': { type: 'URL', label: 'Logo URL' },
  'settings.primaryColor': { type: 'Text', label: 'Primary Color' },
  'isActive': { type: 'Checkbox', label: 'Is Active' }
};

// Get Organization schema field order
// Note: Tenant fields should only be shown when isTenant: true
// CRM fields should only be shown when isTenant: false
const organizationFieldOrder = [
  // Shared fields
  'name',
  'industry',
  
  // CRM fields (isTenant: false)
  'types',
  'website',
  'phone',
  'address',
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
  'logisticsPartner',
  'createdBy',
  
  // Tenant fields (isTenant: true) - add these for tenant orgs
  'slug',
  'subscription.status',
  'subscription.tier',
  'subscription.trialStartDate',
  'subscription.trialEndDate',
  'subscription.currentPeriodStart',
  'subscription.currentPeriodEnd',
  'subscription.autoRenew',
  'limits.maxUsers',
  'limits.maxContacts',
  'limits.maxDeals',
  'limits.maxStorageGB',
  'enabledModules',
  'settings.dateFormat',
  'settings.timeZone',
  'settings.currency',
  'settings.logoUrl',
  'settings.primaryColor',
  'isActive'
];

// Generate field definitions from mappings
function generateOrganizationFields() {
  const fields = [];
  let order = 0;

  // Process fields in the defined order
  for (const key of organizationFieldOrder) {
    const mapping = organizationFieldMappings[key];
    if (!mapping) continue;

    // Convert enum strings to {value, color} objects for picklist/multi-picklist fields
    let options = [];
    if (mapping.enum && mapping.enum.length > 0) {
      options = mapping.enum.map(val => ({
        value: val,
        color: '#3B82F6' // Default blue color for all options
      }));
    }

    const field = {
      key: key,
      label: mapping.label,
      dataType: mapping.type,
      required: false,
      options: options,
      defaultValue: null,
      placeholder: '',
      index: false,
      visibility: { list: true, detail: true },
      order: order++,
      validations: [],
      dependencies: [],
      picklistDependencies: []
    };
    
    // Hide activitylogs from table and detail views (system field)
    if (key === 'activityLogs' || key.toLowerCase() === 'activitylogs') {
      field.visibility.list = false;
      field.visibility.detail = false;
    }

    // Ensure createdBy is visible in table and detail (but not editable)
    if (key === 'createdBy' || key.toLowerCase() === 'createdby') {
      field.visibility.list = true;
      field.visibility.detail = true;
    }

    // Ensure assignedTo is visible in table and detail
    if (key === 'assignedTo' || key.toLowerCase() === 'assignedto') {
      field.visibility.list = true;
      field.visibility.detail = true;
    }

    // Tenant fields: Only show when isTenant is true
    const tenantFields = ['slug', 'subscription.status', 'subscription.tier', 'subscription.trialStartDate', 
                          'subscription.trialEndDate', 'subscription.currentPeriodStart', 'subscription.currentPeriodEnd',
                          'subscription.autoRenew', 'limits.maxUsers', 'limits.maxContacts', 'limits.maxDeals',
                          'limits.maxStorageGB', 'enabledModules', 'settings.dateFormat', 'settings.timeZone',
                          'settings.currency', 'settings.logoUrl', 'settings.primaryColor', 'isActive'];
    
    if (tenantFields.includes(key)) {
      // Mark tenant fields with a flag so frontend can filter
      field.isTenantField = true;
      // These should not show in CRM organization lists/tables
      field.visibility.list = false; // Tenant fields typically not in CRM tables
      field.visibility.detail = true; // But can be shown in detail view if isTenant: true
      // Remove any dependencies - tenant fields should always be visible when isTenant is true
      field.dependencies = [];
      field.picklistDependencies = [];
    }

    // CRM fields: Should not show for tenant orgs
    const crmOnlyFields = ['types', 'createdBy', 'assignedTo', 'primaryContact', 'customerStatus', 'partnerStatus', 
                          'vendorStatus', 'activityLogs'];
    if (crmOnlyFields.includes(key)) {
      field.isCRMField = true;
    }

    // Set lookup target module for relationship fields
    if (mapping.type === 'Lookup (Relationship)') {
      field.lookupSettings = {
        targetModule: '',
        displayField: ''
      };
      
      // Set specific target modules
      if (key === 'assignedTo' || key === 'accountManager') {
        field.lookupSettings.targetModule = 'users'; // Will be handled specially like assignedTo
      } else if (key === 'createdBy') {
        field.lookupSettings.targetModule = 'users'; // CreatedBy is a user lookup
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

async function updateOrganizationsModuleFields(organizationId = null) {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/litedesk';
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB');
    }

    // Get organizations to process (specific one or all tenant organizations)
    // Note: This script updates module definitions for tenant organizations, not CRM organizations
    let organizations;
    if (organizationId) {
      organizations = await Organization.find({ _id: organizationId, isTenant: true });
      console.log(`Found ${organizations.length} tenant organization(s) (filtered by ID)`);
    } else {
      organizations = await Organization.find({ isTenant: true });
      console.log(`Found ${organizations.length} tenant organization(s)`);
    }

    // If no tenant organizations found, try to find any organization (for default setup)
    if (organizations.length === 0) {
      console.log('\n⚠️  No tenant organizations found. Checking for any organizations...');
      const allOrgs = await Organization.find({}).limit(1);
      if (allOrgs.length > 0) {
        console.log(`   Found ${allOrgs.length} organization(s). Will create module definition for first one as default.`);
        organizations = allOrgs;
      } else {
        console.log('   No organizations found in database. Module definition will not be created.');
        console.log('   Please create at least one organization first.');
        await mongoose.connection.close();
        return;
      }
    }

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
    // Only disconnect if we connected in this function (when called as standalone script)
    if (organizationId === null && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
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

