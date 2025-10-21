const Organization = require('../models/Organization');

/**
 * Middleware to ensure organization isolation
 * Attaches organization to req.organization for use in controllers
 * Verifies user belongs to the organization
 */
const organizationIsolation = async (req, res, next) => {
    try {
        // User should already be attached by auth middleware
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Get organization from user
        const organization = await Organization.findById(req.user.organizationId);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        // Check if organization is active
        if (!organization.isActive) {
            return res.status(403).json({ 
                message: 'Organization is inactive. Please contact support.',
                code: 'ORG_INACTIVE'
            });
        }

        // Attach organization to request
        req.organization = organization;
        
        next();
    } catch (error) {
        console.error('Organization isolation error:', error);
        res.status(500).json({ message: 'Server error during organization verification' });
    }
};

/**
 * Middleware to check if trial has expired
 * Blocks access if trial expired, except for upgrade/billing routes
 */
const checkTrialStatus = async (req, res, next) => {
    try {
        const organization = req.organization;
        
        if (!organization) {
            return res.status(500).json({ message: 'Organization not loaded. Use organizationIsolation middleware first.' });
        }

        // Check if trial is expired
        if (organization.isTrialExpired()) {
            return res.status(403).json({ 
                message: 'Trial period has expired. Please upgrade to continue.',
                code: 'TRIAL_EXPIRED',
                requiresUpgrade: true,
                trialEndDate: organization.subscription.trialEndDate
            });
        }

        // Add trial warning if less than 3 days remaining
        const daysRemaining = organization.getTrialDaysRemaining();
        if (organization.subscription.status === 'trial' && daysRemaining <= 3) {
            res.locals.trialWarning = {
                daysRemaining,
                message: `Your trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
            };
        }

        next();
    } catch (error) {
        console.error('Trial check error:', error);
        res.status(500).json({ message: 'Server error during trial verification' });
    }
};

/**
 * Middleware to check if organization has access to a specific feature/module
 * Usage: checkFeatureAccess('process_designer')
 */
const checkFeatureAccess = (featureName) => {
    return async (req, res, next) => {
        try {
            const organization = req.organization;
            
            if (!organization) {
                return res.status(500).json({ message: 'Organization not loaded. Use organizationIsolation middleware first.' });
            }

            // Check if feature is enabled
            if (!organization.hasFeature(featureName)) {
                return res.status(403).json({ 
                    message: `This feature is not available in your current plan.`,
                    code: 'FEATURE_NOT_AVAILABLE',
                    feature: featureName,
                    currentTier: organization.subscription.tier,
                    upgradeRequired: true
                });
            }

            next();
        } catch (error) {
            console.error('Feature access check error:', error);
            res.status(500).json({ message: 'Server error during feature verification' });
        }
    };
};

/**
 * Middleware to check usage limits
 * Usage: checkLimit('contacts', numberOfContactsToCreate)
 */
const checkLimit = (limitType, count = 1) => {
    return async (req, res, next) => {
        try {
            const organization = req.organization;
            
            if (!organization) {
                return res.status(500).json({ message: 'Organization not loaded. Use organizationIsolation middleware first.' });
            }

            const limitField = `max${limitType.charAt(0).toUpperCase() + limitType.slice(1)}`;
            const maxLimit = organization.limits[limitField];
            
            // -1 means unlimited
            if (maxLimit === -1) {
                return next();
            }

            // This is a simplified check - in production you'd query the actual count
            // For now, we'll just pass through and handle it in controllers
            next();
        } catch (error) {
            console.error('Limit check error:', error);
            res.status(500).json({ message: 'Server error during limit verification' });
        }
    };
};

module.exports = {
    organizationIsolation,
    checkTrialStatus,
    checkFeatureAccess,
    checkLimit
};

