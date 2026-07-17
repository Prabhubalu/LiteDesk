<template>
  <div
    class="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
    :class="compact ? 'max-w-sm' : 'w-full max-w-lg'"
  >
    <!-- Priority accent -->
    <div
      class="h-1 w-full"
      :class="accentBarClass"
      aria-hidden="true"
    />

    <!-- Header -->
    <div class="relative space-y-2 px-5 pt-4 sm:px-6 sm:pt-5">
      <div class="flex items-center justify-between gap-3">
        <AnnouncementOwnershipStrip
          :is-platform="isPlatform"
          compact
        />
        <div class="flex shrink-0 items-center gap-1.5">
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            :class="priorityPillClass"
          >
            {{ priorityLabel }}
          </span>
          <button
            v-if="showClose"
            type="button"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :aria-label="t('announcements.dismiss')"
            @click="$emit('dismiss')"
          >
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <h2
        :id="titleId || undefined"
        class="line-clamp-2 w-full text-lg font-semibold leading-snug tracking-tight text-neutral-900 dark:text-white sm:text-xl"
        :title="titleText"
      >
        {{ titleText }}
      </h2>
      <p
        v-if="shortDescription"
        class="line-clamp-3 w-full text-sm leading-relaxed text-neutral-600 dark:text-neutral-300"
        :title="shortDescription"
      >
        {{ shortDescription }}
      </p>
    </div>

    <!-- Body (sole scroll region) -->
    <div class="relative">
      <div
        ref="bodyScrollEl"
        class="space-y-4 overflow-y-auto px-5 py-4 sm:px-6"
        :class="compact ? 'max-h-52' : 'max-h-[min(56vh,32rem)]'"
        @scroll="syncScrollFade"
      >
        <AnnouncementMediaBlock
          v-if="hasMedia"
          :image-url="imageUrl"
          :youtube-url="youtubeUrl"
          :attachments="attachments"
          :image-alt="titleText"
          class="overflow-hidden rounded-xl"
        />
        <div
          v-if="body"
          class="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-200"
        >
          {{ body }}
        </div>
        <p
          v-else-if="!shortDescription && !hasMedia"
          class="text-sm text-neutral-400 dark:text-neutral-500"
        >
          {{ t('announcements.popoverEmptyBody') }}
        </p>
      </div>
      <div
        v-if="showScrollFade"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent dark:from-neutral-900"
        aria-hidden="true"
      />
    </div>

    <!-- Actions -->
    <div class="border-t border-neutral-100 bg-neutral-50/80 px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-950/50 sm:px-6">
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <template v-if="interactive">
          <button
            v-if="showDismissInFooter"
            type="button"
            class="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="$emit('dismiss')"
          >
            {{ t('announcements.dismiss') }}
          </button>
          <button
            v-for="cta in visibleCtas"
            :key="cta.id || cta.label"
            type="button"
            class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            @click="$emit('cta', cta)"
          >
            {{ cta.label }}
          </button>
          <button
            v-if="requireAcknowledgement"
            type="button"
            class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            @click="$emit('acknowledge')"
          >
            {{ t('announcements.acknowledge') }}
          </button>
        </template>
        <template v-else>
          <span
            v-if="showDismissInFooter"
            class="rounded-xl px-4 py-2.5 text-center text-sm font-medium text-neutral-600 dark:text-neutral-300"
          >
            {{ t('announcements.dismiss') }}
          </span>
          <span
            v-for="(cta, index) in visibleCtas"
            :key="index"
            class="rounded-xl bg-primary-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm"
          >
            {{ cta.label }}
          </span>
          <span
            v-if="requireAcknowledgement"
            class="rounded-xl bg-primary-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm"
          >
            {{ t('announcements.acknowledge') }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import AnnouncementMediaBlock from '@/components/announcements/AnnouncementMediaBlock.vue';
import AnnouncementOwnershipStrip from '@/components/announcements/AnnouncementOwnershipStrip.vue';

type Attachment = { name?: string; url: string };
type Cta = { id?: string; label: string; target?: string };

const props = withDefaults(defineProps<{
  title?: string;
  shortDescription?: string;
  body?: string;
  priority?: string;
  imageUrl?: string | null;
  youtubeUrl?: string | null;
  attachments?: Attachment[];
  ctas?: Cta[];
  isPlatform?: boolean;
  dismissible?: boolean;
  requireAcknowledgement?: boolean;
  interactive?: boolean;
  compact?: boolean;
  titleId?: string;
}>(), {
  title: '',
  shortDescription: '',
  body: '',
  priority: 'medium',
  imageUrl: null,
  youtubeUrl: null,
  attachments: () => [],
  ctas: () => [],
  isPlatform: false,
  dismissible: true,
  requireAcknowledgement: false,
  interactive: true,
  compact: false,
  titleId: '',
});

defineEmits<{
  dismiss: [];
  acknowledge: [];
  cta: [cta: Cta];
}>();

const { t } = useI18n();
const bodyScrollEl = ref<HTMLElement | null>(null);
const showScrollFade = ref(false);
let resizeObserver: ResizeObserver | null = null;

function syncScrollFade() {
  const el = bodyScrollEl.value;
  if (!el) {
    showScrollFade.value = false;
    return;
  }
  const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
  showScrollFade.value = remaining > 8;
}

onMounted(() => {
  void nextTick(() => {
    syncScrollFade();
    if (typeof ResizeObserver !== 'undefined' && bodyScrollEl.value) {
      resizeObserver = new ResizeObserver(() => syncScrollFade());
      resizeObserver.observe(bodyScrollEl.value);
    }
  });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => [props.body, props.imageUrl, props.youtubeUrl, props.attachments, props.compact],
  () => {
    void nextTick(() => syncScrollFade());
  },
);

const titleText = computed(() => props.title?.trim() || t('announcements.fieldTitle'));

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

const accentBarClass = computed(() => {
  switch (props.priority) {
    case 'critical':
      return 'bg-danger-600';
    case 'high':
      return 'bg-warning-600';
    case 'medium':
      return 'bg-primary-600';
    case 'low':
      return 'bg-neutral-500';
    case 'information':
      return 'bg-primary-700';
    default:
      return 'bg-primary-600';
  }
});

const priorityPillClass = computed(() => {
  switch (props.priority) {
    case 'critical':
      return 'bg-danger-50 text-danger-700 dark:bg-danger-950/50 dark:text-danger-300';
    case 'high':
      return 'bg-warning-50 text-warning-800 dark:bg-warning-950/40 dark:text-warning-300';
    case 'medium':
      return 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300';
    case 'low':
      return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300';
    case 'information':
      return 'bg-primary-50 text-primary-800 dark:bg-primary-950/50 dark:text-primary-200';
    default:
      return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300';
  }
});

const hasMedia = computed(() => (
  Boolean(props.imageUrl || props.youtubeUrl || (props.attachments || []).some((f) => f.url))
));

const visibleCtas = computed(() => (
  (props.ctas || []).filter((cta) => String(cta.label || '').trim())
));

const showClose = computed(() => (
  props.dismissible !== false && !props.requireAcknowledgement
));

const showDismissInFooter = computed(() => (
  !props.requireAcknowledgement && props.dismissible !== false
));
</script>
