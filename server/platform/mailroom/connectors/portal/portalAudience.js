'use strict';

const People = require('../../../../models/People');
const { getPortalUserEmail, normalizeEmail } = require('./portalSafety');
const { mergePortalConnector } = require('./portalConnectorDefaults');

function emailDomain(email) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) return '';
  return normalized.split('@').pop();
}

function resolvePortalAudienceFromAppAccess(user) {
  const rows = Array.isArray(user?.appAccess) ? user.appAccess : [];
  const portal = rows.find(
    (row) => String(row?.appKey || '').toUpperCase() === 'PORTAL'
      && String(row?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
  const roleKey = String(portal?.roleKey || '').trim().toLowerCase();
  if (roleKey === 'partner') return 'partner';
  if (roleKey === 'customer') return 'customer';
  return null;
}

async function resolvePortalAudienceFromPeople(organizationId, user, portalConfig) {
  const email = getPortalUserEmail(user);
  if (!email || !organizationId) return null;

  const person = await People.findOne({
    organizationId,
    deletedAt: null,
    email: new RegExp(`^${String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  })
    .select('types type')
    .lean();

  if (!person) return null;

  const partnerTypes = (portalConfig?.audienceDetection?.partnerPeopleTypes || ['Partner'])
    .map((t) => String(t).toLowerCase());
  const types = [];
  if (Array.isArray(person.types)) types.push(...person.types);
  if (person.type) types.push(person.type);
  const normalizedTypes = types.map((t) => String(t).toLowerCase());
  if (normalizedTypes.some((t) => partnerTypes.includes(t))) {
    return 'partner';
  }
  return 'customer';
}

function resolvePortalAudienceFromDomains(user, portalConfig) {
  const email = getPortalUserEmail(user);
  const domain = emailDomain(email);
  if (!domain) return null;
  const partnerDomains = (portalConfig?.audienceDetection?.partnerDomains || [])
    .map((d) => String(d).trim().toLowerCase())
    .filter(Boolean);
  if (partnerDomains.includes(domain)) return 'partner';
  return null;
}

/**
 * Resolve whether a portal user is a customer or partner.
 * Priority: explicit appAccess roleKey → People type → email domain list → customer default.
 */
async function resolvePortalAudience(user, portalConnectorConfig) {
  const portalConfig = mergePortalConnector(portalConnectorConfig || {});
  const fromRole = resolvePortalAudienceFromAppAccess(user);
  if (fromRole) return fromRole;

  const organizationId = user?.organizationId;
  const fromPeople = await resolvePortalAudienceFromPeople(organizationId, user, portalConfig);
  if (fromPeople) return fromPeople;

  const fromDomain = resolvePortalAudienceFromDomains(user, portalConfig);
  if (fromDomain) return fromDomain;

  return 'customer';
}

function getPortalChannelLabel(audience) {
  return audience === 'partner' ? 'Partner Portal' : 'Customer Portal';
}

function getMailroomChannelKey(audience) {
  return audience === 'partner' ? 'portal_partner' : 'portal_customer';
}

module.exports = {
  resolvePortalAudience,
  resolvePortalAudienceFromAppAccess,
  getPortalChannelLabel,
  getMailroomChannelKey,
  emailDomain
};
