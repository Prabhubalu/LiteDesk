'use strict';

const Organization = require('../models/Organization');
const User = require('../models/User');
const {
  getUserOnboardingState,
  patchUserOnboarding,
  patchOrgOnboarding
} = require('../services/onboardingService');

async function getScopedUserModel(organization) {
  if (organization?.database?.name && organization.database.initialized) {
    const dbConnectionManager = require('../utils/databaseConnectionManager');
    const orgDbConnection = await dbConnectionManager.getOrganizationConnection(
      organization.database.name
    );
    if (orgDbConnection.models.User) {
      return orgDbConnection.models.User;
    }
    const UserSchema = new (require('mongoose')).Schema(User.schema.obj, User.schema.options);
    return orgDbConnection.model('User', UserSchema);
  }
  return User;
}

async function loadUserAndOrg(req) {
  const organization = req.organization
    || await Organization.findById(req.user.organizationId);
  if (!organization) {
    const err = new Error('Organization not found');
    err.statusCode = 404;
    throw err;
  }
  const ScopedUser = await getScopedUserModel(organization);
  const user = await ScopedUser.findById(req.user._id);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return { user, organization, ScopedUser };
}

exports.getMyOnboarding = async (req, res) => {
  try {
    const { user, organization } = await loadUserAndOrg(req);
    const data = await getUserOnboardingState(user, organization);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[Onboarding] getMyOnboarding error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to load onboarding'
    });
  }
};

exports.patchMyOnboarding = async (req, res) => {
  try {
    const { user, organization } = await loadUserAndOrg(req);
    const data = await patchUserOnboarding(user, organization, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[Onboarding] patchMyOnboarding error:', error);
    const status = error.code === 'VALIDATION_ERROR' ? 400 : (error.statusCode || 500);
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to update onboarding'
    });
  }
};

exports.patchOrganizationOnboarding = async (req, res) => {
  try {
    if (!req.user?.isOwner && req.user?.role !== 'owner' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update organization onboarding'
      });
    }

    const organization = req.organization
      || await Organization.findById(req.user.organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const data = await patchOrgOnboarding(organization, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[Onboarding] patchOrganizationOnboarding error:', error);
    const status = error.code === 'VALIDATION_ERROR' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to update organization onboarding'
    });
  }
};
