/**
 * ============================================================================
 * PLATFORM CORE: User Management Controller
 * ============================================================================
 * 
 * This controller handles app-agnostic user management:
 * - User CRUD operations
 * - User profile management
 * - Password management
 * - User assignment queries
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

const User = require('../models/User');
const Role = require('../models/Role');
const Organization = require('../models/Organization');
const UserDirectory = require('../models/UserDirectory');
const bcrypt = require('bcrypt');
const userInviteService = require('../services/userInviteService');
const { hashToken } = require('../utils/userAuthTokens');
const { generateSecurePassword } = require('../services/provisioning/utils/passwordGenerator');
const mongoose = require('mongoose');
const { APP_KEYS } = require('../constants/appKeys');
const {
    materializeEffectiveCRMEnvelopeOnUser,
    enrichLeanUsersWithEffectiveCRMPermissions,
    sanitizeUserResponsePayload
} = require('../utils/rolePermissionProjection');
const { mapLegacyRoleToCRM } = require('../constants/appRoles');
const { 
    getDefaultRoleForApp, 
    validateAppRole, 
    getAppConfig, 
    getRolesForApp, 
    validateUserTypeForApp,
    isAppEnabledForOrg
} = require('../utils/appAccessUtils');
const { 
    canAddUserToApp, 
    incrementSeat,
    decrementSeat,
    getSeatLimit,
    getSeatsUsed,
    getOrgSubscription,
    isSubscriptionUsable,
    ensureOrgSubscriptionForEnabledApps
} = require('../utils/subscriptionUtils');

function getTenantModel(connection, modelName, sourceModel) {
    if (connection.models[modelName]) {
        return connection.models[modelName];
    }
    const originalSchema = sourceModel.schema;
    const clonedSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);
    if (originalSchema.methods) {
        Object.keys(originalSchema.methods).forEach((methodName) => {
            clonedSchema.methods[methodName] = originalSchema.methods[methodName];
        });
    }
    if (originalSchema.statics) {
        Object.keys(originalSchema.statics).forEach((staticName) => {
            clonedSchema.statics[staticName] = originalSchema.statics[staticName];
        });
    }
    return connection.model(modelName, clonedSchema);
}

async function getScopedUserModel(organization) {
    if (organization?.database?.name && organization.database.initialized) {
        const dbConnectionManager = require('../utils/databaseConnectionManager');
        const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organization.database.name);
        return getTenantModel(orgDbConnection, 'User', User);
    }
    return User;
}

function buildUserScopeQuery(req, organization) {
    // In dedicated tenant DB mode, the DB itself is already organization-scoped.
    // Do not require organizationId match because older converted records may miss it.
    if (organization?.database?.name && organization.database.initialized) {
        return {};
    }
    return { organizationId: req.user.organizationId };
}

async function attachRoleSummaries(users = []) {
    const list = Array.isArray(users) ? users : [];
    if (list.length === 0) return list;

    const roleIds = Array.from(new Set(
        list
            .map((u) => u?.roleId?._id || u?.roleId)
            .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
            .map((id) => String(id))
    ));

    if (roleIds.length === 0) return list;

    const roles = await Role.find({ _id: { $in: roleIds } })
        .select('_id name description color icon level permissions')
        .lean();
    const roleMap = new Map(roles.map((r) => [String(r._id), r]));

    return list.map((u) => {
        const rid = u?.roleId?._id || u?.roleId;
        if (!rid) return u;
        const role = roleMap.get(String(rid));
        if (!role) return u;
        return { ...u, roleId: role };
    });
}

// --- Get all users in the organization ---
exports.getUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            roleId = '',
            status = '',
            adminOnly = ''
        } = req.query;

        const organization = await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);

        // Build query
        const query = buildUserScopeQuery(req, organization);
        const andConditions = [];

        // Add roleId filter if provided
        if (roleId) {
            query.roleId = roleId;
        }

        // Add search filter
        if (search) {
            andConditions.push({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            });
        }

        if (status) {
            if (status === 'active') {
                andConditions.push({
                    $or: [
                        { status: 'active' },
                        { status: { $exists: false } },
                        { status: null }
                    ]
                });
            } else {
                andConditions.push({ status });
            }
        }

        if (adminOnly === 'true') {
            andConditions.push({
                $or: [
                    { isOwner: true },
                    { role: { $in: ['admin', 'owner'] } }
                ]
            });
        }

        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        // Build sort object
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const usingDedicatedTenantDb = ScopedUser !== User;
        const listLimit = Math.max(200, Number(limit) * 5);

        const [scopedUsersRaw, masterUsersRaw] = await Promise.all([
            ScopedUser.find(query)
                .select('-password')
                .sort(sortOptions)
                .limit(listLimit)
                .lean(),
            usingDedicatedTenantDb
                ? User.find({ organizationId: req.user.organizationId })
                    .select('-password')
                    .sort(sortOptions)
                    .limit(listLimit)
                    .lean()
                : Promise.resolve([])
        ]);

        const dedupedUsers = [];
        const seenIds = new Set();
        [...scopedUsersRaw, ...masterUsersRaw].forEach((row) => {
            const key = String(row?._id || '');
            if (!key || seenIds.has(key)) return;
            seenIds.add(key);
            dedupedUsers.push(row);
        });

        const skipEmptyListFallback = Boolean(roleId || search || status || adminOnly);

        // Safety fallback: ensure currently-authenticated user is visible in Users list.
        // Skip for filtered queries (e.g. roleId) — empty results are valid.
        if (dedupedUsers.length === 0 && !skipEmptyListFallback) {
            const currentUserById = await ScopedUser.findById(req.user._id)
                .select('-password')
                .lean();
            const currentUserByEmail = !currentUserById && req.user?.email
                ? await ScopedUser.findOne({ email: String(req.user.email).toLowerCase().trim() })
                    .select('-password')
                    .lean()
                : null;
            const currentUserFallback = currentUserById || currentUserByEmail;

            if (currentUserFallback?._id) {
                seenIds.add(String(currentUserFallback._id));
                dedupedUsers.push(currentUserFallback);
            }
        }

        const total = dedupedUsers.length;
        const start = (Number(page) - 1) * Number(limit);
        const end = start + Number(limit);
        const pagedUsers = dedupedUsers.slice(start, end);
        const usersWithRoles = await attachRoleSummaries(pagedUsers);
        let usersWithEffectivePermissions = usersWithRoles;
        try {
            usersWithEffectivePermissions = await enrichLeanUsersWithEffectiveCRMPermissions(usersWithRoles);
        } catch (permissionProjectionError) {
            console.warn('[getUsers] Permission enrichment failed, returning raw users:', permissionProjectionError.message);
        }

        res.json({
            success: true,
            data: usersWithEffectivePermissions,
            total,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching users' 
        });
    }
};

// --- Get add user capabilities (what apps & roles can be assigned) ---
exports.getAddCapabilities = async (req, res) => {
    try {
        // Requester must be Sales ADMIN (owner or admin)
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user is owner or admin (Sales ADMIN)
        const isCRMAdmin = user.isOwner || String(user.role || '').toLowerCase() === 'admin';
        if (!isCRMAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only Sales administrators can add users',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        // Get organization with enabledApps
        const organization = await Organization.findById(user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Ensure billing/seat entitlements exist for enabled apps.
        // Keeps Invite User capabilities aligned with enabledApps (especially for paid orgs).
        await ensureOrgSubscriptionForEnabledApps(organization);

        // Build capabilities from enabledApps and appRegistry
        const capabilities = [];
        const enabledApps = organization.enabledApps || [];

        for (const enabledApp of enabledApps) {
            // Handle both object format {appKey, status} and legacy string format
            const appKey = typeof enabledApp === 'object' ? enabledApp.appKey : enabledApp;
            const status = typeof enabledApp === 'object' ? enabledApp.status : 'ACTIVE';

            // Only include ACTIVE apps
            if (status !== 'ACTIVE') {
                continue;
            }

            // Get app config from registry
            const appConfig = getAppConfig(appKey);
            if (!appConfig) {
                // App not in registry - skip it
                continue;
            }

            // Get roles for this app
            const roles = getRolesForApp(appKey);
            const defaultRole = getDefaultRoleForApp(appKey);

            // Get seat usage info for PER_USER apps
            const seatLimit = await getSeatLimit(organization._id, appKey);
            const seatsUsed = await getSeatsUsed(organization._id, appKey);
            const canAdd = await canAddUserToApp(organization._id, appKey);

            // Build capability entry
            capabilities.push({
                appKey: appKey,
                roles: roles,
                defaultRole: defaultRole,
                userTypesAllowed: appConfig.userTypesAllowed || [],
                seatInfo: {
                    limit: seatLimit,
                    used: seatsUsed,
                    available: seatLimit === null ? null : Math.max(0, seatLimit - seatsUsed),
                    canAdd: canAdd.allowed,
                    reason: canAdd.reason || null
                }
            });
        }

        res.json({
            success: true,
            data: {
                apps: capabilities
            }
        });
    } catch (error) {
        console.error('Get add capabilities error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching add capabilities',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Get users list for assignment (no permission required, any authenticated user can see org users) ---
exports.getUsersForAssignment = async (req, res) => {
    try {
        // Ensure organizationId is available
        if (!req.user || !req.user.organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized - organization context missing'
            });
        }

        const organization = await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);

        const { scope = 'internal', orgId = null } = req.query;

        // Supported scopes:
        // - internal: users in req.user.organizationId
        // - org: users in orgId
        // - internal_or_org: users in either req.user.organizationId or orgId
        const isValidScope = ['internal', 'org', 'internal_or_org'].includes(String(scope));
        if (!isValidScope) {
            return res.status(400).json({
                success: false,
                message: `Invalid scope. Must be one of: internal, org, internal_or_org`,
                code: 'INVALID_SCOPE'
            });
        }

        const orgIdStr = orgId ? String(orgId) : null;
        const orgIdIsValid = !orgIdStr || /^[0-9a-fA-F]{24}$/.test(orgIdStr);
        if (!orgIdIsValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid orgId format',
                code: 'INVALID_ORG_ID'
            });
        }

        const ids = new Set();
        const allUsers = [];

        const fetchByOrg = async (organizationId) => {
            const scopeQuery = buildUserScopeQuery({ user: { organizationId } }, organization);
            const list = await ScopedUser.find({
                ...scopeQuery,
                status: 'active'
            })
                .select('_id firstName lastName email username avatar organizationId')
                .sort({ firstName: 1, lastName: 1 })
                .lean();
            for (const u of list) {
                const key = String(u._id);
                if (!ids.has(key)) {
                    ids.add(key);
                    allUsers.push(u);
                }
            }
        };

        if (scope === 'internal') {
            await fetchByOrg(req.user.organizationId);
        } else if (scope === 'org') {
            // If orgId isn't selected yet (common during form entry), return an empty list (not an error)
            if (orgIdStr) await fetchByOrg(orgIdStr);
        } else if (scope === 'internal_or_org') {
            await fetchByOrg(req.user.organizationId);
            if (orgIdStr) await fetchByOrg(orgIdStr);
        }

        // Keep deterministic ordering (firstName/lastName) even when merging two org lists
        allUsers.sort((a, b) => {
            const aFirst = (a.firstName || '').toLowerCase();
            const bFirst = (b.firstName || '').toLowerCase();
            if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
            const aLast = (a.lastName || '').toLowerCase();
            const bLast = (b.lastName || '').toLowerCase();
            if (aLast !== bLast) return aLast.localeCompare(bLast);
            return String(a._id).localeCompare(String(b._id));
        });

        res.json({
            success: true,
            data: allUsers
        });
    } catch (error) {
        console.error('Get users for assignment error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching users',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Get single user ---
exports.getUser = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        })
        .select('-password')
        .lean();

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        const [userWithRole] = await attachRoleSummaries([user]);
        const hydratedUser = new User(userWithRole);
        hydratedUser.isNew = false;
        await materializeEffectiveCRMEnvelopeOnUser(hydratedUser);

        res.json({
            success: true,
            data: sanitizeUserResponsePayload(hydratedUser)
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching user' 
        });
    }
};

// --- Invite/Create new user (Unified Add User Flow) ---
exports.inviteUser = async (req, res) => {
    const { 
        email, 
        firstName, 
        lastName, 
        roleId, // Legacy: backward compatibility
        role, // Legacy: backward compatibility
        phoneNumber, 
        password, 
        sendEmail,
        welcomeNote,
        suggestedTask,
        // New unified format
        userType,
        appAccess,
        name // Alternative to firstName/lastName
    } = req.body;

    try {
        // Requester must be Sales ADMIN (enforced by middleware, but check here for clarity)
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const isCRMAdmin = user.isOwner || String(user.role || '').toLowerCase() === 'admin';
        if (!isCRMAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only Sales administrators can add users',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        // Validate required fields
        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: 'Email is required' 
            });
        }

        // Determine if using new unified format or legacy format
        const { isRbacV2Enabled } = require('../utils/rbacFeatureFlags');
        const rbacV2 = isRbacV2Enabled(organization);

        if (rbacV2 && appAccess && Array.isArray(appAccess) && appAccess.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'appAccess cannot be set directly when RBAC v2 is enabled. Assign a role instead.',
                code: 'RBAC_V2_APP_ACCESS_NOT_ALLOWED'
            });
        }

        const isUnifiedFormat = !rbacV2 && appAccess && Array.isArray(appAccess) && appAccess.length > 0;
        const isLegacyFormat = Boolean(roleId) && (rbacV2 || !isUnifiedFormat);

        if (!isUnifiedFormat && !isLegacyFormat) {
            return res.status(400).json({
                success: false,
                message: rbacV2
                    ? 'roleId is required when RBAC v2 is enabled'
                    : 'Either appAccess array (unified format) or roleId (legacy format) is required',
                code: rbacV2 ? 'RBAC_V2_ROLE_REQUIRED' : 'MISSING_APP_ACCESS_OR_ROLE'
            });
        }

        // Get organization for validation
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Ensure billing/seat entitlements exist for enabled apps before enforcing seats.
        // Without this, paid-by-default orgs can show "not subscribed/suspended" in Invite flows.
        await ensureOrgSubscriptionForEnabledApps(organization);

        const ScopedUser = await getScopedUserModel(organization);

        // Check if organization has reached user limit
        const currentUserCount = await ScopedUser.countDocuments({
            organizationId: organization._id,
            status: 'active'
        });

        if (organization.limits.maxUsers !== -1 && currentUserCount >= organization.limits.maxUsers) {
            return res.status(403).json({ 
                success: false,
                message: `User limit reached (${organization.limits.maxUsers}). Please upgrade your plan.`,
                code: 'USER_LIMIT_REACHED'
            });
        }

        // Check if user already exists in this organization.
        // Tenant DBs are org-scoped by database; do not require organizationId on the document.
        const inviteScopeQuery = buildUserScopeQuery(req, organization);
        const existingUser = await ScopedUser.findOne({
            email: email.toLowerCase(),
            ...inviteScopeQuery
        }).sort({ updatedAt: -1 });

        let reinviteUser = null;
        if (existingUser) {
            if (existingUser.status === 'active') {
                return res.status(409).json({
                    success: false,
                    message: 'User with this email already exists in your organization'
                });
            }
            if (!['inactive', 'invited'].includes(existingUser.status)) {
                return res.status(409).json({
                    success: false,
                    message: 'User with this email already exists in your organization'
                });
            }
            reinviteUser = existingUser;
        }

        const wasInactive = reinviteUser?.status === 'inactive';

        let finalAppAccess = [];
        let finalUserType = userType || 'INTERNAL';
        let roleDoc = null;
        let legacyRole = null;
        let isOwner = false;
        let crmRoleKey = null;

        // ============================================
        // NEW UNIFIED FORMAT PROCESSING
        // ============================================
        if (isUnifiedFormat) {
            // Validate unified format
            const validationErrors = [];

            // Validate at least one appAccess entry
            if (appAccess.length === 0) {
                validationErrors.push('At least one appAccess entry is required');
            }

            // Check for duplicate appKeys
            const appKeys = appAccess.map(a => a.appKey);
            const uniqueAppKeys = new Set(appKeys);
            if (appKeys.length !== uniqueAppKeys.size) {
                validationErrors.push('Duplicate appKey entries are not allowed');
            }

            // Validate each appAccess entry
            for (let i = 0; i < appAccess.length; i++) {
                const entry = appAccess[i];
                const entryErrors = [];

                // Validate appKey exists
                if (!entry.appKey) {
                    entryErrors.push('appKey is required');
                } else {
                    const appConfig = getAppConfig(entry.appKey);
                    if (!appConfig) {
                        entryErrors.push(`App ${entry.appKey} is not registered in the system`);
                    } else {
                        // Validate app is enabled for organization
                        if (!isAppEnabledForOrg(organization, entry.appKey)) {
                            entryErrors.push(`App ${entry.appKey} is not enabled for this organization`);
                        }

                        // Validate userType is allowed for this app
                        if (finalUserType && !validateUserTypeForApp(finalUserType, entry.appKey)) {
                            entryErrors.push(`UserType ${finalUserType} is not allowed for app ${entry.appKey}`);
                        }

                        // Validate roleKey
                        let roleKey = entry.roleKey;
                        if (!roleKey) {
                            // Resolve default role if missing
                            roleKey = getDefaultRoleForApp(entry.appKey);
                            if (!roleKey) {
                                entryErrors.push(`No roleKey provided and no default role found for app ${entry.appKey}`);
                            }
                        } else {
                            // Validate roleKey is valid for app
                            if (!validateAppRole(entry.appKey, roleKey)) {
                                entryErrors.push(`Role ${roleKey} is not valid for app ${entry.appKey}`);
                            }
                        }

                        // Build final appAccess entry
                        if (entryErrors.length === 0) {
                            finalAppAccess.push({
                                appKey: entry.appKey,
                                roleKey: roleKey,
                                status: 'ACTIVE',
                                addedAt: new Date()
                            });
                        } else {
                            validationErrors.push(`appAccess[${i}]: ${entryErrors.join(', ')}`);
                        }
                    }
                }
            }

            // Validate userType is provided
            if (!finalUserType) {
                validationErrors.push('userType is required');
            }

            // Reject if any validation errors
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors,
                    code: 'VALIDATION_ERROR'
                });
            }

            // For backward compatibility, try to find Sales role for legacy roleId/role fields
            // This allows UI to still send roleId for Sales while using unified format
            if (roleId) {
                const Role = require('../models/Role');
                roleDoc = await Role.findById(roleId);
                if (roleDoc) {
                    legacyRole = roleDoc.name.toLowerCase();
                    isOwner = roleDoc.name === 'Owner';
                    crmRoleKey = isOwner ? 'ADMIN' : mapLegacyRoleToCRM(legacyRole);
                    
                    // Update Sales appAccess entry if it exists
                    const crmIndex = finalAppAccess.findIndex(a => a.appKey === APP_KEYS.SALES);
                    if (crmIndex >= 0) {
                        finalAppAccess[crmIndex].roleKey = crmRoleKey;
                    }
                }
            }
        }
        // ============================================
        // LEGACY FORMAT PROCESSING (Backward Compatibility)
        // ============================================
        else if (isLegacyFormat) {
            // Fetch the Role document to get role details
            const Role = require('../models/Role');
            roleDoc = await Role.findById(roleId);
            
            if (!roleDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            const {
                deriveAppAccessFromRole,
                mapRoleNameToLegacyEnum
            } = require('../services/roleEntitlementService');

            if (rbacV2) {
                const derived = deriveAppAccessFromRole(roleDoc, organization);
                finalAppAccess = derived.appAccess;
                finalUserType = roleDoc.userType || 'INTERNAL';
                legacyRole = mapRoleNameToLegacyEnum(roleDoc.name);
                isOwner = roleDoc.name === 'Owner';
            } else {
                // Map role name to legacy role enum for backward compatibility
                legacyRole = roleDoc.name.toLowerCase();
                isOwner = roleDoc.name === 'Owner';
                
                // Map legacy role to Sales roleKey
                crmRoleKey = isOwner ? 'ADMIN' : mapLegacyRoleToCRM(legacyRole);

                // Validate Sales roleKey
                if (!validateAppRole(APP_KEYS.SALES, crmRoleKey)) {
                    console.warn(`Invalid Sales roleKey ${crmRoleKey}, using default`);
                    const defaultRole = getDefaultRoleForApp(APP_KEYS.SALES);
                    crmRoleKey = defaultRole || 'USER';
                }

                // Validate Sales is enabled for organization
                if (!isAppEnabledForOrg(organization, APP_KEYS.SALES)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Sales app is not enabled for this organization',
                        code: 'APP_NOT_ENABLED'
                    });
                }

                // Create appAccess from legacy format (Sales only)
                finalAppAccess = [{
                    appKey: APP_KEYS.SALES,
                    roleKey: crmRoleKey,
                    status: 'ACTIVE',
                    addedAt: new Date()
                }];

                // Default to INTERNAL for legacy format
                finalUserType = 'INTERNAL';
            }
        }

        // ============================================
        // SEAT ENFORCEMENT (CRITICAL - BEFORE USER CREATION)
        // ============================================
        // Validation Order (Strict):
        // 1. App exists in appRegistry
        // 2. App enabled for organization
        // 3. App subscribed in OrganizationSubscription
        // 4. Subscription status = ACTIVE or TRIAL
        // 5. If billingType = PER_USER: seatsUsed < seatLimit
        for (const appAccessEntry of finalAppAccess) {
            const appKey = appAccessEntry.appKey;
            
            // Validate app exists in appRegistry (already validated above, but double-check)
            const appConfig = getAppConfig(appKey);
            if (!appConfig) {
                return res.status(400).json({
                    success: false,
                    message: `App ${appKey} is not registered in the system`,
                    code: 'APP_NOT_REGISTERED'
                });
            }

            // Validate app is enabled for organization (already validated above, but double-check)
            if (!isAppEnabledForOrg(organization, appKey)) {
                return res.status(400).json({
                    success: false,
                    message: `App ${appKey} is not enabled for this organization`,
                    code: 'APP_NOT_ENABLED'
                });
            }

            // Check if user can be added to this app (includes subscription and seat checks)
            // SUBSCRIPTION RULE: ACTIVE and TRIAL are usable, SUSPENDED/CANCELLED are blocked
            const canAdd = await canAddUserToApp(organization._id, appKey);
            if (!canAdd.allowed) {
                // Determine error code and HTTP status based on reason
                let errorCode = 'SEAT_LIMIT_EXCEEDED';
                let httpStatus = 403;
                
                if (canAdd.reason && (canAdd.reason.includes('suspended') || canAdd.reason.includes('not active'))) {
                    errorCode = 'SUBSCRIPTION_INACTIVE';
                    httpStatus = 402; // Payment Required
                } else if (canAdd.reason && canAdd.reason.includes('trial')) {
                    errorCode = 'TRIAL_EXPIRED';
                    httpStatus = 402; // Payment Required
                } else if (canAdd.reason && canAdd.reason.includes('not subscribed')) {
                    errorCode = 'SUBSCRIPTION_INACTIVE';
                    httpStatus = 402; // Payment Required
                }

                return res.status(httpStatus).json({
                    success: false,
                    code: errorCode,
                    message: canAdd.reason || `Cannot add user to ${appKey} app`,
                    appKey: appKey
                });
            }
        }

        // Use provided password or generate temporary password
        const wantsEmail = sendEmail === true || sendEmail === 'true' || sendEmail === 1 || sendEmail === '1';
        const manualPassword = password ? String(password) : null;
        const inviteCredentials = userInviteService.buildInviteCredentials({
            wantsEmail,
            manualPassword
        });
        const tempPassword = inviteCredentials.password;
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const inviteTokenHash = inviteCredentials.inviteTokenRaw
            ? hashToken(inviteCredentials.inviteTokenRaw)
            : null;

        // Create username from email
        const username = email.split('@')[0];

        // Handle name field (alternative to firstName/lastName)
        let finalFirstName = firstName || '';
        let finalLastName = lastName || '';
        if (!finalFirstName && !finalLastName && name) {
            const nameParts = name.trim().split(/\s+/);
            finalFirstName = nameParts[0] || '';
            finalLastName = nameParts.slice(1).join(' ') || '';
        }

        const finalWelcomeNote = welcomeNote !== undefined && welcomeNote !== null
            ? String(welcomeNote).trim().slice(0, 500)
            : '';
        const finalSuggestedTask = suggestedTask !== undefined && suggestedTask !== null
            ? String(suggestedTask).trim().slice(0, 200)
            : '';

        const onboardingPayload = (finalWelcomeNote || finalSuggestedTask)
            ? {
                welcomeNote: finalWelcomeNote || undefined,
                suggestedTask: finalSuggestedTask || undefined
            }
            : undefined;

        let newUser;
        if (reinviteUser) {
            if (!reinviteUser.organizationId) {
                reinviteUser.organizationId = organization._id;
            }
            reinviteUser.username = reinviteUser.username || username;
            reinviteUser.password = hashedPassword;
            reinviteUser.firstName = finalFirstName;
            reinviteUser.lastName = finalLastName;
            if (phoneNumber !== undefined) {
                reinviteUser.phoneNumber = phoneNumber;
            }
            reinviteUser.roleId = roleId || null;
            reinviteUser.role = legacyRole || null;
            reinviteUser.isOwner = isOwner;
            reinviteUser.status = inviteCredentials.initialStatus;
            reinviteUser.userType = finalUserType;
            reinviteUser.appAccess = finalAppAccess;
            reinviteUser.allowedApps = finalAppAccess.map((a) => a.appKey);
            reinviteUser.invitedAt = new Date();
            reinviteUser.invitedBy = req.user._id;
            reinviteUser.mustChangePassword = inviteCredentials.mustChangePassword;
            reinviteUser.emailVerifiedAt = null;
            reinviteUser.inviteAcceptedAt = null;
            reinviteUser.inviteTokenHash = inviteTokenHash;
            reinviteUser.inviteTokenExpiresAt = inviteCredentials.inviteTokenExpiresAt;
            reinviteUser.emailVerificationTokenHash = null;
            reinviteUser.emailVerificationExpiresAt = null;
            reinviteUser.emailVerificationSentAt = null;
            if (onboardingPayload) {
                reinviteUser.onboarding = onboardingPayload;
            }
            newUser = reinviteUser;
        } else {
            newUser = await ScopedUser.create({
                organizationId: req.user.organizationId,
                username,
                email: email.toLowerCase(),
                password: hashedPassword,
                firstName: finalFirstName,
                lastName: finalLastName,
                phoneNumber,
                roleId: roleId || null, // May be null for unified format
                role: legacyRole || null, // Store legacy role for backward compatibility
                isOwner: isOwner,
                status: inviteCredentials.initialStatus,
                userType: finalUserType,
                appAccess: finalAppAccess,
                allowedApps: finalAppAccess.map(a => a.appKey), // Legacy field for backward compatibility
                invitedAt: new Date(),
                invitedBy: req.user._id,
                mustChangePassword: inviteCredentials.mustChangePassword,
                emailVerifiedAt: null,
                inviteTokenHash,
                inviteTokenExpiresAt: inviteCredentials.inviteTokenExpiresAt,
                onboarding: onboardingPayload
            });
        }

        await materializeEffectiveCRMEnvelopeOnUser(newUser);
        await newUser.save();

        if (wantsEmail && inviteCredentials.inviteTokenRaw) {
            const persistedInvite = await ScopedUser.findById(newUser._id)
                .select('status inviteTokenHash inviteTokenExpiresAt')
                .lean();
            if (
                !persistedInvite
                || persistedInvite.status !== 'invited'
                || persistedInvite.inviteTokenHash !== inviteTokenHash
            ) {
                console.error('[inviteUser] Invite token not persisted after save:', {
                    email: newUser.email,
                    organizationId: organization._id,
                    expectedStatus: 'invited',
                    actualStatus: persistedInvite?.status || null,
                    hasTokenHash: Boolean(persistedInvite?.inviteTokenHash)
                });
                return res.status(500).json({
                    success: false,
                    message: 'Failed to persist invitation. Please try again.',
                    code: 'INVITE_TOKEN_PERSIST_FAILED'
                });
            }
        }

        await UserDirectory.findOneAndUpdate(
            { email: newUser.email.toLowerCase() },
            {
                $set: {
                    organizationId: organization._id,
                    tenantDatabaseName: organization.database?.name || null,
                    tenantUserId: newUser._id,
                    status: 'active',
                    inviteTokenHash: inviteTokenHash || null,
                    emailVerificationTokenHash: null
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        try {
            const { markOrgInviteSent } = require('../services/onboardingService');
            await markOrgInviteSent(organization);
        } catch (onboardingErr) {
            console.warn('[inviteUser] org invite step update failed:', onboardingErr.message);
        }
        
        // Increment seat usage for each app (atomic operations)
        if (!reinviteUser || wasInactive) {
            for (const appAccessEntry of finalAppAccess) {
                await incrementSeat(organization._id, appAccessEntry.appKey);
            }
        }
        
        // Increment the role's user count (if roleId provided)
        if (roleId && (!reinviteUser || wasInactive)) {
            const Role = require('../models/Role');
            await Role.findByIdAndUpdate(roleId, { $inc: { userCount: 1 } });
        }

        let emailSent = false;
        let emailError = null;
        let verificationEmailSent = false;

        if (wantsEmail && inviteCredentials.inviteTokenRaw) {
            const inviteEmailResult = await userInviteService.sendInviteForUser({
                user: newUser,
                organization,
                inviter: req.user,
                inviteToken: inviteCredentials.inviteTokenRaw,
                welcomeNote: finalWelcomeNote || null
            });
            emailSent = inviteEmailResult.sent === true;
            if (!emailSent) {
                emailError = inviteEmailResult.reason || 'Failed to send invitation email';
                console.warn('[inviteUser] Invitation email failed:', {
                    invitedEmail: newUser.email,
                    organizationId: organization._id,
                    reason: emailError,
                    channel: inviteEmailResult.channel || null
                });
            } else {
                console.log('[inviteUser] Invitation email sent:', {
                    invitedEmail: newUser.email,
                    organizationId: organization._id,
                    channel: inviteEmailResult.channel || null,
                    messageId: inviteEmailResult.messageId || null
                });
            }
        } else {
            const verificationResult = await userInviteService.issueVerificationForUser({
                user: newUser,
                organization,
                forceNewToken: true
            });
            await newUser.save();
            verificationEmailSent = verificationResult.sent === true;
            if (verificationResult.sent) {
                await userInviteService.syncDirectoryEntry(newUser.email, {
                    emailVerificationTokenHash: newUser.emailVerificationTokenHash
                });
            }
        }

        // Populate the role details
        if (newUser.roleId) {
            try {
                await newUser.populate('roleId');
            } catch (_e) {
                // Role model may not be registered on tenant connection; response still succeeds.
            }
        }

        const responseData = {
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            userType: newUser.userType,
            appAccess: newUser.appAccess,
            role: newUser.role,
            roleId: newUser.roleId,
            status: newUser.status,
            emailVerifiedAt: newUser.emailVerifiedAt,
            emailSent,
            verificationEmailSent
        };

        if (emailError) {
            responseData.emailError = emailError;
        }

        if (!wantsEmail && !manualPassword && process.env.NODE_ENV === 'development') {
            responseData.tempPassword = tempPassword;
        }

        res.status(201).json({
            success: true,
            data: responseData,
            message: emailSent
                ? 'User invited successfully. Invitation email sent.'
                : wantsEmail
                    ? 'User invited successfully, but the invitation email could not be sent.'
                    : 'User invited successfully'
        });

    } catch (error) {
        console.error('Invite user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error inviting user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Update user role and permissions ---
exports.updateUser = async (req, res) => {
    const { role, roleId, status, firstName, lastName, phoneNumber, appAccess } = req.body;

    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'permissions') && req.body.permissions !== undefined) {
            console.warn(
                '[DEPRECATED] PUT /users/:id ignores body.permissions. Edit Roles or assign appAccess.',
                { actor: req.user?._id, target: req.params.id }
            );
        }

        const requestKeys = Object.keys(req.body || {});
        const isOwnerAppAccessOnlyUpdate = user.isOwner &&
            requestKeys.length > 0 &&
            requestKeys.every((key) => key === 'appAccess');

        // Prevent changing owner profile/role/status, but allow app seat updates.
        if (user.isOwner && !isOwnerAppAccessOnlyUpdate) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot modify the organization owner',
                code: 'CANNOT_MODIFY_OWNER'
            });
        }

        // Update fields (owner profile remains immutable from this endpoint)
        if (!user.isOwner) {
            if (firstName !== undefined) user.firstName = firstName;
            if (lastName !== undefined) user.lastName = lastName;
            if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
            if (status !== undefined) user.status = status;
        }
        
        // Update role if roleId is provided (new dynamic role system)
        if (!user.isOwner && roleId !== undefined && roleId !== user.roleId?.toString()) {
            const Role = require('../models/Role');
            const roleDoc = await Role.findById(roleId);
            
            if (!roleDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            // Decrement old role's user count
            if (user.roleId) {
                await Role.findByIdAndUpdate(user.roleId, { $inc: { userCount: -1 } });
            }

            // Update user's role (permission snapshot rebuilt from Role below, after appAccess)
            user.roleId = roleId;
            user.role = roleDoc.name.toLowerCase(); // Update legacy role field
            user.isOwner = roleDoc.name === 'Owner';

            // Increment new role's user count
            await Role.findByIdAndUpdate(roleId, { $inc: { userCount: 1 } });
        }
        // Fallback to legacy role update (for backward compatibility)
        else if (!user.isOwner && role !== undefined && role !== user.role) {
            user.role = role;
            user.setPermissionsByRole(role);
        }

        // Update app access (seat-gated execution entitlement)
        if (appAccess !== undefined) {
            if (!Array.isArray(appAccess) || appAccess.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one app access entry is required'
                });
            }

            const currentAccessByApp = new Map((user.appAccess || []).map((entry) => [entry.appKey, entry]));
            const seenAppKeys = new Set();
            const normalizedAppAccess = [];

            for (let i = 0; i < appAccess.length; i++) {
                const raw = appAccess[i] || {};
                const appKey = String(raw.appKey || '').trim().toUpperCase();
                const roleKey = String(raw.roleKey || '').trim().toUpperCase();
                const entryStatus = String(raw.status || 'ACTIVE').trim().toUpperCase();

                if (!appKey) {
                    return res.status(400).json({
                        success: false,
                        message: `appAccess[${i}]: appKey is required`
                    });
                }

                if (!roleKey) {
                    return res.status(400).json({
                        success: false,
                        message: `appAccess[${i}]: roleKey is required`
                    });
                }

                if (seenAppKeys.has(appKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate appAccess entry for ${appKey}`
                    });
                }
                seenAppKeys.add(appKey);

                const appConfig = getAppConfig(appKey);
                if (!appConfig) {
                    return res.status(400).json({
                        success: false,
                        message: `App ${appKey} is not registered in the system`
                    });
                }

                if (!isAppEnabledForOrg(organization, appKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `App ${appKey} is not enabled for this organization`
                    });
                }

                if (!validateAppRole(appKey, roleKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `Role ${roleKey} is not valid for app ${appKey}`
                    });
                }

                if (!validateUserTypeForApp(user.userType || 'INTERNAL', appKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `${appKey} does not support ${user.userType || 'INTERNAL'} users`
                    });
                }

                const previous = currentAccessByApp.get(appKey);
                normalizedAppAccess.push({
                    appKey,
                    roleKey,
                    status: entryStatus === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
                    addedAt: previous?.addedAt || new Date()
                });
            }

            const previousActiveApps = new Set(
                (user.appAccess || [])
                    .filter((entry) => entry.status === 'ACTIVE')
                    .map((entry) => entry.appKey)
            );
            const nextActiveApps = new Set(
                normalizedAppAccess
                    .filter((entry) => entry.status === 'ACTIVE')
                    .map((entry) => entry.appKey)
            );

            // Validate seat availability only for newly activated app memberships.
            for (const appKey of nextActiveApps) {
                if (!previousActiveApps.has(appKey)) {
                    const canAdd = await canAddUserToApp(organization._id, appKey);
                    if (!canAdd.allowed) {
                        return res.status(403).json({
                            success: false,
                            code: 'SEAT_LIMIT_EXCEEDED',
                            message: canAdd.reason || `Cannot add user to ${appKey}`,
                            appKey
                        });
                    }
                }
            }

            user.appAccess = normalizedAppAccess;
            user.allowedApps = normalizedAppAccess
                .filter((entry) => entry.status === 'ACTIVE')
                .map((entry) => entry.appKey);

            // Keep seat counters in sync.
            for (const appKey of previousActiveApps) {
                if (!nextActiveApps.has(appKey)) {
                    await decrementSeat(organization._id, appKey);
                }
            }
            for (const appKey of nextActiveApps) {
                if (!previousActiveApps.has(appKey)) {
                    await incrementSeat(organization._id, appKey);
                }
            }
        }

        await materializeEffectiveCRMEnvelopeOnUser(user);

        await user.save();

        // Populate role details (Role model may not be registered on tenant connection)
        try {
            await user.populate('roleId', 'name description color icon level');
        } catch (_e) {
            // Tenant DB connection may not have Role registered; response still succeeds.
        }

        const updated = sanitizeUserResponsePayload(user);
        res.json({
            success: true,
            data: {
                _id: updated._id,
                username: updated.username,
                email: updated.email,
                firstName: updated.firstName,
                lastName: updated.lastName,
                role: updated.role,
                roleId: updated.roleId,
                status: updated.status,
                permissions: updated.permissions,
                appAccess: updated.appAccess,
                allowedApps: updated.allowedApps
            },
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating user' 
        });
    }
};

// --- Delete/Deactivate user ---
exports.deleteUser = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Prevent deleting owner
        if (user.isOwner) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot delete the organization owner',
                code: 'CANNOT_DELETE_OWNER'
            });
        }

        // Decrement seat usage for each app (atomic operations)
        const appAccess = user.appAccess || [];
        for (const appAccessEntry of appAccess) {
            if (appAccessEntry.status === 'ACTIVE') {
                await decrementSeat(organization._id, appAccessEntry.appKey);
            }
        }

        // Decrement role's user count if roleId exists
        if (user.roleId) {
            const Role = require('../models/Role');
            await Role.findByIdAndUpdate(user.roleId, { $inc: { userCount: -1 } });
        }

        // Soft delete: just deactivate the user
        user.status = 'inactive';
        user.inviteTokenHash = null;
        user.inviteTokenExpiresAt = null;
        user.emailVerificationTokenHash = null;
        user.emailVerificationExpiresAt = null;
        await user.save();

        await userInviteService.syncDirectoryEntry(user.email, {
          inviteTokenHash: null,
          emailVerificationTokenHash: null,
          status: 'inactive'
        });

        // For hard delete, use: await user.remove();

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error deleting user' 
        });
    }
};

// --- Get current user profile ---
exports.getProfile = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId)
            .select('database name subscription limits enabledApps enabledModules settings')
            .lean();
        const ScopedUser = await getScopedUserModel(organization);

        const user = await ScopedUser.findById(req.user._id)
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        await materializeEffectiveCRMEnvelopeOnUser(user);
        const sanitizedUser = sanitizeUserResponsePayload(user);
        const [userWithRole] = await attachRoleSummaries([sanitizedUser]);

        if (organization) {
            const { buildOrgCapabilities } = require('../utils/orgCapabilities');
            userWithRole.organizationId = {
                _id: organization._id,
                name: organization.name,
                subscription: organization.subscription,
                limits: organization.limits,
                enabledApps: organization.enabledApps,
                enabledModules: organization.enabledModules,
                settings: organization.settings,
                capabilities: buildOrgCapabilities(organization)
            };
        }

        res.json({
            success: true,
            data: userWithRole
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching profile' 
        });
    }
};

// --- Update current user profile ---
exports.updateProfile = async (req, res) => {
    const { firstName, lastName, phoneNumber, avatar } = req.body;

    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        res.json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                avatar: user.avatar
            },
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating profile' 
        });
    }
};

// --- Change password ---
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false,
                message: 'Current password and new password are required' 
            });
        }

        const organization = req.organization || await Organization.findById(req.user.organizationId);
        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findById(req.user._id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Current password is incorrect' 
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error changing password' 
        });
    }
};

// --- Reset user password (Admin only) ---
exports.resetUserPassword = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Prevent resetting owner password
        if (user.isOwner) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot reset the organization owner password',
                code: 'CANNOT_RESET_OWNER_PASSWORD'
            });
        }

        // Generate temporary password
        const tempPassword = generateSecurePassword(16);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        user.password = hashedPassword;
        user.mustChangePassword = true;
        await user.save();

        const verificationResult = await userInviteService.issueVerificationForUser({
            user,
            organization,
            forceNewToken: true
        });
        await user.save();
        if (verificationResult.sent) {
            await userInviteService.syncDirectoryEntry(user.email, {
                emailVerificationTokenHash: user.emailVerificationTokenHash
            });
        }

        res.json({
            success: true,
            message: 'Password reset successfully',
            data: {
                tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined,
                verificationEmailSent: verificationResult.sent === true
            }
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error resetting password' 
        });
    }
};

// --- Upload current user's avatar ---
// POST /api/users/profile/avatar (multipart: avatar)
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const allowedImageMimes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml'
        ];
        if (!allowedImageMimes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Please upload an image (PNG, JPG, GIF, WEBP, or SVG).'
            });
        }

        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { persistMulterUpload } = require('../middleware/uploadMiddleware');
        const uploadResult = await persistMulterUpload(req, 'avatars');
        user.avatar = uploadResult.url;
        await user.save();

        return res.json({
            success: true,
            message: 'Avatar updated',
            data: { avatar: uploadResult.url }
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload avatar',
            error: error.message
        });
    }
};

// --- Remove current user's avatar ---
// DELETE /api/users/profile/avatar
exports.deleteAvatar = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.avatar = '';
        await user.save();

        return res.json({
            success: true,
            message: 'Avatar removed',
            data: { avatar: '' }
        });
    } catch (error) {
        console.error('Delete avatar error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove avatar',
            error: error.message
        });
    }
};
