'use strict';

const People = require('../models/People');
const { resolvePortalPersonContext } = require('./portalUserScopeService');

const PORTAL_PEOPLE_FIELDS = '_id first_name last_name email phone mobile organization';

function shapePortalPerson(person) {
  if (!person) return null;
  return {
    _id: person._id,
    firstName: person.first_name || '',
    lastName: person.last_name || '',
    email: person.email || '',
    phone: person.phone || '',
    mobile: person.mobile || '',
    organizationId: person.organization || null
  };
}

async function getPortalPersonForUser(organizationId, user) {
  const { person } = await resolvePortalPersonContext(organizationId, user);
  if (!person?._id) {
    return null;
  }

  const row = await People.findOne({
    _id: person._id,
    organizationId,
    deletedAt: null
  })
    .select(PORTAL_PEOPLE_FIELDS)
    .lean();

  return shapePortalPerson(row);
}

module.exports = {
  getPortalPersonForUser,
  shapePortalPerson
};
