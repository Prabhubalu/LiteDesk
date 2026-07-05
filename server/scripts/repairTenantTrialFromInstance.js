#!/usr/bin/env node
'use strict';

/**
 * Repair tenant trial state from InstanceRegistry when org/subscription drifted.
 *
 * Usage:
 *   node server/scripts/repairTenantTrialFromInstance.js --subdomain=my-tenant
 *   node server/scripts/repairTenantTrialFromInstance.js --email=owner@example.com
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const InstanceRegistry = require('../models/InstanceRegistry');
const Organization = require('../models/Organization');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const UserDirectory = require('../models/UserDirectory');
const Instance = require('../models/Instance');
const { INSTANCE_STATUS } = require('../constants/instanceLifecycle');
const {
    applyTrialEndDateToOrgSubscription,
    reconcileOrgSubscriptionWithOrganizationTrial
} = require('../services/trialExtensionService');

async function resolveOrganizationForInstance(instance) {
    if (!instance) return null;

    if (instance.demoRequestId) {
        const DemoRequest = require('../models/DemoRequest');
        const demo = await DemoRequest.findById(instance.demoRequestId)
            .select('organizationId')
            .lean();
        if (demo?.organizationId) {
            return Organization.findById(demo.organizationId);
        }
    }

    const dbName = instance.databaseConnection?.database;
    if (dbName) {
        const byDatabase = await Organization.findOne({ 'database.name': dbName });
        if (byDatabase) return byDatabase;
    }

    if (instance.ownerEmail) {
        const directoryEntry = await UserDirectory.findOne({
            email: String(instance.ownerEmail).toLowerCase().trim(),
            status: 'active'
        })
            .select('organizationId')
            .lean();
        if (directoryEntry?.organizationId) {
            return Organization.findById(directoryEntry.organizationId);
        }
    }

    return null;
}

async function main() {
    const subdomainArg = process.argv.find((arg) => arg.startsWith('--subdomain='));
    const emailArg = process.argv.find((arg) => arg.startsWith('--email='));
    const subdomain = subdomainArg ? subdomainArg.split('=')[1] : null;
    const email = emailArg ? emailArg.split('=')[1] : null;

    if (!subdomain && !email) {
        console.error('Provide --subdomain=<name> or --email=<owner email>');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const filter = subdomain
        ? { subdomain: String(subdomain).toLowerCase().trim() }
        : { ownerEmail: String(email).toLowerCase().trim() };

    const instance = await InstanceRegistry.findOne(filter);
    if (!instance) {
        console.error('Instance not found for filter:', filter);
        process.exit(1);
    }

    const trialEndDate = instance.subscription?.trialEndDate;
    if (!trialEndDate) {
        console.error('Instance has no trialEndDate to sync');
        process.exit(1);
    }

    const organization = await resolveOrganizationForInstance(instance);
    if (!organization) {
        console.error('Tenant organization not found for instance', instance.subdomain);
        process.exit(1);
    }

    const trialStillActive = new Date(trialEndDate) > new Date();
    organization.subscription.trialEndDate = trialEndDate;
    if (trialStillActive) {
        organization.subscription.status = 'trial';
        organization.subscription.tier = 'trial';
    }
    await organization.save();

    const orgSubscription = await OrganizationSubscription.findOne({ organizationId: organization._id });
    if (orgSubscription) {
        applyTrialEndDateToOrgSubscription(orgSubscription, trialEndDate);
        reconcileOrgSubscriptionWithOrganizationTrial(organization, orgSubscription);
        await orgSubscription.save();
    }

    if (trialStillActive) {
        if (instance.status === 'suspended') {
            instance.status = 'active';
            instance.suspendedAt = undefined;
        }
        instance.subscription.status = 'trial';
        await instance.save();

        await Instance.updateOne(
            {
                organizationId: organization._id,
                status: { $in: [INSTANCE_STATUS.SUSPENDED] }
            },
            { $set: { status: INSTANCE_STATUS.TRIAL } }
        );
    }

    console.log('Repaired tenant trial state:', {
        subdomain: instance.subdomain,
        organizationId: String(organization._id),
        trialEndDate: new Date(trialEndDate).toISOString(),
        trialStillActive,
        orgStatus: organization.subscription.status
    });

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch (_error) {
        /* ignore */
    }
    process.exit(1);
});
