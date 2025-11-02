#!/usr/bin/env node

/**
 * Inspect Demo Flow Test Data
 * Display all created records in readable format
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

const Organization = require('../models/Organization');
const People = require('../models/People');
const DemoRequest = require('../models/DemoRequest');
const Role = require('../models/Role');
const ModuleDefinition = require('../models/ModuleDefinition');

async function inspectData() {
    try {
        console.log('🔍 Inspecting Demo Flow Test Data\n');
        
        await mongoose.connect(MONGO_URI);
        
        // Find test organization
        const testOrg = await Organization.findOne({ name: 'Test Acme Corp' });
        if (!testOrg) {
            console.log('❌ No test data found. Run testDemoFlowWithData.js first.');
            process.exit(1);
        }
        
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📋 Organization (Tenant)');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(JSON.stringify(testOrg, null, 2));
        
        const orgV2 = await Organization.findOne({ legacyOrganizationId: testOrg._id, isTenant: false });
        if (orgV2) {
            console.log('\n═══════════════════════════════════════════════════════════════');
            console.log('🏢 CRM Organization');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(JSON.stringify(orgV2, null, 2));
        }
        
        const people = await People.find({ organizationId: testOrg._id });
        if (people.length > 0) {
            console.log('\n═══════════════════════════════════════════════════════════════');
            console.log('👤 People Records');
            console.log('═══════════════════════════════════════════════════════════════');
            people.forEach((p, idx) => {
                console.log(`\n--- Person ${idx + 1} ---`);
                console.log(JSON.stringify(p, null, 2));
            });
        }
        
        const demoRequests = await DemoRequest.find({ organizationId: testOrg._id });
        if (demoRequests.length > 0) {
            console.log('\n═══════════════════════════════════════════════════════════════');
            console.log('📝 Demo Requests');
            console.log('═══════════════════════════════════════════════════════════════');
            demoRequests.forEach((dr, idx) => {
                console.log(`\n--- Demo Request ${idx + 1} ---`);
                console.log(JSON.stringify(dr, null, 2));
            });
        }
        
        const roles = await Role.find({ organizationId: testOrg._id });
        if (roles.length > 0) {
            console.log('\n═══════════════════════════════════════════════════════════════');
            console.log('🔐 Roles');
            console.log('═══════════════════════════════════════════════════════════════');
            roles.forEach((r, idx) => {
                console.log(`\n--- Role ${idx + 1} ---`);
                console.log(JSON.stringify(r, null, 2));
            });
        }
        
        const moduleDefs = await ModuleDefinition.find({ organizationId: testOrg._id });
        if (moduleDefs.length > 0) {
            console.log('\n═══════════════════════════════════════════════════════════════');
            console.log('📚 Module Definitions');
            console.log('═══════════════════════════════════════════════════════════════');
            moduleDefs.forEach((md, idx) => {
                console.log(`\n--- ${md.name || md.key} (${md.key}) ---`);
                console.log(`Fields: ${md.fields?.length || 0}`);
                if (md.fields && md.fields.length > 0) {
                    console.log('Field List:');
                    md.fields.forEach(f => {
                        console.log(`  - ${f.key}: ${f.dataType} ${f.options?.length ? `[${f.options.length} options]` : ''}`);
                    });
                }
            });
        }
        
        await mongoose.connection.close();
        console.log('\n✅ Inspection complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

inspectData();

