<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-200/60 dark:bg-neutral-950">
    <div
      v-if="!isEmailFormat"
      class="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <p class="text-xs" :class="ui.textMuted">{{ t('templates.builderPreviewPdfHint') }}</p>
      <button
        type="button"
        :class="ui.btnGhost"
        :disabled="previewBusy"
        @click="emit('refresh')"
      >
        <ArrowPathIcon class="h-3.5 w-3.5" :class="previewBusy ? 'animate-spin' : ''" />
        {{ previewBusy ? t('templates.rendering') : t('templates.builderPreviewRefresh') }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-auto p-4">
      <div v-if="previewBusy && !isEmailFormat" class="flex h-full min-h-[24rem] items-center justify-center">
        <p class="text-sm" :class="ui.textMuted">{{ t('templates.rendering') }}</p>
      </div>

      <EmailPreviewFrame
        v-else-if="isEmailFormat"
        class="mx-auto max-w-5xl"
        :html="emailHtml"
        :css="emailCss"
        :viewport="previewDevice"
        :color-scheme="colorScheme"
      />

      <iframe
        v-else-if="pdfPreviewUrl"
        :key="pdfPreviewUrl"
        :src="pdfPreviewUrl"
        class="mx-auto block min-h-[calc(100vh-12rem)] w-full max-w-5xl rounded-lg border bg-white shadow-lg"
        :class="ui.border"
        :title="t('templates.builderViewPreview')"
      />

      <iframe
        v-else
        :key="htmlDocument"
        class="mx-auto block min-h-[calc(100vh-12rem)] w-full max-w-5xl rounded-lg border bg-white shadow-lg"
        :class="ui.border"
        sandbox=""
        :title="t('templates.builderViewPreview')"
        :srcdoc="htmlDocument"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import EmailPreviewFrame from './html/EmailPreviewFrame.vue';

defineProps({
  isEmailFormat: { type: Boolean, default: false },
  emailHtml: { type: String, default: '' },
  emailCss: { type: String, default: '' },
  htmlDocument: { type: String, default: '' },
  pdfPreviewUrl: { type: String, default: '' },
  previewDevice: { type: String, default: 'desktop' },
  previewBusy: { type: Boolean, default: false }
});

const emit = defineEmits(['refresh']);

const { t } = useI18n();
const ui = useBuilderUi();
const colorScheme = ref('light');
</script>
