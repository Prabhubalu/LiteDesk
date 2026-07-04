/**
 * ============================================================================
 * PLATFORM CORE: Organization Isolation & Feature Access Middleware
 * ============================================================================
 * 
 * This middleware provides app-agnostic organization management:
 * - Organization isolation (multi-tenancy)
 * - Trial status checking
 * - Feature/module access control
 * - Usage limit checking
 * 
 * ✅ FIXED: Feature access uses app-aware hasFeature() method
 *    - hasFeature() maps CRM module names to CRM app enablement
 *    - For non-CRM features, falls back to enabledModules (backward compat)
 *    - Use hasApp() for app-level checks, hasFeature() for module/feature checks
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

// 🔓 SECURITY DISABLED FOR DEVELOPMENT
// Set DISABLE_SECURITY=true in .env to bypass all security checks
// NOTE: We do NOT auto-disable in non-production to prevent data leakage
// between organizations. Explicit opt-in only.
const SECURITY_DISABLED = process.env.DISABLE_SECURITY === 'true';

const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { enterTenantContext } = require('../utils/tenantContext');

/** Omit large arrays from every request-scoped org load. */
const ORG_CONTEXT_OMIT = '-activityLogs -descriptionVersions';

async function loadOrganizationForRequest(organizationId) {
    return Organization.findById(organizationId).select(ORG_CONTEXT_OMIT);
}

/**
 * Open the tenant database connection (if the org has a dedicated DB) and
 * run the rest of the middleware chain inside that tenant's AsyncLocalStorage
 * context so tenant-scoped models route to the right database.
 *
 * For organizations without `database.name` / `database.initialized`, this is
 * a no-op pass-through and tenant models continue to fall back to master.
 */
async function continueWithTenantContext(req, res, next, organization) {
    const dbName = organization?.database?.name;
    const initialized = organization?.database?.initialized;

    if (!dbName || !initialized) {
        return next();
    }

    let connection;
    try {
        connection = await dbConnectionManager.getOrganizationConnection(dbName);
        if (connection.readyState !== 1 && typeof connection.asPromise === 'function') {
            await connection.asPromise();
        }
    } catch (err) {
        console.error('[organizationIsolation] Failed to open tenant DB connection:', err.message);
        return res.status(500).json({
            message: 'Failed to open tenant database connection',
            code: 'TENANT_DB_UNAVAILABLE'
        });
    }

    req.tenantConnection = connection;
    req.tenantDatabaseName = dbName;

    return enterTenantContext(
        {
            organizationId: organization._id,
            connection,
            databaseName: dbName
        },
        next
    );
}

/**
 * Middleware to ensure organization isolation
 * Attaches organization to req.organization for use in controllers
 * Verifies user belongs to the organization
 */
const organizationIsolation = async (req, res, next) => {
    // 🔓 BYPASS: Skip organization isolation if security is disabled
    if (SECURITY_DISABLED) {
        console.warn('⚠️  [DEV] Organization isolation bypassed');
        // CRITICAL: Use user's organizationId, not first org found
        // This prevents data leakage between organizations
        try {
            const userOrgId = req.user?.organizationId;
            if (!userOrgId) {
                console.error('[OrganizationIsolation] Missing organizationId in req.user:', {
                    userId: req.user?._id,
                    userEmail: req.user?.email
                });
                return res.status(400).json({ 
                    message: 'User organization context required',
                    code: 'ORG_CONTEXT_MISSING'
                });
            }
            
            const org = await loadOrganizationForRequest(userOrgId);
            if (org) {
                req.organization = org;
                console.log('[OrganizationIsolation] Using organization:', {
                    orgId: org._id,
                    orgName: org.name,
                    userEmail: req.user?.email
                });
                return continueWithTenantContext(req, res, next, org);
            } else {
                console.error('[OrganizationIsolation] Organization not found:', {
                    orgId: userOrgId,
                    userEmail: req.user?.email
                });
                return res.status(404).json({ 
                    message: 'Organization not found',
                    code: 'ORG_NOT_FOUND'
                });
            }
        } catch (error) {
            console.error('[OrganizationIsolation] Error in bypass:', error);
            return res.status(500).json({ 
                message: 'Error loading organization context',
                code: 'ORG_LOAD_ERROR'
            });
        }
    }
    
    try {
        // User should already be attached by auth middleware
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (req.organization && String(req.organization._id) === String(req.user.organizationId)) {
            if (!req.organization.isActive) {
                return res.status(403).json({
                    message: 'Organization is inactive. Please contact support.',
                    code: 'ORG_INACTIVE'
                });
            }
            return continueWithTenantContext(req, res, next, req.organization);
        }

        // Get organization from user (fresh from database to ensure latest state)
        const organization = await loadOrganizationForRequest(req.user.organizationId);
        
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

        // Debug: Log organization state (omit during integration tests — set TEST_SILENCE_ORG_LOGS=1)
        const silenceOrgIsolationLog =
            process.env.TEST_SILENCE_ORG_LOGS === '1' || process.env.NODE_ENV === 'test';
        if (process.env.NODE_ENV === 'development' && !silenceOrgIsolationLog) {
            console.log('[OrganizationIsolation] Organization loaded:', {
                orgId: organization._id,
                isTenant: organization.isTenant,
                enabledApps: organization.enabledApps,
                hasFeatureTasks: organization.hasFeature('tasks'),
                hasFeatureEvents: organization.hasFeature('events')
            });
        }

        // Attach organization to request
        req.organization = organization;
        
        return continueWithTenantContext(req, res, next, organization);
    } catch (error) {
        console.error('Organization isolation error:', error);
        res.status(500).json({ message: 'Server error during organization verification' });
    }
};

function isTrialExpiredBypassRoute(req) {
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.originalUrl || req.path || '').split('?')[0];

    if (method === 'GET' && (path.endsWith('/users/profile') || path.endsWith('/profile'))) {
        return true;
    }

    return false;
}

/**
 * Middleware to check if trial has expired
 * Blocks access if trial expired, except for profile read and settings/billing routes
 */
const checkTrialStatus = async (req, res, next) => {
    // 🔓 BYPASS: Skip trial status check if security is disabled
    if (SECURITY_DISABLED) {
        console.warn('⚠️  [DEV] Trial status check bypassed');
        return next();
    }
    
    try {
        const organization = req.organization;
        
        if (!organization) {
            return res.status(500).json({ message: 'Organization not loaded. Use organizationIsolation middleware first.' });
        }

        // Check if trial is expired
        if (organization.isTrialExpired()) {
            if (isTrialExpiredBypassRoute(req)) {
                return next();
            }

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
        // 🔓 BYPASS: Skip feature access check if security is disabled
        if (SECURITY_DISABLED) {
            console.warn(`⚠️  [DEV] Feature access check bypassed: ${featureName}`);
            return next();
        }
        
        try {
            const organization = req.organization;
            
            if (!organization) {
                return res.status(500).json({ message: 'Organization not loaded. Use organizationIsolation middleware first.' });
            }

            // Debug logging
            console.log(`[FeatureAccess] Checking feature: ${featureName}`, {
                organizationId: organization._id,
                isTenant: organization.isTenant,
                enabledApps: organization.enabledApps,
                hasFeature: organization.hasFeature(featureName),
                path: req.path
            });

            // Check if feature is enabled
            if (!organization.hasFeature(featureName)) {
                console.warn(`[FeatureAccess] Feature ${featureName} not available for organization ${organization._id}`, {
                    isTenant: organization.isTenant,
                    enabledApps: organization.enabledApps,
                    enabledModules: organization.enabledModules,
                    hasAppSALES: organization.hasApp('SALES')
                });
                return res.status(403).json({ 
                    message: `This feature is not available in your current plan.`,
                    code: 'FEATURE_NOT_AVAILABLE',
                    feature: featureName,
                    currentTier: organization.subscription?.tier,
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
