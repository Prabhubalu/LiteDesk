'use strict';

const portalAccessService = require('../services/portalAccessService');

function reqMeta(req) {
  return {
    ip: req.ip || null,
    userAgent: req.get('user-agent') || null
  };
}

function handleServiceError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    code: error.code || 'PORTAL_ERROR',
    message: error.message || 'Portal operation failed'
  });
}

exports.getPortal = async (req, res) => {
  try {
    const data = await portalAccessService.getPortalState(
      req.params.id,
      req.user.organizationId
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.enablePortal = async (req, res) => {
  try {
    const roleIds = req.body?.roleIds;
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'PORTAL_ROLES_REQUIRED',
        message: 'roleIds array is required'
      });
    }

    const data = await portalAccessService.enablePortalAccess({
      peopleId: req.params.id,
      tenantOrganizationId: req.user.organizationId,
      roleIds,
      adminUser: req.user,
      reqMeta: reqMeta(req)
    });

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.disablePortal = async (req, res) => {
  try {
    const data = await portalAccessService.disablePortalAccess({
      peopleId: req.params.id,
      tenantOrganizationId: req.user.organizationId,
      adminUser: req.user,
      reqMeta: reqMeta(req)
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.assignPortalRoles = async (req, res) => {
  try {
    const roleIds = req.body?.roleIds;
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'PORTAL_ROLES_REQUIRED',
        message: 'roleIds array is required'
      });
    }

    const data = await portalAccessService.assignPortalRoles({
      peopleId: req.params.id,
      tenantOrganizationId: req.user.organizationId,
      roleIds,
      adminUser: req.user,
      reqMeta: reqMeta(req)
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.removePortalRole = async (req, res) => {
  try {
    const data = await portalAccessService.removePortalRole({
      peopleId: req.params.id,
      tenantOrganizationId: req.user.organizationId,
      roleId: req.params.roleId,
      adminUser: req.user,
      reqMeta: reqMeta(req)
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.resendPortalInvite = async (req, res) => {
  try {
    const data = await portalAccessService.resendPortalInvite({
      peopleId: req.params.id,
      tenantOrganizationId: req.user.organizationId,
      adminUser: req.user,
      reqMeta: reqMeta(req)
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.resetPortalPassword = async (req, res) => {
  try {
    const data = await portalAccessService.resetPortalPassword({
      peopleId: req.params.id,
      tenantOrganizationId: req.user.organizationId,
      adminUser: req.user,
      reqMeta: reqMeta(req)
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.terminatePortalSessions = async (req, res) => {
  try {
    const data = await portalAccessService.terminatePortalSessions({
      peopleId: req.params.id,
      tenantOrganizationId: req.user.organizationId,
      adminUser: req.user,
      reqMeta: reqMeta(req)
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

exports.getPortalAudit = async (req, res) => {
  try {
    const data = await portalAccessService.listPortalAuditEvents({
      peopleId: req.params.id,
      tenantOrganizationId: req.user.organizationId,
      eventType: req.query.eventType || null,
      limit: req.query.limit
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
