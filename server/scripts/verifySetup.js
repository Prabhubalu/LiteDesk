// Verify proper registration setup
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');

const MONGO_URI = process.env.MONGO_URI;

async function verify() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('🔍 Checking registration setup...\n');
        
        const orgs = await Organization.find({});
        const users = await User.find({}).populate('organizationId');
        
        console.log(`📊 Organizations: ${orgs.length}`);
        console.log(`👥 Users: ${users.length}\n`);
        
        if (orgs.length === 0 && users.length === 0) {
            console.log('✅ Database is clean and ready for new registration');
            console.log('\n📝 Next steps:');
            console.log('   1. Make sure server is running with latest code');
            console.log('   2. Clear browser localStorage');
            console.log('   3. Register a new account');
            console.log('   4. Run this script again to verify\n');
        } else if (orgs.length > 0 && users.length > 0) {
            orgs.forEach(org => {
                console.log(`✅ Organization: ${org.name}`);
                console.log(`   - ID: ${org._id}`);
                console.log(`   - Industry: ${org.industry}`);
                console.log(`   - Status: ${org.subscription.status} (${org.subscription.tier})`);
                console.log(`   - Trial ends: ${new Date(org.subscription.trialEndDate).toLocaleDateString()}`);
                
                const orgUsers = users.filter(u => u.organizationId && u.organizationId._id.toString() === org._id.toString());
                console.log(`   - Users: ${orgUsers.length}`);
                orgUsers.forEach(u => {
                    console.log(`     • ${u.email} (${u.role}${u.isOwner ? ', Owner' : ''})`);
                });
                console.log('');
            });
            
            // Check for orphaned users
            const orphans = users.filter(u => !u.organizationId);
            if (orphans.length > 0) {
                console.log('⚠️  Found users without organization:');
                orphans.forEach(u => console.log(`   - ${u.email}`));
                console.log('   Run cleanupOldUser.js to remove them\n');
            } else {
                console.log('✅ All users properly linked to organizations\n');
            }
        }
        
        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verify();

