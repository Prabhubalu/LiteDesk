import { computed, unref } from 'vue';
import { modulesWithFieldCatalog } from '@/utils/fieldRbacPermission';

export function getEntitledAppKeys(appEntitlements) {
  return (appEntitlements || [])
    .filter((e) => e && e.enabled !== false)
    .map((e) => String(e.appKey || '').toUpperCase())
    .filter(Boolean);
}

/**
 * Whether a catalog module row should appear for the role's app entitlements.
 * @param {object} module
 * @param {string[]} entitledAppKeys
 * @param {string} userType
 */
export function isModuleVisibleForRoleAccess(module, entitledAppKeys, userType) {
  if (!module) return false;
  const scope = module.scope || 'app';
  const entitled = entitledAppKeys || [];

  if (scope === 'platform') {
    return userType !== 'EXTERNAL';
  }

  if (scope === 'core') {
    const participating = Array.isArray(module.participatingApps)
      ? module.participatingApps.map((a) => String(a).toUpperCase())
      : [];
    if (!participating.length) return entitled.length > 0;
    return participating.some((app) => entitled.includes(app));
  }

  if (scope === 'app') {
    const appKey = String(module.appKey || '').toUpperCase();
    return Boolean(appKey && entitled.includes(appKey));
  }

  return true;
}

export function moduleHasReadAccess(permissions, module) {
  const perms = permissions?.[module?.key];
  if (!perms) return false;
  return perms.read === true || perms.view === true;
}

/**
 * Filter field permission keys when an app entitlement is removed.
 * @param {Record<string, string>} fieldPermissions
 * @param {string} appKey
 */
export function stripFieldPermissionsForApp(fieldPermissions, appKey) {
  const prefix = `${String(appKey || '').toUpperCase()}.`;
  const next = { ...fieldPermissions };
  for (const key of Object.keys(next)) {
    if (key.startsWith(prefix)) delete next[key];
  }
  return next;
}

/**
 * @param {import('vue').MaybeRefOrGetter<object[]>} modules
 * @param {import('vue').MaybeRefOrGetter<object[]>} sections
 * @param {import('vue').MaybeRefOrGetter<object[]>} appEntitlements
 * @param {import('vue').MaybeRefOrGetter<object>} permissions
 * @param {import('vue').MaybeRefOrGetter<string>} userType
 * @param {import('vue').MaybeRefOrGetter<boolean>} rbacV2
 */
export function useRoleAccessCatalog({
  modules,
  sections,
  appEntitlements,
  permissions,
  userType,
  rbacV2
}) {
  const entitledAppKeys = computed(() => getEntitledAppKeys(unref(appEntitlements)));

  const accessVisibleModules = computed(() => {
    const all = unref(modules) || [];
    if (!unref(rbacV2)) return all;

    const entitled = entitledAppKeys.value;
    const type = unref(userType) || 'INTERNAL';
    return all.filter((mod) => isModuleVisibleForRoleAccess(mod, entitled, type));
  });

  const accessVisibleSections = computed(() => {
    const allSections = unref(sections) || [];
    if (!unref(rbacV2)) return allSections;

    const visibleSectionIds = new Set(
      accessVisibleModules.value.map((m) => m.sectionId || 'default')
    );
    return allSections.filter((s) => visibleSectionIds.has(s.id));
  });

  const modulesByVisibleSection = computed(() => {
    const map = {};
    for (const mod of accessVisibleModules.value) {
      const sid = mod.sectionId || 'default';
      if (!map[sid]) map[sid] = [];
      map[sid].push(mod);
    }
    return map;
  });

  const fieldPermissionModules = computed(() =>
    modulesWithFieldCatalog(
      accessVisibleModules.value.filter((m) => moduleHasReadAccess(unref(permissions), m))
    )
  );

  const hasEntitledApps = computed(() => entitledAppKeys.value.length > 0);

  return {
    entitledAppKeys,
    accessVisibleModules,
    accessVisibleSections,
    modulesByVisibleSection,
    fieldPermissionModules,
    hasEntitledApps
  };
}
