<template>
  <aside
    data-arivu-builder-sidebar="true"
    class="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l transition-[width] duration-200 ease-out"
    :class="[
      ui.panel,
      ui.border,
      open ? 'w-80 xl:w-[22rem]' : 'w-0 overflow-hidden border-l-0'
    ]"
    @mousedown.capture="onSidebarMouseDownCapture"
  >
    <div v-show="open" class="flex h-full min-h-0 w-80 flex-col overflow-hidden xl:w-[22rem]">
      <TabGroup
        as="div"
        class="flex h-full min-h-0 flex-col overflow-hidden"
        :selected-index="selectedTabIndex"
        @change="onTabChange"
      >
        <TabList :class="ui.inspectorTabList">
          <Tab
            v-for="tab in tabs"
            :key="tab.id"
            v-slot="{ selected }"
            :class="[ui.inspectorTab, selected ? ui.inspectorTabActive : ui.inspectorTabIdle]"
          >
            {{ t(tab.labelKey) }}
          </Tab>
        </TabList>

        <TabPanels class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabPanel :class="ui.tabPanel" :unmount="false">
            <TemplatePagePanel
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
              :output-format="outputFormat"
              :is-default="isDefault"
              @update:name="emit('update-name', $event)"
              @update:description="emit('update-description', $event)"
              @update:module-scope="emit('update-module-scope', $event)"
              @update:page-settings="emit('update-page-settings', $event)"
              @update:margins="emit('update-margins', $event)"
              @update:preview-record-id="emit('update:preview-record-id', $event)"
              @update:preview-record-label="emit('update:preview-record-label', $event)"
              @update:currency-display="emit('update-currency-display', $event)"
              @update:is-default="emit('update-is-default', $event)"
            />
          </TabPanel>
          <TabPanel :class="ui.tabPanel" :unmount="false">
            <GrapesPropertiesPanel
              :component="selectedComponent"
              :editor="editor"
              :module-scope="moduleScope"
              :asset-library="assetLibrary"
              @change="emit('change')"
              @pick-asset="emit('insert-image', $event)"
            />
          </TabPanel>
        </TabPanels>
      </TabGroup>

      <GrapesTableContextMenuHost :editor="editor" />
    </div>
  </aside>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { DEFAULT_PAGE_MARGINS_MM } from '@/constants/contentPageSettings';
import TemplatePagePanel from './TemplatePagePanel.vue';
import GrapesPropertiesPanel from './GrapesPropertiesPanel.vue';
import GrapesTableContextMenuHost from './GrapesTableContextMenuHost.vue';
import { handleSidebarPointerDown } from '../editor/canvasInsertion';

const props = defineProps({
  open: { type: Boolean, default: true },
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
  isDefault: { type: Boolean, default: false },
  editor: { type: Object, default: null },
  pageMargins: { type: Object, default: () => ({ ...DEFAULT_PAGE_MARGINS_MM }) },
  outputFormat: { type: String, default: 'pdf' },
  assetLibrary: {
    type: String,
    default: 'content',
    validator: (value) => ['content', 'marketing'].includes(value)
  }
});

const emit = defineEmits([
  'change',
  'insert-image',
  'update-margins',
  'update-name',
  'update-description',
  'update-module-scope',
  'update-page-settings',
  'update:preview-record-id',
  'update:preview-record-label',
  'update-currency-display',
  'update-is-default'
]);

const { t } = useI18n();
const ui = useBuilderUi();
const selectedTabIndex = ref(0);

const tabs = [
  { id: 'document', labelKey: 'templates.builderTabDocument' },
  { id: 'block', labelKey: 'templates.builderTabBlock' }
];

function onTabChange(index) {
  selectedTabIndex.value = index;
}

function onSidebarMouseDownCapture(event) {
  handleSidebarPointerDown(props.editor, event.target, event);
}

watch(
  () => props.selectedId,
  (id, prevId) => {
    if (id && !prevId) {
      selectedTabIndex.value = 1;
    }
  }
);
</script>
