'use strict';

const Organization = require('../models/Organization');
const { resolvePortalPersonContext } = require('./portalUserScopeService');

const PORTAL_ORG_FIELDS =
  '_id name email phone website industry types status tier address city state postalCode country';

function shapePortalOrganization(org) {
  if (!org) return null;
  return {
    _id: org._id,
    name: org.name,
    email: org.email || '',
    phone: org.phone || '',
    website: org.website || '',
    industry: org.industry || '',
    types: Array.isArray(org.types) ? org.types : [],
    status: org.status || '',
    tier: org.tier || '',
    address: org.address || '',
    city: org.city || '',
    state: org.state || '',
    postalCode: org.postalCode || '',
    country: org.country || ''
  };
}

async function getPortalOrganizationForUser(organizationId, user) {
  const { businessOrganizationId } = await resolvePortalPersonContext(organizationId, user);
  if (!businessOrganizationId) {
    return null;
  }

  const org = await Organization.findOne({
    _id: businessOrganizationId,
    isTenant: { $ne: true },
    deletedAt: null
  })
    .select(PORTAL_ORG_FIELDS)
    .lean();

  return shapePortalOrganization(org);
}

module.exports = {
  getPortalOrganizationForUser,
  shapePortalOrganization
};
