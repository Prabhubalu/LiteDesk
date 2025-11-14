/**
 * Script to check Events module quickCreate configuration in database
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

async function checkEventsQuickCreate() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all organizations
    const Organization = mongoose.model('Organization', new mongoose.Schema({}, { strict: false }), 'organizations');
    const organizations = await Organization.find({}).select('_id').lean();
    console.log(`📊 Found ${organizations.length} organizations\n`);

    for (const org of organizations) {
      // Check raw MongoDB document
      const rawDoc = await mongoose.connection.db.collection('moduledefinitions').findOne({
        organizationId: new mongoose.Types.ObjectId(org._id),
        key: 'events',
        type: 'system'
      });
      
      console.log(`\n📋 Organization: ${org._id}`);
      console.log(`   Raw MongoDB document quickCreate:`, rawDoc?.quickCreate);
      console.log(`   Raw document has quickCreate key:`, rawDoc && 'quickCreate' in rawDoc);
      
      const moduleDef = await ModuleDefinition.findOne({
        organizationId: org._id,
        key: 'events',
        type: 'system'
      }).lean(false); // Don't use lean() to get full Mongoose document

      if (!moduleDef) {
        console.log(`❌ No Events module found for organization ${org._id}\n`);
        continue;
      }

      console.log(`\n📋 Organization: ${org._id}`);
      console.log(`   QuickCreate array:`, moduleDef.quickCreate);
      console.log(`   QuickCreate type:`, typeof moduleDef.quickCreate);
      console.log(`   QuickCreate isArray:`, Array.isArray(moduleDef.quickCreate));
      console.log(`   QuickCreate length:`, moduleDef.quickCreate?.length || 0);
      console.log(`   Fields count:`, moduleDef.fields?.length || 0);
      console.log(`   Module definition keys:`, Object.keys(moduleDef.toObject ? moduleDef.toObject() : moduleDef));
      
      if (moduleDef.quickCreate && moduleDef.quickCreate.length > 0) {
        console.log(`\n   Field matching check:`);
        for (const qcKey of moduleDef.quickCreate) {
          const field = moduleDef.fields?.find(f => {
            if (!f.key) return false;
            return f.key.toLowerCase() === qcKey.toLowerCase();
          });
          if (field) {
            console.log(`   ✅ "${qcKey}" → Found field: key="${field.key}", label="${field.label}"`);
          } else {
            console.log(`   ❌ "${qcKey}" → NOT FOUND in fields`);
            console.log(`      Available field keys:`, moduleDef.fields?.map(f => f.key).join(', ') || 'none');
          }
        }
      } else {
        console.log(`   ⚠️  QuickCreate is empty or not set`);
      }
    }

    console.log('\n✅ Check complete!');

  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  checkEventsQuickCreate()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { checkEventsQuickCreate };

