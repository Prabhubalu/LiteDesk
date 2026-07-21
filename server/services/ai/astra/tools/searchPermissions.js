'use strict';

const { registerTool } = require('./registry');
const { tokenize, matchQuery, toCitations, scoreHaystack } = require('./productSearchUtils');

function summarizeAppPermissions(appPermissions, maxKeys = 24) {
  const keys = [];
  if (!appPermissions) return keys;
  const obj = appPermissions instanceof Map
    ? Object.fromEntries(appPermissions)
    : (typeof appPermissions === 'object' ? appPermissions : {});

  for (const [appKey, modules] of Object.entries(obj || {})) {
    if (!modules || typeof modules !== 'object') continue;
    for (const [moduleKey, actions] of Object.entries(modules)) {
      if (!actions || typeof actions !== 'object') continue;
      for (const [action, allowed] of Object.entries(actions)) {
        if (allowed) {
          keys.push(`${appKey}.${moduleKey}.${action}`);
          if (keys.length >= maxKeys) return keys;
        }
      }
    }
  }
  return keys;
}

async function executeSearchPermissions({
  organizationId,
  userId = null,
  user = null,
  query = '',
  limit = 15,
} = {}) {
  const Role = require('../../../../models/Role');
  const Profile = require('../../../../models/Profile');
  const ModuleSharingDefault = require('../../../../models/ModuleSharingDefault');
  const ModuleSharingRule = require('../../../../models/ModuleSharingRule');
  const needles = tokenize(query);
  const lim = Math.max(1, Math.min(Number(limit) || 15, 30));

  let roles = [];
  let profiles = [];
  let defaults = [];
  let rules = [];
  let catalogSummary = null;

  try {
    roles = await Role.find({ organizationId })
      .select('name privilegeMode profileId canViewAllData appPermissions level updatedAt')
      .populate('profileId', 'name')
      .sort({ level: 1, name: 1 })
      .limit(60)
      .lean();
  } catch (err) {
    return { records: [], citations: [], query, error: String(err?.message || err) };
  }

  try {
    profiles = await Profile.find({ organizationId })
      .select('name profileKey appPermissions isSystemProfile updatedAt')
      .sort({ isSystemProfile: -1, name: 1 })
      .limit(40)
      .lean();
  } catch {
    profiles = [];
  }

  try {
    defaults = await ModuleSharingDefault.find({ organizationId })
      .select('appKey moduleKey mode updatedAt')
      .limit(80)
      .lean();
  } catch {
    defaults = [];
  }

  try {
    rules = await ModuleSharingRule.find({ organizationId, enabled: true })
      .select('name appKey moduleKey privilege source target priority enabled')
      .sort({ priority: -1 })
      .limit(60)
      .lean();
  } catch {
    rules = [];
  }

  try {
    const { getRolePermissionCatalog } = require('../../../rolePermissionCatalogService');
    const catalog = await getRolePermissionCatalog(organizationId);
    catalogSummary = {
      moduleCount: Array.isArray(catalog?.modules) ? catalog.modules.length : 0,
      sectionCount: Array.isArray(catalog?.sections) ? catalog.sections.length : 0,
      enabledApps: Array.isArray(catalog?.enabledApps) ? catalog.enabledApps.slice(0, 20) : [],
    };
  } catch {
    catalogSummary = null;
  }

  const roleRecords = (roles || []).map((r) => {
    const permKeys = summarizeAppPermissions(r.appPermissions, 20);
    return {
      id: String(r._id),
      type: 'role',
      title: r.name || String(r._id),
      subtitle: `${r.privilegeMode || 'inline'} • level=${r.level ?? '?'} • profile=${r.profileId?.name || 'none'} • perms≈${permKeys.length}${r.canViewAllData ? ' • viewAll' : ''}`,
      privilegeMode: r.privilegeMode,
      permissionKeysSample: permKeys,
    };
  }).filter((row) => matchQuery(row, needles, ['title', 'subtitle', 'privilegeMode']));

  const profileRecords = (profiles || []).map((p) => ({
    id: String(p._id),
    type: 'profile',
    title: p.name || p.profileKey || String(p._id),
    subtitle: `${p.profileKey || ''} • ${p.isSystemProfile ? 'system' : 'custom'}`,
    profileKey: p.profileKey,
  })).filter((row) => matchQuery(row, needles, ['title', 'subtitle', 'profileKey']));

  const defaultRecords = (defaults || []).map((d) => ({
    id: String(d._id),
    type: 'sharing_default',
    title: `${d.appKey}.${d.moduleKey}`,
    subtitle: `sharing mode=${d.mode}`,
    appKey: d.appKey,
    moduleKey: d.moduleKey,
    mode: d.mode,
  })).filter((row) => matchQuery(row, needles, ['title', 'subtitle', 'mode', 'appKey', 'moduleKey']));

  const ruleRecords = (rules || []).map((r) => ({
    id: String(r._id),
    type: 'sharing_rule',
    title: r.name || String(r._id),
    subtitle: `${r.appKey}.${r.moduleKey} • privilege=${r.privilege} • priority=${r.priority ?? 0}`,
    appKey: r.appKey,
    moduleKey: r.moduleKey,
    privilege: r.privilege,
  })).filter((row) => matchQuery(row, needles, ['title', 'subtitle', 'appKey', 'moduleKey', 'privilege']));

  let records = [...roleRecords, ...profileRecords, ...defaultRecords, ...ruleRecords];
  if (needles.length) {
    records = records
      .map((r) => ({ r, s: scoreHaystack(`${r.title} ${r.subtitle}`, needles) }))
      .sort((a, b) => b.s - a.s)
      .map(({ r }) => r);
  }
  records = records.slice(0, lim);

  // Optional: current user effective access note
  let currentUserAccess = null;
  const effectiveUser = user || null;
  if (effectiveUser && (userId || effectiveUser._id)) {
    try {
      currentUserAccess = {
        userId: String(userId || effectiveUser._id),
        roleName: effectiveUser.role?.name || effectiveUser.roleName || null,
        note: 'Effective permissions are enforced at runtime via resolveRuntimePermission; samples above are role/profile configuration.',
      };
    } catch {
      currentUserAccess = null;
    }
  }

  return {
    records,
    catalogSummary,
    currentUserAccess,
    citations: toCitations(records, 'permission'),
    query,
  };
}

registerTool({
  name: 'SearchPermissions',
  description: 'Search roles, profiles, sharing defaults/rules, and permission catalog summary.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
    },
  },
  execute: executeSearchPermissions,
});

module.exports = { executeSearchPermissions, summarizeAppPermissions };
