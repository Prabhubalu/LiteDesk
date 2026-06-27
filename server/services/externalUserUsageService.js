'use strict';

/**
 * External user usage counter (V1 — collect only, no seat blocking).
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md §12
 */

const Organization = require('../models/Organization');
const People = require('../models/People');
const { getScopedUserModel } = require('./userInviteService');

async function incrementActiveExternalUsers(organizationId) {
  await Organization.findByIdAndUpdate(organizationId, {
    $inc: { 'usage.externalUsers.active': 1 },
    $set: { 'usage.externalUsers.lastUpdatedAt': new Date() }
  });
}

async function decrementActiveExternalUsers(organizationId) {
  await Organization.findByIdAndUpdate(organizationId, {
    $inc: { 'usage.externalUsers.active': -1 },
    $set: { 'usage.externalUsers.lastUpdatedAt': new Date() }
  });
}

async function countActiveExternalPortalUsers(organizationId, tenantOrg) {
  const people = await People.find({
    organizationId,
    'portalAccess.enabled': true,
    deletedAt: null
  })
    .select('portalAccess.userId')
    .lean();

  const userIds = [
    ...new Set(people.map((person) => person.portalAccess?.userId).filter(Boolean))
  ];
  if (!userIds.length) {
    return 0;
  }

  const ScopedUser = await getScopedUserModel(tenantOrg);
  return ScopedUser.countDocuments({
    _id: { $in: userIds },
    organizationId,
    userType: 'EXTERNAL',
    status: 'active'
  });
}

async function syncExternalUserUsageCount(organizationId, tenantOrg) {
  const active = await countActiveExternalPortalUsers(organizationId, tenantOrg);
  await Organization.findByIdAndUpdate(organizationId, {
    $set: {
      'usage.externalUsers.active': Math.max(0, active),
      'usage.externalUsers.lastUpdatedAt': new Date()
    }
  });
  return active;
}

async function getExternalUserUsage(organizationId) {
  const org = await Organization.findById(organizationId).select('usage limits').lean();
  return {
    active: Math.max(0, org?.usage?.externalUsers?.active ?? 0),
    lastUpdatedAt: org?.usage?.externalUsers?.lastUpdatedAt || null,
    limits: {
      externalUserSeats: org?.limits?.externalUserSeats ?? null
    }
  };
}

module.exports = {
  incrementActiveExternalUsers,
  decrementActiveExternalUsers,
  countActiveExternalPortalUsers,
  syncExternalUserUsageCount,
  getExternalUserUsage
};
