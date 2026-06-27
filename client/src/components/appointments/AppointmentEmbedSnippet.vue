<template>
  <section
    v-if="slug"
    class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80"
  >
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.embedHeading') }}</h2>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      {{ t('appointments.embedHint') }}
    </p>

    <div class="mt-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="activeTab === tab.id
          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="mt-3">
      <label class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('appointments.embedPreview') }}</label>
      <div class="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <div
          v-if="previewLoading"
          class="mx-auto flex max-w-[480px] items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800/50"
          :style="{ height: `${previewHeight}px` }"
        >
          <div class="h-9 w-9 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
        <iframe
          v-else-if="previewReady"
          :src="embedUrl"
          :title="t('appointments.embedPreviewTitle')"
          class="mx-auto block w-full max-w-[480px] rounded-lg border-0 bg-gray-50"
          :style="{ height: `${previewHeight}px` }"
        />
        <div
          v-else
          class="mx-auto flex max-w-[480px] items-center justify-center rounded-lg bg-gray-50 px-4 text-center text-sm text-gray-500 dark:bg-gray-800/50 dark:text-gray-400"
          :style="{ height: `${previewHeight}px` }"
        >
          {{ t('appointments.embedPreviewPending') }}
        </div>
      </div>
    </div>

    <div class="mt-4">
      <div class="flex items-center justify-between gap-2">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.embedCodeToCopy') }}</label>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          @click="copySnippet"
        >
          {{ copied ? t('appointments.embedCopied') : t('actions.copy') }}
        </button>
      </div>
      <pre
        class="mt-2 max-h-40 overflow-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-100"
      ><code>{{ activeSnippet }}</code></pre>
    </div>

    <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
      {{ t('appointments.embedUrlLabel') }}
      <a
        v-if="previewReady"
        :href="embedUrl"
        target="_blank"
        rel="noopener"
        class="text-indigo-600 underline dark:text-indigo-400"
      >{{ embedUrl }}</a>
      <span v-else class="text-gray-400">{{ embedUrl }}</span>
    </p>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  buildBookingPageUrl,
  buildBookingIframeSnippet,
  buildBookingScriptSnippet
} from '@/utils/appointmentFormatters';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  slug: { type: String, default: '' },
  previewHeight: { type: Number, default: 640 },
  previewReady: { type: Boolean, default: true },
  previewLoading: { type: Boolean, default: false }
});

const { t } = useI18n();
const { success: notifySuccess } = useNotifications();

const activeTab = ref('iframe');
const copied = ref(false);

const tabs = computed(() => [
  { id: 'iframe', label: t('appointments.embedTabIframe') },
  { id: 'script', label: t('appointments.embedTabScript') }
]);

const origin = computed(() =>
  typeof window !== 'undefined' ? window.location.origin : ''
);

const embedUrl = computed(() =>
  props.slug ? buildBookingPageUrl(props.slug, { embed: true, origin: origin.value }) : ''
);

const activeSnippet = computed(() => {
  if (!props.slug) return '';
  if (activeTab.value === 'script') {
    return buildBookingScriptSnippet(props.slug, {
      height: props.previewHeight,
      origin: origin.value
    });
  }
  return buildBookingIframeSnippet(props.slug, {
    height: props.previewHeight,
    origin: origin.value
  });
});

async function copySnippet() {
  if (!activeSnippet.value) return;
  await navigator.clipboard.writeText(activeSnippet.value);
  copied.value = true;
  notifySuccess(t('appointments.embedCodeCopied'));
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}
</script>
