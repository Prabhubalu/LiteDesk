<template>
  <aside
    class="flex h-full w-72 shrink-0 flex-col border-l xl:w-80"
    :class="[ui.panel, ui.border]"
  >
    <BuilderTemplateDetailsSection
      :name="String(templateName || '')"
      :description="String(templateDescription || '')"
      :status="String(templateStatus || '')"
      :module-scope="String(moduleScope || '')"
      :paper-size="paperSize"
      :orientation="orientation"
      :custom-page-width="customPageWidth"
      :custom-page-height="customPageHeight"
      :layout-mode="layoutMode"
      :preview-record-id="previewRecordId"
      :preview-record-label="previewRecordLabel"
      @update:name="emit('update:template-name', $event)"
      @update:description="emit('update:template-description', $event)"
      @update:module-scope="emit('update:module-scope', $event)"
      @update:page-settings="emit('update:page-settings', $event)"
      @update:layout-mode="emit('update:layout-mode', $event)"
      @update:preview-record-id="emit('update:preview-record-id', $event)"
      @update:preview-record-label="emit('update:preview-record-label', $event)"
    />

    <div class="flex shrink-0 border-b" :class="ui.border">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="flex-1 px-3 py-2.5 text-xs font-medium transition-colors"
        :class="activeTab === tab.id ? ui.tabActive : ui.tabIdle"
        @click="activeTab = tab.id"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <BuilderPropertiesPanel
        v-if="activeTab === 'properties'"
        :node="node"
        :layout-mode="layoutMode"
        @patch="emit('patch', $event)"
        @patch-table-cell="emit('patch-table-cell', $event)"
      />
      <BuilderLayersPanel
        v-else
        :root="root"
        :selected-ids="selectedIds"
        @select="(id, event) => emit('select', { id, additive: Boolean(event?.shiftKey) })"
        @reorder="emit('reorder', $event)"
        @duplicate="emit('duplicate', $event)"
        @toggle-hidden="emit('toggle-hidden', $event)"
        @toggle-locked="emit('toggle-locked', $event)"
      />
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BuilderPropertiesPanel from '@/components/templates/builder/BuilderPropertiesPanel.vue';
import BuilderLayersPanel from '@/components/templates/builder/BuilderLayersPanel.vue';
import BuilderTemplateDetailsSection from '@/components/templates/builder/BuilderTemplateDetailsSection.vue';
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  node: { type: Object, default: null },
  root: { type: Object, required: true },
  selectedId: { type: String, default: null },
  selectedIds: { type: Array, default: () => [] },
  layoutMode: { type: String, default: 'flow' },
  templateName: { type: String, default: '' },
  templateDescription: { type: String, default: '' },
  templateStatus: { type: String, default: '' },
  moduleScope: { type: String, default: '' },
  paperSize: { type: String, default: 'A4' },
  orientation: { type: String, default: 'portrait' },
  customPageWidth: { type: Number, default: 210 },
  customPageHeight: { type: Number, default: 297 },
  previewRecordId: { type: String, default: '' },
  previewRecordLabel: { type: String, default: '' }
});

const emit = defineEmits([
  'patch',
  'patch-table-cell',
  'select',
  'reorder',
  'duplicate',
  'toggle-hidden',
  'toggle-locked',
  'update:template-name',
  'update:template-description',
  'update:module-scope',
  'update:page-settings',
  'update:layout-mode',
  'update:preview-record-id',
  'update:preview-record-label'
]);

const { t } = useI18n();
const ui = useBuilderUi();
const activeTab = ref('properties');

const tabs = [
  { id: 'properties', labelKey: 'templates.builderTabProperties' },
  { id: 'layers', labelKey: 'templates.builderTabLayers' }
];
</script>
