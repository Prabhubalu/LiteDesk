<template>
  <div :class="ui.shell">
    <div v-if="loading" class="flex flex-1 items-center justify-center text-sm" :class="ui.textMuted">
      {{ t('states.loading') }}
    </div>

    <template v-else>
      <BuilderToolbar
        :title="String(templateMeta?.name || t('templates.detailTitle'))"
        :save-status="saveStatus"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :preview-busy="previewBusy"
        :validate-busy="validateBusy"
        :publish-busy="publishBusy"
        :zoom="canvasZoom"
        @back="goBack"
        @undo="undo"
        @redo="redo"
        @preview="previewPdf"
        @save="saveDraft"
        @validate="runValidate"
        @publish="runPublish"
        @open-print-preview="openPrintPreview"
        @update:zoom="canvasZoom = $event"
      />

      <div class="flex min-h-0 flex-1">
        <BuilderComponentLibrary :layout-mode="layoutMode" @add="handleAddComponent" />

        <div class="flex min-w-0 flex-1 flex-col">
          <BuilderCanvas
            ref="canvasRef"
            :root-id="definition.id"
            :nodes="definition.children || []"
            :selected-id="selectedId"
            :selected-ids="selectedIds"
            :zoom="canvasZoom"
            :page-width-px="pageDimensionsPx.width"
            :page-height-px="pageDimensionsPx.height"
            :layout-mode="layoutMode"
            :focus-on-mount="!loading && !(definition.children?.length)"
            @select="onSelectNode"
            @remove="removeById"
            @duplicate="duplicateById"
            @reorder="onCanvasReorder"
            @patch="onPatchNode"
            @start-typing="onStartTyping"
            @continue-typing="onContinueTyping"
            @continue-after="onContinueAfter"
            @library-add="onLibraryAdd"
            @layout-change="onLayoutChange"
            @component-drop="onComponentDrop"
          />
        </div>

        <BuilderSidebar
          :node="selectedNode"
          :root="definition"
          :selected-id="selectedId"
          :selected-ids="selectedIds"
          :layout-mode="layoutMode"
          :template-name="String(templateMeta?.name || '')"
          :template-description="String(templateMeta?.description || '')"
          :template-status="String(templateMeta?.status || 'draft')"
          :module-scope="String(templateMeta?.moduleScope || '')"
          :paper-size="String(templateMeta?.paperSize || 'A4')"
          :orientation="String(templateMeta?.orientation || 'portrait')"
          :custom-page-width="Number(templateMeta?.customPageWidth) || 210"
          :custom-page-height="Number(templateMeta?.customPageHeight) || 297"
          :preview-record-id="previewRecordId"
          :preview-record-label="previewRecordLabel"
          @patch="patchSelected"
          @patch-table-cell="onPatchTableCell"
          @select="onSelectNode"
          @toggle-hidden="toggleHidden"
          @toggle-locked="toggleLocked"
          @duplicate="duplicateById"
          @reorder="onCanvasReorder"
          @update:template-name="onTemplateNameChange"
          @update:template-description="onTemplateDescriptionChange"
          @update:module-scope="updateModuleScope"
          @update:page-settings="onPageSettingsChange"
          @update:layout-mode="setLayoutMode"
          @update:preview-record-id="onPreviewRecordIdChange"
          @update:preview-record-label="onPreviewRecordLabelChange"
        />

        <BuilderDataPanel
          :module-scope="String(templateMeta?.moduleScope || '')"
          @insert="onInsertMergeTag"
        />

      </div>

      <BuilderPrintPreviewModal
        :open="showPrintPreviewModal"
        :html="htmlPreview"
        :loading="htmlPreviewLoading"
        :error="htmlPreviewError"
        :page-width-px="pageDimensionsPx.width"
        :page-height-px="pageDimensionsPx.height"
        @close="showPrintPreviewModal = false"
        @refresh="refreshHtmlPreview"
      />

      <BuilderStatusBar
        :breadcrumbs="selectionBreadcrumbs"
        :component-count="componentCount"
        :insert-parent-label="insertParentLabel"
        :selected-count="selectedIds.length"
        @select="onSelectNode"
      />

      <BuilderTableInsertDialog
        :open="tableInsertOpen"
        @confirm="onTableInsertConfirm"
        @cancel="onTableInsertCancel"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, provide, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { resolvePageDimensionsPx } from '@/constants/contentPageSettings';
import BuilderToolbar from '@/components/templates/builder/BuilderToolbar.vue';
import BuilderComponentLibrary from '@/components/templates/builder/BuilderComponentLibrary.vue';
import BuilderCanvas from '@/components/templates/builder/BuilderCanvas.vue';
import BuilderSidebar from '@/components/templates/builder/BuilderSidebar.vue';
import BuilderDataPanel from '@/components/templates/builder/BuilderDataPanel.vue';
import BuilderPrintPreviewModal from '@/components/templates/builder/BuilderPrintPreviewModal.vue';
import BuilderStatusBar from '@/components/templates/builder/BuilderStatusBar.vue';
import BuilderTableInsertDialog from '@/components/templates/builder/BuilderTableInsertDialog.vue';
import { useTemplateBuilder } from '@/composables/useTemplateBuilder';
import { useTemplates } from '@/composables/useTemplates';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { BUILDER_DROP_KEY, BUILDER_ACTIVE_TEXT_EDITOR_KEY, BUILDER_TABLE_MERGE_CONTEXT_KEY, BUILDER_DELETE_NODE_KEY, BUILDER_PAGE_METRICS_KEY } from '@/constants/builderInjectKeys';
import { resolveContentAreaPx, resolvePageMarginsPx } from '@/constants/contentPageSettings';
import { CONTENT_COMPONENT_TYPES } from '@/constants/contentComponentRegistry';
import { findNodePath } from '@/utils/templateBuilderTree';
import { createCatalogComponentNode } from '@/constants/templateBuilderCatalog';
import { createTableNode } from '@/utils/builderTableGridModel';

const props = defineProps({
  id: { type: String, default: '' }
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();
const ui = useBuilderUi();
const { validateTemplate, publishTemplate, updateTemplate } = useTemplates();

const showPrintPreviewModal = ref(false);
const validateBusy = ref(false);
const publishBusy = ref(false);
const canvasZoom = ref(1);
const canvasRef = ref(null);
const activeTextEditor = shallowRef(null);
const tableMergeContext = shallowRef(null);
const tableInsertOpen = ref(false);
const tableInsertContext = ref(null);
const templateId = computed(() => props.id || route.params.id);

const {
  templateMeta,
  definition,
  layoutMode,
  selectedId,
  selectedIds,
  selectedNode,
  insertParentLabel,
  componentCount,
  loading,
  saveStatus,
  previewBusy,
  htmlPreview,
  htmlPreviewLoading,
  htmlPreviewError,
  previewRecordId,
  previewRecordLabel,
  canUndo,
  canRedo,
  load,
  saveDraft,
  undo,
  redo,
  selectNode,
  addComponent,
  addComponentByType,
  removeById,
  duplicateById,
  removeSelected,
  patchSelected,
  patchNodeById,
  addParagraphBlock,
  insertParagraphAfter,
  toggleHidden,
  toggleLocked,
  setPreviewRecord,
  handleBuilderDrop,
  reorderCanvas,
  reorderChildrenAt,
  patchNodeLayout,
  setLayoutMode,
  insertMergeTag,
  insertMergeTagIntoTableCell,
  patchTableCell,
  alignSelectedText,
  previewPdf,
  refreshHtmlPreview,
  updatePageSettings
} = useTemplateBuilder(() => templateId.value);

const pageDimensionsPx = computed(() => resolvePageDimensionsPx({
  paperSize: String(templateMeta.value?.paperSize || 'A4'),
  orientation: templateMeta.value?.orientation === 'landscape' ? 'landscape' : 'portrait',
  customPageWidth: templateMeta.value?.customPageWidth,
  customPageHeight: templateMeta.value?.customPageHeight
}));

const builderPageMetrics = computed(() => {
  const marginsPx = resolvePageMarginsPx();
  const pageWidthPx = pageDimensionsPx.value.width;
  const pageHeightPx = pageDimensionsPx.value.height;
  return {
    pageWidthPx,
    pageHeightPx,
    marginsPx,
    contentArea: resolveContentAreaPx(pageWidthPx, pageHeightPx, marginsPx)
  };
});

const selectionBreadcrumbs = computed(() => {
  if (!selectedId.value || !definition.value) return [];
  return findNodePath(definition.value, selectedId.value);
});

function canEditTemplates() {
  return authStore.can('templates', 'edit') || authStore.can('templates', 'update');
}

provide(BUILDER_PAGE_METRICS_KEY, builderPageMetrics);

provide(BUILDER_DROP_KEY, (payload, context) => {
  if (!canEditTemplates()) return;
  if (payload?.kind === 'component' && payload?.type === CONTENT_COMPONENT_TYPES.TABLE) {
    openTableInsertDialog(context);
    return;
  }
  if (payload?.kind === 'component' && payload?.type === CONTENT_COMPONENT_TYPES.LINE_ITEM) {
    const node = createCatalogComponentNode(CONTENT_COMPONENT_TYPES.LINE_ITEM, {
      moduleScope: String(templateMeta.value?.moduleScope || '')
    });
    if (node) {
      addComponent(node, context);
      selectNode(node.id);
    }
    return;
  }
  handleBuilderDrop(payload, context);
});

provide(BUILDER_ACTIVE_TEXT_EDITOR_KEY, activeTextEditor);
provide(BUILDER_TABLE_MERGE_CONTEXT_KEY, tableMergeContext);

function onPatchTableCell({ row, col, patch, setDataRow }) {
  if (!selectedId.value) return;
  if (setDataRow) {
    patchTableCell(selectedId.value, row, col, {}, { setDataRow: true });
    return;
  }
  patchTableCell(selectedId.value, row, col, patch);
}

function onInsertMergeTag(path) {
  const token = `{{${path}}}`;
  if (activeTextEditor.value?.insertText) {
    activeTextEditor.value.insertText(token);
    return;
  }

  const ctx = tableMergeContext.value;
  if (ctx && selectedId.value === ctx.nodeId) {
    insertMergeTagIntoTableCell(path, ctx.nodeId, ctx.row, ctx.col);
    return;
  }

  insertMergeTag(path);
}

provide(BUILDER_DELETE_NODE_KEY, (nodeId) => {
  if (!canEditTemplates()) return;
  removeById(nodeId);
});

function goBack() {
  router.push({ name: 'template-detail', params: { id: templateId.value } });
}

function onSelectNode(payload) {
  if (typeof payload === 'string') {
    selectNode(payload);
    return;
  }
  selectNode(payload?.id, { additive: Boolean(payload?.additive) });
}

function openTableInsertDialog(context = {}) {
  tableInsertContext.value = context;
  tableInsertOpen.value = true;
}

function onTableInsertConfirm({ rows, cols }) {
  const context = tableInsertContext.value || {};
  const node = createTableNode(rows, cols);
  addComponent(node, context);
  selectNode(node.id);
  tableInsertOpen.value = false;
  tableInsertContext.value = null;
}

function onTableInsertCancel() {
  tableInsertOpen.value = false;
  tableInsertContext.value = null;
}

function handleAddComponent(catalogItem) {
  if (!canEditTemplates()) {
    notifications.error(t('templates.builderNoEditPermission'));
    return;
  }
  if (catalogItem.type === CONTENT_COMPONENT_TYPES.TABLE) {
    openTableInsertDialog();
    return;
  }
  if (catalogItem.type === CONTENT_COMPONENT_TYPES.LINE_ITEM) {
    const node = createCatalogComponentNode(CONTENT_COMPONENT_TYPES.LINE_ITEM, {
      moduleScope: String(templateMeta.value?.moduleScope || '')
    });
    if (!node) return;
    addComponent(node);
    selectNode(node.id);
    return;
  }
  addComponent(catalogItem.createDefault());
}

function onPreviewRecordIdChange(recordId) {
  setPreviewRecord(recordId, previewRecordLabel.value);
}

function openPrintPreview() {
  showPrintPreviewModal.value = true;
  void refreshHtmlPreview();
}

function onPreviewRecordLabelChange(label) {
  setPreviewRecord(previewRecordId.value, label);
}

function onPageSettingsChange(patch) {
  if (!canEditTemplates()) return;
  updatePageSettings(patch);
}

async function onTemplateMetaChange(payload) {
  if (!canEditTemplates()) return;
  try {
    await updateTemplate(templateId.value, payload);
    if (templateMeta.value) {
      templateMeta.value = { ...templateMeta.value, ...payload };
    }
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  }
}

function onTemplateNameChange(name) {
  void onTemplateMetaChange({ name: String(name || '').trim() });
}

function onTemplateDescriptionChange(description) {
  void onTemplateMetaChange({ description: String(description || '').trim() });
}

function onPatchNode({ nodeId, patch }) {
  patchNodeById(nodeId, patch);
}

function onStartTyping(initialText = '') {
  if (!canEditTemplates()) return;
  const id = addParagraphBlock(String(initialText || ''));
  selectNode(id);
  void saveDraft();
}

function onContinueAfter(nodeId) {
  if (!canEditTemplates()) return;
  const id = insertParagraphAfter(nodeId);
  selectNode(id);
}

function onContinueTyping() {
  if (!canEditTemplates()) return;
  const children = definition.value?.children || [];
  const last = children[children.length - 1];
  if (last?.type === 'Paragraph' && !String(last.bindings?.text || '').replace(/<[^>]+>/g, '').trim()) {
    selectNode(last.id);
    return;
  }
  const id = addParagraphBlock('');
  selectNode(id);
}

async function updateModuleScope(moduleScope) {
  if (!canEditTemplates()) return;

  const current = String(templateMeta.value?.moduleScope || '');
  const nextScope = moduleScope || '';
  if (current && current !== nextScope && (definition.value?.children?.length || 0) > 0) {
    const confirmed = window.confirm(t('templates.builderModuleScopeChangeConfirm'));
    if (!confirmed) return;
  }

  try {
    await updateTemplate(templateId.value, { moduleScope: moduleScope || null });
    if (templateMeta.value) {
      templateMeta.value = {
        ...templateMeta.value,
        moduleScope: moduleScope || ''
      };
    }
    setPreviewRecord('', '');
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  }
}

function onCanvasReorder({ parentId, orderedIds }) {
  if (parentId === definition.value?.id) {
    reorderCanvas(orderedIds);
    return;
  }
  reorderChildrenAt(parentId, orderedIds);
}

function onLibraryAdd({ parentId, index, node }) {
  if (!canEditTemplates()) {
    notifications.error(t('templates.builderNoEditPermission'));
    return;
  }
  if (node?.type === CONTENT_COMPONENT_TYPES.TABLE) {
    openTableInsertDialog({ parentId, index });
    return;
  }
  addComponent(node, { parentId, index });
}

function onLayoutChange({ id, layout, live }) {
  if (!canEditTemplates()) return;
  patchNodeLayout(id, layout, { live: Boolean(live) });
}

function onComponentDrop({ type, parentId, layout }) {
  if (!canEditTemplates()) {
    notifications.error(t('templates.builderNoEditPermission'));
    return;
  }
  if (type === CONTENT_COMPONENT_TYPES.TABLE) {
    openTableInsertDialog({ parentId, layout });
    return;
  }
  if (type === CONTENT_COMPONENT_TYPES.LINE_ITEM) {
    const node = createCatalogComponentNode(CONTENT_COMPONENT_TYPES.LINE_ITEM, {
      moduleScope: String(templateMeta.value?.moduleScope || '')
    });
    if (node) {
      addComponent(node, { parentId, layout });
      selectNode(node.id);
    }
    return;
  }
  addComponentByType(type, { parentId, layout });
}

async function runValidate() {
  validateBusy.value = true;
  try {
    await saveDraft();
    const result = await validateTemplate(templateId.value, definition.value);
    if (result?.valid === false) {
      notifications.error(t('templates.validationFailed'));
    } else {
      notifications.success(t('templates.validationPassed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('templates.validationFailed'));
  } finally {
    validateBusy.value = false;
  }
}

async function runPublish() {
  publishBusy.value = true;
  try {
    await saveDraft();
    await publishTemplate(templateId.value);
    notifications.success(t('templates.publishSuccess'));
    await load();
  } catch (error) {
    notifications.error(error?.message || t('templates.publishBlocked'));
  } finally {
    publishBusy.value = false;
  }
}

function onKeyDown(event) {
  const target = event.target;
  if (target?.matches('input, textarea, select')) return;

  if (target?.isContentEditable) {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key === 's') {
      event.preventDefault();
      void saveDraft();
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && meta) {
      if (selectedId.value && selectedId.value !== definition.value?.id) {
        event.preventDefault();
        removeSelected();
      }
    }
    return;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedId.value && selectedId.value !== definition.value?.id) {
      event.preventDefault();
      removeSelected();
    }
    return;
  }

  const meta = event.metaKey || event.ctrlKey;
  if (!meta) return;
  if (event.key === 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
  }
  if (event.key === 'z' && event.shiftKey) {
    event.preventDefault();
    redo();
  }
  if (event.key === 's') {
    event.preventDefault();
    void saveDraft();
  }
  if (event.key === 'd') {
    event.preventDefault();
    if (selectedId.value) duplicateById(selectedId.value);
  }
}

onMounted(() => {
  if (!canEditTemplates()) {
    notifications.error(t('templates.builderNoEditPermission'));
    goBack();
    return;
  }
  void load();
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>
