#!/usr/bin/env node

/**
 * Create Default Admin Account
 * 
 * This script creates a default admin user and organization for the platform owner.
 * Run this once when setting up your Arivu instance.
 * 
 * Usage: node scripts/createDefaultAdmin.js
 */

// Load environment variables from parent directory
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Role = require('../models/Role');
const Instance = require('../models/Instance');
const { INSTANCE_STATUS } = require('../constants/instanceLifecycle');
const { ensureDefaultCommunicationSettingsForOrganization } = require('../services/communicationDefaultsSeeder');
const { getMongoUris, connectMasterWithRetry } = require('../lib/mongoConnect');

function slugFromOrganizationName(name) {
    return String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Default Admin Credentials (use environment variables or defaults)
const DEFAULT_ADMIN = {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'hello@arivusystems.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123',
    username: 'Arivu Admin',
    firstName: 'Arivu',
    lastName: 'Admin',
    organizationName: 'Arivu Systems',
    industry: 'Technology'
};

async function createDefaultAdmin() {
    try {
        console.log('🚀 Creating Default Admin Account...\n');

        console.log('🔗 Connecting to MongoDB...');
        const { masterUri, masterDbName } = getMongoUris();
        await connectMasterWithRetry(masterUri);
        console.log(`✅ Connected to MongoDB master database: ${masterDbName}`);

        const expectedSlug = slugFromOrganizationName(DEFAULT_ADMIN.organizationName);
        const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN.email.toLowerCase() });
        let organization = await Organization.findOne({
            isTenant: true,
            $or: [{ slug: expectedSlug }, { name: DEFAULT_ADMIN.organizationName }]
        });

        if (existingAdmin && organization) {
            let upgraded = false;
            if (!existingAdmin.isPlatformAdmin) {
                existingAdmin.isPlatformAdmin = true;
                await existingAdmin.save();
                upgraded = true;
            }
            console.log('⚠️  Default admin and organization already exist — nothing to create.');
            console.log(`   Email: ${DEFAULT_ADMIN.email}`);
            console.log(`   Organization: ${organization.name} (${organization._id})`);
            if (upgraded) {
                console.log('✅ Set isPlatformAdmin=true on existing default admin');
            }
            await ensureDefaultCommunicationSettingsForOrganization(organization._id);
            await mongoose.connection.close();
            return;
        }

        if (existingAdmin) {
            console.log('⚠️  Admin user already exists but tenant organization was not found.');
            console.log(`   Email: ${DEFAULT_ADMIN.email}`);
            await mongoose.connection.close();
            return;
        }

        if (organization) {
            console.log('\n📋 Reusing existing tenant organization...');
            console.log(`   Name: ${organization.name}`);
            console.log(`   ID: ${organization._id}`);
            console.log(`   Slug: ${organization.slug || expectedSlug}`);
        } else {
            console.log('\n📋 Creating tenant organization...');
            organization = new Organization({
            name: DEFAULT_ADMIN.organizationName,
            industry: DEFAULT_ADMIN.industry,
            isActive: true,
            isTenant: true, // Mark as tenant organization (required for feature checks)
            subscription: {
                status: 'active',
                tier: 'paid', // Updated to match new subscription tiers
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            },
            limits: {
                maxUsers: 999999,
                maxContacts: 999999,
                maxDeals: 999999,
                maxStorage: 999999
            },
            enabledModules: [
                'contacts',
                'deals',
                'tasks',
                'calendar',
                'reports',
                'settings',
                'users',
                'demo_requests',
                'instances'
            ],
            // Master organization starts with Sales, Audit, and Portal enabled
            enabledApps: [{
                appKey: 'SALES',
                status: 'ACTIVE',
                enabledAt: new Date()
            }, {
                appKey: 'AUDIT',
                status: 'ACTIVE',
                enabledAt: new Date()
            }, {
                appKey: 'PORTAL',
                status: 'ACTIVE',
                enabledAt: new Date()
            }]
            });

            await organization.save();
            console.log('✅ Tenant organization created');
            console.log(`   Name: ${organization.name}`);
            console.log(`   ID: ${organization._id}`);
        }

        await ensureDefaultCommunicationSettingsForOrganization(organization._id);

        // CRM organization will be created after admin user is created (to set assignedTo/accountManager)

        // Create Default Roles
        console.log('\n🔐 Creating default roles...');
        try {
            const roles = await Role.createDefaultRoles(organization._id);
            console.log('✅ Default roles created:', roles.length, 'roles');
            roles.forEach(role => {
                console.log(`   - ${role.name} (Level ${role.level})`);
            });
        } catch (roleError) {
            console.warn('⚠️  Failed to create default roles:', roleError.message);
        }

        // Hash password
        console.log('\n🔐 Hashing password...');
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

        // Create Admin User
        console.log('\n👤 Creating Admin User...');
        const { APP_KEYS } = require('../constants/appKeys');
        const { validateAppRole } = require('../utils/appAccessUtils');
        
        // Ensure Sales app is present in enabledApps (preserve any other enabled apps like AUDIT/PORTAL)
        if (!organization.enabledApps || !organization.enabledApps.some(app => {
            const appKey = typeof app === 'string' ? app : app.appKey;
            return appKey === APP_KEYS.SALES;
        })) {
            const existingApps = Array.isArray(organization.enabledApps) ? organization.enabledApps : [];
            organization.enabledApps = [
                ...existingApps,
                {
                    appKey: APP_KEYS.SALES,
                    status: 'ACTIVE',
                    enabledAt: new Date()
                }
            ];
            await organization.save();
            console.log('✅ Ensured organization.enabledApps includes SALES (existing apps preserved)');
        }
        
        // Ensure owner has Sales: ADMIN access
        const salesRoleKey = 'ADMIN';
        if (!validateAppRole(APP_KEYS.SALES, salesRoleKey)) {
            throw new Error(`Invalid Sales roleKey: ${salesRoleKey}`);
        }

        const adminUser = new User({
            username: DEFAULT_ADMIN.username,
            email: DEFAULT_ADMIN.email,
            password: hashedPassword,
            firstName: DEFAULT_ADMIN.firstName,
            lastName: DEFAULT_ADMIN.lastName,
            organizationId: organization._id,
            role: 'owner',
            isOwner: true,
            isPlatformAdmin: true,
            status: 'active',
            userType: 'INTERNAL',
            appAccess: [{
                appKey: APP_KEYS.SALES,
                roleKey: salesRoleKey, // Owner must have Sales: ADMIN
                status: 'ACTIVE',
                addedAt: new Date()
            }],
            allowedApps: [APP_KEYS.SALES] // Legacy field for backward compatibility
        });

        // Set all permissions to true for owner
        adminUser.setPermissionsByRole('owner');

        await adminUser.save();
        console.log('✅ Admin User created');
        console.log(`   Name: ${adminUser.firstName} ${adminUser.lastName}`);
        console.log(`   Email: ${adminUser.email}`);
        console.log(`   Role: ${adminUser.role}`);

        // Mark this org's Instance as internal so subscriptionBootstrapService and
        // ensureOrgSubscriptionForEnabledApps permanently treat it as ENTERPRISE /
        // unlimited / ACTIVE — including for any apps enabled later. Idempotent.
        console.log('\n🏢 Marking Instance as internal (Arivu master tenant)...');
        let instance = await Instance.findOne({ organizationId: organization._id });
        if (!instance) {
            instance = await Instance.create({
                organizationId: organization._id,
                status: INSTANCE_STATUS.ACTIVE,
                isInternal: true,
                source: 'MANUAL'
            });
            console.log(`   ✅ Instance created with isInternal=true, status=${instance.status}`);
        } else if (!instance.isInternal) {
            instance.isInternal = true;
            await instance.save();
            console.log('   ✅ Instance updated with isInternal=true');
        } else {
            console.log('   ✅ Instance already marked as internal');
        }

        // Success summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 DEFAULT ADMIN ACCOUNT CREATED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\n📝 LOGIN CREDENTIALS:\n');
        console.log(`   Email:    ${DEFAULT_ADMIN.email}`);
        console.log(`   Password: ${DEFAULT_ADMIN.password}`);
        console.log('\n⚠️  SECURITY WARNING:');
        console.log('   Please change this password immediately after first login!');
        console.log('   Go to Settings → Update Password\n');
        console.log('='.repeat(60));
        console.log('\n✅ You can now login at: http://localhost:5173');
        console.log('   Click "Admin Login" and use the credentials above.\n');

        await mongoose.connection.close();
        console.log('✅ Database connection closed\n');

    } catch (error) {
        console.error('\n❌ Error creating default admin:', error.message);
        console.error(error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run the script
createDefaultAdmin();

