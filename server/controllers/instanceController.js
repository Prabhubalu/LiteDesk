const InstanceRegistry = require('../models/InstanceRegistry');
const DemoRequest = require('../models/DemoRequest');

// @desc    Get all instances (with filters and pagination)
// @route   GET /api/instances
// @access  Private (Owner/Admin only)
const getAllInstances = async (req, res) => {
    try {
        const { 
            status, 
            subscriptionStatus, 
            healthStatus,
            search,
            page = 1, 
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        if (status) filter.status = status;
        if (subscriptionStatus) filter['subscription.status'] = subscriptionStatus;
        if (healthStatus) filter.healthStatus = healthStatus;
        if (search) {
            filter.$or = [
                { instanceName: { $regex: search, $options: 'i' } },
                { subdomain: { $regex: search, $options: 'i' } },
                { ownerEmail: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        // Get instances with pagination
        const instances = await InstanceRegistry.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('demoRequestId', 'companyName contactName email')
            .populate('createdBy', 'firstName lastName email')
            .lean();

        // Get total count for pagination
        const totalInstances = await InstanceRegistry.countDocuments(filter);

        // Calculate statistics
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

        res.status(200).json({
            success: true,
            data: instances,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalInstances / parseInt(limit)),
                totalInstances,
                limit: parseInt(limit)
            },
            statistics: stats[0] || {
                totalInstances: 0,
                activeInstances: 0,
                provisioningInstances: 0,
                suspendedInstances: 0,
                trialInstances: 0,
                paidInstances: 0,
                totalMRR: 0
            }
        });
    } catch (error) {
        console.error('Get all instances error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching instances',
            error: error.message
        });
    }
};

// @desc    Get single instance details
// @route   GET /api/instances/:id
// @access  Private (Owner/Admin only)
const getInstanceDetails = async (req, res) => {
    try {
        const instance = await InstanceRegistry.findById(req.params.id)
            .populate('demoRequestId')
            .populate('createdBy', 'firstName lastName email');

        if (!instance) {
            return res.status(404).json({
                success: false,
                message: 'Instance not found'
            });
        }

        res.status(200).json({
            success: true,
            data: instance
        });
    } catch (error) {
        console.error('Get instance details error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching instance details',
            error: error.message
        });
    }
};

// @desc    Update instance status
// @route   PATCH /api/instances/:id/status
// @access  Private (Owner/Admin only)
const updateInstanceStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['provisioning', 'active', 'suspended', 'terminated', 'failed'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const instance = await InstanceRegistry.findById(req.params.id);
        if (!instance) {
            return res.status(404).json({
                success: false,
                message: 'Instance not found'
            });
        }

        instance.status = status;
        
        // Update timestamp based on status
        if (status === 'active') {
            instance.activatedAt = new Date();
        } else if (status === 'suspended') {
            instance.suspendedAt = new Date();
        } else if (status === 'terminated') {
            instance.terminatedAt = new Date();
        }

        await instance.save();

        res.status(200).json({
            success: true,
            message: `Instance status updated to ${status}`,
            data: instance
        });
    } catch (error) {
        console.error('Update instance status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating instance status',
            error: error.message
        });
    }
};

// @desc    Update instance subscription
// @route   PATCH /api/instances/:id/subscription
// @access  Private (Owner/Admin only)
const updateInstanceSubscription = async (req, res) => {
    try {
        const { tier, status, mrr } = req.body;
        
        const instance = await InstanceRegistry.findById(req.params.id);
        if (!instance) {
            return res.status(404).json({
                success: false,
                message: 'Instance not found'
            });
        }

        if (tier) instance.subscription.tier = tier;
        if (status) instance.subscription.status = status;
        if (mrr !== undefined) instance.subscription.mrr = mrr;

        await instance.save();

        res.status(200).json({
            success: true,
            message: 'Instance subscription updated',
            data: instance
        });
    } catch (error) {
        console.error('Update instance subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating instance subscription',
            error: error.message
        });
    }
};

// @desc    Update instance health check
// @route   PATCH /api/instances/:id/health
// @access  Private (System/Admin only)
const updateInstanceHealth = async (req, res) => {
    try {
        const { healthStatus, metrics } = req.body;
        
        const instance = await InstanceRegistry.findById(req.params.id);
        if (!instance) {
            return res.status(404).json({
                success: false,
                message: 'Instance not found'
            });
        }

        if (healthStatus) instance.healthStatus = healthStatus;
        instance.lastHealthCheck = new Date();
        
        if (metrics) {
            instance.metrics = { ...instance.metrics, ...metrics };
        }

        await instance.save();

        res.status(200).json({
            success: true,
            message: 'Instance health updated',
            data: instance
        });
    } catch (error) {
        console.error('Update instance health error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating instance health',
            error: error.message
        });
    }
};

// @desc    Get instance metrics/analytics
// @route   GET /api/instances/analytics
// @access  Private (Owner/Admin only)
const getInstanceAnalytics = async (req, res) => {
    try {
        // Get time-based analytics
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const analytics = await InstanceRegistry.aggregate([
            {
                $facet: {
                    // Status distribution
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    // Subscription tier distribution
                    byTier: [
                        { $group: { _id: '$subscription.tier', count: { $sum: 1 } } }
                    ],
                    // Health status distribution
                    byHealth: [
                        { $group: { _id: '$healthStatus', count: { $sum: 1 } } }
                    ],
                    // Recent provisioning (last 30 days)
                    recentProvisioning: [
                        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    // MRR by tier
                    mrrByTier: [
                        {
                            $group: {
                                _id: '$subscription.tier',
                                totalMRR: { $sum: '$subscription.mrr' },
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    // Resource usage summary
                    resourceUsage: [
                        {
                            $group: {
                                _id: null,
                                totalUsers: { $sum: '$metrics.totalUsers' },
                                totalContacts: { $sum: '$metrics.totalContacts' },
                                totalDeals: { $sum: '$metrics.totalDeals' },
                                totalStorageGB: { $sum: '$metrics.storageUsedGB' }
                            }
                        }
                    ]
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: analytics[0]
        });
    } catch (error) {
        console.error('Get instance analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching instance analytics',
            error: error.message
        });
    }
};

// @desc    Delete/Terminate instance
// @route   DELETE /api/instances/:id
// @access  Private (Owner only)
const deleteInstance = async (req, res) => {
    try {
        const instance = await InstanceRegistry.findById(req.params.id);
        if (!instance) {
            return res.status(404).json({
                success: false,
                message: 'Instance not found'
            });
        }

        // TODO: Implement actual termination logic via InstanceProvisioner
        // For now, just mark as terminated
        instance.status = 'terminated';
        instance.terminatedAt = new Date();
        await instance.save();

        res.status(200).json({
            success: true,
            message: 'Instance marked for termination',
            data: instance
        });
    } catch (error) {
        console.error('Delete instance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error terminating instance',
            error: error.message
        });
    }
};

module.exports = {
    getAllInstances,
    getInstanceDetails,
    updateInstanceStatus,
    updateInstanceSubscription,
    updateInstanceHealth,
    getInstanceAnalytics,
    deleteInstance
};

