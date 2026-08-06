'use strict';

/**
 * Resolve a user from a JWT access token with strict database routing.
 *
 * Isolation rules (no cross-DB leakage):
 * - JWT organizationId + org has dedicated DB → tenant DB only (never master User).
 * - JWT organizationId + org on master → master User only; orgId must match token.
 * - Legacy token without organizationId → master User only.
 *
 * Shared by auth middleware and SSE endpoints (query-token auth).
 *
 * Auth sessions (UserSession / JWT jti) always live on the **master** connection.
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { validateAuthSession } = require('../services/sessionService');

function getOrgUserModel(orgDbConnection) {
  if (orgDbConnection.models.User) {
    return orgDbConnection.models.User;
  }
  const UserModel = require('../models/User');
  const originalSchema = UserModel.schema;
  const UserSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);

  if (originalSchema.methods) {
    Object.keys(originalSchema.methods).forEach((methodName) => {
      UserSchema.methods[methodName] = originalSchema.methods[methodName];
    });
  }
  if (originalSchema.statics) {
    Object.keys(originalSchema.statics).forEach((staticName) => {
      UserSchema.statics[staticName] = originalSchema.statics[staticName];
    });
  }
  // Bound to org connection — do not also wrap with tenant proxy.
  return orgDbConnection.model('User', UserSchema);
}

function isActiveUser(user) {
  return !user?.status || user.status === 'active';
}

function isTransientDbError(err) {
  if (!err) return false;
  const name = String(err.name || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    name === 'MongoNetworkError'
    || name === 'MongoServerSelectionError'
    || name === 'MongoTimeoutError'
    || msg.includes('buffering timed out')
    || msg.includes('topology was destroyed')
    || msg.includes('econnrefused')
    || msg.includes('etimedout')
  );
}

function attachOrganizationId(user, organizationId) {
  if (!user.organizationId) {
    user.organizationId = organizationId;
  }
  return user;
}

async function findMasterUserById(userId, lean) {
  const select = '-password';
  // Prefer unwrapped master model so tenant ALS cannot redirect User lookups.
  const MasterUser = User.__masterModel || User;
  return lean
    ? MasterUser.findById(userId).select(select).lean()
    : MasterUser.findById(userId).select(select);
}

async function findTenantUserById(organizationId, userId, lean, databaseName) {
  const dbName = databaseName || (await Organization.findById(organizationId).select('database').lean())?.database?.name;
  if (!dbName) {
    return null;
  }

  const orgDbConnection = await dbConnectionManager.getOrganizationConnection(dbName);
  if (orgDbConnection.readyState !== 1 && typeof orgDbConnection.asPromise === 'function') {
    await orgDbConnection.asPromise();
  }
  const OrgUser = getOrgUserModel(orgDbConnection);
  const select = '-password';
  const tenantUser = lean
    ? await OrgUser.findById(userId).select(select).lean()
    : await OrgUser.findById(userId).select(select);

  if (!tenantUser) {
    return null;
  }

  return attachOrganizationId(tenantUser, organizationId);
}

/**
 * @param {string} token - JWT access token
 * @param {{ lean?: boolean }} [options]
 * @returns {Promise<object|null>}
 * @throws {{ status: number, code: string, message: string }} session or transient failures
 */
async function resolveUserFromToken(token, options = {}) {
  const { lean = false } = options;
  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }

  const userId = decoded.id;
  if (!userId) {
    return null;
  }

  let user = null;

  if (decoded.organizationId) {
    let organization;
    try {
      organization = await Organization.findById(decoded.organizationId)
        .select('database')
        .lean();
    } catch (err) {
      if (isTransientDbError(err)) {
        const e = new Error('Database temporarily unavailable');
        e.status = 503;
        e.code = 'DB_UNAVAILABLE';
        throw e;
      }
      throw err;
    }
    const hasDedicatedDb =
      !!organization?.database?.name && organization.database.initialized === true;

    if (hasDedicatedDb) {
      try {
        user = await findTenantUserById(
          decoded.organizationId,
          userId,
          lean,
          organization.database.name
        );
      } catch (err) {
        console.error('[resolveUserFromToken] Tenant user lookup failed:', err.message);
        if (isTransientDbError(err)) {
          const e = new Error('Tenant database temporarily unavailable');
          e.status = 503;
          e.code = 'TENANT_DB_UNAVAILABLE';
          throw e;
        }
        return null;
      }
    } else {
      user = await findMasterUserById(userId, lean);
      if (
        user &&
        user.organizationId &&
        String(user.organizationId) !== String(decoded.organizationId)
      ) {
        return null;
      }
      if (user) {
        user = attachOrganizationId(user, decoded.organizationId);
      }
    }
  } else {
    user = await findMasterUserById(userId, lean);
  }

  if (!user) {
    return null;
  }

  const orgId = user.organizationId || decoded.organizationId;
  if (!orgId) {
    return null;
  }
  if (!user.organizationId) {
    user.organizationId = orgId;
  }

  if (!isActiveUser(user)) {
    return null;
  }

  const sessionCheck = await validateAuthSession(user, decoded);
  if (!sessionCheck.ok) {
    const e = new Error(sessionCheck.code || 'SESSION_INVALID');
    e.status = 401;
    e.code = sessionCheck.code || 'SESSION_INVALID';
    throw e;
  }

  if (decoded.jti) {
    user._sessionJti = decoded.jti;
  }
  if (decoded.sv != null) {
    user._authSessionVersion = Number(decoded.sv);
  }

  if (decoded.userType) {
    user.userType = String(decoded.userType).toUpperCase();
  }
  if (decoded.activeExternalRoleId) {
    user.activeExternalRoleId = decoded.activeExternalRoleId;
  }

  return user;
}

module.exports = {
  resolveUserFromToken,
  getOrgUserModel
};
