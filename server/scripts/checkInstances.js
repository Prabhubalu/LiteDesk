require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const InstanceRegistry = require('../models/InstanceRegistry');

const checkInstances = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('\n✅ Connected to MongoDB\n');

        const instances = await InstanceRegistry.find({});
        
        console.log(`📊 Total Instances: ${instances.length}\n`);
        
        if (instances.length === 0) {
            console.log('⚠️  No instances found in the database.');
        } else {
            console.log('📋 Instances:');
            console.log('=' .repeat(80));
            
            instances.forEach((instance, index) => {
                console.log(`\n${index + 1}. ${instance.instanceName}`);
                console.log(`   ID: ${instance._id}`);
                console.log(`   Subdomain: ${instance.subdomain}`);
                console.log(`   Owner Email: ${instance.ownerEmail}`);
                console.log(`   Status: ${instance.status}`);
                console.log(`   Provisioning Stage: ${instance.provisioningStage}`);
                console.log(`   Health Status: ${instance.healthStatus}`);
                console.log(`   Subscription Tier: ${instance.subscription?.tier}`);
                console.log(`   Subscription Status: ${instance.subscription?.status}`);
                console.log(`   Created: ${instance.createdAt}`);
                console.log(`   Frontend URL: ${instance.urls?.frontend}`);
                console.log(`   API URL: ${instance.urls?.api}`);
            });
        }
        
        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Database connection closed\n');
    }
};

checkInstances();

