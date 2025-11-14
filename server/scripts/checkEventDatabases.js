/**
 * Quick script to check which database has events
 */

const { MongoClient } = require('mongodb');
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

async function checkDatabases() {
  const client = new MongoClient(`${baseUri}${mongoQueryString}`);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const masterDb = client.db('litedesk_master');
    const litedeskDb = client.db('litedesk');

    const masterCount = await masterDb.collection('events').countDocuments({});
    const litedeskCount = await litedeskDb.collection('events').countDocuments({});

    console.log('📊 Event Counts:');
    console.log(`  litedesk_master: ${masterCount} events`);
    console.log(`  litedesk: ${litedeskCount} events\n`);

    if (litedeskCount > 0 && masterCount === 0) {
      console.log('⚠️  Events are in the wrong database!');
      console.log('   Run: node scripts/moveEventsToMasterDatabase.js\n');
    } else if (masterCount > 0) {
      console.log('✅ Events are in the correct database (litedesk_master)');
      console.log('   Run: node scripts/migrateEventsToNewSchema.js\n');
    } else {
      console.log('ℹ️  No events found in either database.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

checkDatabases()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });

