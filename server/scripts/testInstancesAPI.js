require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const InstanceRegistry = require('../models/InstanceRegistry');

const testAPI = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('\n✅ Connected to MongoDB\n');

        // Simulate what the API does
        const filter = {};
        const skip = 0;
        const limit = 20;
        const sortOptions = { createdAt: -1 };

        // Get instances
        const instances = await InstanceRegistry.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(`📊 Found ${instances.length} instances\n`);

        // Calculate statistics (same as in controller)
        const stats = await InstanceRegistry.aggregate([
            {
                $group: {
                    _id: null,
                    totalInstances: { $sum: 1 },
                    activeInstances: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    provisioningInstances: {
                        $sum: { $cond: [{ $eq: ['$status', 'provisioning'] }, 1, 0] }
                    },
                    suspendedInstances: {
                        $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] }
                    },
                    trialInstances: {
                        $sum: { $cond: [{ $eq: ['$subscription.status', 'trial'] }, 1, 0] }
                    },
                    paidInstances: {
                        $sum: { $cond: [{ $eq: ['$subscription.status', 'active'] }, 1, 0] }
                    },
                    totalMRR: { $sum: '$subscription.mrr' }
                }
            }
        ]);

        console.log('📈 Statistics aggregation result:');
        console.log(JSON.stringify(stats, null, 2));

        const statistics = stats[0] || {
            totalInstances: 0,
            activeInstances: 0,
            provisioningInstances: 0,
            suspendedInstances: 0,
            trialInstances: 0,
            paidInstances: 0,
            totalMRR: 0
        };

        console.log('\n📊 Final statistics object:');
        console.log(JSON.stringify(statistics, null, 2));

        console.log('\n✅ API Response would be:');
        const response = {
            success: true,
            data: instances,
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(instances.length / limit),
                totalInstances: instances.length,
                limit: limit
            },
            statistics: statistics
        };
        console.log(JSON.stringify(response, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Database connection closed\n');
    }
};

testAPI();

