import apiClient from '@/utils/apiClient';

export type AddonNavItem = {
  addonKey: string;
  surfaceId: string;
  route: string;
  label: string;
  icon?: string;
  order?: number;
};

type CacheEntry = {
  orgId: string;
  items: AddonNavItem[];
  expiresAt: number;
};

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30_000;

export function invalidateAddonNavigationCache(): void {
  cache = null;
}

export async function fetchAddonNavigation(orgId: string): Promise<AddonNavItem[]> {
  const now = Date.now();
  if (cache && cache.orgId === orgId && cache.expiresAt > now) {
    return cache.items;
  }

  try {
    const res = await apiClient.get('/ui/addon-navigation');
    const items = Array.isArray(res?.data) ? res.data : [];
    cache = { orgId, items, expiresAt: now + CACHE_TTL_MS };
    return items;
  } catch (error) {
    console.warn('[fetchAddonNavigation] Failed to load addon navigation', error);
    return cache?.orgId === orgId ? cache.items : [];
  }
}
