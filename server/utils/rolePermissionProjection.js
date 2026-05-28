/**
 * =============================================================================
 * Effective CRM permissions — architecture
 * =============================================================================
 *
 * Source of truth:
 *   • Role.permissions + Role flags (canViewAllData, etc.) — SALES/CRM module matrix
 *   • user.appAccess — which apps the user is entitled to (HELPDESK cases*, seat roles)
 *
 * user.permissions (persisted on User) is a denormalized cache for exports/listing;
 * authoritative values for a session are always rebuilt via materializeEffectiveCRMEnvelopeOnUser().
 *
 * There is no supported per-user arbitrary permission override API; changes go through Role
 * or appAccess. (Legacy body.permissions on PUT /users/:id is ignored.)
 * =============================================================================
 */

const mongoose = require('mongoose');
const { APP_KEYS } = require('../constants/appKeys');

function toPlain(permsOrSub) {
  if (!permsOrSub) return {};
  if (typeof permsOrSub.toObject === 'function') return permsOrSub.toObject();
  return permsOrSub;
}

function userPermissionsEnvelopeToPlain(user) {
  const p = user?.permissions;
  if (!p || typeof p !== 'object') return {};
  return typeof p.toObject === 'function' ? p.toObject() : { ...p };
}

function finalizeUserPermissionEnvelope(user) {
  const plain = userPermissionsEnvelopeToPlain(user);
  ensurePermissionEnvelopeDefaults(plain);
  user.permissions = plain;
}

/** viewAll semantics: explicit module flag / scope=all, or role-level "Can view all data". */
function viewAllForModule(mod, rolePlain) {
  const m = toPlain(mod);
  if (rolePlain.canViewAllData === true) return true;
  return m.scope === 'all' || m.viewAll === true;
}

/**
 * Helpdesk/cases matrix from app seat assignments (not Role.permissions).
 * @param {object[]} appAccess
 */
function buildCasesEnvelopeFromAppAccess(appAccess = []) {
  const access = Array.isArray(appAccess) ? appAccess : [];
  return {
    view: access.some((entry) => entry.appKey === APP_KEYS.HELPDESK),
    create: access.some(
      (entry) => entry.appKey === APP_KEYS.HELPDESK && entry.status === 'ACTIVE' && entry.roleKey !== 'VIEWER'
    ),
    edit: access.some(
      (entry) => entry.appKey === APP_KEYS.HELPDESK && entry.status === 'ACTIVE' && entry.roleKey !== 'VIEWER'
    ),
    delete: access.some(
      (entry) => entry.appKey === APP_KEYS.HELPDESK && entry.status === 'ACTIVE' && entry.roleKey === 'ADMIN'
    ),
    viewAll: access.some(
      (entry) =>
        entry.appKey === APP_KEYS.HELPDESK &&
        entry.status === 'ACTIVE' &&
        ['ADMIN', 'MANAGER', 'AGENT'].includes(entry.roleKey)
    )
  };
}

/**
 * @param {object} rolePlain - lean Role doc (must include permissions, name, flags)
 * @param {object[]} appAccess - user.appAccess (for HELPDESK cases*)
 * @returns {object} Full User.permissions-compatible object (+ people mirror)
 */
function projectRoleToUserPermissions(rolePlain, appAccess = []) {
  const p = toPlain(rolePlain.permissions);
  const access = Array.isArray(appAccess) ? appAccess : [];

  const contacts = {
    view: p.contacts?.read === true,
    create: p.contacts?.create === true,
    edit: p.contacts?.update === true,
    delete: p.contacts?.delete === true,
    viewAll: viewAllForModule(p.contacts, rolePlain),
    exportData: p.contacts?.export === true
  };

  const organizations = {
    view: p.organizations?.read === true,
    create: p.organizations?.create === true,
    edit: p.organizations?.update === true,
    delete: p.organizations?.delete === true,
    viewAll: viewAllForModule(p.organizations, rolePlain),
    exportData: p.organizations?.export === true
  };

  const deals = {
    view: p.deals?.read === true,
    create: p.deals?.create === true,
    edit: p.deals?.update === true,
    delete: p.deals?.delete === true,
    viewAll: viewAllForModule(p.deals, rolePlain),
    exportData: p.deals?.export === true
  };

  const projects = {
    view: deals.view,
    create: deals.create,
    edit: deals.edit,
    delete: deals.delete,
    viewAll: deals.viewAll
  };

  const tasks = {
    view: p.tasks?.read === true,
    create: p.tasks?.create === true,
    edit: p.tasks?.update === true,
    delete: p.tasks?.delete === true,
    viewAll: viewAllForModule(p.tasks, rolePlain),
    exportData: p.tasks?.export === true
  };

  const events = {
    view: p.events?.read === true,
    create: p.events?.create === true,
    edit: p.events?.update === true,
    delete: p.events?.delete === true,
    viewAll: viewAllForModule(p.events, rolePlain)
  };

  const forms = {
    view: p.forms?.read === true,
    create: p.forms?.create === true,
    edit: p.forms?.update === true,
    delete: p.forms?.delete === true,
    viewAll: viewAllForModule(p.forms, rolePlain),
    exportData: p.forms?.export === true
  };

  const items = {
    view: p.items?.read === true,
    create: p.items?.create === true,
    edit: p.items?.update === true,
    delete: p.items?.delete === true,
    viewAll: viewAllForModule(p.items, rolePlain),
    exportData: p.items?.export === true
  };

  const imports = {
    view:
      p.contacts?.import === true ||
      p.deals?.import === true ||
      p.organizations?.import === true ||
      p.forms?.import === true ||
      p.items?.import === true ||
      false,
    create: p.contacts?.import === true || p.deals?.import === true || false,
    delete: false
  };

  const settings = {
    view: p.settings?.view === true,
    manageUsers:
      (p.users?.create === true) ||
      (p.users?.update === true) ||
      (p.users?.manageRoles === true) ||
      (p.settings?.manageRoles === true) ||
      false,
    manageBilling: p.settings?.manageBilling === true,
    manageIntegrations: false,
    customizeFields: p.settings?.edit === true,
    edit: p.settings?.edit === true
  };

  const perfTargets = p.performance?.targets || {};
  const performance = {
    targets: {
      view: perfTargets.view === true,
      create: perfTargets.create === true,
      edit: perfTargets.edit === true,
      activate: perfTargets.activate === true,
      manageTypes: perfTargets.manageTypes === true,
      manageOrgSettings: perfTargets.manageOrgSettings === true
    }
  };

  const reports = {
    viewStandard: p.reports?.read === true,
    viewCustom: p.reports?.read === true,
    createCustom: p.reports?.create === true,
    exportReports: p.reports?.export === true
  };

  const roleCases = p.cases;
  const hasRoleCasesMatrix =
    roleCases &&
    (roleCases.read === true ||
      roleCases.create === true ||
      roleCases.update === true ||
      roleCases.delete === true);

  const casesModule = hasRoleCasesMatrix
    ? {
        view: roleCases.read === true,
        create: roleCases.create === true,
        edit: roleCases.update === true,
        delete: roleCases.delete === true,
        viewAll: viewAllForModule(roleCases, rolePlain)
      }
    : buildCasesEnvelopeFromAppAccess(access);

  const projected = {
    contacts,
    people: { ...contacts },
    organizations,
    deals,
    projects,
    tasks,
    events,
    forms,
    items,
    imports,
    settings,
    performance,
    reports,
    cases: casesModule
  };

  return projected;
}

/**
 * Ensure legacy UI consumers always see every module key present (safe false defaults).
 * @param {object} merged mutable envelope
 */
function ensurePermissionEnvelopeDefaults(merged) {
  if (!merged || typeof merged !== 'object') return;

  if (merged.contacts && !merged.people) merged.people = { ...merged.contacts };

  const ensureModule = (key, template) => {
    if (!merged[key]) merged[key] = { ...template };
  };

  ensureModule('contacts', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('people', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('organizations', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('deals', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('quotes', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('tasks', { view: false, create: false, edit: false, delete: false, viewAll: false });
  ensureModule('events', { view: false, create: false, edit: false, delete: false, viewAll: false });
  ensureModule('forms', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('items', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('cases', { view: false, create: false, edit: false, delete: false, viewAll: false });
  ensureModule('imports', { view: false, create: false, delete: false });
  ensureModule('settings', {
    view: false,
    edit: false,
    manageUsers: false,
    manageBilling: false,
    manageIntegrations: false,
    customizeFields: false
  });
  ensureModule('reports', {
    viewStandard: false,
    viewCustom: false,
    createCustom: false,
    exportReports: false
  });
  ensureModule('projects', { view: false, create: false, edit: false, delete: false, viewAll: false });
}

/** CRM roles that may edit platform-owned fields (elevated tenancy operations). */
function roleAllowsPlatformOwnedFieldEdits(rolePlain) {
  if (!rolePlain) return false;
  const name = String(rolePlain.name || '').trim();
  return name === 'Owner' || name === 'Admin';
}

/**
 * Applies projection + runtime grants + org guards to req.user / User document.
 * @param {import('mongoose').Document|object} user
 * @param {object|null} roleLean
 * @param {object|null} [organization]
 */
async function applyProjectionToUser(user, roleLean, organization = null) {
  if (!user || !roleLean) return;
  const { materializeRuntimePermissionsOnUser } = require('../services/runtimePermissionResolver');
  await materializeRuntimePermissionsOnUser(user, {
    roleLean,
    organization,
    appAccess: user.appAccess
  });
  user._roleAllowsPlatformOwnedFieldEdit = roleAllowsPlatformOwnedFieldEdits(roleLean);
}

/**
 * Single entry: assign user.permissions + elevation flags from Role, appAccess, or owner defaults.
 * Mutates Mongoose User docs in place (JWT user, profile, login cache, etc.).
 *
 * @param {import('mongoose').Document|object} user
 * @param {{ prefetchedRoleLeanById?: Map<string, object> }} [options]
 */
async function materializeEffectiveCRMEnvelopeOnUser(user, options = {}) {
  if (!user) return;

  const Organization = require('../models/Organization');
  const { materializeRuntimePermissionsOnUser } = require('../services/runtimePermissionResolver');

  try {
    let organization = options.organization || null;
    if (!organization && user.organizationId) {
      organization = await Organization.findById(user.organizationId)
        .select('enabledApps moduleOverrides')
        .lean();
    }

    if (user.isOwner === true && typeof user.setPermissionsByRole === 'function') {
      user.setPermissionsByRole('owner');
      user._roleAllowsPlatformOwnedFieldEdit = true;
      const plain = userPermissionsEnvelopeToPlain(user);
      plain.cases = buildCasesEnvelopeFromAppAccess(user.appAccess);
      ensurePermissionEnvelopeDefaults(plain);
      await materializeRuntimePermissionsOnUser(user, {
        organization,
        appAccess: user.appAccess
      });
      user.permissions = plain;
      user._permissionRuntime = user._permissionRuntime || {
        envelope: plain,
        modulesByApp: {},
        flat: {}
      };
      user._permissionRuntime.envelope = plain;
      return;
    }

    const rid = user.roleId;
    const id = rid && typeof rid === 'object' && rid._id ? rid._id : rid;

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      const Role = require('../models/Role');
      const map = options.prefetchedRoleLeanById;
      let roleLean =
        map instanceof Map ? map.get(String(id)) : undefined;
      if (!roleLean) {
        roleLean = await Role.findById(id).lean();
      }
      if (roleLean) {
        await applyProjectionToUser(user, roleLean, organization);
        return;
      }
    }

    const access = Array.isArray(user.appAccess) ? user.appAccess : [];
    if (access.length > 0 && typeof user.setPermissionsByAppAccess === 'function') {
      user.setPermissionsByAppAccess(access);
      user._roleAllowsPlatformOwnedFieldEdit = false;
      await materializeRuntimePermissionsOnUser(user, { organization, appAccess: access });
      return;
    }

    delete user._roleAllowsPlatformOwnedFieldEdit;
  } catch (e) {
    console.error('[materializeEffectiveCRMEnvelopeOnUser]', e.message);
  }
}

async function hydrateUserPermissionsFromRole(user) {
  return materializeEffectiveCRMEnvelopeOnUser(user);
}

/**
 * Attach effective CRM `permissions` to plain user rows from User.find().lean() (pagination, admin lists).
 * One batched Role query + parallel materialization without persisting.
 *
 * @param {object[]} leanUsers
 * @returns {Promise<object[]>}
 */
async function enrichLeanUsersWithEffectiveCRMPermissions(leanUsers) {
  const list = Array.isArray(leanUsers) ? leanUsers : [];
  if (list.length === 0) return list;

  const User = require('../models/User');
  const Role = require('../models/Role');

  const roleIdSet = new Set();
  for (const row of list) {
    if (row?.isOwner === true) continue;
    const rid = row?.roleId;
    if (!rid) continue;
    const id = rid._id || rid;
    if (mongoose.Types.ObjectId.isValid(id)) {
      roleIdSet.add(String(id));
    }
  }

  /** @type {Map<string, object>} */
  const prefetchedRoleLeanById = new Map();
  if (roleIdSet.size > 0) {
    const docs = await Role.find({ _id: { $in: [...roleIdSet] } }).lean();
    for (const r of docs) {
      prefetchedRoleLeanById.set(String(r._id), r);
    }
  }

  return Promise.all(
    list.map(async (lean) => {
      const temp = new User(lean);
      temp.isNew = false;
      await materializeEffectiveCRMEnvelopeOnUser(temp, { prefetchedRoleLeanById });
      return {
        ...lean,
        permissions: userPermissionsEnvelopeToPlain(temp)
      };
    })
  );
}

/**
 * Strip password and internal authz flags before sending a user document to the client.
 * @param {import('mongoose').Document|object|null|undefined} userDocOrPlain
 */
function sanitizeUserResponsePayload(userDocOrPlain) {
  if (userDocOrPlain == null) return userDocOrPlain;
  const o =
    typeof userDocOrPlain.toObject === 'function'
      ? userDocOrPlain.toObject({ flattenMaps: false })
      : { ...userDocOrPlain };
  delete o.password;
  delete o._roleAllowsPlatformOwnedFieldEdit;
  return o;
}

module.exports = {
  projectRoleToUserPermissions,
  roleAllowsPlatformOwnedFieldEdits,
  applyProjectionToUser,
  materializeEffectiveCRMEnvelopeOnUser,
  ensurePermissionEnvelopeDefaults,
  buildCasesEnvelopeFromAppAccess,
  enrichLeanUsersWithEffectiveCRMPermissions,
  sanitizeUserResponsePayload,
  hydrateUserPermissionsFromRole
};
