'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');
const UserDirectory = require('../models/UserDirectory');
const {
  generateRawToken,
  hashToken,
  getInviteExpiry,
  getVerificationExpiry,
  isTokenExpired
} = require('../utils/userAuthTokens');
const { sendInviteEmail, sendVerificationEmail } = require('./userAccountEmailService');
const { generateSecurePassword } = require('./provisioning/utils/passwordGenerator');

function cloneUserSchema(connection) {
  if (connection.models.User) {
    return connection.models.User;
  }
  const originalSchema = User.schema;
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
  return connection.model('User', UserSchema);
}

async function getScopedUserModel(organization) {
  if (organization?.database?.name && organization.database.initialized) {
    const dbConnectionManager = require('../utils/databaseConnectionManager');
    const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organization.database.name);
    return cloneUserSchema(orgDbConnection);
  }
  return User;
}

async function syncDirectoryEntry(email, updates) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  return UserDirectory.findOneAndUpdate(
    { email: normalizedEmail },
    { $set: updates },
    { upsert: false, new: true }
  );
}

async function resolveUserByDirectoryToken(tokenHash, field) {
  const directoryEntry = await UserDirectory.findOne({ [field]: tokenHash });
  if (!directoryEntry) return null;

  const organization = await Organization.findById(directoryEntry.organizationId);
  if (!organization) return null;

  const ScopedUser = await getScopedUserModel(organization);
  const user = await ScopedUser.findById(directoryEntry.tenantUserId);
  if (!user) return null;

  return { user, organization, directoryEntry, ScopedUser };
}

async function clearInviteTokens(user, email) {
  user.inviteTokenHash = null;
  user.inviteTokenExpiresAt = null;
  await syncDirectoryEntry(email, {
    inviteTokenHash: null,
    status: 'active'
  });
}

async function clearVerificationTokens(user, email) {
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpiresAt = null;
  await syncDirectoryEntry(email, {
    emailVerificationTokenHash: null
  });
}

async function assignVerificationToken(user, email) {
  const rawToken = generateRawToken();
  user.emailVerificationTokenHash = hashToken(rawToken);
  user.emailVerificationSentAt = new Date();
  user.emailVerificationExpiresAt = getVerificationExpiry();
  await syncDirectoryEntry(email, {
    emailVerificationTokenHash: user.emailVerificationTokenHash
  });
  return rawToken;
}

function inviterDisplayName(inviter) {
  const full = `${inviter?.firstName || ''} ${inviter?.lastName || ''}`.trim();
  return full || inviter?.username || inviter?.email || 'Your administrator';
}

async function sendInviteForUser({
  user,
  organization,
  inviter,
  inviteToken
}) {
  const result = await sendInviteEmail({
    to: user.email,
    invitee: user,
    organizationName: organization?.name,
    inviterName: inviterDisplayName(inviter),
    inviteToken
  });

  return {
    sent: result.success === true,
    skipped: result.skipped === true,
    reason: result.reason || result.error || null,
    messageId: result.messageId || null
  };
}

async function issueVerificationForUser({
  user,
  organization,
  forceNewToken = true
}) {
  const rawToken = forceNewToken
    ? await assignVerificationToken(user, user.email)
    : null;

  if (!rawToken) {
    return { sent: false, skipped: true, reason: 'no_token' };
  }

  const result = await sendVerificationEmail({
    to: user.email,
    user,
    organizationName: organization?.name,
    verificationToken: rawToken
  });

  return {
    sent: result.success === true,
    skipped: result.skipped === true,
    reason: result.reason || result.error || null,
    messageId: result.messageId || null
  };
}

async function validateInviteToken(rawToken) {
  if (!rawToken) {
    return { valid: false, code: 'TOKEN_MISSING' };
  }

  const tokenHash = hashToken(rawToken);
  const resolved = await resolveUserByDirectoryToken(tokenHash, 'inviteTokenHash');
  if (!resolved) {
    return { valid: false, code: 'TOKEN_INVALID' };
  }

  const { user, organization } = resolved;
  if (user.status !== 'invited') {
    return { valid: false, code: 'INVITE_ALREADY_ACCEPTED' };
  }
  if (isTokenExpired(user.inviteTokenExpiresAt)) {
    return { valid: false, code: 'TOKEN_EXPIRED' };
  }

  return {
    valid: true,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    organizationName: organization.name
  };
}

async function acceptInvite({ rawToken, password }) {
  if (!rawToken || !password) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Token and password are required' };
  }
  if (String(password).length < 8) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' };
  }

  const tokenHash = hashToken(rawToken);
  const resolved = await resolveUserByDirectoryToken(tokenHash, 'inviteTokenHash');
  if (!resolved) {
    return { ok: false, code: 'TOKEN_INVALID', message: 'Invitation link is invalid' };
  }

  const { user, organization, ScopedUser } = resolved;
  if (user.status !== 'invited') {
    return { ok: false, code: 'INVITE_ALREADY_ACCEPTED', message: 'This invitation has already been accepted' };
  }
  if (isTokenExpired(user.inviteTokenExpiresAt)) {
    return { ok: false, code: 'TOKEN_EXPIRED', message: 'This invitation link has expired' };
  }

  user.password = await bcrypt.hash(password, 10);
  user.status = 'active';
  user.inviteAcceptedAt = new Date();
  user.emailVerifiedAt = new Date();
  user.mustChangePassword = false;
  await clearInviteTokens(user, user.email);
  await clearVerificationTokens(user, user.email);
  await user.save();

  if (ScopedUser !== User && user.organizationId) {
    await User.findOneAndUpdate(
      { _id: user._id, organizationId: user.organizationId },
      {
        $set: {
          password: user.password,
          status: user.status,
          inviteAcceptedAt: user.inviteAcceptedAt,
          emailVerifiedAt: user.emailVerifiedAt,
          mustChangePassword: false,
          inviteTokenHash: null,
          inviteTokenExpiresAt: null,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null
        }
      }
    ).catch(() => {});
  }

  return {
    ok: true,
    email: user.email,
    organizationName: organization.name
  };
}

async function confirmEmailVerification(rawToken) {
  if (!rawToken) {
    return { ok: false, code: 'TOKEN_MISSING', message: 'Verification token is required' };
  }

  const tokenHash = hashToken(rawToken);
  const resolved = await resolveUserByDirectoryToken(tokenHash, 'emailVerificationTokenHash');
  if (!resolved) {
    return { ok: false, code: 'TOKEN_INVALID', message: 'Verification link is invalid' };
  }

  const { user, organization, ScopedUser } = resolved;
  if (user.emailVerifiedAt) {
    return { ok: true, alreadyVerified: true, email: user.email, organizationName: organization.name };
  }
  if (isTokenExpired(user.emailVerificationExpiresAt)) {
    return { ok: false, code: 'TOKEN_EXPIRED', message: 'Verification link has expired' };
  }

  user.emailVerifiedAt = new Date();
  await clearVerificationTokens(user, user.email);
  await user.save();

  if (ScopedUser !== User && user.organizationId) {
    await User.findOneAndUpdate(
      { _id: user._id, organizationId: user.organizationId },
      {
        $set: {
          emailVerifiedAt: user.emailVerifiedAt,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null
        }
      }
    ).catch(() => {});
  }

  return {
    ok: true,
    email: user.email,
    organizationName: organization.name
  };
}

async function resendVerificationForUser(userId, organizationId) {
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    return { ok: false, code: 'ORG_NOT_FOUND', message: 'Organization not found' };
  }

  const ScopedUser = await getScopedUserModel(organization);
  const user = await ScopedUser.findById(userId);
  if (!user) {
    return { ok: false, code: 'USER_NOT_FOUND', message: 'User not found' };
  }
  if (user.emailVerifiedAt) {
    return { ok: true, alreadyVerified: true, sent: false };
  }

  const emailResult = await issueVerificationForUser({ user, organization, forceNewToken: true });
  await user.save();

  if (ScopedUser !== User) {
    await User.findOneAndUpdate(
      { _id: user._id, organizationId: user.organizationId },
      {
        $set: {
          emailVerificationTokenHash: user.emailVerificationTokenHash,
          emailVerificationSentAt: user.emailVerificationSentAt,
          emailVerificationExpiresAt: user.emailVerificationExpiresAt
        }
      }
    ).catch(() => {});
  }

  return {
    ok: emailResult.sent || emailResult.skipped,
    sent: emailResult.sent,
    skipped: emailResult.skipped,
    reason: emailResult.reason || null
  };
}

function buildInviteCredentials({ wantsEmail, manualPassword }) {
  if (wantsEmail) {
    return {
      initialStatus: 'invited',
      mustChangePassword: false,
      password: generateSecurePassword(32),
      inviteTokenRaw: generateRawToken(),
      inviteTokenExpiresAt: getInviteExpiry()
    };
  }

  const password = manualPassword || generateSecurePassword(16);
  return {
    initialStatus: 'active',
    mustChangePassword: !manualPassword,
    password,
    inviteTokenRaw: null,
    inviteTokenExpiresAt: null
  };
}

module.exports = {
  getScopedUserModel,
  syncDirectoryEntry,
  buildInviteCredentials,
  sendInviteForUser,
  issueVerificationForUser,
  validateInviteToken,
  acceptInvite,
  confirmEmailVerification,
  resendVerificationForUser,
  hashToken,
  generateRawToken,
  getInviteExpiry
};
