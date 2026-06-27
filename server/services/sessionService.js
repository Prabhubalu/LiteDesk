'use strict';

/**
 * Auth session store — JWT jti/sv validation, concurrent limits, revocation.
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md §11
 */

const crypto = require('crypto');
const UserSession = require('../models/UserSession');

function normalizeSessionVersion(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function resolveMaxConcurrentSessions(organization) {
  const configured = organization?.security?.sessionRules?.maxConcurrentSessions;
  if (typeof configured === 'number' && configured > 0) {
    return configured;
  }
  return 5;
}

async function issueAuthSession(user, organization, meta = {}) {
  const organizationId = organization?._id || user.organizationId;
  const jti = crypto.randomUUID();
  const sessionVersion = normalizeSessionVersion(user.authSessionVersion);

  await UserSession.create({
    organizationId,
    userId: user._id,
    sessionId: jti,
    authSessionVersion: sessionVersion,
    userType: String(user.userType || 'INTERNAL').toUpperCase(),
    ipAddress: meta.ip || null,
    userAgent: meta.userAgent || null,
    issuedAt: new Date(),
    lastSeenAt: new Date()
  });

  await enforceConcurrentSessionLimit(user, organization);
  return { jti, sessionVersion };
}

async function enforceConcurrentSessionLimit(user, organization) {
  const max = resolveMaxConcurrentSessions(organization);
  const organizationId = organization?._id || user.organizationId;
  const active = await UserSession.find({
    organizationId,
    userId: user._id,
    revokedAt: null
  })
    .sort({ issuedAt: 1 })
    .select('sessionId')
    .lean();

  if (active.length <= max) {
    return;
  }

  const excess = active.length - max;
  const toRevoke = active.slice(0, excess).map((session) => session.sessionId);
  if (!toRevoke.length) {
    return;
  }

  await UserSession.updateMany(
    { sessionId: { $in: toRevoke } },
    { $set: { revokedAt: new Date() } }
  );
}

async function touchAuthSession(sessionId) {
  if (!sessionId) {
    return;
  }
  await UserSession.updateOne(
    { sessionId, revokedAt: null },
    { $set: { lastSeenAt: new Date() } }
  ).catch(() => {});
}

async function validateAuthSession(user, decoded) {
  const tokenSv = decoded?.sv;
  const tokenJti = decoded?.jti;
  const userSv = normalizeSessionVersion(user.authSessionVersion);

  if (tokenSv == null && !tokenJti) {
    return { ok: true, legacy: true };
  }

  if (tokenSv != null && normalizeSessionVersion(tokenSv) !== userSv) {
    return { ok: false, code: 'SESSION_REVOKED' };
  }

  if (tokenJti) {
    const session = await UserSession.findOne({
      sessionId: tokenJti,
      userId: user._id,
      revokedAt: null
    })
      .select('_id')
      .lean();

    if (!session) {
      return { ok: false, code: 'SESSION_INVALID' };
    }

    void touchAuthSession(tokenJti);
  }

  return { ok: true };
}

async function revokeAllUserSessions(user, organizationId) {
  const nextVersion = normalizeSessionVersion(user.authSessionVersion) + 1;
  user.authSessionVersion = nextVersion;
  await user.save();

  const orgId = organizationId || user.organizationId;
  await UserSession.updateMany(
    { organizationId: orgId, userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return { authSessionVersion: nextVersion };
}

async function revokeUserSessionsByUserId(userId, organizationId, tenantOrg) {
  const { getScopedUserModel } = require('./userInviteService');
  const ScopedUser = await getScopedUserModel(tenantOrg);
  const user = await ScopedUser.findById(userId);
  if (!user) {
    return { ok: false, revoked: false };
  }

  const result = await revokeAllUserSessions(user, organizationId);
  return { ok: true, revoked: true, ...result };
}

module.exports = {
  normalizeSessionVersion,
  resolveMaxConcurrentSessions,
  issueAuthSession,
  enforceConcurrentSessionLimit,
  validateAuthSession,
  touchAuthSession,
  revokeAllUserSessions,
  revokeUserSessionsByUserId
};
