'use strict';

/**
 * External / portal system profile catalog scope for RBAC editor.
 * External profiles expose tenant core + app modules; platform admin modules stay blocked.
 * @see docs/architecture/RBAC_PROFILES_SHARING.md §8
 */

const { SYSTEM_PROFILE_KEYS } = require('../permissions/profileKeys');

/** Default module matrix for seeded external profiles (runtime defaults, not editor allowlist). */
const EXTERNAL_PROFILE_DEFAULT_MODULE_KEYS = Object.freeze({
  [SYSTEM_PROFILE_KEYS.PORTAL_CUSTOMER]: Object.freeze([
    'cases',
    'documents'
  ]),
  [SYSTEM_PROFILE_KEYS.PORTAL_VIEWER]: Object.freeze([
    'cases',
    'documents'
  ])
});

const EXTERNAL_PROFILE_KEYS = new Set([
  SYSTEM_PROFILE_KEYS.PORTAL_CUSTOMER,
  SYSTEM_PROFILE_KEYS.PORTAL_VIEWER,
  SYSTEM_PROFILE_KEYS.AUDIT_AUDITOR
]);

function isExternalSystemProfileKey(profileKey) {
  return EXTERNAL_PROFILE_KEYS.has(String(profileKey || ''));
}

function getExternalProfileDefaultModuleKeys(profileKey) {
  return EXTERNAL_PROFILE_DEFAULT_MODULE_KEYS[profileKey] || null;
}

function isPlatformAdminCatalogModule(mod) {
  if (!mod) return true;
  if (mod.scope === 'platform') return true;
  const sectionId = String(mod.sectionId || '');
  return sectionId === 'platform';
}

/**
 * Role-editor catalog for external profiles / external roles:
 * tenant core + app modules only (no platform administration).
 * Portal customer/viewer catalogs prefer default modules when present, and
 * inject stubs for missing defaults so profile grants remain editable.
 * @param {{ modules: object[], sections: object[] }} catalog
 * @param {{ profileKey?: string|null }} [options]
 */
function filterCatalogForExternalAccess(catalog, options = {}) {
  if (!catalog) {
    return catalog;
  }

  const modules = (catalog.modules || []).filter((mod) => !isPlatformAdminCatalogModule(mod));
  const profileKey = options.profileKey ? String(options.profileKey) : null;
  const defaultKeys = getExternalProfileDefaultModuleKeys(profileKey);
  let nextModules = modules;

  if (defaultKeys && defaultKeys.length) {
    const byKey = new Map(modules.map((mod) => [mod.key, mod]));
    const preferred = [];
    for (const key of defaultKeys) {
      if (byKey.has(key)) {
        preferred.push(byKey.get(key));
        byKey.delete(key);
      } else {
        preferred.push({
          key,
          moduleKey: key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          description: `${key} — portal default module`,
          kind: 'crud',
          scope: key === 'cases' ? 'app' : 'core',
          appKey: key === 'cases' ? 'HELPDESK' : null,
          order: preferred.length,
          hasScope: true,
          supportsViewAll: true,
          actions: ['read', 'create', 'update', 'delete'],
          sectionId: key === 'cases' ? 'app-helpdesk' : 'core'
        });
      }
    }
    // Keep other tenant modules after defaults so admins can still grant extras.
    nextModules = [...preferred, ...byKey.values()];
  }

  const visibleSectionIds = new Set(nextModules.map((m) => m.sectionId || 'default'));
  if (defaultKeys?.includes('cases')) visibleSectionIds.add('app-helpdesk');
  if (defaultKeys?.includes('documents')) visibleSectionIds.add('core');

  const sections = [...(catalog.sections || [])];
  if (defaultKeys?.includes('cases') && !sections.some((s) => s.id === 'app-helpdesk')) {
    sections.push({
      id: 'app-helpdesk',
      label: 'Helpdesk',
      description: 'Support case access for portal users',
      appKey: 'HELPDESK',
      order: 15
    });
  }
  const visibleSections = sections.filter((s) => visibleSectionIds.has(s.id));

  return {
    ...catalog,
    modules: nextModules,
    sections: visibleSections,
    externalProfile: true,
    profileScoped: false,
    profileKey
  };
}

/** @deprecated Use filterCatalogForExternalAccess */
function filterCatalogForProfileKey(catalog, profileKey) {
  if (!isExternalSystemProfileKey(profileKey)) {
    return catalog;
  }
  return filterCatalogForExternalAccess(catalog, { profileKey: String(profileKey) });
}

module.exports = {
  EXTERNAL_PROFILE_DEFAULT_MODULE_KEYS,
  EXTERNAL_PROFILE_KEYS,
  isExternalSystemProfileKey,
  getExternalProfileDefaultModuleKeys,
  isPlatformAdminCatalogModule,
  filterCatalogForExternalAccess,
  filterCatalogForProfileKey
};
