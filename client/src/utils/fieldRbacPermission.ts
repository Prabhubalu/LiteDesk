import { isRbacV2Enabled } from '@/utils/rbacFeatureFlags';

export type FieldRbacLevel = 'hidden' | 'read' | 'write';

export type FieldPermissionsMap = Record<string, FieldRbacLevel>;

export function normalizeModuleKeyForFieldRbac(moduleKey: string): string {
  const k = String(moduleKey || '').toLowerCase();
  return k === 'contacts' ? 'people' : k;
}

export function buildFieldPermissionKey(
  appKey: string | null | undefined,
  moduleKey: string,
  fieldKey: string
): string {
  const mod = normalizeModuleKeyForFieldRbac(moduleKey);
  const field = String(fieldKey || '').trim();
  const app = appKey ? String(appKey).toUpperCase() : '_CORE';
  return `${app}.${mod}.${field}`;
}

export function resolveFieldRbacLevel(
  fieldPermissions: FieldPermissionsMap | null | undefined,
  appKey: string | null | undefined,
  moduleKey: string,
  fieldKey: string
): FieldRbacLevel | null {
  if (!fieldPermissions || !fieldKey) return null;
  const mod = normalizeModuleKeyForFieldRbac(moduleKey);
  const field = String(fieldKey).trim();
  const candidates: string[] = [];
  if (appKey) candidates.push(`${String(appKey).toUpperCase()}.${mod}.${field}`);
  candidates.push(`_CORE.${mod}.${field}`);
  candidates.push(`${mod}.${field}`);
  for (const key of candidates) {
    const level = fieldPermissions[key];
    if (level === 'hidden' || level === 'read' || level === 'write') return level;
  }
  return null;
}

export function isFieldHiddenByRbac(
  fieldPermissions: FieldPermissionsMap | null | undefined,
  appKey: string | null | undefined,
  moduleKey: string,
  fieldKey: string
): boolean {
  return resolveFieldRbacLevel(fieldPermissions, appKey, moduleKey, fieldKey) === 'hidden';
}

export function isFieldReadOnlyByRbac(
  fieldPermissions: FieldPermissionsMap | null | undefined,
  appKey: string | null | undefined,
  moduleKey: string,
  fieldKey: string
): boolean {
  return resolveFieldRbacLevel(fieldPermissions, appKey, moduleKey, fieldKey) === 'read';
}

export type FieldRbacAuthContext = {
  fieldPermissions?: FieldPermissionsMap;
  fieldPermissionAppKey?: string | null;
  bypass?: boolean;
};

export function getFieldRbacAuthContext(
  user: {
    isOwner?: boolean;
    fieldPermissions?: FieldPermissionsMap;
    fieldPermissionAppKey?: string | null;
  } | null | undefined,
  organization?: { settings?: { rbacV2Enabled?: boolean } } | null
): FieldRbacAuthContext | null {
  if (!user || !isRbacV2Enabled(organization)) return null;
  if (user.isOwner) return { bypass: true };
  const perms = user.fieldPermissions;
  if (!perms || Object.keys(perms).length === 0) return null;
  return {
    fieldPermissions: perms,
    fieldPermissionAppKey: user.fieldPermissionAppKey ?? 'SALES'
  };
}

export function setFieldRbacLevel(
  fieldPermissions: FieldPermissionsMap,
  appKey: string | null | undefined,
  moduleKey: string,
  fieldKey: string,
  level: FieldRbacLevel | 'inherit'
): FieldPermissionsMap {
  const key = buildFieldPermissionKey(appKey, moduleKey, fieldKey);
  const next = { ...fieldPermissions };
  if (level === 'inherit') {
    delete next[key];
    return next;
  }
  next[key] = level;
  return next;
}

export function mergeFieldPermissionMaps(
  base: FieldPermissionsMap | null | undefined,
  overrides: FieldPermissionsMap | null | undefined
): FieldPermissionsMap {
  return {
    ...(base || {}),
    ...(overrides || {})
  };
}

export function resolveFieldOverrideLevel(
  overrides: FieldPermissionsMap | null | undefined,
  appKey: string | null | undefined,
  moduleKey: string,
  fieldKey: string
): FieldRbacLevel | null {
  return resolveFieldRbacLevel(overrides, appKey, moduleKey, fieldKey);
}

export function resolveEffectiveFieldRbacLevel(
  overrides: FieldPermissionsMap | null | undefined,
  baseline: FieldPermissionsMap | null | undefined,
  appKey: string | null | undefined,
  moduleKey: string,
  fieldKey: string
): FieldRbacLevel | null {
  const override = resolveFieldOverrideLevel(overrides, appKey, moduleKey, fieldKey);
  if (override) return override;
  return resolveFieldRbacLevel(baseline, appKey, moduleKey, fieldKey);
}

export function countFieldOverridesForModule(
  overrides: FieldPermissionsMap | null | undefined,
  module: {
    moduleKey?: string;
    fieldPermissionAppKey?: string | null;
    appKey?: string | null;
    fieldCatalog?: Array<{ key: string }>;
  }
): number {
  if (!overrides || !module?.fieldCatalog?.length) return 0;
  const appKey = module.fieldPermissionAppKey || module.appKey || null;
  const moduleKey = module.moduleKey || '';
  return module.fieldCatalog.filter((field) =>
    Boolean(resolveFieldOverrideLevel(overrides, appKey, moduleKey, field.key))
  ).length;
}

export function moduleSupportsFieldPermissions(module: {
  supportsFieldPermissions?: boolean;
  fieldCatalog?: Array<{ key: string }>;
}) {
  return Boolean(
    module?.supportsFieldPermissions &&
      Array.isArray(module.fieldCatalog) &&
      module.fieldCatalog.length > 0
  );
}

export function modulesWithFieldCatalog(
  modules: Array<{
    moduleKey?: string;
    supportsFieldPermissions?: boolean;
    fieldCatalog?: Array<{ key: string; label?: string }>;
    fieldPermissionAppKey?: string;
    label?: string;
  }>
) {
  return (modules || []).filter(
    (m) => m.supportsFieldPermissions && Array.isArray(m.fieldCatalog) && m.fieldCatalog.length > 0
  );
}
