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
let activeFetchedAt = 0;
const ACTIVE_FETCH_TTL_MS = 10_000;

function resolveSurface(): string {
  if (typeof window === 'undefined') return 'web_app';
  const path = window.location.pathname || '';
  if (path.startsWith('/portal')) return 'portal';
  return 'web_app';
}

async function refreshActive(options: { force?: boolean } = {}): Promise<void> {
  if (
    !options.force
    && activeFetchedAt
    && Date.now() - activeFetchedAt < ACTIVE_FETCH_TTL_MS
  ) {
    return;
  }
  if (loadPromise) return loadPromise;

  loading.value = true;
  loadPromise = (async () => {
    try {
      // getOptional: missing route / unentitled addon must never surface as a toast.
      const res = await apiClient.getOptional('/announcements/runtime/active', {
        params: {
          surface: resolveSurface(),
          // Bust any intermediary caches so dismiss/ack survive refresh.
          _: String(Date.now()),
        },
        cache: 'no-store',
      });
      banner.value = res?.data?.banner || null;
      popover.value = res?.data?.popover || null;
      activeFetchedAt = Date.now();
    } catch {
      // Network / unexpected — keep runtime surfaces quiet.
      banner.value = null;
      popover.value = null;
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

export function useAnnouncements() {
  async function initializeIfReady() {
    if (initialized.value && !loadPromise) return;
    return refreshActive();
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
    try {
      await apiClient.postOptional(`/announcements/runtime/${id}/view`, runtimeBody());
      captureAnnouncementViewed(id, metaFor(id));
    } catch {
      // non-blocking
    }
  }

  async function dismiss(id: string) {
    try {
      await apiClient.postOptional(`/announcements/runtime/${id}/dismiss`, runtimeBody());
    } catch {
      // still clear local surface
    }
    if (banner.value?.id === id) banner.value = null;
    if (popover.value?.id === id) popover.value = null;
  }

  async function acknowledge(id: string) {
    try {
      await apiClient.postOptional(`/announcements/runtime/${id}/acknowledge`, runtimeBody());
    } catch {
      // still clear local surface
    }
    if (banner.value?.id === id) banner.value = null;
    if (popover.value?.id === id) popover.value = null;
  }

  async function clickCta(announcementId: string, ctaId: string) {
    try {
      const res = await apiClient.postOptional(
        `/announcements/runtime/${announcementId}/cta/${ctaId}/click`,
        runtimeBody(),
      );
      captureAnnouncementCtaClicked(announcementId, ctaId, metaFor(announcementId));
      return res?.data as { target?: string; actionType?: string } | undefined;
    } catch {
      return undefined;
    }
  }

  function reset() {
    banner.value = null;
    popover.value = null;
    initialized.value = false;
    activeFetchedAt = 0;
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
