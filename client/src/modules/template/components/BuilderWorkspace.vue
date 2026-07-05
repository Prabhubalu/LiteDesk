<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <div :class="ui.workspaceTabList" role="tablist" :aria-label="t('templates.builderWorkspaceViews')">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="view === tab.id"
        :class="[ui.workspaceTab, view === tab.id ? ui.workspaceTabActive : ui.workspaceTabIdle]"
        @click="emit('update:view', tab.id)"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>

    <div class="relative min-h-0 flex-1 overflow-hidden">
      <EditorCanvas
        v-show="view === 'design'"
        class="absolute inset-0"
        :editor="editor"
        :canvas-width="canvasWidth"
        :canvas-height="canvasHeight"
        :page-width-px="pageWidthPx"
        :page-height-px="pageHeightPx"
        :margins-mm="marginsMm"
        :show-margin-guides="showMarginGuides"
        @container-ready="emit('container-ready', $event)"
      />

      <BuilderHtmlPanel
        v-if="view === 'html'"
        class="absolute inset-0"
        :model-value="htmlDocument"
        :download-filename="downloadFilename"
        :syncing="htmlSyncing"
        @update:model-value="emit('update:htmlDocument', $event)"
        @apply="emit('apply-html')"
        @edit="emit('html-edit')"
      />

      <BuilderPreviewPanel
        v-show="view === 'preview'"
        class="absolute inset-0"
        :is-email-format="isEmailFormat"
        :email-html="emailHtml"
        :email-css="emailCss"
        :html-document="htmlDocument"
        :pdf-preview-url="pdfPreviewUrl"
        :preview-device="previewDevice"
        :preview-busy="previewBusy"
        @refresh="emit('refresh-preview')"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { DEFAULT_PAGE_MARGINS_MM } from '@/constants/contentPageSettings';
import EditorCanvas from './EditorCanvas.vue';
import BuilderHtmlPanel from './BuilderHtmlPanel.vue';
import BuilderPreviewPanel from './BuilderPreviewPanel.vue';

defineProps({
  editor: { type: Object, default: null },
  view: {
    type: String,
    default: 'design',
    validator: (value) => ['design', 'html', 'preview'].includes(value)
  },
  canvasWidth: { type: String, default: '794px' },
  canvasHeight: { type: String, default: '1123px' },
  pageWidthPx: { type: Number, default: 794 },
  pageHeightPx: { type: Number, default: 1123 },
  marginsMm: {
    type: Object,
    default: () => ({ ...DEFAULT_PAGE_MARGINS_MM })
  },
  showMarginGuides: { type: Boolean, default: true },
  htmlDocument: { type: String, default: '' },
  htmlSyncing: { type: Boolean, default: false },
  downloadFilename: { type: String, default: 'template' },
  isEmailFormat: { type: Boolean, default: false },
  emailHtml: { type: String, default: '' },
  emailCss: { type: String, default: '' },
  pdfPreviewUrl: { type: String, default: '' },
  previewDevice: { type: String, default: 'desktop' },
  previewBusy: { type: Boolean, default: false }
});

const emit = defineEmits([
  'update:view',
  'update:htmlDocument',
  'container-ready',
  'refresh-preview',
  'apply-html',
  'html-edit'
]);

const { t } = useI18n();
const ui = useBuilderUi();

const tabs = [
  { id: 'design', labelKey: 'templates.builderViewDesign' },
  { id: 'html', labelKey: 'templates.builderViewHtml' },
  { id: 'preview', labelKey: 'templates.builderViewPreview' }
];
</script>
