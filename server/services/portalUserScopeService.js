'use strict';

const People = require('../models/People');
const { getPortalUserEmail } = require('../platform/mailroom/connectors/portal/portalSafety');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve the portal user's People row and linked business organization.
 * @param {string|import('mongoose').Types.ObjectId} organizationId - tenant org
 * @param {object} user
 */
async function resolvePortalPersonContext(organizationId, user) {
  const email = getPortalUserEmail(user);
  let person = null;

  if (user?.peopleId) {
    person = await People.findOne({
      _id: user.peopleId,
      organizationId,
      deletedAt: null
    })
      .select('_id email first_name last_name organization')
      .lean();
  }

  if (!person && email) {
    person = await People.findOne({
      organizationId,
      deletedAt: null,
      email: new RegExp(`^${escapeRegex(email)}$`, 'i')
    })
      .select('_id email first_name last_name organization')
      .lean();
  }

  const contactIds = person?._id ? [person._id] : [];
  const businessOrganizationId = person?.organization || null;

  return {
    person,
    contactIds,
    businessOrganizationId,
    email: email || person?.email || null
  };
}

module.exports = {
  resolvePortalPersonContext,
  escapeRegex
};
