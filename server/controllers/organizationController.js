const Organization = require('../models/Organization');
const OrganizationV2 = require('../models/OrganizationV2');
const User = require('../models/User');
const { orgV1ToV2Doc, orgV2ToV1View, orgUpdateReqToV2 } = require('../utils/mappers/organizationMapper');

// --- Get organization details ---
exports.getOrganization = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);

        if (!organization) {
            return res.status(404).json({ 
                success: false,
                message: 'Organization not found' 
            });
        }

        // Add trial info if on trial
        let responseData = organization.toObject();
        // READ-THROUGH: Attach V2 details if available
        if (process.env.FEATURE_READ_THROUGH_ORG === 'true') {
            try {
                const v2 = await OrganizationV2.findOne({ legacyOrganizationId: organization._id });
                if (v2) {
                    const { orgV2ToV1View } = require('../utils/mappers/organizationMapper');
                    responseData = orgV2ToV1View(v2, responseData);
                }
            } catch (e) {
                // noop
            }
        }
        if (organization.subscription.status === 'trial') {
            responseData.trialDaysRemaining = organization.getTrialDaysRemaining();
            responseData.isTrialExpired = organization.isTrialExpired();
        }

        res.json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching organization' 
        });
    }
};

// --- Update organization settings ---
exports.updateOrganization = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);

        if (!organization) {
            return res.status(404).json({ 
                success: false,
                message: 'Organization not found' 
            });
        }

        if (process.env.FEATURE_ORG_USE_V2 === 'true') {
            const v2Update = orgUpdateReqToV2(req.body);
            const updatedV2 = await OrganizationV2.findOneAndUpdate(
                { legacyOrganizationId: organization._id },
                { $set: v2Update, $setOnInsert: { legacyOrganizationId: organization._id, name: organization.name } },
                { upsert: true, new: true }
            );
            // Mirror minimal fields back to v1
            if (req.body.name) organization.name = req.body.name;
            if (req.body.industry) organization.industry = req.body.industry;
            if (req.body.settings) organization.settings = { ...organization.settings, ...req.body.settings };
            await organization.save();

            return res.json({ success: true, data: orgV2ToV1View(updatedV2, organization.toObject()), message: 'Organization updated successfully' });
        }

        // Default path: update v1
        const { name, settings } = req.body;
        if (name) organization.name = name;
        if (settings) organization.settings = { ...organization.settings, ...settings };
        await organization.save();

        res.json({ success: true, data: organization, message: 'Organization updated successfully' });

    } catch (error) {
        console.error('Update organization error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating organization' 
        });
    }
};

// --- Get subscription details ---
exports.getSubscription = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);

        if (!organization) {
            return res.status(404).json({ 
                success: false,
                message: 'Organization not found' 
            });
        }

        const subscriptionInfo = {
            ...organization.subscription.toObject(),
            limits: organization.limits,
            enabledModules: organization.enabledModules
        };

        // Add trial info
        if (organization.subscription.status === 'trial') {
            subscriptionInfo.daysRemaining = organization.getTrialDaysRemaining();
            subscriptionInfo.isExpired = organization.isTrialExpired();
        }

        // Add usage stats
        const userCount = await User.countDocuments({ 
            organizationId: organization._id,
            status: 'active'
        });

        subscriptionInfo.usage = {
            users: {
                current: userCount,
                limit: organization.limits.maxUsers
            }
            // TODO: Add other usage stats (contacts, deals, etc.)
        };

        res.json({
            success: true,
            data: subscriptionInfo
        });

    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching subscription' 
        });
    }
};

// --- Upgrade subscription ---
exports.upgradeSubscription = async (req, res) => {
    const { tier } = req.body;

    try {
        if (!['starter', 'professional', 'enterprise'].includes(tier)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid subscription tier' 
            });
        }

        const organization = await Organization.findById(req.user.organizationId);

        if (!organization) {
            return res.status(404).json({ 
                success: false,
                message: 'Organization not found' 
            });
        }

        // Update subscription
        organization.subscription.status = 'active';
        organization.subscription.tier = tier;
        organization.subscription.currentPeriodStart = new Date();
        
        // Set next billing date (30 days from now)
        const nextBillingDate = new Date();
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
        organization.subscription.currentPeriodEnd = nextBillingDate;

        // Update limits based on tier
        organization.updateLimitsForTier(tier);
        
        // Update enabled modules
        organization.enabledModules = organization.getModulesForTier(tier);

        await organization.save();

        // TODO: Integrate with Stripe for actual payment processing

        res.json({
            success: true,
            data: {
                subscription: organization.subscription,
                limits: organization.limits,
                enabledModules: organization.enabledModules
            },
            message: `Successfully upgraded to ${tier} plan`
        });

    } catch (error) {
        console.error('Upgrade subscription error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error upgrading subscription' 
        });
    }
};

// --- Cancel subscription ---
exports.cancelSubscription = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);

        if (!organization) {
            return res.status(404).json({ 
                success: false,
                message: 'Organization not found' 
            });
        }

        // Mark for cancellation at end of period
        organization.subscription.autoRenew = false;
        // organization.subscription.status = 'cancelled'; // Uncomment to cancel immediately

        await organization.save();

        // TODO: Cancel Stripe subscription

        res.json({
            success: true,
            message: 'Subscription will be cancelled at the end of the billing period',
            data: organization.subscription
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error cancelling subscription' 
        });
    }
};

// --- Get organization statistics ---
exports.getStats = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);

        if (!organization) {
            return res.status(404).json({ 
                success: false,
                message: 'Organization not found' 
            });
        }

        // Get user count
        const userCount = await User.countDocuments({ 
            organizationId: organization._id,
            status: 'active'
        });

        // TODO: Get counts for other modules
        // const contactCount = await Contact.countDocuments({ organizationId: organization._id });
        // const dealCount = await Deal.countDocuments({ organizationId: organization._id });

        const stats = {
            users: {
                count: userCount,
                limit: organization.limits.maxUsers,
                percentage: organization.limits.maxUsers === -1 ? 0 : (userCount / organization.limits.maxUsers) * 100
            },
            subscription: {
                tier: organization.subscription.tier,
                status: organization.subscription.status,
                daysRemaining: organization.subscription.status === 'trial' ? organization.getTrialDaysRemaining() : null
            }
            // Add more stats as modules are implemented
        };

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching statistics' 
        });
    }
};

