'use strict';

const { getPortalPersonForUser } = require('../services/portalPeopleService');

async function getPortalPerson(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const person = await getPortalPersonForUser(organizationId, req.user);
    if (!person) {
      return res.status(404).json({ success: false, message: 'Contact profile not found' });
    }

    return res.json({ success: true, data: person });
  } catch (error) {
    console.error('[portalPeopleController] getPortalPerson', error);
    return res.status(500).json({ success: false, message: 'Failed to load contact profile' });
  }
}

module.exports = {
  getPortalPerson
};
