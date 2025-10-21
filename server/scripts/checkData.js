// Quick script to check database contents
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');

const MONGO_URI = process.env.MONGO_URI;

async function checkData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB\n');
        
        // Get all organizations
        const orgs = await Organization.find({});
        console.log(`📊 Organizations found: ${orgs.length}`);
        orgs.forEach(org => {
            console.log(`  - ${org.name} (ID: ${org._id})`);
            console.log(`    Industry: ${org.industry}`);
            console.log(`    Status: ${org.subscription.status}`);
            console.log(`    Trial End: ${org.subscription.trialEndDate}`);
        });
        
        console.log('\n👥 Users found:');
        // Get all users
        const users = await User.find({}).populate('organizationId');
        console.log(`Total: ${users.length}`);
        users.forEach(user => {
            console.log(`  - ${user.email} (${user.role})`);
            console.log(`    Organization: ${user.organizationId ? user.organizationId.name : 'NONE - ERROR!'}`);
            console.log(`    IsOwner: ${user.isOwner}`);
        });
        
        await mongoose.connection.close();
        console.log('\n✅ Check complete');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkData();

