#!/usr/bin/env node

/**
 * Drop Database Script
 * 
 * WARNING: This will delete ALL data from your MongoDB database!
 * Use only for development/testing environments.
 * 
 * Usage: node server/scripts/dropDatabase.js
 */

const path = require('path');
// Try loading .env from multiple locations
const envPaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '.env')
];
for (const envPath of envPaths) {
    try {
        require('dotenv').config({ path: envPath });
        if (process.env.MONGODB_URI || process.env.MONGO_URI) {
            break;
        }
    } catch (e) {
        // Continue to next path
    }
}
const mongoose = require('mongoose');

// Get MongoDB URI from environment (try multiple variations, same logic as server.js)
const isProduction = process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 
                  (isProduction ? process.env.MONGO_URI_PRODUCTION : process.env.MONGO_URI_LOCAL);

if (!MONGO_URI) {
    console.error('❌ FATAL ERROR: MONGO_URI is not defined in environment variables!');
    console.error('📝 Please check your .env file and ensure MONGO_URI or MONGODB_URI is set.');
    process.exit(1);
}

// Extract database name from URI
const dbName = MONGO_URI.split('/').pop().split('?')[0];

async function dropDatabase() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Confirm with user (in non-interactive mode, use environment variable)
        const forceDrop = process.env.FORCE_DROP === 'true';
        
        if (!forceDrop) {
            console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
            console.log(`📊 Database: ${dbName}`);
            console.log('🔒 Set FORCE_DROP=true environment variable to skip confirmation.');
            console.log('\n❌ Database drop cancelled for safety.');
            console.log('💡 To proceed, run: FORCE_DROP=true node server/scripts/dropDatabase.js');
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log(`🗑️  Dropping database: ${dbName}...`);
        await mongoose.connection.dropDatabase();
        console.log('✅ Database dropped successfully!\n');

        console.log('💡 Next steps:');
        console.log('   1. Run: node server/scripts/createDefaultAdmin.js');
        console.log('   2. Initialize module definitions (if needed)');
        console.log('   3. Start your server\n');

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error dropping database:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run
dropDatabase();

