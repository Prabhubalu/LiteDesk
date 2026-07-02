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
        :is-email-format="isEmailFormat"
        :has-import-snapshot="hasImportSnapshot"
        @back="goBack"
        @undo="undo"
        @redo="redo"
        @preview="handlePreview"
        @preview-email="openEmailPreview"
        @preview-email-clients="openClientPreview"
        @advanced="handleAdvancedAction"
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
            :show-margin-guides="!isEmailFormat"
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
          :output-format="outputFormat"
          :asset-library="assetLibrary"
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

      <EmailPreviewModal
        :open="showEmailPreview"
        :html="emailPreviewBodyHtml"
        :css="emailPreviewCss"
        :initial-viewport="emailPreviewViewport"
        @close="showEmailPreview = false"
      />

      <EmailClientPreviewModal
        :open="showClientPreview"
        :html="currentEmailDocument"
        :subject="templateName"
        @close="showClientPreview = false"
      />

      <HtmlDocumentModal
        :open="showViewHtml"
        :html="currentEmailDocument"
        :read-only="true"
        :title="t('templates.htmlImport.actionViewHtml')"
        @close="showViewHtml = false"
      />

      <HtmlDocumentModal
        :open="showEditHtml"
        :html="currentEmailDocument"
        :read-only="false"
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import { resolvePageDimensionsPx, DEFAULT_PAGE_MARGINS_MM, isEmailOutputFormat, resolveEmailCanvasDimensionsPx } from '@/constants/contentPageSettings';
import { resolveTemplateMarginsMm } from '../editor/pageDimensions';
import EditorToolbar from '../components/EditorToolbar.vue';
import ComponentLibraryPanel from '../components/ComponentLibraryPanel.vue';
import EditorSidebar from '../components/EditorSidebar.vue';
import EditorCanvas from '../components/EditorCanvas.vue';
import EmailPreviewModal from '../components/html/EmailPreviewModal.vue';
import EmailClientPreviewModal from '../components/html/EmailClientPreviewModal.vue';
import HtmlDocumentModal from '../components/html/HtmlDocumentModal.vue';
import HtmlValidationModal from '../components/html/HtmlValidationModal.vue';
import HtmlExportModal from '../components/html/HtmlExportModal.vue';
import IrreversibleHtmlWarningModal from '../components/html/IrreversibleHtmlWarningModal.vue';
import HtmlRestoreSnapshotModal from '../components/html/HtmlRestoreSnapshotModal.vue';
import HtmlImportWizard from '../components/html/HtmlImportWizard.vue';
import { useGrapesEditor } from '../composables/useGrapesEditor';
import { useTemplateEditor } from '../composables/useTemplateEditor';
import { useEmailHtmlValidation } from '../composables/useEmailHtmlValidation';
import { previewTemplatePdf } from '../services/templateApi';
import { createBlankGrapesDefinition } from '../editor/storage';
import {
  attachImportSnapshot,
  buildSnapshotFromParts,
  readImportSnapshot
} from '../utils/emailImportSnapshot';
import {
  buildEmailHtmlDocument,
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
  loadDefinitionIntoEditor
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

const showEmailPreview = ref(false);
const showClientPreview = ref(false);
const showViewHtml = ref(false);
const showEditHtml = ref(false);
const showEditWarning = ref(false);
const showValidation = ref(false);
const showExport = ref(false);
const showReplaceImport = ref(false);
const showRestoreSnapshot = ref(false);
const importSnapshot = ref(null);
const emailPreviewBodyHtml = ref('');
const emailPreviewCss = ref('');
const emailPreviewViewport = ref('desktop');

const {
  validating: validationValidating,
  result: validationResult,
  error: validationError,
  validateHtml,
  reset: resetValidation
} = useEmailHtmlValidation();

const currentEmailDocument = computed(() => {
  if (!editor.value) return '';
  return buildEmailHtmlDocument(editor.value);
});

const hasImportSnapshot = computed(() => Boolean(importSnapshot.value?.html?.trim()));

function serializeProjectWithSnapshot() {
  const definition = serializeProject();
  return attachImportSnapshot(definition, importSnapshot.value);
}

function captureImportSnapshot(reason) {
  if (!editor.value) return;
  const parts = getEmailHtmlParts(editor.value);
  if (!String(parts.html || '').trim()) return;
  importSnapshot.value = buildSnapshotFromParts(parts.html, parts.css, reason);
}

registerSerializer(serializeProjectWithSnapshot);

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
    const definition = resolveDraftDefinition(meta);
    importSnapshot.value = readImportSnapshot(definition);
    withAutosaveSuppressed(() => {
      loadProject(definition);
    });
  }
);

watch(templateId, () => {
  projectLoadedFor.value = '';
  importSnapshot.value = null;
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
      pageSettings: isEmailFormat.value ? undefined : {
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

function openEmailPreview(viewport) {
  if (!editor.value) return;
  const parts = getEmailHtmlParts(editor.value);
  emailPreviewBodyHtml.value = parts.html;
  emailPreviewCss.value = parts.css;
  emailPreviewViewport.value = viewport === 'mobile' ? 'mobile' : 'desktop';
  showEmailPreview.value = true;
}

function openClientPreview() {
  if (!editor.value) return;
  showClientPreview.value = true;
}

function handleAdvancedAction(action) {
  switch (action) {
    case 'view-html':
      showViewHtml.value = true;
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
