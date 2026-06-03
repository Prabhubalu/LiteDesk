/** Platform-owned quote-to-cash modules; gated by Sales app entitlement. */

export const COMMERCIAL_PLATFORM_MODULE_KEYS = new Set([
  'quotes',
  'sales_orders',
  'invoices',
  'payments'
]);

export const COMMERCIAL_PARTICIPATION_APP_KEYS = new Set(['SALES']);

export function hasCommercialPlatformEntitlement(
  allowedAppKeys: Set<string>,
  hasExplicitUserAppAccess: boolean,
  hasAppAccess: (appKey: string) => boolean
): boolean {
  for (const appKey of COMMERCIAL_PARTICIPATION_APP_KEYS) {
    if (hasExplicitUserAppAccess) {
      if (allowedAppKeys.has(appKey)) return true;
    } else if (hasAppAccess(appKey)) {
      return true;
    }
  }
  return false;
}

export function isCommercialPlatformModuleKey(moduleKey: string | undefined): boolean {
  return COMMERCIAL_PLATFORM_MODULE_KEYS.has(String(moduleKey || '').toLowerCase());
}
