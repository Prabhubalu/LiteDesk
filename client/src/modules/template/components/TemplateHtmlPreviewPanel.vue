<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <template v-if="canShow">
      <div
        v-if="busy && !hasPreview"
        class="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800/40"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('templates.rendering') }}</p>
      </div>

      <p
        v-else-if="error"
        class="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800/40 px-4 text-center text-sm text-red-700 dark:text-red-300"
      >
        {{ error }}
      </p>

      <EmailPreviewFrame
        v-else-if="isEmailFormat && hasPreview"
        class="min-h-0 h-0 w-full flex-1"
        fill-height
        :html="emailParts.html"
        :css="emailParts.css"
        viewport="desktop"
      />

      <iframe
        v-else-if="hasPreview"
        :key="previewDocument"
        class="block h-0 min-h-0 w-full flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
        sandbox=""
        :title="t('templates.previewSection')"
        :srcdoc="previewDocument"
      />

      <div
        v-else
        class="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4"
      >
        <p class="text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t('templates.previewUnavailable') }}
        </p>
      </div>
    </template>

    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4"
    >
      <p class="text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('templates.previewUnavailable') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EmailPreviewFrame from './html/EmailPreviewFrame.vue';
import { isEmailOutputFormat } from '@/constants/contentPageSettings';
import { resolvePreviewHtmlImageUrls } from '../utils/previewHtmlImages';
import { useTemplates } from '@/composables/useTemplates';
import { useAuthStore } from '@/stores/authRegistry';

const props = defineProps({
  templateId: { type: String, required: true },
  /** Template record (draftDefinition / outputFormat / moduleScope). */
  template: { type: Object, default: null }
});

const { t } = useI18n();
const authStore = useAuthStore();
const { renderHtmlPreview } = useTemplates();

const busy = ref(false);
const rawHtml = ref('');
const error = ref('');

const canRender = computed(() => authStore.can('templates', 'render'));
const isEmailFormat = computed(() => isEmailOutputFormat(props.template?.outputFormat));

const canShow = computed(() => {
  if (!canRender.value || !props.template) return false;
  return Boolean(
    props.template.latestPublishedVersion
    || props.template.draftDefinition
    || props.template.draftVersionId
  );
});

const hasPreview = computed(() => Boolean(String(rawHtml.value || '').trim()));

const previewDocument = computed(() => resolvePreviewHtmlImageUrls(rawHtml.value));

const emailParts = computed(() => {
  const full = String(rawHtml.value || '');
  if (!full.trim()) return { html: '', css: '' };
  const bodyMatch = full.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const styles = [...full.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
  return {
    html: resolvePreviewHtmlImageUrls(bodyMatch ? bodyMatch[1] : full),
    css: styles.join('\n\n')
  };
});

async function loadPreview() {
  if (!canShow.value || !props.templateId) {
    rawHtml.value = '';
    error.value = '';
    return;
  }

  busy.value = true;
  error.value = '';
  try {
    const options = {
      recordModuleKey: props.template?.moduleScope || undefined
    };
    if (!props.template?.latestPublishedVersion && props.template?.draftDefinition) {
      options.jsonDefinition = props.template.draftDefinition;
    }
    rawHtml.value = await renderHtmlPreview(props.templateId, options);
  } catch (err) {
    rawHtml.value = '';
    error.value = err?.message || t('templates.renderFailed');
  } finally {
    busy.value = false;
  }
}

watch(
  () => [props.templateId, props.template?.draftVersionId, props.template?.latestPublishedVersion, props.template?.updatedAt],
  () => {
    void loadPreview();
  },
  { immediate: true }
);
</script>
