// Clean up users created without organization
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;

async function cleanup() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB\n');
        
        // Find users without organizationId
        const usersWithoutOrg = await User.find({ 
            organizationId: { $exists: false } 
        });
        
        console.log(`Found ${usersWithoutOrg.length} users without organization`);
        
        if (usersWithoutOrg.length > 0) {
            usersWithoutOrg.forEach(user => {
                console.log(`  - ${user.email}`);
            });
            
            // Delete them
            const result = await User.deleteMany({ 
                organizationId: { $exists: false } 
            });
            
            console.log(`\n✅ Deleted ${result.deletedCount} users`);
        } else {
            console.log('No cleanup needed');
        }
        
        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

cleanup();

