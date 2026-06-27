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
    'documents',
    'invoices',
    'forms',
    'responses',
    'events'
  ]),
  [SYSTEM_PROFILE_KEYS.PORTAL_VIEWER]: Object.freeze([
    'cases',
    'documents',
    'invoices',
    'forms',
    'responses',
    'events'
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
 * @param {{ modules: object[], sections: object[] }} catalog
 * @param {{ profileKey?: string|null }} [options]
 */
function filterCatalogForExternalAccess(catalog, options = {}) {
  if (!catalog) {
    return catalog;
  }

  const modules = (catalog.modules || []).filter((mod) => !isPlatformAdminCatalogModule(mod));
  const visibleSectionIds = new Set(modules.map((m) => m.sectionId || 'default'));
  const sections = (catalog.sections || []).filter((s) => visibleSectionIds.has(s.id));

  const profileKey = options.profileKey ? String(options.profileKey) : null;

  return {
    ...catalog,
    modules,
    sections,
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
