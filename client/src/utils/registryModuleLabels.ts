/**
 * Tenant-custom module labels from /ui/registry (vertical presets, settings overrides).
 * Indexed once per registry load; consumed by sidebar, tabs, and module lists.
 */

import type { AppRegistry, AppRegistryModule } from '@/types/sidebar.types';

export type TenantModuleLabels = {
  plural: string;
  singular: string;
  listLabel: string;
  createLabel: string;
  tenantLabel: boolean;
};

const byRoute = new Map<string, TenantModuleLabels>();
const byAppModule = new Map<string, TenantModuleLabels>();

function routeKey(moduleKey: string): string {
  return String(moduleKey || '').toLowerCase().replace(/-/g, '_');
}

function appModuleKey(appKey: string, moduleKey: string): string {
  return `${String(appKey || '').toUpperCase()}:${routeKey(moduleKey)}`;
}

const GENERIC_MODULE_TERMS: Record<string, { singular: string; plural: string }> = {
  deals: { singular: 'Deal', plural: 'Deals' },
  people: { singular: 'Person', plural: 'People' },
  contacts: { singular: 'Person', plural: 'People' },
  organizations: { singular: 'Organization', plural: 'Organizations' },
  tasks: { singular: 'Task', plural: 'Tasks' },
  events: { singular: 'Event', plural: 'Events' },
  items: { singular: 'Item', plural: 'Items' },
  forms: { singular: 'Form', plural: 'Forms' },
  quotes: { singular: 'Quote', plural: 'Quotes' },
};

function applyCasePattern(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source === source.toLowerCase()) return replacement.toLowerCase();
  if (
    source.charAt(0) === source.charAt(0).toUpperCase()
    && source.slice(1) === source.slice(1).toLowerCase()
  ) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }
  return replacement;
}

/** Swap generic module terms (Deal → Opportunity) in any UI string when tenant labels apply. */
export function applyTenantModuleTermsToLabel(moduleKey: string, label: string): string {
  const tenant = getTenantModuleLabelsByRoute(moduleKey);
  if (!tenant?.tenantLabel || !label) return label;

  const generic = GENERIC_MODULE_TERMS[routeKey(moduleKey)];
  if (!generic) return label;

  let result = String(label);
  for (const [from, to] of [
    [generic.plural, tenant.plural] as const,
    [generic.singular, tenant.singular] as const,
  ]) {
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) continue;
    const pattern = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(pattern, (match) => applyCasePattern(match, to));
  }
  return result;
}

function extractLabels(mod: AppRegistryModule): TenantModuleLabels | null {
  if (!mod?.moduleKey) return null;
  const tenantLabel = mod.tenantLabel === true;
  const plural = String(mod.pluralLabel || mod.label || '').trim();
  const singular = String(mod.singularLabel || mod.label || plural || '').trim();
  if (!plural && !singular) return null;

  const resolvedPlural = plural || singular;
  const resolvedSingular = singular || plural;

  if (tenantLabel) {
    return {
      plural: resolvedPlural,
      singular: resolvedSingular,
      listLabel: `All ${resolvedPlural}`,
      createLabel: `New ${resolvedSingular}`,
      tenantLabel: true,
    };
  }

  return {
    plural: resolvedPlural,
    singular: resolvedSingular,
    listLabel: String(mod.listLabel || `All ${resolvedPlural}`).trim(),
    createLabel: String(mod.createLabel || `New ${resolvedSingular}`).trim(),
    tenantLabel: false,
  };
}
export function indexRegistryModuleLabels(registry: AppRegistry): void {
  byRoute.clear();
  byAppModule.clear();

  for (const app of Object.values(registry)) {
    if (!app?.modules?.length) continue;
    for (const mod of app.modules) {
      const labels = extractLabels(mod);
      if (!labels) continue;

      const composite = appModuleKey(app.appKey, mod.moduleKey);
      byAppModule.set(composite, labels);

      if (labels.tenantLabel) {
        byRoute.set(routeKey(mod.moduleKey), labels);
      }
    }
  }
}

export function getTenantModuleLabelsByRoute(moduleRoute: string): TenantModuleLabels | null {
  return byRoute.get(routeKey(moduleRoute)) || null;
}

export function getTenantModuleLabels(
  appKey: string,
  moduleKey: string
): TenantModuleLabels | null {
  return byAppModule.get(appModuleKey(appKey, moduleKey)) || getTenantModuleLabelsByRoute(moduleKey);
}

export function getTenantModulePluralLabel(moduleRoute: string): string | null {
  const labels = getTenantModuleLabelsByRoute(moduleRoute);
  return labels?.tenantLabel ? labels.plural : null;
}

export function clearRegistryModuleLabels(): void {
  byRoute.clear();
  byAppModule.clear();
}
