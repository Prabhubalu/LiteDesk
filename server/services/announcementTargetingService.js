'use strict';

const Group = require('../models/Group');

/**
 * Build a targeting context for the current user (server-authoritative).
 * @param {object} user
 * @param {{ surface?: string }} [opts]
 */
async function buildAudienceContext(user, opts = {}) {
  const organizationId = user?.organizationId;
  const userId = String(user?._id || '');
  const userType = String(user?.userType || 'INTERNAL').toUpperCase();
  const legacyRole = String(user?.role || '').toLowerCase();
  const roleId = user?.roleId ? String(user.roleId) : null;

  const externalRoleIds = (user?.externalRoleAssignments || [])
    .filter((row) => String(row?.status || '').toUpperCase() === 'ACTIVE' && row?.roleId)
    .map((row) => String(row.roleId));

  let teamIds = [];
  if (organizationId && userId) {
    const groups = await Group.find({
      organizationId,
      members: user._id,
    })
      .select('_id')
      .lean();
    teamIds = groups.map((g) => String(g._id));
  }

  const surface = String(opts.surface || 'web_app').toLowerCase();

  return {
    organizationId: organizationId ? String(organizationId) : null,
    userId,
    userType,
    legacyRole,
    roleIds: [roleId, ...externalRoleIds].filter(Boolean),
    teamIds,
    surface,
    isPortal: surface === 'portal' || userType === 'EXTERNAL',
    isMobile: surface === 'mobile',
  };
}

function normalizeValues(values) {
  return (Array.isArray(values) ? values : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);
}

function segmentMatches(segment, ctx) {
  const type = String(segment?.type || '').toLowerCase();
  const values = normalizeValues(segment?.values).map((v) => v.toLowerCase());
  const rawValues = normalizeValues(segment?.values);

  if (!type || !rawValues.length) return false;

  switch (type) {
    case 'everyone':
      return true;
    case 'user':
    case 'users':
    case 'individual':
      return rawValues.includes(ctx.userId);
    case 'role':
    case 'roles':
      if (ctx.roleIds.some((id) => rawValues.includes(id))) return true;
      return values.includes(ctx.legacyRole);
    case 'team':
    case 'teams':
    case 'group':
    case 'groups':
    case 'department':
    case 'departments':
      return ctx.teamIds.some((id) => rawValues.includes(id));
    case 'user_type':
    case 'usertype': {
      const mapped = new Set(values.map((v) => {
        if (['internal', 'employee', 'employees'].includes(v)) return 'internal';
        if (['external', 'portal', 'portal_users', 'customer', 'partner', 'vendor', 'dealer'].includes(v)) {
          return 'external';
        }
        return v;
      }));
      if (mapped.has(ctx.userType.toLowerCase())) return true;
      if (mapped.has('portal') && ctx.isPortal) return true;
      if (mapped.has('mobile') && ctx.isMobile) return true;
      return false;
    }
    case 'portal':
      return ctx.isPortal;
    case 'mobile':
      return ctx.isMobile;
    default:
      return false;
  }
}

/**
 * True if announcement audience includes this user context.
 * Segment mode: OR across segments (any match).
 */
function matchesAudience(announcement, ctx) {
  const audience = announcement?.audience || {};
  const mode = audience.mode || 'everyone';
  if (mode === 'everyone') return true;

  const segments = Array.isArray(audience.segments) ? audience.segments : [];
  if (!segments.length) return false;
  return segments.some((segment) => segmentMatches(segment, ctx));
}

module.exports = {
  buildAudienceContext,
  matchesAudience,
  segmentMatches,
};
