<template>
  <div
    v-if="announcement"
    ref="rootEl"
    role="region"
    :aria-label="regionLabel"
    :aria-live="announcement.priority === 'critical' ? 'assertive' : 'polite'"
    class="announcement-banner pointer-events-auto relative w-full"
    :class="[surfaceClass, stickyClass]"
  >
    <div class="mx-auto flex min-h-9 w-full max-w-5xl items-center justify-center gap-2.5 px-10 py-1.5 sm:px-12">
      <span
        class="hidden shrink-0 items-center rounded-full border border-white/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white sm:inline-flex"
      >
        {{ ownershipBadge }}
      </span>

      <p class="min-w-0 truncate text-center text-sm leading-snug text-white">
        <span class="font-medium">{{ announcement.title }}</span>
        <span
          v-if="announcement.shortDescription"
          class="font-normal text-white/85"
        >
          — {{ announcement.shortDescription }}
        </span>
      </p>

      <nav
        v-if="titleLinks.length"
        class="flex shrink-0 items-center gap-1.5"
        :aria-label="t('announcements.bannerLinksLabel')"
      >
        <button
          v-for="link in titleLinks"
          :key="link.key"
          type="button"
          class="whitespace-nowrap rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          @click="onTitleLink(link)"
        >
          {{ link.label }}
        </button>
      </nav>

      <button
        v-if="announcement.userBehaviour?.requireAcknowledgement"
        type="button"
        class="shrink-0 whitespace-nowrap rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-white hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        @click="onAcknowledge"
      >
        {{ t('announcements.acknowledge') }}
      </button>
    </div>

    <button
      v-if="!announcement.userBehaviour?.requireAcknowledgement && announcement.userBehaviour?.dismissible !== false"
      type="button"
      class="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-3"
      :aria-label="t('announcements.dismiss')"
      @click="onDismiss"
    >
      <XMarkIcon class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import {
  useAnnouncements,
  type AnnouncementCta,
  type AnnouncementViewModel,
} from '@/composables/useAnnouncements';
import { useAuthStore } from '@/stores/authRegistry';
import {
  extractYoutubeVideoId,
  isSafeMediaUrl,
} from '@/utils/announcementMedia';

type TitleLink = {
  key: string;
  label: string;
  kind: 'cta' | 'attachment' | 'youtube';
  cta?: AnnouncementCta;
  url?: string;
};

type PriorityTone = 'critical' | 'high' | 'medium' | 'information' | 'low';

const BANNER_OFFSET_VAR = '--platform-banner-offset';

const props = defineProps<{
  announcement: AnnouncementViewModel | null;
}>();

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { recordView, dismiss, acknowledge, clickCta } = useAnnouncements();
const rootEl = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

function setBannerOffset(height: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(BANNER_OFFSET_VAR, `${Math.max(0, Math.round(height))}px`);
}

function clearBannerOffset() {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(BANNER_OFFSET_VAR, '0px');
}

function syncBannerOffset() {
  // App.vue owns --platform-banner-offset when #platform-top-banners is mounted.
  if (typeof document !== 'undefined' && document.getElementById('platform-top-banners')) {
    return;
  }
  if (!rootEl.value) {
    clearBannerOffset();
    return;
  }
  setBannerOffset(rootEl.value.getBoundingClientRect().height);
}

const priority = computed((): PriorityTone => {
  const value = props.announcement?.priority;
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'information' || value === 'low') {
    return value;
  }
  return 'information';
});

const isPlatform = computed(() => (
  Boolean(props.announcement?.isPlatform || props.announcement?.ownership?.scope === 'platform')
));

const ownershipBadge = computed(() => {
  if (isPlatform.value) return t('announcements.fromPlatform');
  const orgName = String(
    authStore.user?.organization?.name
    || authStore.organization?.name
    || '',
  ).trim();
  return orgName || t('announcements.fromOrg', { orgName: 'Org' });
});

const regionLabel = computed(() => {
  const priorityKey = {
    critical: 'announcements.priorityCritical',
    high: 'announcements.priorityHigh',
    medium: 'announcements.priorityMedium',
    low: 'announcements.priorityLow',
    information: 'announcements.priorityInformation',
  }[priority.value];
  const title = props.announcement?.title || '';
  return `${t(priorityKey)}: ${title}`;
});

const surfaceClass = computed(() => {
  switch (priority.value) {
    case 'critical':
      return 'bg-gradient-to-r from-danger-700 to-danger-500';
    case 'high':
      return 'bg-gradient-to-r from-warning-700 to-amber-500';
    case 'medium':
      return 'bg-gradient-to-r from-primary-700 to-primary-500';
    case 'low':
      return 'bg-gradient-to-r from-neutral-700 to-neutral-500';
    default:
      return 'bg-gradient-to-r from-primary-700 to-violet-500';
  }
});

const titleLinks = computed((): TitleLink[] => {
  const links: TitleLink[] = [];
  const seen = new Set<string>();

  for (const cta of props.announcement?.ctas || []) {
    const target = String(cta?.target || '').trim();
    const label = String(cta?.label || '').trim();
    if (!cta?.id || !target || !label) continue;
    const key = `cta:${cta.id}`;
    if (seen.has(target.toLowerCase())) continue;
    seen.add(target.toLowerCase());
    links.push({ key, label, kind: 'cta', cta });
  }

  for (const [index, file] of (props.announcement?.content?.attachments || []).entries()) {
    const url = String(file?.url || '').trim();
    if (!isSafeMediaUrl(url)) continue;
    if (seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    links.push({
      key: `file:${index}`,
      label: String(file.name || '').trim() || t('announcements.attachmentFallback'),
      kind: 'attachment',
      url,
    });
  }

  const youtubeRaw = props.announcement?.content?.youtubeUrl || null;
  const youtubeId = extractYoutubeVideoId(youtubeRaw);
  if (youtubeId) {
    const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    if (!seen.has(watchUrl.toLowerCase()) && !seen.has(String(youtubeRaw).trim().toLowerCase())) {
      links.push({
        key: 'youtube',
        label: t('announcements.watchVideo'),
        kind: 'youtube',
        url: watchUrl,
      });
    }
  }

  return links.slice(0, 4);
});

const stickyClass = computed(() => (
  props.announcement?.userBehaviour?.stickyBanner ? 'sticky top-0 z-[60]' : 'relative z-[60]'
));

async function trackView() {
  if (!props.announcement?.id) return;
  try {
    await recordView(props.announcement.id);
  } catch {
    // non-blocking
  }
}

onMounted(() => {
  void trackView();
  void nextTick(() => {
    syncBannerOffset();
    if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
      resizeObserver = new ResizeObserver(() => {
        syncBannerOffset();
      });
      resizeObserver.observe(rootEl.value);
    }
  });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (typeof document !== 'undefined' && document.getElementById('platform-top-banners')) {
    return;
  }
  clearBannerOffset();
});

watch(
  () => props.announcement?.id,
  () => {
    void trackView();
    requestAnimationFrame(() => syncBannerOffset());
  },
);

watch(titleLinks, () => {
  requestAnimationFrame(() => syncBannerOffset());
});

async function onDismiss() {
  if (!props.announcement?.id) return;
  await dismiss(props.announcement.id);
}

async function onAcknowledge() {
  if (!props.announcement?.id) return;
  await acknowledge(props.announcement.id);
}

async function onTitleLink(link: TitleLink) {
  if (link.kind === 'cta' && link.cta) {
    await onCta(link.cta);
    return;
  }
  if (!link.url) return;
  window.open(link.url, '_blank', 'noopener,noreferrer');
}

async function onCta(cta: AnnouncementCta) {
  if (!props.announcement?.id) return;
  const result = await clickCta(props.announcement.id, cta.id);
  const target = result?.target || cta.target;
  const actionType = result?.actionType || cta.actionType;
  if (!target) return;
  if (actionType === 'external_url' || /^https?:\/\//i.test(target)) {
    window.open(target, '_blank', 'noopener,noreferrer');
    return;
  }
  await router.push(target);
}
</script>

<style scoped>
.announcement-banner {
  animation: announcement-banner-in 220ms ease-out;
}

@keyframes announcement-banner-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .announcement-banner {
    animation: none;
  }
}
</style>
