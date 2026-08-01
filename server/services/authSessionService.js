'use strict';

const jwt = require('jsonwebtoken');
const DemoRequest = require('../models/DemoRequest');
const InstanceRegistry = require('../models/InstanceRegistry');
const { buildOrgCapabilities } = require('../utils/orgCapabilities');
const {
  materializeEffectiveCRMEnvelopeOnUser,
  userPermissionsEnvelopeToPlain
} = require('../utils/rolePermissionProjection');
const {
  ensureOnboardingStarted,
  syncAutomaticCompletions,
  buildLoginOnboardingSummary
} = require('./onboardingService');
const { buildClientSessionEntitlements } = require('../utils/clientSessionEntitlements');
const {
  serializePortalsForClient
} = require('./externalRoleSessionService');
const { normalizeSessionVersion } = require('./sessionService');

function generateToken(id, organizationId = null, sessionClaims = {}) {
  if (!process.env.JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not set!');
  }
  const payload = { id };
  if (organizationId) {
    payload.organizationId = organizationId.toString();
  }
  if (sessionClaims.userType) {
    payload.userType = String(sessionClaims.userType).toUpperCase();
  }
  if (sessionClaims.activeExternalRoleId) {
    payload.activeExternalRoleId = String(sessionClaims.activeExternalRoleId);
  }
  if (sessionClaims.jti) {
    payload.jti = String(sessionClaims.jti);
  }
  if (sessionClaims.sessionVersion != null) {
    payload.sv = normalizeSessionVersion(sessionClaims.sessionVersion);
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
}

/**
 * @deprecated Use generateToken with sessionClaims — kept for callers passing org id only.
 */
function generateSessionToken({ userId, organizationId, userType, activeExternalRoleId }) {
  return generateToken(userId, organizationId, { userType, activeExternalRoleId });
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

      const organization = await require('../models/Organization')
        .findById(organizationId)
        .select('database')
        .lean();
      const dbName = organization?.database?.name;
      if (dbName) {
        const fallbackByDatabase = await InstanceRegistry.findOne({
          'databaseConnection.database': dbName
        })
          .sort({ updatedAt: -1 })
          .select('subdomain urls status')
          .lean();

        if (fallbackByDatabase) {
          return {
            subdomain: fallbackByDatabase.subdomain || null,
            frontendUrl: fallbackByDatabase.urls?.frontend || null,
            apiUrl: fallbackByDatabase.urls?.api || null,
            status: fallbackByDatabase.status || null
          };
        }
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
 * Build login/select/switch response payload (shared shape with POST /api/auth/login).
 */
async function buildAuthenticatedSessionResponse(orgUser, organizationForLogin, options = {}) {
  const {
    activeExternalRoleId = orgUser.activeExternalRoleId || null,
    requiresPortalSelection = false,
    portals = [],
    activePortal = null,
    markLogin = false,
    sessionMeta = {},
    sessionIds = null,
    issueSession = true
  } = options;

  if (markLogin) {
    orgUser.lastLogin = new Date();
  }

  const userType = String(orgUser.userType || 'INTERNAL').toUpperCase();
  if (userType === 'EXTERNAL' && activeExternalRoleId) {
    orgUser.activeExternalRoleId = activeExternalRoleId;
    await materializeEffectiveCRMEnvelopeOnUser(orgUser, {
      organization: organizationForLogin,
      activeExternalRoleId
    });
  } else if (userType !== 'EXTERNAL') {
    await materializeEffectiveCRMEnvelopeOnUser(orgUser, { organization: organizationForLogin });
  }

  if (markLogin) {
    await ensureOnboardingStarted(orgUser);
    await syncAutomaticCompletions(orgUser, organizationForLogin);
  }

  const allowedApps = deriveAllowedApps(orgUser);
  const instanceContext = await resolveInstanceForLogin(
    organizationForLogin?._id,
    orgUser.email
  );
  const entitledAddons = await buildClientSessionEntitlements(orgUser, organizationForLogin._id);

  let issuedSession = sessionIds;
  if (issueSession && !issuedSession) {
    const { issueAuthSession } = require('./sessionService');
    issuedSession = await issueAuthSession(orgUser, organizationForLogin, sessionMeta);
  } else if (issuedSession?.jti) {
    const { touchAuthSession } = require('./sessionService');
    void touchAuthSession(issuedSession.jti);
  }

  return {
    _id: orgUser._id,
    username: orgUser.username,
    email: orgUser.email,
    firstName: orgUser.firstName,
    lastName: orgUser.lastName,
    language: orgUser.language || null,
    timeZone: orgUser.timeZone || null,
    dateFormat: orgUser.dateFormat || null,
    timeFormat: orgUser.timeFormat || null,
    displayPreferences: orgUser.displayPreferences || null,
    role: orgUser.role,
    userType,
    isOwner: orgUser.isOwner,
    isPlatformAdmin: orgUser.isPlatformAdmin === true,
    permissions: userPermissionsEnvelopeToPlain(orgUser),
    allowedApps,
    entitledAddons,
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
      database: organizationForLogin.database
        ? {
            name: organizationForLogin.database.name,
            initialized: organizationForLogin.database.initialized
          }
        : null,
      capabilities: buildOrgCapabilities(organizationForLogin)
    },
    instance: instanceContext,
    token: generateToken(orgUser._id, organizationForLogin._id, {
      userType,
      activeExternalRoleId: activeExternalRoleId || undefined,
      jti: issuedSession?.jti,
      sessionVersion: issuedSession?.sessionVersion
    }),
    emailVerifiedAt: orgUser.emailVerifiedAt || null,
    requiresEmailVerification: !orgUser.emailVerifiedAt,
    mustChangePassword: orgUser.mustChangePassword === true,
    onboarding: buildLoginOnboardingSummary(orgUser),
    requiresPortalSelection: requiresPortalSelection === true,
    portals: serializePortalsForClient(portals),
    activeExternalRoleId: activeExternalRoleId || null,
    activePortal: activePortal
      ? {
          roleId: activePortal.roleId,
          name: activePortal.name
        }
      : null
  };
}

/**
 * Build the same auth payload returned by POST /api/auth/login.
 */
async function buildAuthSessionPayload(user, organization, options = {}) {
  return buildAuthenticatedSessionResponse(user, organization, options);
}

module.exports = {
  generateToken,
  generateSessionToken,
  buildAuthSessionPayload,
  buildAuthenticatedSessionResponse,
  deriveAllowedApps,
  resolveInstanceForLogin
};
