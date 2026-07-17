import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import {
  captureAnnouncementCtaClicked,
  captureAnnouncementViewed,
} from '@/config/posthogAnnouncements';

export type AnnouncementCta = {
  id: string;
  label: string;
  actionType: string;
  target: string;
  style?: string;
  sortOrder?: number;
};

export type AnnouncementViewModel = {
  id: string;
  title: string;
  shortDescription?: string;
  detailedDescription?: string;
  displayType: 'banner' | 'popover';
  priority: string;
  content?: {
    body?: string;
    imageUrl?: string | null;
    icon?: string | null;
    youtubeUrl?: string | null;
    attachments?: Array<{
      name?: string;
      url: string;
      mime?: string | null;
      size?: number | null;
    }>;
  };
  ctas?: AnnouncementCta[];
  userBehaviour?: {
    dismissible?: boolean;
    stickyBanner?: boolean;
    autoCloseSeconds?: number | null;
    requireAcknowledgement?: boolean;
  };
  ownership?: { scope: string };
  isPlatform?: boolean;
  remainingDays?: number | null;
};

const banner = ref<AnnouncementViewModel | null>(null);
const popover = ref<AnnouncementViewModel | null>(null);
const loading = ref(false);
const initialized = ref(false);
let loadPromise: Promise<void> | null = null;

function resolveSurface(): string {
  if (typeof window === 'undefined') return 'web_app';
  const path = window.location.pathname || '';
  if (path.startsWith('/portal')) return 'portal';
  return 'web_app';
}

async function refreshActive(): Promise<void> {
  loading.value = true;
  try {
    const res = await apiClient.get('/announcements/runtime/active', {
      params: {
        surface: resolveSurface(),
        // Bust any intermediary caches so dismiss/ack survive refresh.
        _: String(Date.now()),
      },
      cache: 'no-store',
    });
    banner.value = res?.data?.banner || null;
    popover.value = res?.data?.popover || null;
  } catch {
    // Addon may be uninstalled — fail quietly for runtime surfaces.
    banner.value = null;
    popover.value = null;
  } finally {
    loading.value = false;
    initialized.value = true;
  }
}

export function useAnnouncements() {
  async function initializeIfReady() {
    if (initialized.value || loadPromise) return loadPromise;
    loadPromise = refreshActive().finally(() => {
      loadPromise = null;
    });
    return loadPromise;
  }

  function runtimeBody() {
    return {
      surface: resolveSurface(),
      platform: typeof navigator !== 'undefined' ? navigator.platform || null : null,
      deviceType: typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
        ? 'mobile'
        : 'desktop',
    };
  }

  function metaFor(id: string) {
    const doc = banner.value?.id === id ? banner.value : popover.value?.id === id ? popover.value : null;
    return {
      display_type: doc?.displayType,
      priority: doc?.priority,
      is_platform: Boolean(doc?.isPlatform),
      surface: resolveSurface(),
    };
  }

  async function recordView(id: string) {
    await apiClient.post(`/announcements/runtime/${id}/view`, runtimeBody());
    captureAnnouncementViewed(id, metaFor(id));
  }

  async function dismiss(id: string) {
    await apiClient.post(`/announcements/runtime/${id}/dismiss`, runtimeBody());
    if (banner.value?.id === id) banner.value = null;
    if (popover.value?.id === id) popover.value = null;
  }

  async function acknowledge(id: string) {
    await apiClient.post(`/announcements/runtime/${id}/acknowledge`, runtimeBody());
    if (banner.value?.id === id) banner.value = null;
    if (popover.value?.id === id) popover.value = null;
  }

  async function clickCta(announcementId: string, ctaId: string) {
    const res = await apiClient.post(
      `/announcements/runtime/${announcementId}/cta/${ctaId}/click`,
      runtimeBody(),
    );
    captureAnnouncementCtaClicked(announcementId, ctaId, metaFor(announcementId));
    return res?.data as { target?: string; actionType?: string } | undefined;
  }

  function reset() {
    banner.value = null;
    popover.value = null;
    initialized.value = false;
  }

  return {
    banner: computed(() => banner.value),
    popover: computed(() => popover.value),
    loading: computed(() => loading.value),
    initializeIfReady,
    refreshActive,
    recordView,
    dismiss,
    acknowledge,
    clickCta,
    reset,
  };
}
