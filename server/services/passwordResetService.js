'use strict';

const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');
const UserDirectory = require('../models/UserDirectory');
const {
  generateRawToken,
  hashToken,
  getPasswordResetExpiry,
  isTokenExpired
} = require('../utils/userAuthTokens');
const { sendPasswordResetEmail } = require('./userAccountEmailService');
const {
  getScopedUserModel,
  syncDirectoryEntry
} = require('./userInviteService');

async function resolveActiveUserByEmail(normalizedEmail) {
  if (!normalizedEmail) return null;

  let organization = null;
  const masterUser = await User.findOne({ email: normalizedEmail });

  if (masterUser?.organizationId) {
    organization = await Organization.findById(masterUser.organizationId);
  }

  if (!masterUser) {
    const directoryEntry = await UserDirectory.findOne({
      email: normalizedEmail,
      status: 'active'
    });
    if (directoryEntry?.organizationId) {
      organization = await Organization.findById(directoryEntry.organizationId);
    }
  }

  if (!organization) {
    const tenantOrgs = await Organization.find({
      'database.initialized': true,
      'database.name': { $exists: true, $ne: null }
    }).select('_id name database');

    for (const tenantOrg of tenantOrgs) {
      try {
        const ScopedUser = await getScopedUserModel(tenantOrg);
        const discoveredUser = await ScopedUser.findOne({ email: normalizedEmail }).select('_id status');
        if (discoveredUser) {
          organization = tenantOrg;
          await UserDirectory.findOneAndUpdate(
            { email: normalizedEmail },
            {
              $set: {
                organizationId: tenantOrg._id,
                tenantDatabaseName: tenantOrg.database.name,
                tenantUserId: discoveredUser._id,
                status: 'active'
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          break;
        }
      } catch (discoveryError) {
        console.warn(`[passwordReset] Tenant discovery skipped for ${tenantOrg.database?.name}:`, discoveryError.message);
      }
    }
  }

  if (!organization) return null;

  const ScopedUser = await getScopedUserModel(organization);
  const user = await ScopedUser.findOne({ email: normalizedEmail });
  if (!user || user.status !== 'active') return null;

  return { user, organization, ScopedUser };
}

async function resolveUserByPasswordResetToken(tokenHash) {
  const directoryEntry = await UserDirectory.findOne({ passwordResetTokenHash: tokenHash });
  if (directoryEntry?.organizationId) {
    const organization = await Organization.findById(directoryEntry.organizationId);
    if (organization) {
      const ScopedUser = await getScopedUserModel(organization);
      const user = await ScopedUser.findById(directoryEntry.tenantUserId);
      if (user && user.passwordResetTokenHash === tokenHash) {
        return { user, organization, ScopedUser };
      }
    }
  }

  const masterMatches = await User.find({
    passwordResetTokenHash: tokenHash,
    status: 'active'
  }).limit(10);

  for (const masterUser of masterMatches) {
    const organization = await Organization.findById(masterUser.organizationId);
    if (!organization) continue;

    const ScopedUser = await getScopedUserModel(organization);
    const user = ScopedUser === User
      ? masterUser
      : await ScopedUser.findOne({
        _id: masterUser._id,
        passwordResetTokenHash: tokenHash,
        status: 'active'
      });

    if (!user) continue;

    await syncDirectoryEntry(user.email, {
      organizationId: organization._id,
      tenantDatabaseName: organization.database?.name || null,
      tenantUserId: user._id,
      passwordResetTokenHash: tokenHash,
      status: 'active'
    });

    return { user, organization, ScopedUser };
  }

  return null;
}

async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Email is required' };
  }

  const resolved = await resolveActiveUserByEmail(normalizedEmail);
  if (!resolved) {
    return { ok: true, sent: false, skipped: true };
  }

  const { user, organization } = resolved;
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = getPasswordResetExpiry();
  await user.save();

  await syncDirectoryEntry(user.email, {
    organizationId: organization._id,
    tenantDatabaseName: organization.database?.name || null,
    tenantUserId: user._id,
    passwordResetTokenHash: tokenHash,
    status: 'active'
  });

  const emailResult = await sendPasswordResetEmail({
    to: user.email,
    user,
    organizationId: organization._id,
    organizationName: organization.name,
    resetToken: rawToken
  });

  return {
    ok: true,
    sent: emailResult.success === true,
    skipped: emailResult.skipped === true,
    reason: emailResult.reason || null
  };
}

async function validateResetToken(rawToken) {
  if (!rawToken) {
    return { valid: false, code: 'TOKEN_INVALID' };
  }

  const tokenHash = hashToken(rawToken);
  const resolved = await resolveUserByPasswordResetToken(tokenHash);
  if (!resolved) {
    return { valid: false, code: 'TOKEN_INVALID' };
  }

  const { user } = resolved;
  if (isTokenExpired(user.passwordResetExpiresAt)) {
    return { valid: false, code: 'TOKEN_EXPIRED' };
  }

  return {
    valid: true,
    email: user.email
  };
}

async function resetPassword({ rawToken, password }) {
  if (!rawToken || !password) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Token and password are required' };
  }
  if (String(password).length < 8) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' };
  }

  const tokenHash = hashToken(rawToken);
  const resolved = await resolveUserByPasswordResetToken(tokenHash);
  if (!resolved) {
    return { ok: false, code: 'TOKEN_INVALID', message: 'Password reset link is invalid' };
  }

  const { user, organization } = resolved;
  if (isTokenExpired(user.passwordResetExpiresAt)) {
    return { ok: false, code: 'TOKEN_EXPIRED', message: 'This password reset link has expired' };
  }

  user.password = await bcrypt.hash(password, 10);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.mustChangePassword = false;
  await user.save();

  await syncDirectoryEntry(user.email, {
    passwordResetTokenHash: null
  });

  return {
    ok: true,
    email: user.email,
    organizationName: organization.name
  };
}

module.exports = {
  requestPasswordReset,
  validateResetToken,
  resetPassword
};
