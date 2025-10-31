const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');

async function checkOrganizationsFields() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/litedesk';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations\n`);

    for (const org of organizations) {
      const mod = await ModuleDefinition.findOne({
        organizationId: org._id,
        key: 'organizations'
      }).lean();

      if (!mod) {
        console.log(`❌ No module definition found for organization: ${org.name || org._id}\n`);
        continue;
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Organization: ${org.name || org._id}`);
      console.log(`${'='.repeat(60)}\n`);

      if (!mod.fields || mod.fields.length === 0) {
        console.log('❌ No fields found in module definition\n');
        continue;
      }

      console.log(`Total fields: ${mod.fields.length}\n`);
      
      // Expected mappings from the JSON
      const expectedMappings = {
        'Name': 'Text',
        'Types': 'Multi-Picklist',
        'Website': 'URL',
        'Phone': 'Phone',
        'Address': 'Text-Area',
        'Industry': 'Picklist',
        'Assigned To (Owner)': 'Lookup (Relationship)',
        'Primary Contact': 'Lookup (Relationship)',
        'Customer Status': 'Picklist',
        'Customer Tier': 'Picklist',
        'SLA Level': 'Picklist',
        'Payment Terms': 'Text',
        'Credit Limit': 'Currency',
        'Account Manager': 'Lookup (Relationship)',
        'Annual Revenue': 'Currency',
        'Number of Employees': 'Integer',
        'Partner Status': 'Picklist',
        'Partner Tier': 'Picklist',
        'Partner Type': 'Picklist',
        'Partner Since': 'Date',
        'Partner Onboarding Steps': 'Multi-Picklist',
        'Territory': 'Multi-Picklist',
        'Discount Rate': 'Decimal',
        'Vendor Status': 'Picklist',
        'Vendor Rating': 'Integer',
        'Vendor Contract': 'URL',
        'Preferred Payment Method': 'Picklist',
        'VAT/GSTIN/Tax ID': 'Text',
        'Channel Region': 'Picklist',
        'Distribution Territory': 'Multi-Picklist',
        'Distribution Capacity (Monthly)': 'Integer',
        'Dealer Level': 'Picklist',
        'Terms': 'Rich Text',
        'Shipping Address': 'Text-Area',
        'Logistics Partner': 'Lookup (Relationship)'
      };

      console.log('Field Analysis:\n');
      const issues = [];

      for (const field of mod.fields) {
        const key = field.key || '';
        const label = field.label || '';
        const type = field.dataType || '';
        const options = field.options || [];
        
        const expectedType = expectedMappings[label];
        
        let status = '✓';
        const problems = [];
        
        if (expectedType && type !== expectedType) {
          status = '❌';
          problems.push(`Type mismatch: expected "${expectedType}", got "${type}"`);
        }
        
        if (!expectedType && !['createdby', 'organizationid', 'createdat', 'updatedat'].includes(key.toLowerCase())) {
          status = '⚠️';
          problems.push('Not in expected mappings (custom field?)');
        }

        // Check for missing enum values for specific fields
        const enumFields = {
          'Types': ['Customer', 'Partner', 'Vendor', 'Distributor', 'Dealer'],
          'Customer Status': ['Active', 'Prospect', 'Churned', 'Lead Customer'],
          'Customer Tier': ['Gold', 'Silver', 'Bronze'],
          'Partner Status': ['Active', 'Onboarding', 'Inactive'],
          'Partner Tier': ['Platinum', 'Gold', 'Silver', 'Bronze'],
          'Partner Type': ['Reseller', 'System Integrator', 'Referral', 'Technology Partner'],
          'Vendor Status': ['Approved', 'Pending', 'Suspended'],
          'Dealer Level': ['Authorized', 'Franchise', 'Retailer']
        };

        if (enumFields[label]) {
          const expectedOptions = enumFields[label];
          const missingOptions = expectedOptions.filter(opt => !options.includes(opt));
          const extraOptions = options.filter(opt => !expectedOptions.includes(opt));
          
          if (missingOptions.length > 0) {
            status = '⚠️';
            problems.push(`Missing enum options: ${missingOptions.join(', ')}`);
          }
          if (extraOptions.length > 0) {
            problems.push(`Extra enum options: ${extraOptions.join(', ')}`);
          }
        }

        if (status !== '✓' || problems.length > 0) {
          issues.push({ key, label, type, expectedType, options, problems });
          console.log(`${status} ${label} (${key})`);
          console.log(`   Type: ${type}${expectedType ? ` (expected: ${expectedType})` : ''}`);
          if (options.length > 0) {
            console.log(`   Options: [${options.join(', ')}]`);
          }
          if (problems.length > 0) {
            problems.forEach(p => console.log(`   ⚠️  ${p}`));
          }
          console.log();
        }
      }

      if (issues.length === 0) {
        console.log('✅ All fields appear to be correctly configured!\n');
      } else {
        console.log(`\n⚠️  Found ${issues.length} field(s) with issues\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

if (require.main === module) {
  checkOrganizationsFields()
    .then(() => {
      console.log('\n✅ Check completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Check failed:', error);
      process.exit(1);
    });
}

module.exports = checkOrganizationsFields;

