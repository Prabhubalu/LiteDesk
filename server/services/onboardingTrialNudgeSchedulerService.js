'use strict';

const Organization = require('../models/Organization');
const User = require('../models/User');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { countOrgPeople, countOrgActiveUsers } = require('./onboardingService');
const { sendTrialNudgeEmail } = require('./onboardingTrialEmailService');

const NUDGE_DAYS = [1, 3, 7];

function resolveUserModel(connection) {
  return connection?.models?.User || User;
}

function daysSince(date) {
  if (!date) return null;
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return null;
  return Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function hasNudgeBeenSent(organization, day) {
  const sent = organization?.onboarding?.trialNudgesSent || [];
  return sent.some((entry) => entry.day === day);
}

function shouldSendNudge(day, peopleCount, activeUsers) {
  if (day === 1) return true;
  if (day === 3) return peopleCount === 0;
  if (day === 7) return activeUsers <= 1;
  return false;
}

function ctaPathForDay(day) {
  if (day === 1) return '/onboarding';
  if (day === 3) return '/dashboard/sales';
  return '/settings?tab=users';
}

/**
 * Send trial onboarding nudges on day 1, 3, and 7 (conditional for 3 and 7).
 * @returns {Promise<{ tenantsProcessed: number, sent: number, skipped: number, errors: number }>}
 */
async function tickTrialOnboardingNudges() {
  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'subscription.status': 'trial',
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id name subscription.trialStartDate onboarding database.name')
    .lean();

  let tenantsProcessed = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    const elapsedDays = daysSince(tenant.subscription?.trialStartDate);
    if (elapsedDays === null) {
      skipped += 1;
      continue;
    }

    const dayToSend = NUDGE_DAYS.find((day) => elapsedDays >= day && !hasNudgeBeenSent(tenant, day));
    if (!dayToSend) {
      skipped += 1;
      continue;
    }

    let conn;
    try {
      conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
    } catch (err) {
      errors += 1;
      console.error(`[trialNudgeScheduler] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const ScopedUser = resolveUserModel(conn);
          const orgDoc = await Organization.findById(tenant._id);
          if (!orgDoc) return;

          const peopleCount = await countOrgPeople(tenant._id);
          const activeUsers = await countOrgActiveUsers(orgDoc);

          if (!shouldSendNudge(dayToSend, peopleCount, activeUsers)) {
            if (!orgDoc.onboarding) orgDoc.onboarding = {};
            orgDoc.onboarding.trialNudgesSent = [
              ...(orgDoc.onboarding.trialNudgesSent || []),
              { day: dayToSend, sentAt: new Date() }
            ];
            await orgDoc.save();
            skipped += 1;
            return;
          }

          const owner = await ScopedUser.findOne({
            organizationId: tenant._id,
            isOwner: true,
            status: 'active'
          })
            .select('email firstName lastName username')
            .lean();

          if (!owner?.email) {
            skipped += 1;
            return;
          }

          const result = await sendTrialNudgeEmail({
            day: dayToSend,
            user: owner,
            organizationName: tenant.name,
            ctaPath: ctaPathForDay(dayToSend)
          });

          if (result.success) {
            if (!orgDoc.onboarding) orgDoc.onboarding = {};
            orgDoc.onboarding.trialNudgesSent = [
              ...(orgDoc.onboarding.trialNudgesSent || []),
              { day: dayToSend, sentAt: new Date() }
            ];
            await orgDoc.save();
            sent += 1;
          } else if (result.skipped) {
            skipped += 1;
          } else {
            errors += 1;
          }
        }
      );
      tenantsProcessed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[trialNudgeScheduler] tenant ${tenant._id} failed:`, err.message);
    }
  }

  return { tenantsProcessed, sent, skipped, errors };
}

module.exports = {
  tickTrialOnboardingNudges,
  NUDGE_DAYS
};
