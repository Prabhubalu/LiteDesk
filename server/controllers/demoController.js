const DemoRequest = require('../models/DemoRequest');
const Organization = require('../models/Organization');
const People = require('../models/People');
const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const updatePeopleModuleFields = require('../scripts/updatePeopleModuleFields');
const updateOrganizationsModuleFields = require('../scripts/updateOrganizationsModuleFields');
const updateDealsModuleFields = require('../scripts/updateDealsModuleFields');
const UserDirectory = require('../models/UserDirectory');
const { ensureDefaultCommunicationSettingsForOrganization } = require('../services/communicationDefaultsSeeder');
const { ensureOrgEmailPolicy } = require('../services/orgEmailPolicyService');
const InstanceRegistry = require('../models/InstanceRegistry');
const { generateUniqueSlug } = require('../services/provisioning/utils/slugGenerator');
const { seedTenantDatabase } = require('../services/provisioning/tenantSeeder');
const { buildTenantFrontendUrl, buildTenantApiUrl } = require('../utils/tenantDomain');

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
    if (originalSchema._indexes && originalSchema._indexes.length > 0) {
        originalSchema._indexes.forEach((index) => {
            clonedSchema.index(index[0], index[1]);
        });
    }
    return connection.model(modelName, clonedSchema);
}

const USER_APP_KEYS = new Set(['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING']);

async function upsertMasterLeadFromDemo({
    demoRequest,
    masterOrganizationId,
    actorUserId
}) {
    if (!demoRequest?.email || !masterOrganizationId || !actorUserId) return null;

    const normalizedEmail = String(demoRequest.email).toLowerCase().trim();
    const firstName = String(demoRequest.contactName || '').split(' ')[0] || normalizedEmail.split('@')[0] || 'Lead';
    const lastName = String(demoRequest.contactName || '').split(' ').slice(1).join(' ') || '';

    const existing = await People.findOne({
        organizationId: masterOrganizationId,
        email: normalizedEmail
    });

    const leadFields = {
        first_name: firstName,
        last_name: lastName,
        phone: demoRequest.phone || '',
        source: 'Web Form',
        organization: demoRequest.organizationId || null,
        assignedTo: actorUserId,
        lead_owner: actorUserId,
        participations: {
            SALES: {
                role: 'Lead',
                lead_status: 'New'
            }
        }
    };

    if (existing) {
        await People.findByIdAndUpdate(existing._id, {
            $set: leadFields,
            $addToSet: {
                tags: { $each: ['demo-request', 'converted-demo'] }
            }
        });
        return existing._id;
    }

    const created = await People.create({
        organizationId: masterOrganizationId,
        createdBy: actorUserId,
        email: normalizedEmail,
        ...leadFields,
        tags: ['demo-request', 'converted-demo']
    });

    return created._id;
}

// --- Submit Demo Request (Public) ---
exports.submitDemoRequest = async (req, res) => {
    const { companyName, industry, companySize, contactName, email, phone, jobTitle, message } = req.body;
    
    try {
        console.log('📝 Demo request received from:', email);
        
        // Validate required fields
        if (!companyName || !contactName || !email || !industry || !companySize) {
            return res.status(400).json({ 
                success: false,
                message: 'Please provide all required fields' 
            });
        }

        const normalizedEmail = String(email).toLowerCase().trim();
        if (!normalizedEmail) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Platform identity SSOT — existing accounts cannot request a demo
        const existingDirectoryUser = await UserDirectory.findOne({ email: normalizedEmail })
            .select('_id status')
            .lean();
        if (existingDirectoryUser) {
            return res.status(409).json({
                success: false,
                code: 'EXISTING_USER',
                message: 'This email is already linked to an account. Sign in to continue.'
            });
        }
        
        // Check if email already requested
        const existing = await DemoRequest.findOne({ email: normalizedEmail }).select('_id').lean();
        if (existing) {
            return res.status(409).json({ 
                success: false,
                code: 'DEMO_EXISTS',
                message: 'A demo request with this email already exists. We will contact you soon!' 
            });
        }
        
        // Step 1: Create demo request only.
        // Organization + People are created during conversion.
        const demoRequest = await DemoRequest.create({
            companyName,
            industry,
            companySize,
            contactName,
            email: normalizedEmail,
            phone,
            jobTitle,
            message,
            status: 'pending',
            source: 'website',
            organizationId: null
        });
        
        console.log('✅ Demo request created:', demoRequest._id);
        console.log('ℹ️  Organization/People will be created on conversion');
        
        // TODO: Send email notification to sales team
        // TODO: Send confirmation email to requester
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your interest! Our team will contact you within 24 hours.',
            requestId: demoRequest._id
        });
        
    } catch (error) {
        console.error('❌ Demo request error:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error name:', error.name);
        res.status(500).json({ 
            success: false,
            message: 'Error submitting demo request. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Get All Demo Requests (Admin Only) ---
exports.getDemoRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        
        const requests = await DemoRequest.find(query)
            .sort({ createdAt: -1 })
            .populate('assignedTo', 'username email firstName lastName')
            .populate('organizationId', 'name industry')
            .populate('contactId', 'first_name last_name email phone lifecycle_stage')
            .populate('convertedToInstanceId', 'instanceName subdomain status');
        
        res.json({
            success: true,
            count: requests.length,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching demo requests:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching demo requests' 
        });
    }
};

// --- Get Single Demo Request ---
exports.getDemoRequest = async (req, res) => {
    try {
        const request = await DemoRequest.findById(req.params.id)
            .populate('assignedTo', 'username email firstName lastName')
            .populate('organizationId', 'name industry subscription')
            .populate('contactId', 'first_name last_name email phone job_title lifecycle_stage lead_score')
            .populate('convertedToInstanceId', 'instanceName subdomain status urls');
        
        if (!request) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error fetching demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// --- Update Demo Request Status ---
exports.updateDemoRequest = async (req, res) => {
    try {
        const { status, notes, assignedTo, preferredDemoDate } = req.body;
        
        const updateData = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        if (preferredDemoDate) updateData.preferredDemoDate = preferredDemoDate;
        
        const demoRequest = await DemoRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'username email');
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        console.log('✅ Demo request updated:', demoRequest._id, '- Status:', demoRequest.status);
        
        res.json({
            success: true,
            data: demoRequest,
            message: 'Demo request updated successfully'
        });
    } catch (error) {
        console.error('Error updating demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating demo request' 
        });
    }
};

// --- Convert Demo Request to Instance (Multi-Instance Architecture) ---
exports.convertToOrganization = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findById(req.params.id);
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        if (demoRequest.status === 'converted') {
            return res.status(400).json({ 
                success: false,
                message: 'This demo request has already been converted' 
            });
        }
        
        const { subscriptionTier = 'trial' } = req.body;
        
        console.log('🔄 Converting demo request to ORGANIZATION:', demoRequest.email);
        
        // Ensure SALES/business organization exists (kept visible in Organizations module).
        console.log('📋 Step 1: Resolving/creating sales organization...');
        let organization = demoRequest.organizationId
            ? await Organization.findById(demoRequest.organizationId)
            : null;

        if (!organization) {
            const slug = await generateUniqueSlug(demoRequest.companyName || 'workspace');
            organization = await Organization.create({
                name: demoRequest.companyName,
                slug,
                industry: demoRequest.industry || '',
                isActive: true,
                createdBy: req.user?._id || null,
                assignedTo: req.user?._id || null,
                subscription: {
                    tier: 'trial',
                    status: 'trial',
                    trialStartDate: new Date(),
                    trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
                },
                limits: {
                    maxUsers: -1,
                    maxContacts: -1,
                    maxDeals: -1,
                    maxStorageGB: -1
                },
                settings: {
                    timeZone: 'UTC',
                    currency: 'USD'
                },
                enabledModules: ['contacts', 'deals'],
                enabledApps: [{
                    appKey: 'SALES',
                    status: 'ACTIVE',
                    enabledAt: new Date()
                }],
                types: [],
                customerStatus: 'Prospect',
                isTenant: false
            });

            demoRequest.organizationId = organization._id;
            await demoRequest.save();

            try {
                await Role.createDefaultRoles(organization._id);
            } catch (roleError) {
                console.warn('⚠️  Failed to create default roles during conversion:', roleError.message);
            }

            try {
                const salesInitializer = require('../services/salesAppInitializer');
                await salesInitializer.initializeSales(organization._id);
            } catch (moduleError) {
                console.warn('⚠️  Failed to initialize Sales modules during conversion:', moduleError.message);
            }

            try {
                await updateOrganizationsModuleFields(organization._id);
            } catch (moduleError) {
                console.warn('⚠️  Failed to initialize Organizations module during conversion:', moduleError.message);
            }

            console.log('✅ Sales organization created during conversion:', organization.name);
        } else {
            console.log('✅ Sales organization found:', organization.name);
        }

        // Ensure tenant workspace organization exists separately from SALES organization.
        console.log('📋 Step 1.1: Resolving/creating tenant workspace organization...');
        let tenantOrganization = await Organization.findOne({
            legacyOrganizationId: organization._id,
            isTenant: true
        });

        if (!tenantOrganization) {
            const tenantSlug = await generateUniqueSlug(organization.name || demoRequest.companyName || 'workspace');
            tenantOrganization = await Organization.create({
                name: organization.name || demoRequest.companyName,
                slug: tenantSlug,
                industry: organization.industry || demoRequest.industry || '',
                isActive: true,
                isTenant: true,
                legacyOrganizationId: organization._id,
                createdBy: req.user?._id || null,
                assignedTo: req.user?._id || null,
                subscription: {
                    tier: 'trial',
                    status: 'trial',
                    trialStartDate: new Date(),
                    trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
                },
                limits: {
                    maxUsers: -1,
                    maxContacts: -1,
                    maxDeals: -1,
                    maxStorageGB: -1
                },
                settings: {
                    timeZone: 'UTC',
                    currency: 'USD'
                },
                enabledModules: ['contacts', 'deals'],
                enabledApps: [{
                    appKey: 'SALES',
                    status: 'ACTIVE',
                    enabledAt: new Date()
                }],
                types: []
            });
            console.log('✅ Tenant workspace organization created:', tenantOrganization.name);
            try {
                const { provisionFreshTenantAstra } = require('../services/ai/astraDefaultEntitlementService');
                await provisionFreshTenantAstra({
                    organizationId: tenantOrganization._id,
                    initiatedByUserId: req.user?._id || null,
                });
            } catch (astraErr) {
                console.warn('[demoController] Astra starter grant failed:', astraErr?.message || astraErr);
            }
        } else {
            console.log('✅ Tenant workspace organization found:', tenantOrganization.name);
        }
        try {
            await ensureDefaultCommunicationSettingsForOrganization(tenantOrganization._id);
        } catch (commErr) {
            console.warn('[demoController] Communication defaults seed failed:', commErr?.message || commErr);
        }

        const validTiers = ['trial', 'paid'];
        const tier = validTiers.includes(subscriptionTier) ? subscriptionTier : 'trial';

        try {
            await ensureOrgEmailPolicy(tenantOrganization._id, tier === 'trial' ? 'TRIAL' : 'PRO');
        } catch (policyErr) {
            console.warn('[demoController] OrgEmailPolicy seed failed:', policyErr?.message || policyErr);
        }

        console.log('✅ Subscription tier:', tier);

        const activeOrgAppKeys = Array.isArray(tenantOrganization.enabledApps)
            ? tenantOrganization.enabledApps
                .map((app) => {
                    if (typeof app === 'string') return app.toUpperCase();
                    if (app && typeof app === 'object') {
                        const status = String(app.status || 'ACTIVE').toUpperCase();
                        if (status !== 'ACTIVE') return null;
                        return typeof app.appKey === 'string' ? app.appKey.toUpperCase() : null;
                    }
                    return null;
                })
                .filter((appKey) => appKey && USER_APP_KEYS.has(appKey))
            : [];
        if (activeOrgAppKeys.length === 0) {
            activeOrgAppKeys.push('SALES');
        }
        
        // Generate database name from organization slug or ID
        const dbName = tenantOrganization.slug 
            ? `arivu_${tenantOrganization.slug.replace(/-/g, '_')}`
            : `arivu_${tenantOrganization._id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        console.log('📦 Step 2: Creating dedicated database:', dbName);
        
        // Import database connection manager
        const dbConnectionManager = require('../utils/databaseConnectionManager');
        
        // Create organization database
        try {
            await dbConnectionManager.createOrganizationDatabase(dbName);
            console.log('✅ Database created:', dbName);
        } catch (dbError) {
            console.error('❌ Database creation failed:', dbError.message);
            console.error('❌ Database error stack:', dbError.stack);
            // Continue anyway - database might already exist
        }
        
        console.log('📦 Step 3: Getting organization database connection...');
        // Get organization database connection
        const orgDbConnection = await dbConnectionManager.getOrganizationConnection(dbName);
        console.log('✅ Organization database connection established');
        
        // Build connection string for storage (use baseMongoUri from connection manager)
        if (!dbConnectionManager.baseMongoUri) {
            // Ensure baseMongoUri is set
            await dbConnectionManager.initializeMasterConnection();
        }
        const baseUri = dbConnectionManager.baseMongoUri;
        if (!baseUri) {
            throw new Error('Failed to get base MongoDB URI. Please ensure MONGO_URI is set in .env');
        }
        const connectionString = `${baseUri}/${dbName}`;
        console.log('✅ Connection string built:', connectionString);
        
        console.log('📦 Step 4: Updating tenant workspace with database info...');
        
        // Get modules for the subscription tier (exclude admin-only modules)
        const tierModules = tenantOrganization.getModulesForTier(tier);
        
        // Remove admin-only modules (demo_requests, instances, etc.)
        const adminModules = ['demo_requests', 'instances', 'users', 'settings'];
        const allowedModules = tierModules.filter(module => !adminModules.includes(module));
        
        // Update tenant workspace with database info
        await Organization.findByIdAndUpdate(
            tenantOrganization._id,
            {
                // Update subscription tier and status
                'subscription.tier': tier,
                'subscription.status': tier === 'trial' ? 'trial' : 'active',
                // Store database configuration
                'database.name': dbName,
                'database.connectionString': connectionString,
                'database.createdAt': new Date(),
                'database.initialized': true,
                // Update enabled modules (exclude admin-only modules)
                enabledModules: allowedModules
            }
        );
        console.log('✅ Tenant workspace updated with database:', dbName);
        console.log('✅ Enabled modules:', allowedModules.join(', '));

        try {
            await updateDealsModuleFields(organization._id);
            console.log('✅ Deals module definition refreshed after conversion');
        } catch (moduleError) {
            console.warn('⚠️  Failed to refresh Deals module during conversion:', moduleError.message);
        }

        // Seed the tenant DB with the same baseline that arivu_master holds
        // (apps, platform module definitions, relationships, default roles, and
        // tenant app/module configurations). Idempotent — re-running is safe.
        try {
            const updatedOrg = await Organization.findById(tenantOrganization._id).lean();
            await seedTenantDatabase(orgDbConnection, updatedOrg || organization);
        } catch (seedError) {
            console.warn('⚠️  Failed to seed tenant DB baseline:', seedError.message);
            console.warn(seedError.stack);
        }

        // Mirror seeded module definitions from master DB into tenant DB so
        // module metadata is available immediately in dedicated deployments.
        try {
            const MasterModuleDefinition = require('../models/ModuleDefinition');
            const TenantModuleDefinition = getTenantModel(orgDbConnection, 'ModuleDefinition', MasterModuleDefinition);
            const seededDefinitions = await MasterModuleDefinition.find({ organizationId: tenantOrganization._id }).lean();
            if (seededDefinitions.length > 0) {
                for (const definition of seededDefinitions) {
                    const payload = { ...definition };
                    delete payload._id;
                    await TenantModuleDefinition.findOneAndUpdate(
                        { organizationId: tenantOrganization._id, moduleKey: definition.moduleKey || definition.key },
                        { $set: payload },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                }
                console.log(`✅ Mirrored ${seededDefinitions.length} module definitions to tenant DB`);
            } else {
                console.warn('⚠️  No seeded module definitions found in master to mirror');
            }
        } catch (mirrorError) {
            console.warn('⚠️  Failed to mirror module definitions to tenant DB:', mirrorError.message);
        }
        
        // Create owner user pending workspace activation (no admin-set password)
        console.log('👤 Step 5: Creating owner user in organization database...');
        
        // Import User model for organization database
        // Check if model already exists on this connection
        let OrgUser;
        if (orgDbConnection.models.User) {
            OrgUser = orgDbConnection.models.User;
            console.log('✅ Using existing User model on organization connection');
        } else {
            console.log('📋 Creating User model for organization database...');
            // Get schema definition from the compiled User model
            const UserModel = require('../models/User');
            const originalSchema = UserModel.schema;
            
            console.log('📋 Schema definition retrieved, creating new schema instance...');
            // Create a new schema instance from the schema definition object
            // Mongoose doesn't have clone(), so we need to create from the definition
            const UserSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);
            
            // Copy methods from original schema
            if (originalSchema.methods) {
                Object.keys(originalSchema.methods).forEach(methodName => {
                    UserSchema.methods[methodName] = originalSchema.methods[methodName];
                });
                console.log(`✅ Copied ${Object.keys(originalSchema.methods).length} methods`);
            }
            
            // Copy statics from original schema
            if (originalSchema.statics) {
                Object.keys(originalSchema.statics).forEach(staticName => {
                    UserSchema.statics[staticName] = originalSchema.statics[staticName];
                });
                console.log(`✅ Copied ${Object.keys(originalSchema.statics).length} statics`);
            }
            
            // Copy indexes from original schema
            if (originalSchema._indexes && originalSchema._indexes.length > 0) {
                originalSchema._indexes.forEach(index => {
                    UserSchema.index(index[0], index[1]);
                });
                console.log(`✅ Copied ${originalSchema._indexes.length} indexes`);
            }
            
            // Register the model with the organization database connection
            OrgUser = orgDbConnection.model('User', UserSchema);
            console.log('✅ Created User model on organization connection');
        }
        
        const nameParts = demoRequest.contactName ? demoRequest.contactName.split(' ') : [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const ownerEmail = demoRequest.email.toLowerCase();

        const userInviteService = require('../services/userInviteService');
        const { buildInviteUrl } = require('../utils/userAuthTokens');
        const {
            initializeOnboardingForUser,
            ONBOARDING_ORIGINS
        } = require('../services/onboardingService');

        const inviteCredentials = userInviteService.buildInviteCredentials({});
        const inviteTokenHash = userInviteService.hashToken(inviteCredentials.inviteTokenRaw);
        const hashedPassword = await bcrypt.hash(inviteCredentials.password, 10);

        const existingUser = await OrgUser.findOne({ email: ownerEmail });
        let ownerUser;

        if (existingUser) {
            console.log('⚠️  User already exists in organization database');
            existingUser.organizationId = tenantOrganization._id;
            existingUser.role = 'owner';
            existingUser.isOwner = true;
            existingUser.status = inviteCredentials.initialStatus;
            existingUser.userType = 'INTERNAL';
            existingUser.password = hashedPassword;
            existingUser.mustChangePassword = false;
            existingUser.allowedApps = activeOrgAppKeys;
            existingUser.appAccess = activeOrgAppKeys.map((appKey) => ({
                appKey,
                roleKey: 'ADMIN',
                status: 'ACTIVE',
                addedAt: new Date()
            }));
            existingUser.invitedAt = new Date();
            existingUser.invitedBy = req.user?._id || null;
            existingUser.inviteAcceptedAt = null;
            existingUser.emailVerifiedAt = null;
            existingUser.inviteTokenHash = inviteTokenHash;
            existingUser.inviteTokenExpiresAt = inviteCredentials.inviteTokenExpiresAt;
            existingUser.emailVerificationTokenHash = null;
            existingUser.emailVerificationExpiresAt = null;
            existingUser.emailVerificationSentAt = null;
            existingUser.setPermissionsByRole('owner');
            await initializeOnboardingForUser(existingUser, {
                origin: ONBOARDING_ORIGINS.DEMO_CONVERTED
            });
            await existingUser.save();
            ownerUser = existingUser;
            console.log('✅ Existing user updated as pending owner activation');
        } else {
            ownerUser = await OrgUser.create({
                organizationId: tenantOrganization._id,
                username: demoRequest.email.split('@')[0] || demoRequest.contactName?.toLowerCase().replace(/\s+/g, '') || 'user',
                email: ownerEmail,
                password: hashedPassword,
                firstName: firstName,
                lastName: lastName,
                phoneNumber: demoRequest.phone || '',
                role: 'owner',
                isOwner: true,
                status: inviteCredentials.initialStatus,
                userType: 'INTERNAL',
                mustChangePassword: false,
                allowedApps: activeOrgAppKeys,
                appAccess: activeOrgAppKeys.map((appKey) => ({
                    appKey,
                    roleKey: 'ADMIN',
                    status: 'ACTIVE',
                    addedAt: new Date()
                })),
                invitedAt: new Date(),
                invitedBy: req.user?._id || null,
                inviteTokenHash,
                inviteTokenExpiresAt: inviteCredentials.inviteTokenExpiresAt
            });

            ownerUser.setPermissionsByRole('owner');
            await initializeOnboardingForUser(ownerUser, {
                origin: ONBOARDING_ORIGINS.DEMO_CONVERTED
            });
            await ownerUser.save();
            console.log('✅ Owner user created pending activation:', ownerUser.email);
        }

        await UserDirectory.findOneAndUpdate(
            { email: ownerEmail },
            {
                $set: {
                    organizationId: tenantOrganization._id,
                    tenantDatabaseName: dbName,
                    tenantUserId: ownerUser._id,
                    status: 'active',
                    inviteTokenHash,
                    emailVerificationTokenHash: null
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log('✅ User directory entry upserted for tenant owner');

        const activationEmailResult = await userInviteService.sendDemoWorkspaceActivationForUser({
            user: ownerUser,
            organization: tenantOrganization,
            inviteToken: inviteCredentials.inviteTokenRaw
        });
        const activationEmailSent = activationEmailResult.sent === true;
        if (!activationEmailSent) {
            console.warn('⚠️  Demo workspace activation email not sent:', {
                email: ownerEmail,
                reason: activationEmailResult.reason || null,
                channel: activationEmailResult.channel || null
            });
        } else {
            console.log('✅ Demo workspace activation email sent:', ownerEmail);
        }
        
        // Do not create a full user in master DB for converted tenants.
        // Tenant auth now resolves user from dedicated DB using org context.
        console.log('👤 Step 6: Skipping master user creation for dedicated tenant database');
        
        // Update demo request
        let instance = await InstanceRegistry.findOne({ demoRequestId: demoRequest._id });
        if (!instance) {
            let retries = 0;
            while (!instance && retries < 5) {
                const subdomain = await generateUniqueSlug(tenantOrganization.name || demoRequest.companyName);
                try {
                    instance = await InstanceRegistry.create({
                        instanceName: tenantOrganization.name || demoRequest.companyName,
                        subdomain,
                        ownerEmail: ownerEmail,
                        ownerName: demoRequest.contactName,
                        status: 'active',
                        provisioningStage: 'complete',
                        healthStatus: 'healthy',
                        subscription: {
                            tier: tier,
                            status: tier === 'trial' ? 'trial' : 'active',
                            trialStartDate: tier === 'trial' ? new Date() : undefined,
                            trialEndDate: tier === 'trial' ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) : undefined
                        },
                        databaseConnection: {
                            database: dbName
                        },
                        urls: {
                            frontend: buildTenantFrontendUrl(subdomain),
                            api: buildTenantApiUrl(subdomain)
                        },
                        demoRequestId: demoRequest._id
                    });
                    console.log(`✅ Instance registry created for converted tenant: ${subdomain}`);
                } catch (instanceError) {
                    const duplicateSubdomainError = instanceError?.code === 11000
                        && instanceError?.keyPattern
                        && instanceError.keyPattern.subdomain;
                    if (!duplicateSubdomainError) {
                        throw instanceError;
                    }
                    retries += 1;
                    console.warn(`⚠️  Subdomain collision detected during conversion, retrying (${retries}/5)...`);
                }
            }
            if (!instance) {
                throw new Error('Failed to allocate a unique subdomain for converted demo request');
            }
        }

        demoRequest.status = 'converted';
        demoRequest.convertedAt = new Date();
        demoRequest.convertedToInstanceId = instance._id;

        try {
            const masterLeadId = await upsertMasterLeadFromDemo({
                demoRequest,
                masterOrganizationId: req.user?.organizationId,
                actorUserId: req.user?._id
            });
            if (masterLeadId) {
                demoRequest.contactId = masterLeadId;
                console.log('✅ Master lead upserted from demo conversion:', masterLeadId.toString());
            }
        } catch (leadErr) {
            // CRM lead is a non-critical side effect — never block tenant conversion.
            console.warn('[demoController] Master lead upsert failed (conversion continues):', leadErr?.message || leadErr);
        }

        await demoRequest.save();
        
        // Return success response
        const responseData = {
            demoRequestId: demoRequest._id,
            organizationId: demoRequest.organizationId,
            tenantOrganizationId: tenantOrganization._id,
            databaseName: dbName,
            subdomain: instance?.subdomain || null,
            status: 'converted',
            ownerEmail,
            activationEmailSent,
            note: activationEmailSent
                ? 'Activation email sent. Owner must activate their workspace before signing in.'
                : 'Workspace provisioned. Activation email was not sent — use Resend activation or share the activation link.'
        };
        if (!activationEmailSent && inviteCredentials.inviteTokenRaw) {
            responseData.activationUrl = buildInviteUrl(inviteCredentials.inviteTokenRaw);
            responseData.activationEmailReason = activationEmailResult.reason || null;
        }

        res.json({
            success: true,
            message: activationEmailSent
                ? 'Organization converted. Activation email sent to the demo contact.'
                : 'Organization converted. Activation email could not be sent.',
            data: responseData
        });
        
    } catch (error) {
        console.error('❌ Conversion error:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // Return detailed error in development
        const errorResponse = {
            success: false,
            message: 'Error converting demo request',
            error: error.message,
            stack: error.stack,
            name: error.name
        };
        
        // Add additional error details if available
        if (error.code) errorResponse.code = error.code;
        if (error.keyPattern) errorResponse.keyPattern = error.keyPattern;
        if (error.keyValue) errorResponse.keyValue = error.keyValue;
        
        res.status(500).json(errorResponse);
    }
};


// --- Resend demo workspace activation email ---
exports.resendDemoActivation = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findById(req.params.id);
        if (!demoRequest) {
            return res.status(404).json({
                success: false,
                message: 'Demo request not found'
            });
        }
        if (demoRequest.status !== 'converted') {
            return res.status(400).json({
                success: false,
                message: 'Only converted demo requests can resend activation',
                code: 'NOT_CONVERTED'
            });
        }

        let tenantOrganization = await Organization.findOne({
            legacyOrganizationId: demoRequest.organizationId,
            isTenant: true
        });
        if (!tenantOrganization && demoRequest.convertedToInstanceId) {
            const instance = await InstanceRegistry.findById(demoRequest.convertedToInstanceId).lean();
            if (instance?.databaseConnection?.database) {
                tenantOrganization = await Organization.findOne({
                    'database.name': instance.databaseConnection.database,
                    isTenant: true
                });
            }
        }
        if (!tenantOrganization?.database?.name || !tenantOrganization.database.initialized) {
            return res.status(400).json({
                success: false,
                message: 'Converted tenant workspace is not ready',
                code: 'TENANT_NOT_READY'
            });
        }

        const userInviteService = require('../services/userInviteService');
        const { buildInviteUrl } = require('../utils/userAuthTokens');
        const ScopedUser = await userInviteService.getScopedUserModel(tenantOrganization);
        const ownerEmail = String(demoRequest.email || '').toLowerCase().trim();
        const ownerUser = await ScopedUser.findOne({ email: ownerEmail, isOwner: true });
        if (!ownerUser) {
            return res.status(404).json({
                success: false,
                message: 'Owner user not found for converted demo',
                code: 'OWNER_NOT_FOUND'
            });
        }
        if (ownerUser.status === 'active' && ownerUser.inviteAcceptedAt) {
            return res.status(400).json({
                success: false,
                message: 'Owner has already activated their workspace',
                code: 'ALREADY_ACTIVATED'
            });
        }

        const inviteCredentials = userInviteService.buildInviteCredentials({});
        const inviteTokenHash = userInviteService.hashToken(inviteCredentials.inviteTokenRaw);
        ownerUser.password = await bcrypt.hash(inviteCredentials.password, 10);
        ownerUser.status = inviteCredentials.initialStatus;
        ownerUser.mustChangePassword = false;
        ownerUser.invitedAt = new Date();
        ownerUser.invitedBy = req.user?._id || ownerUser.invitedBy || null;
        ownerUser.inviteAcceptedAt = null;
        ownerUser.emailVerifiedAt = null;
        ownerUser.inviteTokenHash = inviteTokenHash;
        ownerUser.inviteTokenExpiresAt = inviteCredentials.inviteTokenExpiresAt;
        ownerUser.emailVerificationTokenHash = null;
        ownerUser.emailVerificationExpiresAt = null;
        ownerUser.emailVerificationSentAt = null;
        await ownerUser.save();

        await UserDirectory.findOneAndUpdate(
            { email: ownerEmail },
            {
                $set: {
                    organizationId: tenantOrganization._id,
                    tenantDatabaseName: tenantOrganization.database.name,
                    tenantUserId: ownerUser._id,
                    status: 'active',
                    inviteTokenHash,
                    emailVerificationTokenHash: null
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const activationEmailResult = await userInviteService.sendDemoWorkspaceActivationForUser({
            user: ownerUser,
            organization: tenantOrganization,
            inviteToken: inviteCredentials.inviteTokenRaw
        });

        const responseData = {
            ownerEmail,
            activationEmailSent: activationEmailResult.sent === true
        };
        if (!activationEmailResult.sent) {
            responseData.activationUrl = buildInviteUrl(inviteCredentials.inviteTokenRaw);
            responseData.activationEmailReason = activationEmailResult.reason || null;
        }

        return res.json({
            success: true,
            message: activationEmailResult.sent
                ? 'Activation email resent'
                : 'Activation link reissued; email could not be sent',
            data: responseData
        });
    } catch (error) {
        console.error('[demoController] resendDemoActivation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error resending activation email',
            error: error.message
        });
    }
};

// --- Delete Demo Request ---
exports.deleteDemoRequest = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findByIdAndDelete(req.params.id);
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        console.log('🗑️ Demo request deleted:', demoRequest.email);
        
        res.json({
            success: true,
            message: 'Demo request deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// --- Get Demo Request Statistics ---
exports.getStats = async (req, res) => {
    try {
        const stats = await DemoRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const total = await DemoRequest.countDocuments();
        const thisMonth = await DemoRequest.countDocuments({
            createdAt: { $gte: new Date(new Date().setDate(1)) }
        });
        
        res.json({
            success: true,
            data: {
                total,
                thisMonth,
                byStatus: stats.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

