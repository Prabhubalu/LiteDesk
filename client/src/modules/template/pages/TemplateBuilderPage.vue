<template>
  <div :class="ui.shell">
    <div v-if="loading" class="flex flex-1 items-center justify-center text-sm" :class="ui.textMuted">
      {{ t('states.loading') }}
    </div>

    <template v-else>
      <EditorToolbar
        :title="templateName"
        :save-status="saveStatus"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :preview-busy="previewBusy"
        :publish-busy="publishBusy"
        @back="goBack"
        @undo="undo"
        @redo="redo"
        @preview="handlePreview"
        @save="handleSave"
        @publish="handlePublish"
      />

      <div class="flex min-h-0 flex-1">
        <ComponentLibraryPanel
          :editor-ready="ready"
          :output-format="outputFormat"
          :drag-start="startBlockDrag"
          :drag-move="moveBlockDrag"
          :drag-end="endBlockDrag"
          @add="addBlock"
        />

        <div class="relative flex min-w-0 flex-1 flex-col">
          <EditorCanvas
            :canvas-width="canvasWidth"
            :canvas-height="canvasHeight"
            :page-width-px="pageDimensionsPx.width"
            :page-height-px="pageDimensionsPx.height"
            :margins-mm="pageMarginsMm"
            @container-ready="onContainerReady"
          />
        </div>

        <EditorSidebar
          :selected-component="selectedComponent"
          :selected-id="selectedId"
          :name="templateName"
          :description="templateDescription"
          :module-scope="moduleScope"
          :paper-size="paperSize"
          :orientation="orientation"
          :custom-page-width="customPageWidth"
          :custom-page-height="customPageHeight"
          :preview-record-id="previewRecordId"
          :preview-record-label="previewRecordLabel"
          :currency-display="currencyDisplay"
          :layer-tree="layerTree"
          :editor="editor"
          :page-margins="pageMarginsMm"
          @change="markDirty"
          @update-margins="handleMarginsChange"
          @update-name="handleNameChange"
          @update-description="handleDescriptionChange"
          @update-module-scope="handleModuleScopeChange"
          @update-page-settings="handlePageSettingsChange"
          @update-currency-display="handleCurrencyDisplayChange"
          @update-preview-record-id="handlePreviewRecordIdChange"
          @update-preview-record-label="handlePreviewRecordLabelChange"
          @insert-merge="insertMerge"
          @insert-image="insertImage"
          @select-layer="selectLayer"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import { resolvePageDimensionsPx, DEFAULT_PAGE_MARGINS_MM } from '@/constants/contentPageSettings';
import { resolveTemplateMarginsMm } from '../editor/pageDimensions';
import EditorToolbar from '../components/EditorToolbar.vue';
import ComponentLibraryPanel from '../components/ComponentLibraryPanel.vue';
import EditorSidebar from '../components/EditorSidebar.vue';
import EditorCanvas from '../components/EditorCanvas.vue';
import { useGrapesEditor } from '../composables/useGrapesEditor';
import { useTemplateEditor } from '../composables/useTemplateEditor';
import { previewTemplatePdf } from '../services/templateApi';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const ui = useBuilderUi();
const notifications = useNotifications();
const authStore = useAuthStore();

const grapesContainer = ref(null);
const projectLoadedFor = ref('');
const templateId = computed(() => String(route.params.id || ''));

const {
  templateMeta,
  templateName,
  templateDescription,
  outputFormat,
  loading,
  saveStatus,
  publishBusy,
  previewBusy,
  loadTemplate,
  registerSerializer,
  markDirty,
  saveDraft,
  runPublish,
  setPreviewBusy,
  withAutosaveSuppressed,
  resolveDraftDefinition,
  updateTemplateMargins,
  patchTemplateMetadata,
  previewRecordId,
  previewRecordLabel,
  setPreviewRecord
} = useTemplateEditor(() => templateId.value);

const pageDimensionsPx = computed(() => {
  const meta = templateMeta.value;
  return resolvePageDimensionsPx({
    paperSize: String(meta?.paperSize || 'A4'),
    orientation: meta?.orientation === 'landscape' ? 'landscape' : 'portrait',
    customPageWidth: meta?.customPageWidth,
    customPageHeight: meta?.customPageHeight
  });
});

const canvasWidth = computed(() => `${pageDimensionsPx.value.width}px`);
const canvasHeight = computed(() => `${pageDimensionsPx.value.height}px`);

const localMarginsMm = ref({ ...DEFAULT_PAGE_MARGINS_MM });

watch(
  templateMeta,
  (meta) => {
    if (meta?.margins) {
      localMarginsMm.value = resolveTemplateMarginsMm(meta.margins);
    }
  },
  { immediate: true }
);

const pageMarginsMm = computed(() =>
  resolveTemplateMarginsMm(localMarginsMm.value)
);

const moduleScope = computed(() => String(templateMeta.value?.moduleScope || ''));
const paperSize = computed(() => String(templateMeta.value?.paperSize || 'A4'));
const orientation = computed(() => (
  templateMeta.value?.orientation === 'landscape' ? 'landscape' : 'portrait'
));
const customPageWidth = computed(() => Number(templateMeta.value?.customPageWidth) || 210);
const customPageHeight = computed(() => Number(templateMeta.value?.customPageHeight) || 297);
const currencyDisplay = computed(() => (
  templateMeta.value?.currencyDisplay === 'symbol' ? 'symbol' : 'code'
));

const containerRef = grapesContainer;

function onContainerReady(el) {
  grapesContainer.value = el;
}

const {
  editor,
  selectedComponent,
  ready,
  canUndo,
  canRedo,
  undo,
  redo,
  addBlock,
  startBlockDrag,
  moveBlockDrag,
  endBlockDrag,
  loadProject,
  serializeProject,
  insertMerge,
  insertImage,
  selectLayer,
  layerTree
} = useGrapesEditor({
  containerRef,
  outputFormat,
  canvasWidth,
  canvasHeight,
  pageMarginsMm,
  moduleScope,
  onDirty: markDirty
});

const selectedId = computed(() => String(selectedComponent.value?.getId?.() || ''));

registerSerializer(serializeProject);

onMounted(async () => {
  try {
    await loadTemplate();
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  }
});

watch(
  [ready, templateMeta],
  ([isReady, meta]) => {
    if (!isReady || !meta) return;
    const id = String(meta._id || templateId.value);
    if (projectLoadedFor.value === id) return;
    projectLoadedFor.value = id;
    withAutosaveSuppressed(() => {
      loadProject(resolveDraftDefinition(meta));
    });
  }
);

watch(templateId, () => {
  projectLoadedFor.value = '';
});

function goBack() {
  router.push({ name: 'template-detail', params: { id: templateId.value } });
}

async function handleSave() {
  if (!authStore.can('templates', 'edit')) {
    notifications.error(t('templates.builderNoEditPermission'));
    return;
  }
  try {
    await saveDraft({ force: true });
    notifications.success(t('templates.builderSaveStatusSaved'));
  } catch (error) {
    notifications.error(error?.message || t('templates.builderSaveStatusError'));
  }
}

async function handlePublish() {
  if (!authStore.can('templates', 'publish')) {
    notifications.error(t('templates.builderNoEditPermission'));
    return;
  }
  try {
    await runPublish();
    notifications.success(t('templates.publishSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('templates.validationFailed'));
  }
}

async function handleMarginsChange(margins) {
  localMarginsMm.value = resolveTemplateMarginsMm(margins);
  try {
    await updateTemplateMargins(margins);
  } catch (error) {
    notifications.error(error?.message || t('templates.builderSaveStatusError'));
  }
}

async function handleNameChange(name) {
  try {
    await patchTemplateMetadata({ name: String(name || '').trim() });
  } catch (error) {
    notifications.error(error?.message || t('templates.builderSaveStatusError'));
  }
}

async function handleDescriptionChange(description) {
  try {
    await patchTemplateMetadata({ description: String(description || '') });
  } catch (error) {
    notifications.error(error?.message || t('templates.builderSaveStatusError'));
  }
}

async function handleModuleScopeChange(nextScope) {
  if (!templateMeta.value) return;
  try {
    await patchTemplateMetadata({ moduleScope: String(nextScope || '') });
  } catch (error) {
    notifications.error(error?.message || t('templates.builderSaveStatusError'));
  }
}

async function handlePageSettingsChange(patch) {
  if (!templateMeta.value || !patch || typeof patch !== 'object') return;
  try {
    await patchTemplateMetadata(patch);
  } catch (error) {
    notifications.error(error?.message || t('templates.builderSaveStatusError'));
  }
}

async function handleCurrencyDisplayChange(value) {
  const next = value === 'symbol' ? 'symbol' : 'code';
  try {
    await patchTemplateMetadata({ currencyDisplay: next });
  } catch (error) {
    notifications.error(error?.message || t('templates.builderSaveStatusError'));
  }
}

function handlePreviewRecordIdChange(recordId) {
  setPreviewRecord(recordId, previewRecordLabel.value);
}

function handlePreviewRecordLabelChange(label) {
  setPreviewRecord(previewRecordId.value, label);
}

async function handlePreview() {
  if (previewRecordId.value && !moduleScope.value) {
    notifications.error(t('templates.builderDataSelectModule'));
    return;
  }

  setPreviewBusy(true);
  try {
    await saveDraft({ force: true });
    const meta = templateMeta.value;
    await previewTemplatePdf(templateId.value, {
      recordModuleKey: moduleScope.value || meta?.moduleScope,
      recordId: previewRecordId.value || undefined,
      jsonDefinition: serializeProject(),
      pageSettings: {
        paperSize: paperSize.value,
        orientation: orientation.value,
        customPageWidth: customPageWidth.value,
        customPageHeight: customPageHeight.value,
        margins: pageMarginsMm.value,
        currencyDisplay: currencyDisplay.value
      }
    });
  } catch (error) {
    notifications.error(error?.message || t('templates.renderFailed'));
  } finally {
    setPreviewBusy(false);
  }
}
</script>
