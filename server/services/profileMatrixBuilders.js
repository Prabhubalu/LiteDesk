/**
 * Canonical permission matrices for system profiles and role seeding.
 * Extracted from Role.createDefaultRoles definitions.
 */

const { SYSTEM_PROFILE_KEYS } = require('../permissions/profileKeys');
const { APP_KEYS } = require('../constants/appKeys');

function toProfileStoragePayload(uiPermissions) {
  const { normalizeRolePermissions } = require('./rolePermissionCatalogService');
  return normalizeRolePermissions(uiPermissions);
}

function buildPlatformFullPermissions() {
  const fullCrudAll = {
    create: true,
    read: true,
    update: true,
    delete: true,
    export: true,
    import: true,
    scope: 'all'
  };
  const fullCrudNoImport = {
    create: true,
    read: true,
    update: true,
    delete: true,
    export: true,
    scope: 'all'
  };
  const fullEvents = {
    create: true,
    read: true,
    update: true,
    delete: true,
    scope: 'all'
  };

  return {
    contacts: { ...fullCrudAll },
    organizations: { ...fullCrudAll },
    deals: { ...fullCrudAll },
    tasks: { ...fullCrudNoImport },
    events: { ...fullEvents },
    forms: { ...fullCrudAll },
    webforms: { ...fullCrudNoImport },
    items: { ...fullCrudAll },
    cases: { create: true, read: true, update: true, delete: true, scope: 'all' },
    reports: { create: true, read: true, update: true, delete: true, export: true },
    users: { create: true, read: true, update: true, delete: true, manageRoles: true },
    settings: { view: true, edit: true, manageRoles: true, manageBilling: true },
    performance: {
      targets: {
        view: true,
        create: true,
        edit: true,
        activate: true,
        manageTypes: true,
        manageOrgSettings: true
      }
    }
  };
}

function buildSalesManagerPermissions() {
  return {
    contacts: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'team' },
    organizations: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'team' },
    deals: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'team' },
    tasks: { create: true, read: true, update: true, delete: false, export: true, scope: 'team' },
    events: { create: true, read: true, update: true, delete: false, scope: 'team' },
    forms: { create: true, read: true, update: true, delete: false, export: true, import: false, scope: 'team' },
    webforms: { create: true, read: true, update: true, delete: false, export: true, scope: 'team' },
    items: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'team' },
    reports: { create: false, read: true, update: false, delete: false, export: true },
    users: { create: false, read: true, update: false, delete: false, manageRoles: false },
    settings: { view: false, edit: false, manageRoles: false, manageBilling: false },
    performance: {
      targets: {
        view: true,
        create: true,
        edit: true,
        activate: true,
        manageTypes: false,
        manageOrgSettings: false
      }
    }
  };
}

function buildSalesStandardPermissions() {
  return {
    contacts: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
    organizations: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
    deals: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
    tasks: { create: true, read: true, update: true, delete: false, export: false, scope: 'own' },
    events: { create: true, read: true, update: true, delete: false, scope: 'own' },
    forms: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
    webforms: { create: true, read: true, update: true, delete: false, export: false, scope: 'own' },
    items: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
    reports: { create: false, read: true, update: false, delete: false, export: false },
    users: { create: false, read: false, update: false, delete: false, manageRoles: false },
    settings: { view: false, edit: false, manageRoles: false, manageBilling: false },
    performance: {
      targets: {
        view: true,
        create: false,
        edit: false,
        activate: false,
        manageTypes: false,
        manageOrgSettings: false
      }
    }
  };
}

function buildReadOnlyPermissions() {
  const readOwn = {
    create: false,
    read: true,
    update: false,
    delete: false,
    export: false,
    import: false,
    scope: 'own'
  };
  return {
    contacts: { ...readOwn },
    organizations: { ...readOwn },
    deals: { ...readOwn },
    tasks: { ...readOwn },
    events: { ...readOwn },
    forms: { ...readOwn },
    webforms: { ...readOwn },
    items: { ...readOwn },
    reports: { create: false, read: true, update: false, delete: false, export: false },
    users: { create: false, read: false, update: false, delete: false, manageRoles: false },
    settings: { view: false, edit: false, manageRoles: false, manageBilling: false }
  };
}

function buildPortalCustomerPermissions() {
  const ownRw = {
    create: true,
    read: true,
    update: true,
    delete: false,
    export: false,
    scope: 'own'
  };
  const ownRead = {
    create: false,
    read: true,
    update: false,
    delete: false,
    export: false,
    scope: 'own'
  };
  return toProfileStoragePayload({
    cases: { ...ownRw },
    documents: { ...ownRead },
    users: { create: false, read: false, update: false, delete: false, manageRoles: false },
    settings: { view: false, edit: false, manageRoles: false, manageBilling: false }
  });
}

function buildPortalViewerPermissions() {
  const ownRead = {
    create: false,
    read: true,
    update: false,
    delete: false,
    export: false,
    scope: 'own'
  };
  return toProfileStoragePayload({
    cases: { ...ownRead },
    documents: { ...ownRead },
    users: { create: false, read: false, update: false, delete: false, manageRoles: false },
    settings: { view: false, edit: false, manageRoles: false, manageBilling: false }
  });
}

function buildAuditAuditorPermissions() {
  const ownAudit = {
    create: false,
    read: true,
    update: true,
    delete: false,
    export: false,
    scope: 'own'
  };
  const ownRead = {
    create: false,
    read: true,
    update: false,
    delete: false,
    export: false,
    scope: 'own'
  };
  return toProfileStoragePayload({
    [`${APP_KEYS.AUDIT}:audits`]: { ...ownAudit },
    [`${APP_KEYS.AUDIT}:cases`]: { ...ownRead },
    [`${APP_KEYS.AUDIT}:schedule`]: { ...ownRead },
    events: { ...ownAudit },
    forms: { read: true, update: true, delete: false, scope: 'own' },
    responses: { read: true, update: false, delete: false, scope: 'own' },
    users: { create: false, read: false, update: false, delete: false, manageRoles: false },
    settings: { view: false, edit: false, manageRoles: false, manageBilling: false }
  });
}

const SYSTEM_PROFILE_DEFINITIONS = [
  {
    profileKey: SYSTEM_PROFILE_KEYS.PLATFORM_FULL,
    name: 'Platform Full Access',
    description: 'Full access across all enabled modules and apps',
    isSystemProfile: true,
    permissions: buildPlatformFullPermissions
  },
  {
    profileKey: SYSTEM_PROFILE_KEYS.SALES_MANAGER,
    name: 'Sales Manager',
    description: 'Team-level SALES access with export and reports',
    isSystemProfile: true,
    permissions: buildSalesManagerPermissions
  },
  {
    profileKey: SYSTEM_PROFILE_KEYS.SALES_STANDARD,
    name: 'Sales Standard',
    description: 'Standard SALES rep — own records',
    isSystemProfile: true,
    permissions: buildSalesStandardPermissions
  },
  {
    profileKey: SYSTEM_PROFILE_KEYS.READ_ONLY,
    name: 'Read Only',
    description: 'View-only access assignable to any role',
    isSystemProfile: true,
    permissions: buildReadOnlyPermissions
  },
  {
    profileKey: SYSTEM_PROFILE_KEYS.PORTAL_CUSTOMER,
    name: 'Portal Customer',
    description: 'Portal self-service — Support, Help, and Documents by default',
    isSystemProfile: true,
    permissions: buildPortalCustomerPermissions
  },
  {
    profileKey: SYSTEM_PROFILE_KEYS.PORTAL_VIEWER,
    name: 'Portal Viewer',
    description: 'Portal read-only access to assigned records',
    isSystemProfile: true,
    permissions: buildPortalViewerPermissions
  },
  {
    profileKey: SYSTEM_PROFILE_KEYS.AUDIT_AUDITOR,
    name: 'Audit Auditor',
    description: 'Execute and update assigned audit work',
    isSystemProfile: true,
    permissions: buildAuditAuditorPermissions
  }
];

function getSystemProfileDefinition(profileKey) {
  return SYSTEM_PROFILE_DEFINITIONS.find((d) => d.profileKey === profileKey) || null;
}

module.exports = {
  SYSTEM_PROFILE_DEFINITIONS,
  buildPlatformFullPermissions,
  buildSalesManagerPermissions,
  buildSalesStandardPermissions,
  buildReadOnlyPermissions,
  buildPortalCustomerPermissions,
  buildPortalViewerPermissions,
  buildAuditAuditorPermissions,
  getSystemProfileDefinition
};
