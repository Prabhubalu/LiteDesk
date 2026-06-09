'use strict';

const jwt = require('jsonwebtoken');
const DemoRequest = require('../models/DemoRequest');
const InstanceRegistry = require('../models/InstanceRegistry');
const { buildOrgCapabilities } = require('../utils/orgCapabilities');
const { materializeEffectiveCRMEnvelopeOnUser } = require('../utils/rolePermissionProjection');
const {
  ensureOnboardingStarted,
  syncAutomaticCompletions,
  buildLoginOnboardingSummary
} = require('./onboardingService');

function generateToken(id, organizationId = null) {
  if (!process.env.JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not set!');
  }
  const payload = { id };
  if (organizationId) {
    payload.organizationId = organizationId.toString();
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
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
  } catch (err) {
    console.warn('[authSessionService] Instance resolution failed:', err.message);
  }

  return null;
}

function deriveAllowedApps(user) {
  if (Array.isArray(user.allowedApps) && user.allowedApps.length > 0) {
    return user.allowedApps;
  }
  if (Array.isArray(user.appAccess) && user.appAccess.length > 0) {
    return user.appAccess
      .filter((access) => access.status === 'ACTIVE')
      .map((access) => access.appKey);
  }
  return ['SALES'];
}

/**
 * Build the same auth payload returned by POST /api/auth/login.
 */
async function buildAuthSessionPayload(user, organization, options = {}) {
  const orgUser = user;
  const organizationForLogin = organization;

  if (options.markLogin !== false) {
    orgUser.lastLogin = new Date();
  }

  await materializeEffectiveCRMEnvelopeOnUser(orgUser);
  await ensureOnboardingStarted(orgUser);
  await syncAutomaticCompletions(orgUser, organizationForLogin);

  const allowedApps = deriveAllowedApps(orgUser);
  const instanceContext = await resolveInstanceForLogin(
    organizationForLogin?._id,
    orgUser.email
  );

  return {
    _id: orgUser._id,
    username: orgUser.username,
    email: orgUser.email,
    firstName: orgUser.firstName,
    lastName: orgUser.lastName,
    role: orgUser.role,
    isOwner: orgUser.isOwner,
    isPlatformAdmin: orgUser.isPlatformAdmin === true,
    permissions: orgUser.permissions,
    allowedApps,
    appAccess: orgUser.appAccess,
    organization: {
      _id: organizationForLogin._id,
      name: organizationForLogin.name,
      industry: organizationForLogin.industry,
      subscription: organizationForLogin.subscription,
      limits: organizationForLogin.limits,
      enabledApps: organizationForLogin.enabledApps || [],
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
    emailVerifiedAt: orgUser.emailVerifiedAt || null,
    requiresEmailVerification: !orgUser.emailVerifiedAt,
    mustChangePassword: orgUser.mustChangePassword === true,
    onboarding: buildLoginOnboardingSummary(orgUser)
  };
}

module.exports = {
  generateToken,
  buildAuthSessionPayload,
  deriveAllowedApps,
  resolveInstanceForLogin
};
