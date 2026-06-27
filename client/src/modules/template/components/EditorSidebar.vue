<template>
  <aside
    class="flex w-80 shrink-0 flex-col border-l xl:w-96"
    :class="[ui.panel, ui.border]"
  >
    <div class="flex shrink-0 border-b" :class="ui.border">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="flex-1 px-2 py-2.5 text-xs font-medium transition-colors"
        :class="activeTab === tab.id ? ui.tabActive : ui.tabIdle"
        @click="activeTab = tab.id"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <TemplatePagePanel
        v-show="activeTab === 'page'"
        :name="name"
        :description="description"
        :module-scope="moduleScope"
        :paper-size="paperSize"
        :orientation="orientation"
        :custom-page-width="customPageWidth"
        :custom-page-height="customPageHeight"
        :margins="pageMargins"
        :preview-record-id="previewRecordId"
        :preview-record-label="previewRecordLabel"
        :currency-display="currencyDisplay"
        @update:name="emit('update-name', $event)"
        @update:description="emit('update-description', $event)"
        @update:module-scope="emit('update-module-scope', $event)"
        @update:page-settings="emit('update-page-settings', $event)"
        @update:margins="emit('update-margins', $event)"
        @update:preview-record-id="emit('update-preview-record-id', $event)"
        @update:preview-record-label="emit('update-preview-record-label', $event)"
        @update:currency-display="emit('update-currency-display', $event)"
      />
      <GrapesPropertiesPanel
        v-show="activeTab === 'properties'"
        :component="selectedComponent"
        :editor="editor"
        :module-scope="moduleScope"
        @change="emit('change')"
        @pick-asset="emit('insert-image', $event)"
      />
      <VariablesPanel
        v-show="activeTab === 'variables'"
        :module-scope="moduleScope"
        @insert="emit('insert-merge', $event)"
      />
      <AssetsPanel
        v-show="activeTab === 'assets'"
        @insert="emit('insert-image', $event)"
      />
      <LayersPanel
        v-show="activeTab === 'layers'"
        :root="layerTree"
        :selected-id="selectedId"
        @select="emit('select-layer', $event)"
      />
    </div>

    <GrapesTableContextMenuHost :editor="editor" />
  </aside>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import TemplatePagePanel from './TemplatePagePanel.vue';
import GrapesPropertiesPanel from './GrapesPropertiesPanel.vue';
import VariablesPanel from './VariablesPanel.vue';
import AssetsPanel from './AssetsPanel.vue';
import LayersPanel from './LayersPanel.vue';
import GrapesTableContextMenuHost from './GrapesTableContextMenuHost.vue';

defineProps({
  name: { type: String, default: '' },
  description: { type: String, default: '' },
  selectedComponent: { type: Object, default: null },
  selectedId: { type: String, default: '' },
  moduleScope: { type: String, default: '' },
  paperSize: { type: String, default: 'A4' },
  orientation: { type: String, default: 'portrait' },
  customPageWidth: { type: Number, default: 210 },
  customPageHeight: { type: Number, default: 297 },
  previewRecordId: { type: String, default: '' },
  previewRecordLabel: { type: String, default: '' },
  currencyDisplay: { type: String, default: 'code' },
  layerTree: { type: Object, default: null },
  editor: { type: Object, default: null },
  pageMargins: { type: Object, default: () => ({ top: 12, right: 12, bottom: 12, left: 12 }) }
});

const emit = defineEmits([
  'change',
  'insert-merge',
  'insert-image',
  'select-layer',
  'update-margins',
  'update-name',
  'update-description',
  'update-module-scope',
  'update-page-settings',
  'update-preview-record-id',
  'update-preview-record-label',
  'update-currency-display'
]);

const { t } = useI18n();
const ui = useBuilderUi();
const activeTab = ref('page');

const tabs = [
  { id: 'page', labelKey: 'templates.builderTabPage' },
  { id: 'properties', labelKey: 'templates.builderTabProperties' },
  { id: 'variables', labelKey: 'templates.builderTabMergeTags' },
  { id: 'assets', labelKey: 'templates.builderTabAssets' },
  { id: 'layers', labelKey: 'templates.builderTabLayers' }
];
</script>
