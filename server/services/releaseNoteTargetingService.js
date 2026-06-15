'use strict';

/**
 * Active app keys from organization subscription (fallback when user has no appAccess).
 * @param {Record<string, unknown> | null} organization
 * @returns {string[]}
 */
function getOrganizationAppKeys(organization) {
  const keys = new Set();
  const enabledApps = organization?.enabledApps;
  if (!Array.isArray(enabledApps)) return [];

  for (const entry of enabledApps) {
    if (typeof entry === 'object' && entry?.appKey) {
      if (String(entry.status || 'ACTIVE').toUpperCase() === 'ACTIVE') {
        keys.add(String(entry.appKey));
      }
    } else if (typeof entry === 'string' && entry) {
      keys.add(String(entry));
    }
  }

  return [...keys];
}

/**
 * Resolve active app keys for a user (appAccess + allowedApps + org enabledApps fallback).
 * @param {import('mongoose').Document | Record<string, unknown>} user
 * @param {Record<string, unknown> | null} [organization]
 * @returns {string[]}
 */
function getUserAppKeys(user, organization = null) {
  const keys = new Set();

  if (Array.isArray(user?.appAccess)) {
    for (const entry of user.appAccess) {
      if (String(entry?.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && entry?.appKey) {
        keys.add(String(entry.appKey));
      }
    }
  }

  if (Array.isArray(user?.allowedApps)) {
    for (const appKey of user.allowedApps) {
      if (appKey) keys.add(String(appKey));
    }
  }

  if (!keys.size) {
    for (const appKey of getOrganizationAppKeys(organization)) {
      keys.add(appKey);
    }
  }

  return [...keys];
}

/**
 * @param {import('mongoose').Document | Record<string, unknown>} organization
 * @returns {'trial' | 'paid'}
 */
function getOrganizationPlanTier(organization) {
  const tier = organization?.subscription?.tier;
  if (tier === 'paid') return 'paid';
  return 'trial';
}

/**
 * @param {Record<string, unknown>} releaseNote
 * @param {string[]} userAppKeys
 * @returns {boolean}
 */
function releaseMatchesApps(releaseNote, userAppKeys) {
  const targets = releaseNote?.targetApps || [];
  if (!targets.length) return true;
  return targets.some((appKey) => userAppKeys.includes(appKey));
}

/**
 * @param {Record<string, unknown>} releaseNote
 * @param {'trial' | 'paid'} planTier
 * @returns {boolean}
 */
function releaseMatchesPlans(releaseNote, planTier) {
  const targets = releaseNote?.targetPlans || [];
  if (!targets.length) return true;
  return targets.includes(planTier);
}

/**
 * @param {{ user: Record<string, unknown>, organization: Record<string, unknown> | null, releaseNote: Record<string, unknown> }} params
 * @returns {boolean}
 */
function userMatchesReleaseTargeting({ user, organization, releaseNote }) {
  if (!releaseNote) return false;
  const userAppKeys = getUserAppKeys(user, organization);
  const planTier = getOrganizationPlanTier(organization);
  return releaseMatchesApps(releaseNote, userAppKeys)
    && releaseMatchesPlans(releaseNote, planTier);
}

/**
 * Build a MongoDB user filter for audience preview / stats (master User collection).
 * @param {Record<string, unknown>} releaseNote
 * @param {import('mongoose').Types.ObjectId[]} organizationIds
 * @returns {Record<string, unknown>}
 */
function buildTargetedUserQuery(releaseNote, organizationIds) {
  const query = {
    organizationId: { $in: organizationIds },
    status: 'active'
  };

  const targetApps = releaseNote?.targetApps || [];
  if (targetApps.length) {
    query.$or = [
      {
        appAccess: {
          $elemMatch: {
            appKey: { $in: targetApps },
            status: 'ACTIVE'
          }
        }
      },
      { allowedApps: { $in: targetApps } }
    ];
  }

  return query;
}

/**
 * Build org filter for plan targeting.
 * @param {Record<string, unknown>} releaseNote
 * @returns {Record<string, unknown>}
 */
function buildTargetedOrganizationQuery(releaseNote) {
  const query = { isTenant: true };
  const targetPlans = releaseNote?.targetPlans || [];
  if (targetPlans.length === 1) {
    query['subscription.tier'] = targetPlans[0];
  } else if (targetPlans.length > 1) {
    query['subscription.tier'] = { $in: targetPlans };
  }
  return query;
}

module.exports = {
  getUserAppKeys,
  getOrganizationPlanTier,
  releaseMatchesApps,
  releaseMatchesPlans,
  userMatchesReleaseTargeting,
  buildTargetedUserQuery,
  buildTargetedOrganizationQuery
};
