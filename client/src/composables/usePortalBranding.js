import { ref } from 'vue';
import portalApiClient from '@/utils/portalApiClient';

export const PORTAL_DEFAULT_PRIMARY_COLOR = '#3a1f8a';

const branding = ref(null);
const loading = ref(false);
let loadPromise = null;

function applyCssVariables(data) {
  const color = data?.primaryColor || PORTAL_DEFAULT_PRIMARY_COLOR;
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--portal-brand-primary', color);
}

if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--portal-brand-primary', PORTAL_DEFAULT_PRIMARY_COLOR);
}

export function usePortalBranding() {
  async function loadBranding(force = false) {
    if (branding.value && !force) return branding.value;
    if (loadPromise && !force) return loadPromise;

    loading.value = true;
    loadPromise = portalApiClient.get('/org')
      .then((res) => {
        if (res?.success && res.data) {
          branding.value = {
            orgName: res.data.name || '',
            logoUrl: res.data.branding?.logoUrl || null,
            primaryColor: res.data.branding?.primaryColor || PORTAL_DEFAULT_PRIMARY_COLOR,
            supportEmail: res.data.branding?.supportEmail || null
          };
          applyCssVariables(branding.value);
        }
        return branding.value;
      })
      .catch(() => branding.value)
      .finally(() => {
        loading.value = false;
        loadPromise = null;
      });

    return loadPromise;
  }

  return {
    branding,
    loading,
    loadBranding
  };
}
