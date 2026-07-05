import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForMedia } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

export interface CompanyLogoAsset {
  _id?: string;
  assetId?: string;
  downloadUrl?: string;
  accessibilityAltText?: string;
  filename?: string;
}

export interface CompanyLogoPayload {
  asset: CompanyLogoAsset | null;
  organizationLogoUrl: string | null;
  organizationName?: string;
}

const sharedAsset = ref<CompanyLogoAsset | null>(null);
const sharedOrganizationLogoUrl = ref('');
const sharedOrganizationName = ref('');
const sharedLoading = ref(false);
let inflightRequest: Promise<CompanyLogoPayload | null> | null = null;
let cachedPayload: CompanyLogoPayload | null = null;

export function stripAuthTokenFromDownloadUrl(url: string): string {
  const source = String(url || '').trim();
  if (!source || !source.includes('/files/download')) return source;

  try {
    const parsed = new URL(source, 'http://local');
    parsed.searchParams.delete('token');
    const search = parsed.searchParams.toString();
    const pathAndQuery = `${parsed.pathname}${search ? `?${search}` : ''}`;
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return `${parsed.origin}${pathAndQuery}`;
    }
    return pathAndQuery;
  } catch {
    return source
      .replace(/([?&])token=[^&]*(?=&|$)/g, (_, prefix) => prefix)
      .replace(/[?&]$/, '');
  }
}

export function resolveAssetDownloadUrl(downloadUrl?: string | null): string {
  if (!downloadUrl) return '';

  const normalized = stripAuthTokenFromDownloadUrl(downloadUrl);
  const resolved = getApiUrlForMedia(normalized);
  if (!resolved.includes('/files/download')) {
    return resolved;
  }

  const authStore = useAuthStore();
  const token = authStore.user?.token;
  if (!token) return resolved;

  return `${resolved}${resolved.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

export function invalidateCompanyLogoCache(): void {
  cachedPayload = null;
  inflightRequest = null;
}

export function useCompanyLogoAsset() {
  async function ensureCompanyLogo(force = false): Promise<CompanyLogoPayload | null> {
    if (!force && cachedPayload) {
      sharedAsset.value = cachedPayload.asset || null;
      sharedOrganizationLogoUrl.value = String(cachedPayload.organizationLogoUrl || '');
      sharedOrganizationName.value = String(cachedPayload.organizationName || '');
      return cachedPayload;
    }

    if (!force && inflightRequest) {
      return inflightRequest;
    }

    sharedLoading.value = true;
    inflightRequest = (async () => {
      try {
        const response = await apiClient.get('/content-assets/company-logo', { cache: 'no-store' });
        if (!response?.success) {
          cachedPayload = null;
          sharedAsset.value = null;
          sharedOrganizationLogoUrl.value = '';
          sharedOrganizationName.value = '';
          return null;
        }

        const data = response.data as CompanyLogoPayload;
        cachedPayload = data;
        sharedAsset.value = data?.asset || null;
        sharedOrganizationLogoUrl.value = String(data?.organizationLogoUrl || '');
        sharedOrganizationName.value = String(data?.organizationName || '');
        return data;
      } catch {
        return cachedPayload;
      } finally {
        sharedLoading.value = false;
        inflightRequest = null;
      }
    })();

    return inflightRequest;
  }

  function companyLogoAssetUrl(): string {
    return resolveAssetDownloadUrl(sharedAsset.value?.downloadUrl);
  }

  return {
    asset: sharedAsset,
    organizationLogoUrl: sharedOrganizationLogoUrl,
    organizationName: sharedOrganizationName,
    loading: sharedLoading,
    ensureCompanyLogo,
    companyLogoAssetUrl,
    invalidateCompanyLogoCache
  };
}
