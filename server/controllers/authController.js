const User = require('../models/User');
const Organization = require('../models/Organization');
const Role = require('../models/Role');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const updatePeopleModuleFields = require('../scripts/updatePeopleModuleFields');
const updateDealsModuleFields = require('../scripts/updateDealsModuleFields');
const securityLogger = require('../middleware/securityLoggingMiddleware');

// --- Helper Function: Generate Token ---
const generateToken = (id) => {
    // SECURITY: JWT_SECRET must be set - fail hard if not configured
    if (!process.env.JWT_SECRET) {
        throw new Error('CRITICAL: JWT_SECRET environment variable is not set! Server cannot generate tokens.');
    }
    
    return jwt.sign({ id }, process.env.JWT_SECRET, {
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
            enabledModules: ['contacts', 'deals', 'tasks', 'events']
        });
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

        // 1.6. Initialize People Module Definition with dependencies
        console.log('🔍 Step 3.6: Initializing People module definition...');
        try {
            await updatePeopleModuleFields(organization._id);
            console.log('✅ People module definition initialized with dependencies');
        } catch (moduleError) {
            console.warn('⚠️  Failed to initialize People module:', moduleError.message);
            // Continue even if module initialization fails - can be run manually later
        }
        try {
            await updateDealsModuleFields(organization._id);
            console.log('✅ Deals module definition initialized with standardized fields');
        } catch (moduleError) {
            console.warn('⚠️  Failed to initialize Deals module:', moduleError.message);
        }
        console.log('\n');

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
            status: 'active'
        });
        console.log('✅ ✅ ✅ USER CREATED SUCCESSFULLY! ✅ ✅ ✅');
        console.log('   ID:', user._id);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   IsOwner:', user.isOwner);
        console.log('   Organization ID:', user.organizationId);
        console.log('\n');

        // 4. Set owner permissions
        console.log('🔍 Step 6: Setting owner permissions...');
        user.setPermissionsByRole('owner');
        await user.save();
        console.log('✅ Permissions set and user saved\n');

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
                enabledModules: organization.enabledModules
            },
            token: generateToken(user._id),
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
        console.log('\n🔐 Login attempt for:', email);
        
        // 1. Find User by Email (check master database first)
        const user = await User.findOne({ email: email.toLowerCase() })
            .populate('organizationId', 'name industry subscription limits enabledModules settings isActive database')
            .populate('roleId', 'name description color icon level permissions');

        if (!user) {
            console.log('❌ User not found');
            // Log failed login attempt
            securityLogger.logAuthEvent('LOGIN_FAILED', {
                email: email.toLowerCase(),
                reason: 'USER_NOT_FOUND',
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        console.log('✅ User found:', user.email);
        console.log('   Organization populated?', !!user.organizationId);
        console.log('   Organization ID:', user.organizationId?._id || 'NOT POPULATED');
        console.log('   Organization has dedicated DB?', !!(user.organizationId?.database?.name));
        
        // If organization has dedicated database, get user from there
        let orgUser = user;
        if (user.organizationId?.database?.name && user.organizationId.database.initialized) {
            try {
                console.log('📊 Attempting to get user from organization database:', user.organizationId.database.name);
                const dbConnectionManager = require('../utils/databaseConnectionManager');
                const orgDbConnection = await dbConnectionManager.getOrganizationConnection(user.organizationId.database.name);
                
                // Get or create User model for organization database
                let OrgUser;
                if (orgDbConnection.models.User) {
                    OrgUser = orgDbConnection.models.User;
                    console.log('✅ Using existing User model on organization connection');
                } else {
                    console.log('📋 Creating User model for organization database...');
                    const UserModel = require('../models/User');
                    const originalSchema = UserModel.schema;
                    
                    // Create a new schema instance from the schema definition
                    const UserSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);
                    
                    // Copy methods and statics
                    if (originalSchema.methods) {
                        Object.keys(originalSchema.methods).forEach(methodName => {
                            UserSchema.methods[methodName] = originalSchema.methods[methodName];
                        });
                    }
                    if (originalSchema.statics) {
                        Object.keys(originalSchema.statics).forEach(staticName => {
                            UserSchema.statics[staticName] = originalSchema.statics[staticName];
                        });
                    }
                    
                    OrgUser = orgDbConnection.model('User', UserSchema);
                    console.log('✅ Created User model on organization connection');
                }
                
                const orgDbUser = await OrgUser.findOne({ email: email.toLowerCase() })
                    .populate('roleId', 'name description color icon level permissions');
                
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
        
        console.log('   Role populated?', !!orgUser.roleId);
        console.log('   Role:', orgUser.roleId?.name || orgUser.role);

        // 2. Check password (use orgUser if available, otherwise master user)
        const passwordToCheck = orgUser.password || user.password;
        const isPasswordMatch = await bcrypt.compare(password, passwordToCheck);
        
        if (!isPasswordMatch) {
            // Log failed login attempt (wrong password)
            securityLogger.logAuthEvent('LOGIN_FAILED', {
                email: email.toLowerCase(),
                userId: user._id,
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
        if (!user.organizationId) {
            console.log('❌ Organization not found for user');
            return res.status(500).json({ 
                message: 'Organization data not found. Please contact support.',
                code: 'ORG_NOT_FOUND'
            });
        }
        console.log('✅ Organization found:', user.organizationId.name);
        
        // 5. Check if organization is active
        if (!user.organizationId.isActive) {
            console.log('❌ Organization not active:', user.organizationId.isActive);
            return res.status(403).json({ 
                message: 'Your organization account is inactive. Please contact support.',
                code: 'ORG_INACTIVE'
            });
        }
        console.log('✅ Organization is active');

        // 6. Update last login (in both databases if applicable)
        orgUser.lastLogin = new Date();
        await orgUser.save();
        
        if (orgUser !== user) {
            user.lastLogin = new Date();
            await user.save();
        }

        console.log('✅ Login successful for:', email);

        // 7. Sync permissions from roleId if available (use orgUser)
        if (orgUser.roleId && orgUser.roleId.permissions) {
            console.log('🔄 Syncing permissions from role:', orgUser.roleId.name);
            orgUser.permissions = {
                contacts: {
                    view: orgUser.roleId.permissions.contacts?.read || false,
                    create: orgUser.roleId.permissions.contacts?.create || false,
                    edit: orgUser.roleId.permissions.contacts?.update || false,
                    delete: orgUser.roleId.permissions.contacts?.delete || false,
                    viewAll: orgUser.roleId.permissions.contacts?.viewAll || false,
                    exportData: orgUser.roleId.permissions.contacts?.export || false
                },
                organizations: {
                    view: orgUser.roleId.permissions.organizations?.read || false,
                    create: orgUser.roleId.permissions.organizations?.create || false,
                    edit: orgUser.roleId.permissions.organizations?.update || false,
                    delete: orgUser.roleId.permissions.organizations?.delete || false,
                    viewAll: orgUser.roleId.permissions.organizations?.viewAll || false,
                    exportData: orgUser.roleId.permissions.organizations?.export || false
                },
                deals: {
                    view: orgUser.roleId.permissions.deals?.read || false,
                    create: orgUser.roleId.permissions.deals?.create || false,
                    edit: orgUser.roleId.permissions.deals?.update || false,
                    delete: orgUser.roleId.permissions.deals?.delete || false,
                    viewAll: orgUser.roleId.permissions.deals?.viewAll || false,
                    exportData: orgUser.roleId.permissions.deals?.export || false
                },
                projects: {
                    view: orgUser.roleId.permissions.deals?.read || false,
                    create: orgUser.roleId.permissions.deals?.create || false,
                    edit: orgUser.roleId.permissions.deals?.update || false,
                    delete: orgUser.roleId.permissions.deals?.delete || false,
                    viewAll: orgUser.roleId.permissions.deals?.viewAll || false
                },
                tasks: {
                    view: orgUser.roleId.permissions.tasks?.read || false,
                    create: orgUser.roleId.permissions.tasks?.create || false,
                    edit: orgUser.roleId.permissions.tasks?.update || false,
                    delete: orgUser.roleId.permissions.tasks?.delete || false,
                    viewAll: orgUser.roleId.permissions.tasks?.viewAll || false
                },
                events: {
                    view: orgUser.roleId.permissions.events?.read || false,
                    create: orgUser.roleId.permissions.events?.create || false,
                    edit: orgUser.roleId.permissions.events?.update || false,
                    delete: orgUser.roleId.permissions.events?.delete || false,
                    viewAll: orgUser.roleId.permissions.events?.viewAll || false
                },
                imports: {
                    view: orgUser.roleId.permissions.contacts?.import || orgUser.roleId.permissions.deals?.import || false,
                    create: orgUser.roleId.permissions.contacts?.import || orgUser.roleId.permissions.deals?.import || false,
                    delete: false
                },
                settings: {
                    manageUsers: orgUser.roleId.permissions.settings?.manageUsers || false,
                    manageBilling: orgUser.roleId.permissions.settings?.manageBilling || false,
                    manageIntegrations: false,
                    customizeFields: false
                },
                reports: {
                    viewStandard: orgUser.roleId.permissions.reports?.read || false,
                    viewCustom: orgUser.roleId.permissions.reports?.read || false,
                    createCustom: orgUser.roleId.permissions.reports?.create || false,
                    exportReports: orgUser.roleId.permissions.reports?.export || false
                }
            };
            await orgUser.save();
            console.log('✅ Permissions synced from role');
        }

        // 8. Log successful login
        securityLogger.logAuthEvent('LOGIN_SUCCESS', {
            email: email.toLowerCase(),
            userId: orgUser._id,
            organizationId: user.organizationId._id,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            success: true
        });

        // 9. Respond with Token and Organization Info (use orgUser data)
        res.json({
            _id: orgUser._id,
            username: orgUser.username,
            email: orgUser.email,
            role: orgUser.role,
            isOwner: orgUser.isOwner,
            permissions: orgUser.permissions,
            organization: {
                _id: user.organizationId._id,
                name: user.organizationId.name,
                industry: user.organizationId.industry,
                subscription: user.organizationId.subscription,
                limits: user.organizationId.limits,
                enabledModules: user.organizationId.enabledModules,
                settings: user.organizationId.settings,
                database: user.organizationId.database ? {
                    name: user.organizationId.database.name,
                    initialized: user.organizationId.database.initialized
                } : null
            },
            token: generateToken(orgUser._id),
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