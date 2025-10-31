const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');

// Expected mappings from the JSON specification
const expectedMappings = {
  'Name': { type: 'Text', key: 'name' },
  'Types': { type: 'Multi-Picklist', key: 'types' },
  'Website': { type: 'URL', key: 'website' },
  'Phone': { type: 'Phone', key: 'phone' },
  'Address': { type: 'Text-Area', key: 'address' }, // Address (Compound) -> Text-Area
  'Industry': { type: 'Picklist', key: 'industry' },
  'Assigned To (Owner)': { type: 'Lookup (Relationship)', key: 'assignedTo' },
  'Primary Contact': { type: 'Lookup (Relationship)', key: 'primaryContact' },
  'Customer Status': { type: 'Picklist', key: 'customerStatus' },
  'Customer Tier': { type: 'Picklist', key: 'customerTier' },
  'SLA Level': { type: 'Picklist', key: 'slaLevel' },
  'Payment Terms': { type: 'Text', key: 'paymentTerms' },
  'Credit Limit': { type: 'Currency', key: 'creditLimit' },
  'Account Manager': { type: 'Lookup (Relationship)', key: 'accountManager' },
  'Annual Revenue': { type: 'Currency', key: 'annualRevenue' },
  'Number of Employees': { type: 'Integer', key: 'numberOfEmployees' },
  'Partner Status': { type: 'Picklist', key: 'partnerStatus' }, // Picklist (Single-Select) -> Picklist
  'Partner Tier': { type: 'Picklist', key: 'partnerTier' },
  'Partner Type': { type: 'Picklist', key: 'partnerType' },
  'Partner Since': { type: 'Date', key: 'partnerSince' },
  'Partner Onboarding Steps': { type: 'Multi-Picklist', key: 'partnerOnboardingSteps' },
  'Territory': { type: 'Picklist', key: 'territory' }, // Fixed: should be Picklist, not Multi-Picklist
  'Discount Rate': { type: 'Decimal', key: 'discountRate' },
  'Vendor Status': { type: 'Picklist', key: 'vendorStatus' },
  'Vendor Rating': { type: 'Integer', key: 'vendorRating' }, // Rating -> Integer
  'Vendor Contract': { type: 'URL', key: 'vendorContract' }, // File/Attachment -> URL
  'Preferred Payment Method': { type: 'Picklist', key: 'preferredPaymentMethod' },
  'VAT/GSTIN/Tax ID': { type: 'Text', key: 'taxId' },
  'Channel Region': { type: 'Picklist', key: 'channelRegion' },
  'Distribution Territory': { type: 'Multi-Picklist', key: 'distributionTerritory' },
  'Distribution Capacity (Monthly)': { type: 'Integer', key: 'distributionCapacityMonthly' },
  'Dealer Level': { type: 'Picklist', key: 'dealerLevel' },
  'Terms': { type: 'Rich Text', key: 'terms' },
  'Shipping Address': { type: 'Text-Area', key: 'shippingAddress' }, // Address (Compound) -> Text-Area
  'Logistics Partner': { type: 'Lookup (Relationship)', key: 'logisticsPartner' }
};

async function verifyOrganizationsFields() {
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

      console.log(`\n${'='.repeat(80)}`);
      console.log(`Organization: ${org.name || org._id}`);
      console.log(`${'='.repeat(80)}\n`);

      if (!mod.fields || mod.fields.length === 0) {
        console.log('❌ No fields found in module definition\n');
        continue;
      }

      console.log(`Total fields in DB: ${mod.fields.length}`);
      console.log(`Expected fields: ${Object.keys(expectedMappings).length}\n`);

      const issues = [];
      const foundFields = new Map();

      // Create a map of fields by label and key
      for (const field of mod.fields) {
        const key = (field.key || '').toLowerCase();
        const label = field.label || '';
        foundFields.set(key, field);
        foundFields.set(label.toLowerCase(), field);
      }

      console.log('Verification Results:\n');
      console.log(`${'Field Name'.padEnd(35)} | ${'Expected Type'.padEnd(25)} | ${'Actual Type'.padEnd(25)} | Status`);
      console.log('-'.repeat(105));

      for (const [label, expected] of Object.entries(expectedMappings)) {
        const field = foundFields.get(expected.key.toLowerCase()) || foundFields.get(label.toLowerCase());
        
        if (!field) {
          issues.push({ label, issue: 'FIELD NOT FOUND' });
          console.log(`${label.padEnd(35)} | ${expected.type.padEnd(25)} | ${'NOT FOUND'.padEnd(25)} | ❌`);
          continue;
        }

        const actualType = field.dataType || 'MISSING';
        const status = actualType === expected.type ? '✓' : '❌';
        
        if (status === '❌') {
          issues.push({ 
            label, 
            key: field.key, 
            expected: expected.type, 
            actual: actualType, 
            issue: 'TYPE MISMATCH' 
          });
        }

        console.log(`${label.padEnd(35)} | ${expected.type.padEnd(25)} | ${actualType.padEnd(25)} | ${status}`);
      }

      console.log('-'.repeat(105));

      // Check for extra fields
      const expectedKeys = new Set(Object.values(expectedMappings).map(e => e.key.toLowerCase()));
      const extraFields = mod.fields.filter(f => {
        const key = (f.key || '').toLowerCase();
        return !expectedKeys.has(key) && 
               !['createdby', 'organizationid', 'createdat', 'updatedat', '_id', '__v'].includes(key);
      });

      if (extraFields.length > 0) {
        console.log(`\n⚠️  Found ${extraFields.length} extra field(s) not in specification:`);
        extraFields.forEach(f => {
          console.log(`   - ${f.label} (${f.key}) - Type: ${f.dataType}`);
        });
      }

      if (issues.length === 0) {
        console.log(`\n✅ All ${Object.keys(expectedMappings).length} fields are correctly configured!\n`);
      } else {
        console.log(`\n⚠️  Found ${issues.length} issue(s):\n`);
        issues.forEach(issue => {
          console.log(`❌ ${issue.label} (${issue.key || 'N/A'})`);
          if (issue.issue === 'TYPE MISMATCH') {
            console.log(`   Expected: ${issue.expected}`);
            console.log(`   Actual: ${issue.actual}`);
          } else {
            console.log(`   Issue: ${issue.issue}`);
          }
          console.log();
        });
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
  verifyOrganizationsFields()
    .then(() => {
      console.log('\n✅ Verification completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = verifyOrganizationsFields;

