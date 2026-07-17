<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-meta uppercase tracking-wide text-neutral-500">
        {{ t('announcements.previewLabel') }}
      </p>
      <div class="flex items-center gap-1 rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-700">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition"
          :class="device === 'desktop'
            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
            : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'"
          @click="device = 'desktop'"
        >
          {{ t('announcements.previewDesktop') }}
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition"
          :class="device === 'mobile'
            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
            : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'"
          @click="device = 'mobile'"
        >
          {{ t('announcements.previewMobile') }}
        </button>
      </div>
    </div>

    <div
      class="min-h-0 flex-1 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-100 p-3 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div
        class="mx-auto overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
        :class="device === 'mobile' ? 'max-w-[280px]' : 'w-full'"
      >
        <div class="border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/60">
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            <span class="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            <span class="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            <span class="ml-2 truncate text-[10px] text-neutral-400">{{ t('announcements.previewAppChrome') }}</span>
          </div>
        </div>

        <!-- Banner preview -->
        <div
          v-if="displayType === 'banner'"
          class="relative w-full"
          :class="bannerSurfaceClass"
        >
          <div class="flex min-h-9 items-center justify-center gap-2 px-8 py-1.5 sm:px-10">
            <span
              class="hidden shrink-0 rounded-full border border-white/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white sm:inline-flex"
            >
              {{ ownershipBadge }}
            </span>
            <p class="min-w-0 truncate text-center text-sm leading-snug text-white">
              <span class="font-medium">{{ titleText }}</span>
              <span
                v-if="shortDescription"
                class="font-normal text-white/85"
              >
                — {{ shortDescription }}
              </span>
            </p>
            <nav
              v-if="previewLinks.length"
              class="flex shrink-0 items-center gap-1"
            >
              <span
                v-for="link in previewLinks"
                :key="link.key"
                class="whitespace-nowrap rounded-full bg-neutral-950 px-2.5 py-0.5 text-[10px] font-medium text-white"
              >
                {{ link.label }}
              </span>
            </nav>
            <span
              v-if="requireAcknowledgement"
              class="shrink-0 whitespace-nowrap rounded-full bg-neutral-950 px-2.5 py-0.5 text-[10px] font-medium text-white"
            >
              {{ t('announcements.acknowledge') }}
            </span>
          </div>
          <span
            v-if="dismissible && !requireAcknowledgement"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-white/75"
            aria-hidden="true"
          >
            ×
          </span>
        </div>

        <div
          v-if="displayType === 'banner'"
          class="space-y-2 p-4"
        >
          <div class="h-2 w-2/3 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div class="h-2 w-full rounded bg-neutral-100 dark:bg-neutral-800" />
          <div class="h-2 w-5/6 rounded bg-neutral-100 dark:bg-neutral-800" />
          <p class="pt-2 text-[10px] text-neutral-400">
            {{ priorityLabel }} · {{ t('announcements.typeBanner') }}
          </p>
        </div>

        <!-- Popover preview -->
        <div
          v-else
          class="relative flex justify-center bg-neutral-900/45 p-4 backdrop-blur-[1px] dark:bg-black/55"
        >
          <AnnouncementPopoverCard
            :title="title"
            :short-description="shortDescription"
            :body="body"
            :priority="priority"
            :image-url="imageUrl"
            :youtube-url="youtubeUrl"
            :attachments="attachments"
            :ctas="previewCtas"
            :dismissible="dismissible"
            :require-acknowledgement="requireAcknowledgement"
            :interactive="false"
            compact
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AnnouncementPopoverCard from '@/components/announcements/AnnouncementPopoverCard.vue';
import { useAuthStore } from '@/stores/authRegistry';
import {
  extractYoutubeVideoId,
  isSafeMediaUrl,
} from '@/utils/announcementMedia';

type Attachment = { name?: string; url: string };
type Cta = { label: string; target: string };

const props = withDefaults(defineProps<{
  title?: string;
  shortDescription?: string;
  body?: string;
  displayType?: 'banner' | 'popover';
  priority?: string;
  imageUrl?: string | null;
  youtubeUrl?: string | null;
  attachments?: Attachment[];
  ctas?: Cta[];
  dismissible?: boolean;
  requireAcknowledgement?: boolean;
}>(), {
  title: '',
  shortDescription: '',
  body: '',
  displayType: 'banner',
  priority: 'medium',
  imageUrl: null,
  youtubeUrl: null,
  attachments: () => [],
  ctas: () => [],
  dismissible: true,
  requireAcknowledgement: false,
});

const { t } = useI18n();
const authStore = useAuthStore();
const device = ref<'desktop' | 'mobile'>('desktop');

const titleText = computed(() => props.title?.trim() || t('announcements.fieldTitle'));

const ownershipBadge = computed(() => {
  const orgName = String(
    authStore.user?.organization?.name
    || authStore.organization?.name
    || '',
  ).trim();
  return orgName || t('announcements.fromOrg', { orgName: 'Org' });
});

const priorityLabel = computed(() => {
  const map: Record<string, string> = {
    critical: t('announcements.priorityCritical'),
    high: t('announcements.priorityHigh'),
    medium: t('announcements.priorityMedium'),
    low: t('announcements.priorityLow'),
    information: t('announcements.priorityInformation'),
  };
  return map[props.priority] || map.medium;
});

const bannerSurfaceClass = computed(() => {
  switch (props.priority) {
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

const previewCtas = computed(() => (
  (props.ctas || []).filter((cta) => String(cta.label || '').trim() && String(cta.target || '').trim())
));

const previewLinks = computed(() => {
  const links: Array<{ key: string; label: string }> = [];
  const seen = new Set<string>();

  for (const [index, cta] of previewCtas.value.entries()) {
    const target = String(cta.target).trim().toLowerCase();
    if (seen.has(target)) continue;
    seen.add(target);
    links.push({ key: `cta:${index}`, label: cta.label.trim() });
  }

  for (const [index, file] of (props.attachments || []).entries()) {
    const url = String(file?.url || '').trim();
    if (!isSafeMediaUrl(url) || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    links.push({
      key: `file:${index}`,
      label: String(file.name || '').trim() || t('announcements.attachmentFallback'),
    });
  }

  const youtubeId = extractYoutubeVideoId(props.youtubeUrl || null);
  if (youtubeId) {
    links.push({ key: 'youtube', label: t('announcements.watchVideo') });
  }

  return links.slice(0, 4);
});
</script>
