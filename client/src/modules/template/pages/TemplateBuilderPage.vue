<template>
  <div :class="ui.shell">
    <div v-if="loading" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="h-12 shrink-0 animate-pulse border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <div class="hidden w-[19rem] shrink-0 animate-pulse border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/80 md:flex" />
        <div class="flex-1 animate-pulse bg-neutral-200/60 dark:bg-neutral-950" />
        <div class="hidden w-80 shrink-0 animate-pulse border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:block" />
      </div>
    </div>

    <template v-else>
      <EditorToolbar
        :title="templateName"
        :save-status="saveStatus"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :publish-busy="publishBusy"
        :is-email-format="isEmailFormat"
        :has-import-snapshot="hasImportSnapshot"
        :output-format="outputFormat"
        :right-panel-open="rightPanelOpen"
        :preview-device="previewDevice"
        :workspace-view="workspaceView"
        @back="goBack"
        @undo="undo"
        @redo="redo"
        @preview-email-clients="openClientPreview"
        @advanced="handleAdvancedAction"
        @save="handleSave"
        @publish="handlePublish"
        @toggle-right-panel="rightPanelOpen = !rightPanelOpen"
        @update:preview-device="previewDevice = $event"
        @update:workspace-view="setWorkspaceView"
      />

      <div class="flex min-h-0 flex-1 overflow-hidden">
        <BuilderLeftDock
          :open="leftPanelOpen"
          :editor-ready="ready"
          :output-format="outputFormat"
          :drag-start="startBlockDrag"
          :drag-move="moveBlockDrag"
          :drag-end="endBlockDrag"
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
          :asset-library="assetLibrary"
          :selected-id="selectedId"
          @add="addBlock"
          @insert-merge="insertMerge"
          @insert-image="insertImage"
          @select-layer="selectLayer"
          @update-margins="handleMarginsChange"
          @update-name="handleNameChange"
          @update-description="handleDescriptionChange"
          @update-module-scope="handleModuleScopeChange"
          @update-page-settings="handlePageSettingsChange"
          @update-currency-display="handleCurrencyDisplayChange"
          @update:preview-record-id="handlePreviewRecordIdChange"
          @update:preview-record-label="handlePreviewRecordLabelChange"
          @toggle-open="leftPanelOpen = !leftPanelOpen"
        />

        <BuilderWorkspace
          v-model:view="workspaceView"
          v-model:html-document="htmlEditorContent"
          :editor="editor"
          :html-syncing="htmlSyncing"
          :canvas-width="canvasWidth"
          :canvas-height="canvasHeight"
          :page-width-px="pageDimensionsPx.width"
          :page-height-px="pageDimensionsPx.height"
          :margins-mm="pageMarginsMm"
          :show-margin-guides="!isEmailFormat"
          :download-filename="templateName"
          :is-email-format="isEmailFormat"
          :email-html="emailPreviewParts.html"
          :email-css="emailPreviewParts.css"
          :preview-document="workspacePreviewHtml"
          :preview-device="previewDevice"
          :preview-busy="previewBusy"
          :pdf-preview-busy="pdfPreviewBusy"
          @container-ready="onContainerReady"
          @refresh-preview="refreshWorkspaceHtmlPreview"
          @preview-pdf="openWorkspacePdfPreview"
          @apply-html="flushHtmlEditorToCanvas"
          @html-edit="onHtmlEditorEdit"
        />

        <EditorSidebar
          :open="rightPanelOpen"
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
          :editor="editor"
          :page-margins="pageMarginsMm"
          :output-format="outputFormat"
          :asset-library="assetLibrary"
          @change="markDirty"
          @update-margins="handleMarginsChange"
          @update-name="handleNameChange"
          @update-description="handleDescriptionChange"
          @update-module-scope="handleModuleScopeChange"
          @update-page-settings="handlePageSettingsChange"
          @update-currency-display="handleCurrencyDisplayChange"
          @update:preview-record-id="handlePreviewRecordIdChange"
          @update:preview-record-label="handlePreviewRecordLabelChange"
          @insert-image="insertImage"
        />
      </div>

      <EmailClientPreviewModal
        :open="showClientPreview"
        :html="currentTemplateDocument"
        :subject="templateName"
        @close="showClientPreview = false"
      />

      <HtmlDocumentModal
        :open="showEditHtml"
        :html="currentTemplateDocument"
        :read-only="false"
        :download-filename="templateName"
        :title="t('templates.htmlImport.actionEditHtml')"
        @close="showEditHtml = false"
        @apply="handleApplyEditedHtml"
      />

      <HtmlValidationModal
        :open="showValidation"
        :validating="validationValidating"
        :error="validationError"
        :result="validationResult"
        @close="showValidation = false"
      />

      <HtmlExportModal
        :open="showExport"
        @close="showExport = false"
        @export="handleExportHtml"
      />

      <IrreversibleHtmlWarningModal
        :open="showEditWarning"
        @cancel="showEditWarning = false"
        @confirm="confirmEditHtml"
      />

      <HtmlRestoreSnapshotModal
        :open="showRestoreSnapshot"
        :captured-at="importSnapshot?.capturedAt || ''"
        @cancel="showRestoreSnapshot = false"
        @confirm="confirmRestoreSnapshot"
      />

      <HtmlImportWizard
        :open="showReplaceImport"
        mode="replace"
        :initial-name="templateName"
        :initial-metadata="{ moduleScope: moduleScope }"
        @close="showReplaceImport = false"
        @apply="handleReplaceImport"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import { resolvePageDimensionsPx, DEFAULT_PAGE_MARGINS_MM, isEmailOutputFormat, resolveEmailCanvasDimensionsPx } from '@/constants/contentPageSettings';
import { resolveTemplateMarginsMm } from '../editor/pageDimensions';
import EditorToolbar from '../components/EditorToolbar.vue';
import BuilderLeftDock from '../components/BuilderLeftDock.vue';
import BuilderWorkspace from '../components/BuilderWorkspace.vue';
import EditorSidebar from '../components/EditorSidebar.vue';
import EmailClientPreviewModal from '../components/html/EmailClientPreviewModal.vue';
import HtmlDocumentModal from '../components/html/HtmlDocumentModal.vue';
import HtmlValidationModal from '../components/html/HtmlValidationModal.vue';
import HtmlExportModal from '../components/html/HtmlExportModal.vue';
import IrreversibleHtmlWarningModal from '../components/html/IrreversibleHtmlWarningModal.vue';
import HtmlRestoreSnapshotModal from '../components/html/HtmlRestoreSnapshotModal.vue';
import HtmlImportWizard from '../components/html/HtmlImportWizard.vue';
import { useGrapesEditor } from '../composables/useGrapesEditor';
import { useCompanyLogoAsset } from '../composables/useCompanyLogoAsset';
import { useTemplateEditor } from '../composables/useTemplateEditor';
import { applyCompanyLogoToEditor, refreshCanvasImageSources, resolveLogoPreviewUrl, setLogoHydrationHandler } from '../editor/logoContent';
import { useEmailHtmlValidation } from '../composables/useEmailHtmlValidation';
import { previewTemplatePdf, renderTemplateHtml } from '../services/templateApi';
import { buildTemplateHtmlDocument } from '../editor/renderer';
import { resolvePreviewHtmlImageUrls } from '../utils/previewHtmlImages';
import { createBlankGrapesDefinition } from '../editor/storage';
import {
  attachImportSnapshot,
  buildSnapshotFromParts,
  readImportSnapshot
} from '../utils/emailImportSnapshot';
import {
  copyTextToClipboard,
  downloadTextFile,
  getEmailHtmlParts,
  slugifyFilename
} from '../utils/emailHtmlExport';
import { downloadEmailHtmlZip } from '../utils/emailHtmlZipExport';
import { isEmailHtmlWarningDismissed } from '../utils/emailHtmlWarning';
import { captureEmailTemplateExported, captureEmailTemplateHtmlModeEntered } from '@/config/posthogTemplates';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const ui = useBuilderUi();
const notifications = useNotifications();
const authStore = useAuthStore();

const grapesContainer = ref(null);
const projectLoadedFor = ref('');
const leftPanelOpen = ref(true);
const rightPanelOpen = ref(true);
const previewDevice = ref('desktop');
const workspaceView = ref('design');
const serverPreviewHtml = ref('');
const pdfPreviewBusy = ref(false);
const htmlEditorContent = ref('');
const htmlEditorDirty = ref(false);
const htmlSyncing = ref(false);
const canvasContentRevision = ref(0);
let lastAppliedHtmlSource = '';
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
  setAutosaveBlockedChecker,
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

setAutosaveBlockedChecker(() =>
  htmlSyncing.value
  || (workspaceView.value === 'html' && htmlEditorDirty.value)
);

const isEmailFormat = computed(() => isEmailOutputFormat(outputFormat.value));

const pageDimensionsPx = computed(() => {
  if (isEmailFormat.value) {
    return resolveEmailCanvasDimensionsPx();
  }
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

const assetLibrary = computed(() => {
  const meta = templateMeta.value || {};
  if (String(meta.purpose || '').toLowerCase() === 'marketing') return 'marketing';
  if (String(meta.category || '').toLowerCase() === 'marketing') return 'marketing';
  if (moduleScope.value === 'campaigns') return 'marketing';
  return 'content';
});

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
  layerTree,
  applyEmailHtml,
  applyTemplateHtmlDocument,
  loadDefinitionIntoEditor,
  syncPageDimensions
} = useGrapesEditor({
  containerRef,
  outputFormat,
  canvasWidth,
  canvasHeight,
  pageMarginsMm,
  moduleScope,
  onDirty: () => {
    markDirty();
    canvasContentRevision.value += 1;
  }
});

const {
  ensureCompanyLogo,
  companyLogoAssetUrl,
  organizationLogoUrl,
  organizationName: companyName
} = useCompanyLogoAsset();

async function syncCompanyLogoToCanvas() {
  if (!editor.value || isEmailFormat.value) return;
  refreshCanvasImageSources(editor.value);
  try {
    const data = await ensureCompanyLogo();
    const previewUrl = resolveLogoPreviewUrl(data?.asset?.downloadUrl, data?.organizationLogoUrl);
    if (!previewUrl) return;
    applyCompanyLogoToEditor(editor.value, {
      assetUrl: previewUrl,
      alt: data?.organizationName || companyName.value || authStore.organization?.name || ''
    });
  } catch {
    // Keep existing canvas logo if sync fails.
  }
}

const selectedId = computed(() => String(selectedComponent.value?.getId?.() || ''));

const showClientPreview = ref(false);
const showEditHtml = ref(false);
const showEditWarning = ref(false);
const showValidation = ref(false);
const showExport = ref(false);
const showReplaceImport = ref(false);
const showRestoreSnapshot = ref(false);
const importSnapshot = ref(null);

const emailPreviewParts = computed(() => {
  void canvasContentRevision.value;
  if (!editor.value) return { html: '', css: '' };
  return getEmailHtmlParts(editor.value);
});

const {
  validating: validationValidating,
  result: validationResult,
  error: validationError,
  validateHtml,
  reset: resetValidation
} = useEmailHtmlValidation();

const currentTemplateDocument = computed(() => {
  if (!editor.value) return '';
  return buildTemplateHtmlDocument(editor.value, {
    outputFormat: outputFormat.value,
    pageSettings: isEmailFormat.value ? undefined : {
      paperSize: paperSize.value,
      orientation: orientation.value,
      customPageWidth: customPageWidth.value,
      customPageHeight: customPageHeight.value,
      margins: pageMarginsMm.value
    }
  });
});

const currentEmailDocument = computed(() => currentTemplateDocument.value);

const workspacePreviewHtml = computed(() => {
  void canvasContentRevision.value;
  const raw = serverPreviewHtml.value || currentTemplateDocument.value;
  const fallbackLogoUrl = resolveLogoPreviewUrl(
    companyLogoAssetUrl(),
    organizationLogoUrl.value
  );
  return resolvePreviewHtmlImageUrls(raw, fallbackLogoUrl);
});

const PREVIEW_DEBOUNCE_MS = 1200;
let previewRefreshTimer = null;

function buildPreviewRenderOptions() {
  const meta = templateMeta.value;
  return {
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
  };
}

function clearPreviewRefreshTimer() {
  if (previewRefreshTimer) {
    clearTimeout(previewRefreshTimer);
    previewRefreshTimer = null;
  }
}

function scheduleWorkspaceHtmlPreview() {
  if (workspaceView.value !== 'preview') return;
  if (isEmailFormat.value) return;
  if (String(outputFormat.value || 'pdf').toLowerCase() !== 'pdf') return;

  clearPreviewRefreshTimer();
  previewRefreshTimer = window.setTimeout(() => {
    previewRefreshTimer = null;
    void refreshWorkspaceHtmlPreview();
  }, PREVIEW_DEBOUNCE_MS);
}

function refreshHtmlEditorFromCanvas() {
  resyncHtmlEditorFromCanvas();
}

function resyncHtmlEditorFromCanvas() {
  if (!editor.value) return;
  htmlEditorContent.value = buildTemplateHtmlDocument(editor.value, {
    outputFormat: outputFormat.value,
    pageSettings: isEmailFormat.value ? undefined : {
      paperSize: paperSize.value,
      orientation: orientation.value,
      customPageWidth: customPageWidth.value,
      customPageHeight: customPageHeight.value,
      margins: pageMarginsMm.value
    }
  });
  lastAppliedHtmlSource = String(htmlEditorContent.value || '').trim();
  htmlEditorDirty.value = false;
}

function onHtmlEditorEdit() {
  htmlEditorDirty.value = true;
  markDirty();
}

function applyHtmlEditorToCanvas(rawHtml = htmlEditorContent.value, resyncEditor = false) {
  const source = String(rawHtml || '').trim();
  if (!editor.value || !source || source === lastAppliedHtmlSource) {
    htmlEditorDirty.value = false;
    return false;
  }

  htmlSyncing.value = true;
  try {
    applyTemplateHtmlDocument(source);
    lastAppliedHtmlSource = source;
    htmlEditorDirty.value = false;
    markDirty();
    if (resyncEditor) {
      resyncHtmlEditorFromCanvas();
    }
    return true;
  } catch (error) {
    notifications.error(error?.message || t('templates.htmlImport.errorApplyFailed'));
    return false;
  } finally {
    htmlSyncing.value = false;
  }
}

function flushHtmlEditorToCanvas() {
  applyHtmlEditorToCanvas(htmlEditorContent.value, true);
}

async function ensureHtmlEditorAppliedToCanvas() {
  if (!htmlEditorDirty.value && workspaceView.value !== 'html') return;
  applyHtmlEditorToCanvas(htmlEditorContent.value, false);
  await nextTick();
}

const hasImportSnapshot = computed(() => Boolean(importSnapshot.value?.html?.trim()));

function serializeProjectWithSnapshot() {
  if (htmlEditorDirty.value || workspaceView.value === 'html') {
    applyHtmlEditorToCanvas(htmlEditorContent.value, false);
  }
  const definition = serializeProject();
  return attachImportSnapshot(definition, importSnapshot.value);
}

function captureImportSnapshot(reason) {
  if (!editor.value) return;
  const parts = getEmailHtmlParts(editor.value);
  if (!String(parts.html || '').trim()) return;
  importSnapshot.value = buildSnapshotFromParts(parts.html, parts.css, reason);
}

watch(ready, (isReady) => {
  if (isReady && workspaceView.value === 'html') {
    refreshHtmlEditorFromCanvas();
  }
});

registerSerializer(serializeProjectWithSnapshot);

onMounted(async () => {
  window.addEventListener('keydown', onBuilderKeydown);
  setLogoHydrationHandler(syncCompanyLogoToCanvas);
  try {
    await loadTemplate();
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  }
});

onBeforeUnmount(() => {
  setLogoHydrationHandler(null);
  setAutosaveBlockedChecker(null);
  window.removeEventListener('keydown', onBuilderKeydown);
  clearPreviewRefreshTimer();
});

watch(
  [ready, templateMeta],
  async ([isReady, meta]) => {
    if (!isReady || !meta) return;
    const id = String(meta._id || templateId.value);
    if (projectLoadedFor.value === id) return;
    projectLoadedFor.value = id;
    const definition = resolveDraftDefinition(meta);
    importSnapshot.value = readImportSnapshot(definition);
    withAutosaveSuppressed(() => {
      loadProject(definition);
    });
    await nextTick();
    await new Promise((resolve) => queueMicrotask(resolve));
    await syncCompanyLogoToCanvas();
  }
);

watch(templateId, () => {
  projectLoadedFor.value = '';
  importSnapshot.value = null;
});

function goBack() {
  router.push({ name: 'template-detail', params: { id: templateId.value } });
}

function onBuilderKeydown(event) {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return;

  const target = event.target;
  const tag = target instanceof HTMLElement ? target.tagName : '';
  const isEditable = target instanceof HTMLElement && (
    target.isContentEditable
    || tag === 'INPUT'
    || tag === 'TEXTAREA'
    || tag === 'SELECT'
  );
  if (isEditable) return;

  if (event.key === 's' || event.key === 'S') {
    event.preventDefault();
    void handleSave();
    return;
  }
  if (event.key === 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
    return;
  }
  if (event.key === 'y' || (event.key === 'z' && event.shiftKey) || (event.key === 'Z' && event.shiftKey)) {
    event.preventDefault();
    redo();
  }
}

async function handleSave() {
  if (!authStore.can('templates', 'edit')) {
    notifications.error(t('templates.builderNoEditPermission'));
    return;
  }
  try {
    await ensureHtmlEditorAppliedToCanvas();
    await saveDraft({ force: true });
    if (workspaceView.value === 'html') {
      resyncHtmlEditorFromCanvas();
    }
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
  if (isEmailFormat.value) {
    const validation = await validateHtml(currentEmailDocument.value);
    if (!validation) return;
    if (validation.errors.length > 0) {
      showValidation.value = true;
      notifications.error(t('templates.htmlImport.publishBlocked'));
      return;
    }
    if (validation.warnings.length > 0) {
      const proceed = window.confirm(t('templates.htmlImport.publishWarningsConfirm'));
      if (!proceed) return;
    }
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

function setWorkspaceView(view) {
  workspaceView.value = view;
}

async function refreshWorkspaceHtmlPreview() {
  if (!editor.value || isEmailFormat.value) return;

  const format = String(outputFormat.value || 'pdf').toLowerCase();
  if (format !== 'pdf') return;

  if (previewRecordId.value && !moduleScope.value) {
    notifications.error(t('templates.builderDataSelectModule'));
    return;
  }

  setPreviewBusy(true);
  try {
    await saveDraft({ force: true });
    serverPreviewHtml.value = await renderTemplateHtml(templateId.value, buildPreviewRenderOptions());
  } catch (error) {
    notifications.error(error?.message || t('templates.renderFailed'));
  } finally {
    setPreviewBusy(false);
  }
}

async function openWorkspacePdfPreview() {
  if (!editor.value || isEmailFormat.value) return;

  const format = String(outputFormat.value || 'pdf').toLowerCase();
  if (format !== 'pdf') return;

  if (previewRecordId.value && !moduleScope.value) {
    notifications.error(t('templates.builderDataSelectModule'));
    return;
  }

  pdfPreviewBusy.value = true;
  try {
    await saveDraft({ force: true });
    await previewTemplatePdf(templateId.value, buildPreviewRenderOptions());
  } catch (error) {
    notifications.error(error?.message || t('templates.renderFailed'));
  } finally {
    pdfPreviewBusy.value = false;
  }
}

function handlePreviewRecordIdChange(recordId) {
  setPreviewRecord(recordId, previewRecordLabel.value);
}

function handlePreviewRecordLabelChange(label) {
  setPreviewRecord(previewRecordId.value, label);
}

function openClientPreview() {
  if (!editor.value) return;
  showClientPreview.value = true;
}

function handleAdvancedAction(action) {
  switch (action) {
    case 'view-html':
      setWorkspaceView('html');
      break;
    case 'edit-html':
      if (isEmailHtmlWarningDismissed()) {
        showEditHtml.value = true;
        captureEmailTemplateHtmlModeEntered({ action: 'edit-html' });
      } else {
        showEditWarning.value = true;
      }
      break;
    case 'validate-html':
      void runValidation();
      break;
    case 'import-html':
      showReplaceImport.value = true;
      break;
    case 'export-html':
      showExport.value = true;
      break;
    case 'restore-snapshot':
      showRestoreSnapshot.value = true;
      break;
    default:
      break;
  }
}

function confirmEditHtml() {
  showEditWarning.value = false;
  showEditHtml.value = true;
  captureEmailTemplateHtmlModeEntered({ action: 'edit-html' });
}

async function handleApplyEditedHtml(rawHtml) {
  try {
    captureImportSnapshot('html-edit');
    applyEmailHtml(rawHtml);
    showEditHtml.value = false;
    await saveDraft({ force: true });
    notifications.success(t('templates.htmlImport.applySuccess'));
  } catch (error) {
    notifications.error(error?.message || t('templates.htmlImport.errorApplyFailed'));
  }
}

async function runValidation() {
  resetValidation();
  showValidation.value = true;
  await validateHtml(currentEmailDocument.value);
}

async function handleExportHtml(mode) {
  const documentHtml = currentEmailDocument.value;
  const baseName = slugifyFilename(templateName.value);
  showExport.value = false;

  if (mode === 'copy') {
    const copied = await copyTextToClipboard(documentHtml);
    captureEmailTemplateExported({ format: 'copy', success: copied });
    notifications.success(
      copied
        ? t('templates.htmlImport.copySuccess')
        : t('templates.htmlImport.copyFailed')
    );
    return;
  }

  if (mode === 'zip') {
    try {
      const result = await downloadEmailHtmlZip(documentHtml, baseName);
      captureEmailTemplateExported({
        format: 'zip',
        includedAssets: result.includedCount,
        failedAssets: result.failedCount
      });
      if (result.failedCount > 0 || result.skippedCount > 0) {
        notifications.success(t('templates.htmlImport.zipPartialSuccess'));
      } else {
        notifications.success(t('templates.htmlImport.zipSuccess'));
      }
    } catch (error) {
      notifications.error(error?.message || t('templates.htmlImport.zipFailed'));
    }
    return;
  }

  downloadTextFile(`${baseName}.html`, documentHtml, 'text/html;charset=utf-8');
  captureEmailTemplateExported({ format: 'download' });
  notifications.success(t('templates.htmlImport.downloadSuccess'));
}

async function handleReplaceImport(payload) {
  if (!payload?.jsonDefinition) return;
  try {
    captureImportSnapshot('html-replace');
    withAutosaveSuppressed(() => {
      loadDefinitionIntoEditor(payload.jsonDefinition);
    });
    showReplaceImport.value = false;
    markDirty();
    await saveDraft({ force: true });
    notifications.success(t('templates.htmlImport.applySuccess'));
  } catch (error) {
    notifications.error(error?.message || t('templates.htmlImport.errorApplyFailed'));
  }
}

watch(workspaceView, (view, previousView) => {
  if (view === 'html') {
    if (!htmlEditorDirty.value) {
      refreshHtmlEditorFromCanvas();
    }
  } else if (previousView === 'html' && htmlEditorDirty.value) {
    flushHtmlEditorToCanvas();
  } else if (view === 'design' && !isEmailFormat.value) {
    syncPageDimensions();
  }

  if (view !== 'preview') return;
  if (isEmailFormat.value) return;
  if (String(outputFormat.value || 'pdf').toLowerCase() !== 'pdf') return;
  void ensureCompanyLogo();
  scheduleWorkspaceHtmlPreview();
});

watch(previewRecordId, () => {
  if (workspaceView.value !== 'preview') return;
  if (isEmailFormat.value) return;
  if (String(outputFormat.value || 'pdf').toLowerCase() !== 'pdf') return;
  serverPreviewHtml.value = '';
  scheduleWorkspaceHtmlPreview();
});

watch(canvasContentRevision, () => {
  scheduleWorkspaceHtmlPreview();
});

async function confirmRestoreSnapshot() {
  const snapshot = importSnapshot.value;
  if (!snapshot) {
    showRestoreSnapshot.value = false;
    return;
  }

  try {
    withAutosaveSuppressed(() => {
      loadDefinitionIntoEditor({
        ...createBlankGrapesDefinition(),
        html: snapshot.html,
        css: snapshot.css
      });
    });
    importSnapshot.value = null;
    showRestoreSnapshot.value = false;
    markDirty();
    await saveDraft({ force: true });
    notifications.success(t('templates.htmlImport.restoreSnapshotSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('templates.htmlImport.restoreSnapshotFailed'));
  }
}
</script>
