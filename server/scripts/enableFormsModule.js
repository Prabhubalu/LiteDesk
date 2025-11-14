#!/usr/bin/env node

/**
 * Enable Forms Module for Organization
 * Adds 'forms' to enabledModules array
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;
const ORG_ID = process.argv[2] || null; // Optional: specific org ID

async function enableFormsModule() {
    try {
        console.log('🔧 Enabling Forms Module...\n');
        
        if (!MONGO_URI) {
            console.error('❌ Error: MONGODB_URI is not set in .env file!');
            process.exit(1);
        }
        
        console.log('🔗 Connecting to MongoDB...');
        const [uriWithoutQuery, queryPart] = MONGO_URI.split('?');
        const connectionQuery = queryPart ? `?${queryPart}` : '';
        const baseUri = uriWithoutQuery.split('/').slice(0, -1).join('/');
        const masterDbName = 'litedesk_master';
        const masterUri = `${baseUri}/${masterDbName}${connectionQuery}`;
        
        await mongoose.connect(masterUri);
        console.log(`✅ Connected to MongoDB master database: ${masterDbName}\n`);
        
        // Find organization(s)
        let organizations;
        if (ORG_ID) {
            organizations = await Organization.find({ _id: ORG_ID });
        } else {
            // Enable for all organizations
            organizations = await Organization.find({});
        }
        
        if (organizations.length === 0) {
            console.log('❌ No organizations found');
            process.exit(1);
        }
        
        console.log(`📋 Found ${organizations.length} organization(s)\n`);
        
        for (const org of organizations) {
            const enabledModules = org.enabledModules || [];
            
            if (!enabledModules.includes('forms')) {
                enabledModules.push('forms');
                org.enabledModules = enabledModules;
                await org.save();
                console.log(`✅ Enabled 'forms' module for: ${org.name} (${org._id})`);
            } else {
                console.log(`ℹ️  'forms' module already enabled for: ${org.name} (${org._id})`);
            }
        }
        
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

enableFormsModule();

