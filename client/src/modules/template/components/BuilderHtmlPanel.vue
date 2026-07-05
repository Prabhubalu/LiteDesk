<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-100 dark:bg-neutral-950">
    <div
      class="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div class="min-w-0">
        <p class="text-xs" :class="ui.textMuted">{{ t('templates.builderViewHtmlHint') }}</p>
        <p
          v-if="syncing"
          class="mt-0.5 text-xs text-brand-600 dark:text-brand-400"
          role="status"
        >
          {{ t('templates.builderHtmlSyncing') }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          :class="ui.btnGhost"
          :disabled="syncing || !modelValue.trim()"
          @click="emit('apply')"
        >
          {{ t('templates.builderHtmlApplyToDesign') }}
        </button>
        <button type="button" :class="ui.btnGhost" @click="copyHtml">
          {{ t('templates.builderHtmlCopy') }}
        </button>
        <button type="button" :class="ui.btnGhost" @click="downloadHtml">
          {{ t('templates.builderHtmlDownload') }}
        </button>
      </div>
    </div>
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
      <HtmlCodeEditor
        :model-value="modelValue"
        :use-monaco="true"
        fill-height
        :placeholder="t('templates.builderHtmlPlaceholder')"
        @update:model-value="emit('update:modelValue', $event)"
        @edit="emit('edit')"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useNotifications } from '@/composables/useNotifications';
import HtmlCodeEditor from './html/HtmlCodeEditor.vue';
import { copyTextToClipboard, downloadTextFile, slugifyFilename } from '../utils/emailHtmlExport';

const props = defineProps({
  modelValue: { type: String, default: '' },
  downloadFilename: { type: String, default: 'template' },
  syncing: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'apply', 'edit']);

const { t } = useI18n();
const ui = useBuilderUi();
const notifications = useNotifications();

async function copyHtml() {
  const copied = await copyTextToClipboard(props.modelValue);
  notifications.success(
    copied ? t('templates.htmlImport.copySuccess') : t('templates.htmlImport.copyFailed')
  );
}

function downloadHtml() {
  const baseName = slugifyFilename(props.downloadFilename);
  downloadTextFile(`${baseName}.html`, props.modelValue, 'text/html;charset=utf-8');
  notifications.success(t('templates.htmlImport.downloadSuccess'));
}
</script>
