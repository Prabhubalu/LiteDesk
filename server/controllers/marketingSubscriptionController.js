'use strict';

const mongoose = require('mongoose');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { listPersonSubscriptionHistory } = require('../services/marketing/marketingSubscriptionService');

/**
 * GET /api/marketing/subscriptions/person/:personId
 */
exports.getPersonSubscriptionHistory = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const personId = String(req.params.personId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(personId)) {
      return res.status(400).json({ success: false, message: 'Invalid person id' });
    }

    const data = await runWithOrganizationTenantContext(organizationId, async () =>
      listPersonSubscriptionHistory(organizationId, personId)
    );

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};
