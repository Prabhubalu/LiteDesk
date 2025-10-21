// Direct test of Organization creation
require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGO_URI;

async function testOrgCreation() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('🧪 Testing Organization & User Creation...\n');
        
        // 1. Create Organization
        console.log('Creating organization...');
        const organization = await Organization.create({
            name: "Test Company 123",
            industry: "Retail",
            subscription: {
                status: 'trial',
                tier: 'trial',
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
            },
            limits: {
                maxUsers: 3,
                maxContacts: 100,
                maxDeals: 50,
                maxStorageGB: 1
            },
            enabledModules: ['contacts', 'deals', 'tasks', 'events']
        });
        
        console.log('✅ Organization created:', organization.name);
        console.log('   ID:', organization._id);
        
        // 2. Create User
        console.log('\nCreating user...');
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        const user = await User.create({
            organizationId: organization._id,
            username: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
            vertical: 'Retail',
            role: 'owner',
            isOwner: true,
            status: 'active'
        });
        
        // Set permissions
        user.setPermissionsByRole('owner');
        await user.save();
        
        console.log('✅ User created:', user.email);
        console.log('   Role:', user.role);
        console.log('   IsOwner:', user.isOwner);
        console.log('   Organization:', user.organizationId);
        
        // 3. Verify
        console.log('\n📊 Verification:');
        const orgCount = await Organization.countDocuments({});
        const userCount = await User.countDocuments({});
        
        console.log(`   Organizations: ${orgCount}`);
        console.log(`   Users: ${userCount}`);
        
        if (orgCount > 0 && userCount > 0) {
            console.log('\n✅ SUCCESS! Organization creation works correctly.\n');
            console.log('💡 This means the MODELS work fine.');
            console.log('   If registration still fails, the issue is in:');
            console.log('   1. Server not restarted with new code');
            console.log('   2. Frontend not sending organizationName');
            console.log('   3. Some error in the registration endpoint\n');
        }
        
        await mongoose.connection.close();
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testOrgCreation();

