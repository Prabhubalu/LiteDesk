/**
 * ============================================================================
 * PLATFORM CORE: Organization Management Controller
 * ============================================================================
 * 
 * This controller handles app-agnostic organization management:
 * - Organization CRUD
 * - Subscription management
 * - Organization settings
 * - Usage statistics
 * 
 * ⚠️ VIOLATION: Handles both tenant organization (Platform Core) and
 *    Sales organization entity (Sales App) in same controller.
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

const Organization = require('../models/Organization');
const User = require('../models/User');
const ModuleDefinition = require('../models/ModuleDefinition');
const { getAppConfig, isAppEnabledForOrg } = require('../utils/appAccessUtils');
const { ensureSubscriptionForApp } = require('../services/subscriptionBootstrapService');
const { invalidateTenantPermissionCaches } = require('../services/rolePermissionCatalogService');

function invalidatePermissionCachesForOrg(organizationId) {
    try {
        invalidateTenantPermissionCaches(organizationId);
    } catch (err) {
        console.warn('[organizationController] permission cache invalidation failed:', err.message);
    }
}

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

        // Update organization (unified model handles both tenant and Sales fields)
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

// --- Enable app for organization (Admin only) ---
exports.enableApp = async (req, res) => {
    try {
        const { appKey } = req.body;
        const organizationId = req.params.id || req.user.organizationId;

        // Validate appKey provided
        if (!appKey) {
            return res.status(400).json({
                success: false,
                message: 'appKey is required',
                code: 'APP_KEY_REQUIRED'
            });
        }

        // Validate user is Sales ADMIN (has Sales appAccess with ADMIN role or isOwner)
        const user = req.user;
        const hasSalesAccess = user.appAccess?.some(
            access => access.appKey === 'SALES' && access.status === 'ACTIVE'
        ) || user.allowedApps?.includes('SALES');
        
        const isAdmin = user.isOwner || String(user.role || '').toLowerCase() === 'admin';
        
        if (!hasSalesAccess || !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only Sales administrators can enable/disable apps',
                code: 'ADMIN_REQUIRED'
            });
        }

        // Validate app exists in registry
        const appConfig = getAppConfig(appKey);
        if (!appConfig) {
            return res.status(400).json({
                success: false,
                message: `App ${appKey} is not registered in the system`,
                code: 'INVALID_APP'
            });
        }

        // Get organization
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found',
                code: 'ORGANIZATION_NOT_FOUND'
            });
        }

        // Check if app is already enabled
        if (isAppEnabledForOrg(organization, appKey)) {
            return res.status(400).json({
                success: false,
                message: `App ${appKey} is already enabled for this organization`,
                code: 'APP_ALREADY_ENABLED'
            });
        }

        // Add app to enabledApps
        if (!organization.enabledApps) {
            organization.enabledApps = [];
        }

        // Remove any existing entry for this app (in case it's SUSPENDED)
        organization.enabledApps = organization.enabledApps.filter(
            app => typeof app === 'object' ? app.appKey !== appKey : app !== appKey
        );

        // Add new entry
        organization.enabledApps.push({
            appKey: appKey,
            status: 'ACTIVE',
            enabledAt: new Date()
        });

        await organization.save();
        invalidatePermissionCachesForOrg(organization._id);

        // Bootstrap trial subscription if needed (after app is enabled)
        try {
            await ensureSubscriptionForApp({
                organizationId: organization._id,
                appKey: appKey,
                initiatedByUserId: req.user._id
            });
        } catch (bootstrapError) {
            // Log but don't fail the enable operation
            console.error('[EnableApp] Subscription bootstrap failed (non-fatal)', {
                orgId: organization._id,
                appKey: appKey,
                error: bootstrapError.message
            });
        }

        res.json({
            success: true,
            message: `App ${appKey} enabled successfully`,
            data: {
                enabledApps: organization.enabledApps
            }
        });

    } catch (error) {
        console.error('Enable app error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error enabling app',
            error: error.message
        });
    }
};

// --- Disable app for organization (Admin only) ---
exports.disableApp = async (req, res) => {
    try {
        const { appKey } = req.body;
        const organizationId = req.params.id || req.user.organizationId;

        // Validate appKey provided
        if (!appKey) {
            return res.status(400).json({
                success: false,
                message: 'appKey is required',
                code: 'APP_KEY_REQUIRED'
            });
        }

        // Validate user is Sales ADMIN (has Sales appAccess with ADMIN role or isOwner)
        const user = req.user;
        const hasSalesAccess = user.appAccess?.some(
            access => access.appKey === 'SALES' && access.status === 'ACTIVE'
        ) || user.allowedApps?.includes('SALES');
        
        const isAdmin = user.isOwner || String(user.role || '').toLowerCase() === 'admin';
        
        if (!hasSalesAccess || !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only Sales administrators can enable/disable apps',
                code: 'ADMIN_REQUIRED'
            });
        }

        // Validate app exists in registry
        const appConfig = getAppConfig(appKey);
        if (!appConfig) {
            return res.status(400).json({
                success: false,
                message: `App ${appKey} is not registered in the system`,
                code: 'INVALID_APP'
            });
        }

        // Prevent disabling Sales (critical app)
        if (appKey === 'SALES') {
            return res.status(400).json({
                success: false,
                message: 'Sales cannot be disabled',
                code: 'Sales_CANNOT_BE_DISABLED'
            });
        }

        // Get organization
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found',
                code: 'ORGANIZATION_NOT_FOUND'
            });
        }

        // Check if app is enabled
        if (!isAppEnabledForOrg(organization, appKey)) {
            return res.status(400).json({
                success: false,
                message: `App ${appKey} is not enabled for this organization`,
                code: 'APP_NOT_ENABLED'
            });
        }

        // Update app status to SUSPENDED (don't remove, just suspend)
        if (!organization.enabledApps) {
            organization.enabledApps = [];
        }

        // Update existing entry or add as SUSPENDED
        const appIndex = organization.enabledApps.findIndex(
            app => (typeof app === 'object' ? app.appKey === appKey : app === appKey)
        );

        if (appIndex >= 0) {
            // Update existing entry
            if (typeof organization.enabledApps[appIndex] === 'object') {
                organization.enabledApps[appIndex].status = 'SUSPENDED';
            } else {
                // Convert string to object
                organization.enabledApps[appIndex] = {
                    appKey: appKey,
                    status: 'SUSPENDED',
                    enabledAt: new Date()
                };
            }
        } else {
            // Add as SUSPENDED (shouldn't happen, but handle gracefully)
            organization.enabledApps.push({
                appKey: appKey,
                status: 'SUSPENDED',
                enabledAt: new Date()
            });
        }

        await organization.save();
        invalidatePermissionCachesForOrg(organization._id);

        // Clean up app-owned fields from module definitions
        // For complete uninstall rules, see: /docs/field-governance.md
        // Only remove fields where owner = 'app' AND context = <app>
        // Preserve org-owned and platform-owned fields
        const appContext = appKey.toLowerCase(); // Normalize app key to lowercase for context matching
        let fieldsRemoved = 0;
        let modulesUpdated = 0;

        try {
            // Find all module definitions for this organization
            const moduleDefinitions = await ModuleDefinition.find({
                organizationId: organizationId
            });

            for (const moduleDef of moduleDefinitions) {
                let moduleChanged = false;
                
                // First, identify which field keys will be removed (before filtering)
                const removedFieldKeys = new Set();
                if (Array.isArray(moduleDef.fields) && moduleDef.fields.length > 0) {
                    moduleDef.fields.forEach(field => {
                        if (field && field.key) {
                            const fieldOwner = (field.owner || 'platform').toLowerCase();
                            const fieldContext = (field.context || 'global').toLowerCase();
                            if (fieldOwner === 'app' && fieldContext === appContext) {
                                removedFieldKeys.add(field.key.toLowerCase());
                            }
                        }
                    });
                }
                
                // Filter out app-owned fields with matching context
                if (Array.isArray(moduleDef.fields) && moduleDef.fields.length > 0) {
                    const fieldsBefore = moduleDef.fields.length;
                    const filteredFields = moduleDef.fields.filter(field => {
                        if (!field) return true; // Preserve null/undefined fields
                        
                        const fieldOwner = (field.owner || 'platform').toLowerCase();
                        const fieldContext = (field.context || 'global').toLowerCase();
                        
                        // NEVER remove platform or org-owned fields
                        if (fieldOwner === 'platform' || fieldOwner === 'org') {
                            return true; // Keep the field
                        }
                        
                        // Only remove app-owned fields with matching context
                        if (fieldOwner === 'app' && fieldContext === appContext) {
                            return false; // Remove this field
                        }
                        
                        // Keep all other fields (app-owned with different context, or missing owner/context)
                        return true;
                    });

                    // Only update if fields were actually removed
                    if (filteredFields.length < fieldsBefore) {
                        moduleDef.fields = filteredFields;
                        fieldsRemoved += (fieldsBefore - filteredFields.length);
                        moduleChanged = true;
                    }
                }

                // Also clean up quickCreate array - remove app-owned field keys
                if (removedFieldKeys.size > 0 && Array.isArray(moduleDef.quickCreate) && moduleDef.quickCreate.length > 0) {
                    const quickCreateBefore = moduleDef.quickCreate.length;
                    moduleDef.quickCreate = moduleDef.quickCreate.filter(key => {
                        if (!key) return true;
                        return !removedFieldKeys.has(String(key).toLowerCase());
                    });
                    
                    if (moduleDef.quickCreate.length < quickCreateBefore) {
                        moduleChanged = true;
                    }
                }

                // Clean up quickCreateLayout - remove app-owned field references
                if (removedFieldKeys.size > 0 && 
                    moduleDef.quickCreateLayout && 
                    moduleDef.quickCreateLayout.rows && 
                    Array.isArray(moduleDef.quickCreateLayout.rows)) {
                    
                    let layoutChanged = false;
                    const cleanedRows = moduleDef.quickCreateLayout.rows.map(row => {
                        if (!row || !Array.isArray(row.cols)) return row;
                        
                        const cleanedCols = row.cols.filter(col => {
                            if (!col || !col.fieldKey) return true;
                            return !removedFieldKeys.has(String(col.fieldKey).toLowerCase());
                        });
                        
                        if (cleanedCols.length !== row.cols.length) {
                            layoutChanged = true;
                        }
                        
                        return {
                            ...row,
                            cols: cleanedCols
                        };
                    }).filter(row => !row.cols || row.cols.length > 0); // Remove empty rows
                    
                    if (layoutChanged) {
                        moduleDef.quickCreateLayout = {
                            ...moduleDef.quickCreateLayout,
                            rows: cleanedRows
                        };
                        moduleChanged = true;
                    }
                }

                // Save module if any changes were made
                if (moduleChanged) {
                    await moduleDef.save();
                    modulesUpdated += 1;
                }
            }

            console.log(`✅ App uninstall cleanup: Removed ${fieldsRemoved} app-owned fields from ${modulesUpdated} modules`);
        } catch (cleanupError) {
            // Log error but don't fail the uninstall - app is already disabled
            console.error('⚠️  Error during app uninstall cleanup:', cleanupError);
            // Continue with response - app is disabled even if cleanup partially failed
        }

        res.json({
            success: true,
            message: `App ${appKey} disabled successfully`,
            data: {
                enabledApps: organization.enabledApps,
                cleanup: {
                    fieldsRemoved: fieldsRemoved,
                    modulesUpdated: modulesUpdated
                }
            }
        });

    } catch (error) {
        console.error('Disable app error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error disabling app',
            error: error.message
        });
    }
};

