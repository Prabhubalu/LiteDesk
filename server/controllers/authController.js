/**
 * ============================================================================
 * PLATFORM CORE: Authentication & Session Handling
 * ============================================================================
 * 
 * This controller handles app-agnostic authentication:
 * - User registration (creates organization + owner)
 * - User login with JWT tokens
 * - Password hashing and verification
 * - Token generation
 * 
 * ✅ FIXED: Registration no longer initializes Sales-specific modules.
 *    Sales initialization has been moved to salesAppInitializer service.
 *    Registration is now app-agnostic.
 * 
 * See PLATFORM_CORE_ANALYSIS.md and REGISTRATION_REFACTORING.md for details.
 * ============================================================================
 */

const User = require('../models/User');
const Organization = require('../models/Organization');
const { buildOrgCapabilities } = require('../utils/orgCapabilities');
const Role = require('../models/Role');
const UserDirectory = require('../models/UserDirectory');
const DemoRequest = require('../models/DemoRequest');
const InstanceRegistry = require('../models/InstanceRegistry');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { APP_KEYS } = require('../constants/appKeys');
const { materializeEffectiveCRMEnvelopeOnUser } = require('../utils/rolePermissionProjection');
const securityLogger = require('../middleware/securityLoggingMiddleware');
const { getDefaultRoleForApp } = require('../utils/appAccessUtils');
const { ensureDefaultCommunicationSettingsForOrganization } = require('../services/communicationDefaultsSeeder');

function getOrgUserModel(orgDbConnection) {
    if (orgDbConnection.models.User) {
        return orgDbConnection.models.User;
    }
    const originalSchema = User.schema;
    const UserSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);

    if (originalSchema.methods) {
        Object.keys(originalSchema.methods).forEach((methodName) => {
            UserSchema.methods[methodName] = originalSchema.methods[methodName];
        });
    }
    if (originalSchema.statics) {
        Object.keys(originalSchema.statics).forEach((staticName) => {
            UserSchema.statics[staticName] = originalSchema.statics[staticName];
        });
    }

    return orgDbConnection.model('User', UserSchema);
}

async function resolveInstanceForLogin(organizationId, email) {
    if (!organizationId && !email) return null;

    try {
        if (organizationId) {
            const convertedDemo = await DemoRequest.findOne({
                organizationId,
                status: 'converted',
                convertedToInstanceId: { $exists: true, $ne: null }
            })
                .sort({ convertedAt: -1, updatedAt: -1 })
                .select('convertedToInstanceId')
                .populate('convertedToInstanceId', 'subdomain urls status');

            if (convertedDemo?.convertedToInstanceId) {
                const instance = convertedDemo.convertedToInstanceId;
                return {
                    subdomain: instance.subdomain || null,
                    frontendUrl: instance.urls?.frontend || null,
                    apiUrl: instance.urls?.api || null,
                    status: instance.status || null
                };
            }
        }

        if (email) {
            const fallbackByOwnerEmail = await InstanceRegistry.findOne({
                ownerEmail: String(email).toLowerCase().trim()
            })
                .sort({ updatedAt: -1 })
                .select('subdomain urls status')
                .lean();

            if (fallbackByOwnerEmail) {
                return {
                    subdomain: fallbackByOwnerEmail.subdomain || null,
                    frontendUrl: fallbackByOwnerEmail.urls?.frontend || null,
                    apiUrl: fallbackByOwnerEmail.urls?.api || null,
                    status: fallbackByOwnerEmail.status || null
                };
            }
        }
    } catch (instanceLookupError) {
        console.warn('[Auth] Instance resolution failed during login:', instanceLookupError.message);
    }

    return null;
}

// --- Helper Function: Generate Token ---
const generateToken = (id, organizationId = null) => {
    // SECURITY: JWT_SECRET must be set - fail hard if not configured
    if (!process.env.JWT_SECRET) {
        throw new Error('CRITICAL: JWT_SECRET environment variable is not set! Server cannot generate tokens.');
    }
    
    const payload = { id };
    if (organizationId) {
        payload.organizationId = organizationId.toString();
    }
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1d',
    });
};

// --- 1. Registration Logic (Multi-tenant: Creates Organization + Owner) ---
exports.registerUser = async (req, res) => {
    console.log('\n\n========================================');
    console.log('🚀 REGISTRATION FUNCTION CALLED - NEW CODE VERSION');
    console.log('========================================');
    
    const { username, email, password, vertical, organizationName } = req.body;
    
    // DEBUG LOGGING
    console.log('📝 Registration Request Received:');
    console.log('  - Username:', username);
    console.log('  - Email:', email);
    console.log('  - Vertical:', vertical);
    console.log('  - Organization Name:', organizationName);
    console.log('  - Full body:', JSON.stringify(req.body, null, 2));
    
    try {
        console.log('\n🔍 Step 1: Validating fields...');
        // Validate required fields
        if (!username || !email || !password || !vertical) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({ 
                message: 'Please provide all required fields: username, email, password, vertical' 
            });
        }

        console.log('✅ Validation passed\n');
        
        console.log('🔍 Step 2: Checking for existing user...');
        // Check if user with this email already exists (across all organizations)
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('❌ User already exists:', email);
            return res.status(409).json({ 
                message: 'A user with this email already exists.' 
            });
        }
        console.log('✅ No existing user found\n');

        // 1. Create Organization (Tenant)
        console.log('🔍 Step 3: Creating organization...');
        console.log('   Organization Name:', organizationName || `${username}'s Organization`);
        console.log('   Industry:', vertical);
        const organization = await Organization.create({
            name: organizationName || `${username}'s Organization`,
            industry: vertical,
            subscription: {
                status: 'trial',
                tier: 'trial',
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
            },
            limits: {
                maxUsers: 3,
                maxContacts: 100,
                maxDeals: 50,
                maxStorageGB: 1
            },
            // ⚠️ BACKWARD COMPATIBILITY: Explicitly set SALES modules for new registrations
            //    Schema default is empty array (app-agnostic), but we set SALES modules here
            //    for backward compatibility with existing SALES functionality
            enabledModules: ['contacts', 'deals', 'tasks', 'events'],
            // New organizations start with Sales enabled only
            enabledApps: [{
                appKey: 'SALES',
                status: 'ACTIVE',
                enabledAt: new Date()
            }]
        });
        await ensureDefaultCommunicationSettingsForOrganization(organization._id);
        console.log('✅ ✅ ✅ ORGANIZATION CREATED SUCCESSFULLY! ✅ ✅ ✅');
        console.log('   ID:', organization._id);
        console.log('   Name:', organization.name);
        console.log('   Subscription Status:', organization.subscription.status);
        console.log('   Trial End Date:', organization.subscription.trialEndDate);
        console.log('\n');

        // 1.5. Create Default Roles for Organization
        console.log('🔍 Step 3.5: Creating default roles...');
        try {
            const roles = await Role.createDefaultRoles(organization._id);
            console.log('✅ Default roles created:', roles.length, 'roles');
            roles.forEach(role => {
                console.log(`   - ${role.name} (Level ${role.level})`);
            });
        } catch (roleError) {
            console.warn('⚠️  Failed to create default roles:', roleError.message);
            // Continue even if role creation fails - roles can be initialized manually
        }
        console.log('\n');

        // NOTE: Sales module initialization (People, Pipeline Entity) has been moved to salesAppInitializer
        // This keeps registration app-agnostic. Sales initialization should be called separately
        // when Sales app is enabled for the organization.

        // 2. Hash Password
        console.log('🔍 Step 4: Hashing password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('✅ Password hashed\n');

        // 3. Create Owner User
        console.log('🔍 Step 5: Creating owner user...');
        console.log('   Linking to Organization ID:', organization._id);
        const user = await User.create({
            organizationId: organization._id,
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            vertical,
            role: 'owner',
            isOwner: true,
            status: 'active',
            userType: 'INTERNAL', // Platform user type
            appAccess: [{
                appKey: APP_KEYS.SALES,
                roleKey: 'ADMIN', // Organization owner must have Sales: ADMIN
                status: 'ACTIVE',
                addedAt: new Date()
            }],
            allowedApps: [APP_KEYS.SALES] // Legacy field for backward compatibility
        });
        console.log('✅ ✅ ✅ USER CREATED SUCCESSFULLY! ✅ ✅ ✅');
        console.log('   ID:', user._id);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   IsOwner:', user.isOwner);
        console.log('   UserType:', user.userType);
        console.log('   AppAccess:', JSON.stringify(user.appAccess));
        console.log('   Organization ID:', user.organizationId);
        console.log('\n');

        // 4. Set owner permissions
        console.log('🔍 Step 6: Setting owner permissions...');
        user.setPermissionsByRole('owner');
        await user.save();
        console.log('✅ Permissions set and user saved\n');

        await UserDirectory.findOneAndUpdate(
            { email: user.email.toLowerCase() },
            {
                $set: {
                    organizationId: organization._id,
                    tenantDatabaseName: organization.database?.name || null,
                    tenantUserId: user._id,
                    status: 'active'
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // 5. Respond with Token and Organization Info
        console.log('🔍 Step 7: Preparing response...');
        const response = {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isOwner: user.isOwner,
            organization: {
                _id: organization._id,
                name: organization.name,
                industry: organization.industry,
                subscription: organization.subscription,
                limits: organization.limits,
                enabledApps: organization.enabledApps || [APP_KEYS.SALES], // App-level enablement
                enabledModules: organization.enabledModules, // Legacy: kept for backward compatibility
                capabilities: buildOrgCapabilities(organization)
            },
            token: generateToken(user._id, organization._id),
        };
        
        console.log('✅ Response prepared');
        console.log('📤 SENDING RESPONSE:');
        console.log('   - User ID:', response._id);
        console.log('   - Email:', response.email);
        console.log('   - Role:', response.role);
        console.log('   - IsOwner:', response.isOwner);
        console.log('   - Organization Name:', response.organization.name);
        console.log('   - Organization ID:', response.organization._id);
        console.log('========================================\n\n');
        
        res.status(201).json(response);
        
    } catch (error) {
        console.error('\n\n❌❌❌ REGISTRATION ERROR ❌❌❌');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        console.error('========================================\n\n');
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({ 
                message: 'User already exists with this email or username.' 
            });
        }
        
        res.status(500).json({ 
            message: 'Server error during registration.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- 2. Login Logic ---
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const normalizedEmail = String(email || '').toLowerCase().trim();
        console.log('\n🔐 Login attempt for:', email);
        
        // 1. Find User by Email (check master database first)
        let user = await User.findOne({ email: normalizedEmail })
            .populate('organizationId', 'name industry subscription limits enabledApps enabledModules settings isActive database')
            .populate(
                'roleId',
                'name description color icon level permissions canViewAllData canManageTeam canExportData isSystemRole'
            );

        let organizationFromDirectory = null;
        // Fallback: resolve organization from master user directory when user is tenant-only
        if (!user) {
            const directoryEntry = await UserDirectory.findOne({ email: normalizedEmail, status: 'active' })
                .populate('organizationId', 'name industry subscription limits enabledApps enabledModules settings isActive database');
            if (directoryEntry?.organizationId) {
                organizationFromDirectory = directoryEntry.organizationId;
            }
        }

        // Legacy fallback for tenants converted before directory support:
        // search tenant databases by email and auto-heal directory entry.
        if (!user && !organizationFromDirectory) {
            const dbConnectionManager = require('../utils/databaseConnectionManager');
            const tenantOrgs = await Organization.find({
                'database.initialized': true,
                'database.name': { $exists: true, $ne: null }
            }).select('_id name industry subscription limits enabledApps enabledModules settings isActive database');

            for (const tenantOrg of tenantOrgs) {
                try {
                    const orgDbConnection = await dbConnectionManager.getOrganizationConnection(tenantOrg.database.name);
                    const OrgUser = getOrgUserModel(orgDbConnection);
                    const discoveredUser = await OrgUser.findOne({ email: normalizedEmail }).select('_id');
                    if (discoveredUser) {
                        organizationFromDirectory = tenantOrg;
                        await UserDirectory.findOneAndUpdate(
                            { email: normalizedEmail },
                            {
                                $set: {
                                    organizationId: tenantOrg._id,
                                    tenantDatabaseName: tenantOrg.database.name,
                                    tenantUserId: discoveredUser._id,
                                    status: 'active'
                                }
                            },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                        console.log('✅ Auto-healed user directory from tenant discovery:', normalizedEmail);
                        break;
                    }
                } catch (discoveryError) {
                    console.warn(`[Auth] Tenant discovery skipped for ${tenantOrg.database?.name}:`, discoveryError.message);
                }
            }
        }

        if (!user) {
            if (!organizationFromDirectory) {
                console.log('❌ User not found');
                // Log failed login attempt
                securityLogger.logAuthEvent('LOGIN_FAILED', {
                    email: normalizedEmail,
                    reason: 'USER_NOT_FOUND',
                    ip: req.ip,
                    userAgent: req.get('user-agent')
                });
                return res.status(401).json({ message: 'Invalid credentials.' });
            }
        }

        if (user) {
            console.log('✅ User found:', user.email);
            console.log('   Organization populated?', !!user.organizationId);
            console.log('   Organization ID:', user.organizationId?._id || 'NOT POPULATED');
            console.log('   Organization has dedicated DB?', !!(user.organizationId?.database?.name));
        } else {
            console.log('✅ User resolved via directory:', normalizedEmail);
            console.log('   Organization ID:', organizationFromDirectory?._id || 'NOT POPULATED');
        }
        
        // If organization has dedicated database, get user from there
        let orgUser = user;
        const organizationForLogin = user?.organizationId || organizationFromDirectory;
        if (organizationForLogin?.database?.name && organizationForLogin.database.initialized) {
            try {
                console.log('📊 Attempting to get user from organization database:', organizationForLogin.database.name);
                const dbConnectionManager = require('../utils/databaseConnectionManager');
                const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organizationForLogin.database.name);
                
                // Get or create User model for organization database
                const OrgUser = getOrgUserModel(orgDbConnection);
                
                const orgDbUser = await OrgUser.findOne({ email: normalizedEmail });
                
                if (orgDbUser) {
                    orgUser = orgDbUser;
                    console.log('✅ User found in organization database');
                } else {
                    console.log('⚠️  User not found in organization database, using master DB user');
                }
            } catch (orgDbError) {
                console.error('❌ Error accessing organization database:', orgDbError.message);
                console.error('❌ Falling back to master database user');
                // Continue with master database user
                orgUser = user;
            }
        }

        if (!orgUser) {
            securityLogger.logAuthEvent('LOGIN_FAILED', {
                email: normalizedEmail,
                reason: 'USER_NOT_FOUND_IN_TENANT_DB',
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        console.log('   Role populated?', !!orgUser.roleId);
        console.log('   Role:', orgUser.roleId?.name || orgUser.role);

        // 2. Check password (use orgUser if available, otherwise master user)
        const passwordToCheck = orgUser?.password || user?.password;
        const isPasswordMatch = await bcrypt.compare(password, passwordToCheck);
        
        if (!isPasswordMatch) {
            // Log failed login attempt (wrong password)
            securityLogger.logAuthEvent('LOGIN_FAILED', {
                email: normalizedEmail,
                userId: orgUser?._id || user?._id,
                reason: 'INVALID_PASSWORD',
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // 3. Check if user is active
        if (orgUser.status !== 'active') {
            console.log('❌ User status not active:', orgUser.status);
            return res.status(403).json({ 
                message: 'Your account has been suspended. Please contact your administrator.',
                code: 'ACCOUNT_SUSPENDED'
            });
        }
        console.log('✅ User status: active');

        // 4. Check if organization exists and is populated
        if (!organizationForLogin) {
            console.log('❌ Organization not found for user');
            return res.status(500).json({ 
                message: 'Organization data not found. Please contact support.',
                code: 'ORG_NOT_FOUND'
            });
        }
        console.log('✅ Organization found:', organizationForLogin.name);
        
        // 5. Check if organization is active
        if (!organizationForLogin.isActive) {
            console.log('❌ Organization not active:', organizationForLogin.isActive);
            return res.status(403).json({ 
                message: 'Your organization account is inactive. Please contact support.',
                code: 'ORG_INACTIVE'
            });
        }
        console.log('✅ Organization is active');

        // 6. Last login + denormalized permission snapshot (one save)
        orgUser.lastLogin = new Date();
        await materializeEffectiveCRMEnvelopeOnUser(orgUser);
        await orgUser.save();

        if (user && orgUser !== user) {
            user.lastLogin = new Date();
            await user.save();
        }

        console.log('✅ Login successful for:', email);

        // Log successful login
        securityLogger.logAuthEvent('LOGIN_SUCCESS', {
            email: normalizedEmail,
            userId: orgUser._id,
            organizationId: organizationForLogin._id,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            success: true
        });

        // Derive allowedApps from appAccess if not set (for backward compatibility)
        let allowedApps = orgUser.allowedApps;
        if (!allowedApps || allowedApps.length === 0) {
            // Derive from appAccess array
            if (orgUser.appAccess && orgUser.appAccess.length > 0) {
                allowedApps = orgUser.appAccess
                    .filter(access => access.status === 'ACTIVE')
                    .map(access => access.appKey);
            } else {
                // Default to Sales if nothing is set
                allowedApps = ['SALES'];
            }
        }

        const instanceContext = await resolveInstanceForLogin(organizationForLogin?._id, normalizedEmail);
        // Respond with Token and Organization Info (use orgUser data)
        res.json({
            _id: orgUser._id,
            username: orgUser.username,
            email: orgUser.email,
            role: orgUser.role,
            isOwner: orgUser.isOwner,
            isPlatformAdmin: orgUser.isPlatformAdmin === true,
            permissions: orgUser.permissions,
            allowedApps: allowedApps, // Include app access
            appAccess: orgUser.appAccess,
            organization: {
                _id: organizationForLogin._id,
                name: organizationForLogin.name,
                industry: organizationForLogin.industry,
                subscription: organizationForLogin.subscription,
                limits: organizationForLogin.limits,
                enabledApps: organizationForLogin.enabledApps || [], // App-level enablement (required for owner access check)
                enabledModules: organizationForLogin.enabledModules,
                settings: organizationForLogin.settings,
                database: organizationForLogin.database ? {
                    name: organizationForLogin.database.name,
                    initialized: organizationForLogin.database.initialized
                } : null,
                capabilities: buildOrgCapabilities(organizationForLogin)
            },
            instance: instanceContext,
            token: generateToken(orgUser._id, organizationForLogin._id),
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // Return detailed error in development
        res.status(500).json({ 
            message: 'Server error during login.',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            name: error.name
        });
    }
};
