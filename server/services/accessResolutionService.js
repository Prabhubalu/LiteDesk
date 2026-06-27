/**
 * ============================================================================
 * Phase 0F: Unified Access Resolution Engine (Platform-Level)
 * ============================================================================
 * 
 * Single, authoritative access resolution function that determines:
 * - Whether a user can see, enter, or act inside an app
 * - Whether the access is ADMIN (implicit, non-billable) or EXECUTION (explicit, billable)
 * - Whether UI, API, automation, and Process Designer can proceed
 * 
 * Core Principles:
 * - One function decides access
 * - Owner ≠ Billable User (organization owner has implicit ADMIN access)
 * - Execution access is explicit and billable
 * - Access ≠ Visibility (Admin allows config, Execution allows data operations)
 * 
 * ============================================================================
 */

const AppDefinition = require('../models/AppDefinition');
const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const Organization = require('../models/Organization');
const Instance = require('../models/Instance');
const { getAppConfig, validateAppRole } = require('../utils/appAccessUtils');
const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
const provisioning = require('./tenantProvisioningMetadata');
const { resolveExecutionEntitlement } = require('./executionEntitlementService');
const { resolveAccessFeedback } = require('../utils/executionFeedbackResolver');

const ACCESS_DEBUG = process.env.ACCESS_DEBUG === 'true';

/**
 * Check if user email is a Arivu internal email
 * @param {string} email - User email
 * @returns {boolean} - True if internal email
 */
function isArivuInternalEmail(email) {
    if (!email) return false;
    const internalDomains = [
        'arivusystems.com',
        'arivu.com',
        'arivu.io',
        '@arivu', // legacy @arivu* patterns
    ];
    const emailLower = email.toLowerCase();
    return internalDomains.some(domain => emailLower.includes(domain));
}

/**
 * Resolve app access for a user
 * 
 * @param {Object} params - Access resolution parameters
 * @param {Object} params.user - User object (must have _id, organizationId, appAccess)
 * @param {Object} params.organization - Organization object (must have ownerId, enabledApps)
 * @param {string} params.appKey - Application key (SALES, AUDIT, PORTAL, LMS)
 * @param {string} params.intent - Intent: 'VIEW' | 'CONFIGURE' | 'EXECUTE'
 * @returns {Promise<Object>} Access resolution result
 * 
 * @returns {Object} result
 * @returns {boolean} result.allowed - Whether access is allowed
 * @returns {string|null} result.mode - 'ADMIN' | 'EXECUTION' | null
 * @returns {boolean} result.billable - Whether this access consumes a seat
 * @returns {string} result.reason - Reason code for the decision
 * @returns {string|null} result.roleKey - Role key if EXECUTION mode
 */
async function resolveAppAccess({ user, organization, appKey, intent }) {
    // Initialize result object
    const result = {
        allowed: false,
        mode: null,
        billable: false,
        reason: 'UNKNOWN',
        roleKey: null
    };

    // ============================================================================
    // STEP 1: Validate App
    // ============================================================================
    // App must exist in AppDefinition
    // Try both lowercase and uppercase (case-insensitive)
    let appDefinition = null;
    try {
        appDefinition = await AppDefinition.findOne({ 
            $or: [
                { appKey: appKey.toLowerCase(), enabled: true },
                { appKey: appKey.toUpperCase(), enabled: true },
                { appKey: appKey, enabled: true }
            ]
        });
    } catch (dbError) {
        // If AppDefinition query fails, log but continue (might not be critical)
        if (ACCESS_DEBUG) {
            console.warn(`[AccessResolution] AppDefinition query failed:`, dbError.message);
        }
        // Fall through to check if app exists in registry
    }
    
    // If AppDefinition not found in DB, check if app exists in registry
    // This allows apps to work even if AppDefinition hasn't been seeded
    if (!appDefinition) {
        const { getAppConfig } = require('../utils/appAccessUtils');
        const appConfig = getAppConfig(appKey);
        if (!appConfig) {
            result.reason = 'APP_NOT_FOUND';
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }
        // App exists in registry, continue (AppDefinition is optional for basic access)
        if (ACCESS_DEBUG) {
            console.log(`[AccessResolution] App ${appKey} found in registry but not in AppDefinition`);
        }
    }

    // ============================================================================
    // STEP 1.5: Platform-Only App Guard (ESSENTIAL SECURITY)
    // ============================================================================
    // If app is marked as platform-only (tenantVisible === false), only platform admins can access
    // This prevents tenant admins from accessing platform-only apps even if:
    // - There's a bug in role configuration
    // - A bad seed script grants access
    // - There's a misconfiguration
    if (appDefinition && appDefinition.capabilities?.tenantVisible === false) {
        const isPlatformAdmin = user.isPlatformAdmin === true;
        
        if (!isPlatformAdmin) {
            result.reason = 'PLATFORM_ONLY_APP';
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }
        
        // Platform admin has ADMIN access (non-billable) to platform-only apps
        result.allowed = true;
        result.mode = 'ADMIN';
        result.billable = false;
        result.reason = 'PLATFORM_ADMIN_ACCESS';
        
        // Validate intent for ADMIN mode
        if (intent === 'EXECUTE') {
            // ADMIN cannot execute (needs explicit EXECUTION access)
            result.allowed = false;
            result.reason = 'ADMIN_CANNOT_EXECUTE';
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }
        
        // ADMIN can VIEW and CONFIGURE platform-only apps
        addFeedbackToResult(result);
        logAccessDecision(user, appKey, intent, result);
        return result;
    }

    // ============================================================================
    // STEP 1.6: Control Plane Access Check (STRICT - Legacy/Explicit)
    // ============================================================================
    // CONTROL_PLANE is platform-only, non-tenant, non-billable
    // Only platform admins can access
    // Bypasses all tenant enablement checks
    // Note: This check is redundant if CONTROL_PLANE has capabilities.tenantVisible === false
    // but kept for explicit CONTROL_PLANE protection
    if (appKey.toUpperCase() === 'CONTROL_PLANE') {
        // Check if user is platform admin
        const isPlatformAdmin = user.isPlatformAdmin === true || 
                               isArivuInternalEmail(user.email);
        
        if (!isPlatformAdmin) {
            result.reason = 'CONTROL_PLANE_ACCESS_DENIED';
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }
        
        // Platform admin has ADMIN access (non-billable)
        result.allowed = true;
        result.mode = 'ADMIN';
        result.billable = false;
        result.reason = 'PLATFORM_ADMIN_ACCESS';
        
        // Validate intent for ADMIN mode
        if (intent === 'EXECUTE') {
            // ADMIN cannot execute (needs explicit EXECUTION access, but CONTROL_PLANE doesn't support execution)
            result.allowed = false;
            result.reason = 'CONTROL_PLANE_NO_EXECUTION';
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }
        
        // ADMIN can VIEW and CONFIGURE
        // CONTROL_PLANE bypasses tenant enablement checks
        addFeedbackToResult(result);
        logAccessDecision(user, appKey, intent, result);
        return result;
    }

    // ============================================================================
    // STEP 2: Get Organization Object
    // ============================================================================
    // Ensure we have the full organization object (handle both object and ID)
    let org = null;
    let organizationId = null;
    
    // Check if organization is an object with _id or enabledApps
    if (organization && typeof organization === 'object') {
        organizationId = organization._id || organization;
        // If organization has enabledApps, use it directly
        if (organization.enabledApps && Array.isArray(organization.enabledApps)) {
            org = organization;
        } else {
            // Organization object passed but missing enabledApps, query from database
            org = await Organization.findById(organizationId);
        }
    } else {
        // Organization is just an ID (string or ObjectId)
        organizationId = organization;
        org = await Organization.findById(organizationId);
    }
    
    if (!org) {
        console.error(`[AccessResolution] Organization not found:`, {
            organizationId: organizationId,
            organizationType: typeof organization,
            organization: organization
        });
        result.reason = 'ORGANIZATION_NOT_FOUND';
        addFeedbackToResult(result);
        logAccessDecision(user, appKey, intent, result);
        return result;
    }
    
    // Ensure organizationId is set
    if (!organizationId) {
        organizationId = org._id;
    }

    // Ensure enabledApps exists (initialize if missing)
    if (!org.enabledApps || !Array.isArray(org.enabledApps) || org.enabledApps.length === 0) {
        if (ACCESS_DEBUG) {
            console.log(`[AccessResolution] Organization missing enabledApps, initializing: orgId=${organizationId}`);
        }
        // Initialize with SALES app
        const { APP_KEYS } = require('../constants/appKeys');
        org.enabledApps = [{ appKey: APP_KEYS.SALES, status: 'ACTIVE', enabledAt: new Date() }];
        // Try to save (non-blocking)
        try {
            if (org.save) {
                await org.save().catch(err => {
                    if (ACCESS_DEBUG) {
                        console.warn(`[AccessResolution] Failed to save enabledApps:`, err.message);
                    }
                });
            }
        } catch (saveError) {
            // Non-blocking - continue with in-memory value
            if (ACCESS_DEBUG) {
                console.warn(`[AccessResolution] Error saving enabledApps:`, saveError.message);
            }
        }
    }

    // App must be enabled for tenant via TenantAppConfiguration or Organization.enabledApps
    // Check TenantAppConfiguration first (preferred)
    let tenantAppConfig = null;
    try {
        tenantAppConfig = await TenantAppConfiguration.findOne({
            organizationId: organizationId,
            appKey: appKey.toUpperCase(),
            enabled: true
        });
    } catch (configError) {
        // TenantAppConfiguration might not exist - that's okay, fall back to enabledApps
        if (ACCESS_DEBUG) {
            console.warn(`[AccessResolution] TenantAppConfiguration query failed (non-critical):`, configError.message);
        }
    }

    // Fallback to Organization.enabledApps if TenantAppConfiguration not found
    let isAppEnabled = false;
    if (tenantAppConfig) {
        isAppEnabled = tenantAppConfig.enabled === true;
    } else {
        // Use organization.enabledApps (handles both object and string formats)
        isAppEnabled = isAppEnabledForOrg(org, appKey);
    }

    if (!isAppEnabled) {
        result.reason = 'APP_NOT_ENABLED_FOR_TENANT';
        addFeedbackToResult(result);
        logAccessDecision(user, appKey, intent, result);
        return result;
    }

    // ============================================================================
    // STEP 2.5: Instance Status Check (Phase 0I)
    // ============================================================================
    // Check if instance execution is blocked (SUSPENDED, TERMINATED)
    // This check happens after app validation but before role checks
    let instance = null;
    try {
        instance = await Instance.findOne({ organizationId: organizationId });
        
        if (instance && provisioning.isExecutionBlocked(instance)) {
            result.reason = 'INSTANCE_BLOCKED';
            result.billable = false;
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }
    } catch (error) {
        // If Instance model doesn't exist or query fails, continue
        // (graceful degradation for organizations without instance records)
        if (ACCESS_DEBUG) {
            console.log('[AccessResolution] Instance check skipped:', error.message);
        }
    }

    // ============================================================================
    // PHASE 0J.1 — INTERNAL INSTANCE OVERRIDE
    // ============================================================================
    /**
     * INTERNAL INSTANCE OVERRIDE
     * --------------------------
     * Arivu-owned instances must never be blocked by:
     * - trial expiration
     * - subscription enforcement
     * - seat limits
     * - owner execution restrictions
     *
     * This guard MUST remain above all billing logic.
     * 
     * Rules:
     * - Runs before trial checks
     * - Runs before subscription checks
     * - Runs before owner execution logic
     * - Runs before seat enforcement
     * - Applies to all apps
     * - Applies to all intents (VIEW, CONFIGURE, EXECUTE)
     * - Always non-billable
     * - EXECUTE intent uses EXECUTION mode; VIEW/CONFIGURE use ADMIN
     */
    if (instance?.isInternal === true) {
        result.allowed = true;
        result.mode = intent === 'EXECUTE' ? 'EXECUTION' : 'ADMIN';
        result.billable = false;
        result.roleKey = 'PLATFORM_INTERNAL';
        result.reason = 'INTERNAL_INSTANCE_OVERRIDE';
        addFeedbackToResult(result);
        logAccessDecision(user, appKey, intent, result);
        return result;
    }

    // ============================================================================
    // STEP 2.6: Execution Entitlement Check (Phase 0J)
    // ============================================================================
    // Execute entitlement resolver to determine if execution is allowed
    // This happens after instance status check but before seat enforcement
    // It handles trial execution, subscription requirements, and seat checks
    try {
        const executionResult = resolveExecutionEntitlement({
            user,
            organization: org,
            instance,
            appKey,
            intent
        });

        // If execution is not allowed, return early with execution entitlement reason
        if (!executionResult.allowed) {
            result.allowed = false;
            result.billable = false;
            result.reason = executionResult.reason;
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }

        // Execution is allowed - set billable flag from execution result
        result.billable = executionResult.billable;

        // If intent is VIEW or CONFIGURE and execution entitlement allows it,
        // we can grant ADMIN mode access (non-billable)
        if ((intent === 'VIEW' || intent === 'CONFIGURE') && executionResult.reason?.includes('ADMIN')) {
            result.allowed = true;
            result.mode = 'ADMIN';
            result.billable = false;
            result.reason = executionResult.reason;
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }

        // If this is trial execution, grant EXECUTION mode (non-billable)
        if (executionResult.reason === 'TRIAL_EXECUTION_ALLOWED') {
            result.allowed = true;
            result.mode = 'EXECUTION';
            result.billable = false;
            result.reason = 'TRIAL_EXECUTION_ALLOWED';
            // Note: For trial execution, we don't check roles - owner can execute any app
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }

        // If execution entitlement allows it with billable=true, user has a seat
        // We still need to validate roles and permissions below
        // Set allowed=true here but continue to role validation
        if (executionResult.billable) {
            result.allowed = true;
            // Continue to Step 4 for role validation and permission checks
        } else {
            // Non-billable (trial or admin) - already handled above with early returns
            // This should not be reached, but keep as safety
        }
    } catch (error) {
        // If execution entitlement check fails, continue with legacy logic
        // (graceful degradation)
        if (ACCESS_DEBUG) {
            console.log('[AccessResolution] Execution entitlement check skipped:', error.message);
        }
    }

    // ============================================================================
    // STEP 3: Owner Override (Legacy - handled by execution entitlement for EXECUTE)
    // ============================================================================
    // If user is organization owner, grant ADMIN access (implicit, non-billable)
    // Check isOwner flag (primary) or ownerId match (if organization has ownerId field)

    const isOwner = user.isOwner === true || 
                    (user._id && org.ownerId && user._id.toString() === org.ownerId.toString());

    // Owner override for VIEW and CONFIGURE (execution entitlement handles EXECUTE)
    // Only apply if execution entitlement didn't already handle it
    if (isOwner && intent !== 'EXECUTE') {
        // Owner has implicit ADMIN access for VIEW and CONFIGURE
        // (EXECUTE is handled by execution entitlement above)
        if (!result.allowed) {
            result.allowed = true;
            result.mode = 'ADMIN';
            result.billable = false;
            result.reason = 'OWNER_IMPLICIT_ADMIN';
        }
        
        // ADMIN can VIEW and CONFIGURE
        addFeedbackToResult(result);
        logAccessDecision(user, appKey, intent, result);
        return result;
    }

    // If execution entitlement already handled EXECUTE for trial, we return early
    // Otherwise, continue to seat enforcement for post-trial execution

    // ============================================================================
    // STEP 4: Explicit App Access Check
    // ============================================================================
    // Look for user.appAccess entry for appKey
    const appAccess = user.appAccess || [];
    const userAppAccess = appAccess.find(
        access => access.appKey === appKey.toUpperCase() && access.status === 'ACTIVE'
    );

    // Backward compatibility: check allowedApps if appAccess is empty
    let hasLegacyAccess = false;
    if (!userAppAccess && (!appAccess || appAccess.length === 0)) {
        const allowedApps = user.allowedApps || [];
        hasLegacyAccess = allowedApps.includes(appKey.toUpperCase());
    }

    if (!userAppAccess && !hasLegacyAccess) {
        result.reason = 'NO_EXPLICIT_APP_ACCESS';
        addFeedbackToResult(result);
        logAccessDecision(user, appKey, intent, result);
        return result;
    }

    // If using legacy allowedApps, use default role from app registry
    let roleKey = null;
    if (userAppAccess) {
        roleKey = userAppAccess.roleKey;
        // Validate role via app registry
        if (!validateAppRole(appKey, roleKey)) {
            result.reason = 'INVALID_ROLE_FOR_APP';
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }
    } else if (hasLegacyAccess) {
        // Legacy access: use default role for the app
        const { getDefaultRoleForApp } = require('../utils/appAccessUtils');
        roleKey = getDefaultRoleForApp(appKey);
        if (!roleKey) {
            result.reason = 'NO_DEFAULT_ROLE_FOR_APP';
            addFeedbackToResult(result);
            logAccessDecision(user, appKey, intent, result);
            return result;
        }
    }

    // User has explicit EXECUTION access
    result.allowed = true;
    result.mode = 'EXECUTION';
    result.billable = true;
    result.reason = hasLegacyAccess ? 'LEGACY_EXECUTION_ACCESS' : 'EXPLICIT_EXECUTION_ACCESS';
    result.roleKey = roleKey;

    // ============================================================================
    // STEP 5: Intent Validation
    // ============================================================================
    // Intent validation matrix:
    // VIEW: Allowed for both ADMIN and EXECUTION
    // CONFIGURE: Allowed only for ADMIN
    // EXECUTE: Allowed only for EXECUTION
    if (intent === 'CONFIGURE') {
        // EXECUTION mode cannot configure
        result.allowed = false;
        result.reason = 'EXECUTION_CANNOT_CONFIGURE';
        addFeedbackToResult(result);
        logAccessDecision(user, appKey, intent, result);
        return result;
    }

    // EXECUTION can VIEW and EXECUTE
    addFeedbackToResult(result);
    logAccessDecision(user, appKey, intent, result);
    return result;
}

/**
 * Helper function for Process Designer
 * Determines if a user can trigger a process in an app
 * 
 * @param {Object} params - Process trigger parameters
 * @param {Object} params.user - User object
 * @param {string} params.appKey - Application key
 * @param {Object} params.process - Process object (optional, for future use)
 * @returns {Promise<boolean>} Whether user can trigger the process
 */
async function canTriggerProcess({ user, appKey, process }) {
    // Get organization
    const organizationId = user.organizationId;
    if (!organizationId) {
        return false;
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
        return false;
    }

    // Resolve access with EXECUTE intent (processes require execution access)
    const accessResult = await resolveAppAccess({
        user,
        organization: organization,
        appKey,
        intent: 'EXECUTE'
    });

    return accessResult.allowed && accessResult.mode === 'EXECUTION';
}

/**
 * Add feedback metadata to result (Phase 0K)
 * @private
 */
function addFeedbackToResult(result) {
    // Resolve feedback from result
    const feedback = resolveAccessFeedback(result);
    
    // Attach feedback to result
    result.feedback = feedback;
    
    return result;
}

/**
 * Debug logging helper
 * @private
 */
function logAccessDecision(user, appKey, intent, result) {
    if (!ACCESS_DEBUG) {
        return;
    }

    const userId = user._id?.toString() || 'unknown';
    const userEmail = user.email || 'unknown';
    
    console.log('[AccessResolution]', {
        user: userId,
        email: userEmail,
        app: appKey,
        intent: intent,
        result: {
            allowed: result.allowed,
            mode: result.mode,
            billable: result.billable,
            reason: result.reason,
            roleKey: result.roleKey,
            feedback: result.feedback
        }
    });
}

module.exports = {
    resolveAppAccess,
    canTriggerProcess
};

