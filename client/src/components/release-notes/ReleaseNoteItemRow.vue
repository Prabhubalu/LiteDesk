<template>
  <div class="py-2">
    <span class="mb-1.5 inline-flex items-center gap-1.5">
      <span
        class="h-2 w-2 shrink-0 rounded-full"
        :class="typeAccentClass"
        aria-hidden="true"
      />
      <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ typeLabel }}
      </span>
    </span>

    <p v-if="isBlockDescription" class="text-sm leading-relaxed">
      <span class="font-semibold text-gray-900 dark:text-white">{{ title }}</span>
    </p>
    <p
      v-else
      class="text-sm leading-relaxed text-gray-600 dark:text-gray-300"
    >
      <span class="font-semibold text-gray-900 dark:text-white">{{ title }}</span>
      <template v-if="safeDescriptionHtml">
        <span class="px-1.5 text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
        <span
          class="release-note-item-body"
          v-html="safeDescriptionHtml"
        />
      </template>
    </p>

    <div
      v-if="isBlockDescription && safeDescriptionHtml"
      class="release-note-item-body mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
      v-html="safeDescriptionHtml"
    />

    <div
      v-if="resolvedImageUrl || (ctaLabel && ctaUrl)"
      class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <button
        v-if="resolvedImageUrl"
        type="button"
        class="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        @click="showImagePreview = true"
      >
        <PhotoIcon class="h-3.5 w-3.5" aria-hidden="true" />
        {{ t('releaseNotes.itemImagePreview') }}
      </button>

      <button
        v-if="ctaLabel && ctaUrl"
        type="button"
        class="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        @click="onCtaClick"
      >
        {{ ctaLabel }}
        <ArrowTopRightOnSquareIcon v-if="isExternalCta" class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  </div>

  <Teleport to="body">
    <TransitionRoot as="template" :show="showImagePreview">
      <Dialog class="relative z-[10100]" @close="showImagePreview = false">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-150"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black/80" aria-hidden="true" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto p-4 sm:p-8">
          <div class="flex min-h-full items-center justify-center">
            <TransitionChild
              as="template"
              enter="ease-out duration-200"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-150"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="relative w-full max-w-5xl">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <DialogTitle class="text-sm font-medium text-white">
                    {{ title }}
                  </DialogTitle>
                  <button
                    type="button"
                    class="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                    @click="showImagePreview = false"
                  >
                    <span class="sr-only">{{ t('actions.close') }}</span>
                    <XMarkIcon class="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <img
                  :src="resolvedImageUrl"
                  :alt="title"
                  class="mx-auto max-h-[80vh] w-full rounded-lg object-contain"
                >
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ArrowTopRightOnSquareIcon,
  PhotoIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';
import { resolveReleaseNoteImageUrl } from '@/utils/releaseNoteImageUrl';
import { captureReleaseItemClicked } from '@/config/posthogReleaseNotes';

const TYPE_BADGE = {
  feature: {
    labelKey: 'releaseNotes.adminItemType_feature',
    accentClass: 'bg-emerald-500'
  },
  improvement: {
    labelKey: 'releaseNotes.adminItemType_improvement',
    accentClass: 'bg-indigo-500'
  },
  bugfix: {
    labelKey: 'releaseNotes.adminItemType_bugfix',
    accentClass: 'bg-amber-500'
  }
};

const props = defineProps({
  releaseId: { type: String, required: true },
  releaseVersion: { type: String, default: '' },
  itemId: { type: String, required: true },
  itemType: { type: String, default: 'feature' },
  title: { type: String, required: true },
  descriptionHtml: { type: String, default: '' },
  imageUrl: { type: String, default: null },
  ctaLabel: { type: String, default: null },
  ctaUrl: { type: String, default: null }
});

const emit = defineEmits(['navigate']);

const router = useRouter();
const { t } = useI18n();
const showImagePreview = ref(false);

const typeMeta = computed(() => TYPE_BADGE[props.itemType] || TYPE_BADGE.feature);
const typeLabel = computed(() => t(typeMeta.value.labelKey));
const typeAccentClass = computed(() => typeMeta.value.accentClass);

const safeDescriptionHtml = computed(() =>
  sanitizeRichDescriptionHtml(props.descriptionHtml || '')
);

const isBlockDescription = computed(() => {
  const html = safeDescriptionHtml.value;
  if (!html) return false;
  return /<(ul|ol|h[1-6]|blockquote|img)/i.test(html) || (html.match(/<p/gi) || []).length > 1;
});

const resolvedImageUrl = computed(() => resolveReleaseNoteImageUrl(props.imageUrl));

const isExternalCta = computed(() => {
  const url = String(props.ctaUrl || '');
  return url.startsWith('http://') || url.startsWith('https://');
});

function onCtaClick() {
  captureReleaseItemClicked(props.releaseId, props.itemId, {
    item_type: props.itemType,
    cta_url: props.ctaUrl,
    release_version: props.releaseVersion
  });

  const url = String(props.ctaUrl || '').trim();
  if (!url) return;

  if (url.startsWith('/')) {
    router.push(url);
    emit('navigate');
    return;
  }

  if (isExternalCta.value) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
</script>

<style scoped>
.release-note-item-body :deep(p) {
  display: inline;
  margin: 0;
}

.release-note-item-body :deep(a) {
  text-decoration: underline;
}
</style>
