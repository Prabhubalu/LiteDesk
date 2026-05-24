export const SURFACE_LABEL_KEYS: Record<string, string>;
export const MODULE_LABEL_KEYS: Record<string, string>;
export const APP_NAME_KEYS: Record<string, string>;
export const ROUTE_TITLE_KEYS: Record<string, string>;

export function getModuleLabelKey(moduleKey: string): string | undefined;
export function getSurfaceLabelKey(surfaceId: string): string | undefined;
export function getAppNameKey(appKey: string): string | undefined;

export function resolveSidebarItemLabel(
  item: { labelKey?: string; label?: string },
  t: (key: string) => string
): string;

export function getTabTitleMetaForPath(
  path: string,
  params?: Record<string, unknown>
): { titleKey?: string; titleParams?: Record<string, unknown>; title?: string };

export function resolveTabTitle(
  tab: { titleKey?: string; titleParams?: Record<string, unknown>; title?: string; path?: string },
  t: (key: string, params?: Record<string, unknown>) => string,
  te?: (key: string) => boolean
): string;

export function enrichTabWithTitleKey(tab: {
  path?: string;
  params?: Record<string, unknown>;
  title?: string;
  titleKey?: string;
}): typeof tab;
