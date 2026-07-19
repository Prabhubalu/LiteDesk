const Profile = require('../models/Profile');
const Role = require('../models/Role');
const Organization = require('../models/Organization');
const { isRbacV2Enabled } = require('../utils/rbacFeatureFlags');
const {
  normalizeRolePermissions,
  invalidateTenantPermissionCaches,
  expandProfilePermissionsForUI
} = require('../services/rolePermissionCatalogService');
const { seedSystemProfiles, forceSyncPortalSystemProfiles } = require('../services/roleSeedService');

async function loadOrganization(req) {
  return req.organization || (await Organization.findById(req.user.organizationId).lean());
}

async function ensureRbacV2Enabled(req, res) {
  const organization = await loadOrganization(req);
  if (!isRbacV2Enabled(organization)) {
    res.status(403).json({
      success: false,
      message: 'RBAC v2 is not enabled for this organization',
      code: 'RBAC_V2_DISABLED'
    });
    return null;
  }
  return organization;
}

exports.listProfiles = async (req, res) => {
  try {
    if (!(await ensureRbacV2Enabled(req, res))) return;

    const orgId = req.user.organizationId;
    await seedSystemProfiles(orgId);
    await forceSyncPortalSystemProfiles(orgId);
    const profiles = await Profile.find({ organizationId: orgId })
      .sort({ isSystemProfile: -1, name: 1 })
      .lean();

    res.json({
      success: true,
      data: profiles,
      total: profiles.length
    });
  } catch (error) {
    console.error('List profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profiles',
      error: error.message
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    if (!(await ensureRbacV2Enabled(req, res))) return;

    await forceSyncPortalSystemProfiles(req.user.organizationId);

    const profile = await Profile.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).lean();

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    res.json({
      success: true,
      data: {
        ...profile,
        permissionsUi: expandProfilePermissionsForUI(profile)
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

exports.createProfile = async (req, res) => {
  try {
    if (!(await ensureRbacV2Enabled(req, res))) return;

    const { name, description, permissions, appPermissions, fieldPermissions, copiedFromProfileId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Profile name is required' });
    }

    const existing = await Profile.findOne({
      organizationId: req.user.organizationId,
      name: String(name).trim()
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A profile with this name already exists' });
    }

    const { permissions: normalizedPermissions, appPermissions: normalizedAppPerms } =
      permissions || appPermissions
        ? normalizeRolePermissions(permissions || appPermissions)
        : { permissions: {}, appPermissions: null };

    const payload = {
      organizationId: req.user.organizationId,
      name: String(name).trim(),
      description: description || '',
      permissions: normalizedPermissions,
      isSystemProfile: false,
      copiedFromProfileId: copiedFromProfileId || null,
      createdBy: req.user._id,
      updatedBy: req.user._id
    };
    if (normalizedAppPerms) payload.appPermissions = normalizedAppPerms;
    if (fieldPermissions) payload.fieldPermissions = fieldPermissions;

    const profile = await Profile.create(payload);
    invalidateTenantPermissionCaches(req.user.organizationId);

    res.status(201).json({
      success: true,
      data: profile.toObject(),
      message: 'Profile created successfully'
    });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating profile',
      error: error.message
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (!(await ensureRbacV2Enabled(req, res))) return;

    const profile = await Profile.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (profile.isSystemProfile && req.body.name && req.body.name !== profile.name) {
      return res.status(403).json({
        success: false,
        message: 'Cannot rename system profile',
        code: 'CANNOT_MODIFY_SYSTEM_PROFILE'
      });
    }

    const allowed = ['description', 'permissions', 'appPermissions', 'fieldPermissions'];
    if (!profile.isSystemProfile) allowed.push('name');

    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(req.body, key)) continue;
      if (key === 'permissions' || key === 'appPermissions') {
        const { permissions: normalized, appPermissions: appPerms } = normalizeRolePermissions(
          req.body.permissions || req.body.appPermissions
        );
        profile.permissions = normalized;
        if (appPerms) profile.appPermissions = appPerms;
      } else {
        profile[key] = req.body[key];
      }
    }

    profile.updatedBy = req.user._id;
    await profile.save();

    // Drop stale module matrices copied onto profile-linked roles so profile edits take effect.
    await Role.updateMany(
      {
        organizationId: req.user.organizationId,
        profileId: profile._id,
        privilegeMode: 'profile'
      },
      { $set: { permissions: {}, appPermissions: {} } }
    );

    invalidateTenantPermissionCaches(req.user.organizationId);

    res.json({
      success: true,
      data: profile.toObject(),
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    if (!(await ensureRbacV2Enabled(req, res))) return;

    const profile = await Profile.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (profile.isSystemProfile) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete system profile',
        code: 'CANNOT_DELETE_SYSTEM_PROFILE'
      });
    }

    const linkedCount = await Role.countDocuments({
      organizationId: req.user.organizationId,
      profileId: profile._id
    });
    if (linkedCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Profile is assigned to ${linkedCount} role(s). Reassign roles first.`,
        code: 'PROFILE_IN_USE'
      });
    }

    await profile.deleteOne();
    invalidateTenantPermissionCaches(req.user.organizationId);

    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting profile',
      error: error.message
    });
  }
};

exports.cloneProfile = async (req, res) => {
  try {
    if (!(await ensureRbacV2Enabled(req, res))) return;

    const source = await Profile.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!source) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const baseName = `${source.name} Copy`;
    let name = baseName;
    let suffix = 2;
    while (await Profile.findOne({ organizationId: req.user.organizationId, name })) {
      name = `${baseName} ${suffix}`;
      suffix += 1;
    }

    const clone = await Profile.create({
      organizationId: req.user.organizationId,
      name,
      description: source.description,
      permissions: source.permissions,
      appPermissions: source.appPermissions,
      fieldPermissions: source.fieldPermissions,
      isSystemProfile: false,
      copiedFromProfileId: source._id,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: clone.toObject(),
      message: 'Profile cloned successfully'
    });
  } catch (error) {
    console.error('Clone profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cloning profile',
      error: error.message
    });
  }
};
