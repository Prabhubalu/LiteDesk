// Complete database reset - removes all users and organizations
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Contact = require('../models/Contact');

const MONGO_URI = process.env.MONGO_URI;

async function reset() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB\n');
        
        console.log('⚠️  WARNING: This will delete ALL data!\n');
        
        // Delete all
        const users = await User.deleteMany({});
        const orgs = await Organization.deleteMany({});
        const contacts = await Contact.deleteMany({});
        
        console.log(`✅ Deleted:`);
        console.log(`   - ${users.deletedCount} users`);
        console.log(`   - ${orgs.deletedCount} organizations`);
        console.log(`   - ${contacts.deletedCount} contacts`);
        
        console.log('\n🎉 Database reset complete!');
        console.log('Ready for fresh registration.\n');
        
        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

reset();

