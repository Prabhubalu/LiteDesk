<template>
  <aside
    class="flex h-full min-h-0 shrink-0 overflow-hidden border-r transition-[width] duration-200 ease-out"
    :class="[
      ui.border,
      open ? 'w-[19rem] xl:w-[21rem]' : 'w-12'
    ]"
  >
    <nav :class="ui.iconRail" :aria-label="t('templates.builderLeftRail')">
      <button
        v-for="item in railItems"
        :key="item.id"
        type="button"
        :class="[ui.iconRailBtn, activeRail === item.id && open ? ui.iconRailBtnActive : '']"
        :title="t(item.labelKey)"
        @click="selectRail(item.id)"
      >
        <component :is="item.icon" class="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </nav>

    <div
      v-show="open"
      class="flex h-full min-h-0 w-64 flex-col overflow-hidden xl:w-72"
      :class="ui.panelMuted"
      @mousedown.capture="onDockMouseDownCapture"
    >
      <header class="shrink-0 border-b px-3 py-3" :class="ui.border">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {{ activeRailTitle }}
        </h2>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <ComponentLibraryPanel
          v-if="activeRail === 'blocks'"
          embedded
          :open="true"
          :editor-ready="editorReady"
          :output-format="outputFormat"
          :drag-start="dragStart"
          :drag-move="dragMove"
          :drag-end="dragEnd"
          @add="emit('add', $event)"
        />
        <div v-else-if="activeRail === 'layers'" class="p-3">
          <LayersPanel
            :root="layerTree"
            :selected-id="selectedId"
            @select="emit('select-layer', $event)"
          />
        </div>
        <div v-else-if="activeRail === 'variables'" class="p-3">
          <VariablesPanel
            :module-scope="moduleScope"
            :picker-active="mergeTagsPickerActive"
            :editor="editor"
            @insert="emit('insert-merge', $event)"
          />
        </div>
        <div v-else-if="activeRail === 'assets'" class="p-3">
          <AssetsPanel
            :library="assetLibrary"
            @insert="emit('insert-image', $event)"
          />
        </div>
        <div v-else-if="activeRail === 'page'" class="p-3">
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
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CodeBracketIcon,
  Cog6ToothIcon,
  PhotoIcon,
  RectangleStackIcon,
  Squares2X2Icon
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { DEFAULT_PAGE_MARGINS_MM } from '@/constants/contentPageSettings';
import ComponentLibraryPanel from './ComponentLibraryPanel.vue';
import LayersPanel from './LayersPanel.vue';
import VariablesPanel from './VariablesPanel.vue';
import AssetsPanel from './AssetsPanel.vue';
import TemplatePagePanel from './TemplatePagePanel.vue';
import {
  handleSidebarPointerDown,
  restoreCanvasCaret,
  setMergeTagPickerActive
} from '../editor/canvasInsertion';

const props = defineProps({
  open: { type: Boolean, default: true },
  editorReady: { type: Boolean, default: false },
  outputFormat: { type: String, default: 'pdf' },
  dragStart: { type: Function, default: null },
  dragMove: { type: Function, default: null },
  dragEnd: { type: Function, default: null },
  name: { type: String, default: '' },
  description: { type: String, default: '' },
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
  layerTree: { type: Object, default: null },
  editor: { type: Object, default: null },
  pageMargins: { type: Object, default: () => ({ ...DEFAULT_PAGE_MARGINS_MM }) },
  assetLibrary: {
    type: String,
    default: 'content',
    validator: (value) => ['content', 'marketing'].includes(value)
  }
});

const emit = defineEmits([
  'add',
  'insert-merge',
  'insert-image',
  'select-layer',
  'update-margins',
  'update-name',
  'update-description',
  'update-module-scope',
  'update-page-settings',
  'update:preview-record-id',
  'update:preview-record-label',
  'update-currency-display',
  'update-is-default',
  'toggle-open'
]);

const { t } = useI18n();
const ui = useBuilderUi();
const activeRail = ref('blocks');

const railItems = [
  { id: 'blocks', labelKey: 'templates.builderRailBlocks', icon: RectangleStackIcon },
  { id: 'layers', labelKey: 'templates.builderRailLayers', icon: Squares2X2Icon },
  { id: 'variables', labelKey: 'templates.builderRailVariables', icon: CodeBracketIcon },
  { id: 'assets', labelKey: 'templates.builderRailAssets', icon: PhotoIcon },
  { id: 'page', labelKey: 'templates.builderRailPage', icon: Cog6ToothIcon }
];

const mergeTagsPickerActive = computed(() => activeRail.value === 'variables');

const activeRailTitle = computed(() => {
  const item = railItems.find((entry) => entry.id === activeRail.value);
  return item ? t(item.labelKey) : '';
});

function selectRail(id) {
  if (activeRail.value === id && props.open) {
    emit('toggle-open');
    return;
  }
  activeRail.value = id;
  if (!props.open) {
    emit('toggle-open');
  }
}

function onDockMouseDownCapture(event) {
  handleSidebarPointerDown(props.editor, event.target, event);
}

watch(
  mergeTagsPickerActive,
  (active) => {
    setMergeTagPickerActive(active);
    if (active) {
      restoreCanvasCaret(props.editor);
    }
  },
  { immediate: true }
);
</script>
