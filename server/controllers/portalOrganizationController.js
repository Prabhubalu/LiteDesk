'use strict';

const { getPortalOrganizationForUser } = require('../services/portalOrganizationService');

async function getPortalOrganization(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const organization = await getPortalOrganizationForUser(organizationId, req.user);
    if (!organization) {
      return res.status(404).json({
        success: false,
        code: 'PORTAL_ORG_NOT_LINKED',
        message: 'No business organization is linked to your portal account'
      });
    }

    return res.json({ success: true, data: organization });
  } catch (error) {
    console.error('[portalOrganizationController] getPortalOrganization', error);
    return res.status(500).json({ success: false, message: 'Failed to load organization' });
  }
}

module.exports = {
  getPortalOrganization
};
