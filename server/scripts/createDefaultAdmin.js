#!/usr/bin/env node

/**
 * Create Default Admin Account
 * 
 * This script creates a default admin user and organization for the platform owner.
 * Run this once when setting up your LiteDesk instance.
 * 
 * Usage: node scripts/createDefaultAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');

const MONGO_URI = process.env.MONGO_URI;

// Default Admin Credentials
const DEFAULT_ADMIN = {
    email: 'prabhu@litedesk.com',
    password: 'Admin@123',  // CHANGE THIS IN PRODUCTION!
    username: 'Prabhu Balu',
    firstName: 'Prabhu',
    lastName: 'Balu',
    organizationName: 'LiteDesk Master',
    industry: 'Technology'
};

async function createDefaultAdmin() {
    try {
        console.log('🚀 Creating Default Admin Account...\n');

        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN.email });
        if (existingAdmin) {
            console.log('⚠️  Admin user already exists!');
            console.log(`   Email: ${DEFAULT_ADMIN.email}`);
            console.log('\n   To reset, delete the user first or change the email in this script.');
            await mongoose.connection.close();
            return;
        }

        // Create Master Organization
        console.log('\n📋 Creating Master Organization...');
        const organization = new Organization({
            name: DEFAULT_ADMIN.organizationName,
            industry: DEFAULT_ADMIN.industry,
            isActive: true,
            subscription: {
                status: 'active',
                tier: 'enterprise',
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
            ]
        });

        await organization.save();
        console.log('✅ Master Organization created');
        console.log(`   Name: ${organization.name}`);
        console.log(`   ID: ${organization._id}`);

        // Hash password
        console.log('\n🔐 Hashing password...');
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

        // Create Admin User
        console.log('\n👤 Creating Admin User...');
        const adminUser = new User({
            username: DEFAULT_ADMIN.username,
            email: DEFAULT_ADMIN.email,
            password: hashedPassword,
            firstName: DEFAULT_ADMIN.firstName,
            lastName: DEFAULT_ADMIN.lastName,
            organizationId: organization._id,
            role: 'owner',
            isOwner: true,
            status: 'active'
        });

        // Set all permissions to true for owner
        adminUser.setPermissionsByRole('owner');

        await adminUser.save();
        console.log('✅ Admin User created');
        console.log(`   Name: ${adminUser.firstName} ${adminUser.lastName}`);
        console.log(`   Email: ${adminUser.email}`);
        console.log(`   Role: ${adminUser.role}`);

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

