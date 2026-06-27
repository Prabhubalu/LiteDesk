import { computed, ref, shallowRef } from 'vue';
import {
  fetchTemplate,
  publishTemplate,
  updateTemplateDefinition,
  type TemplateMetadataPatch,
  type TemplateRecord
} from '../services/templateApi';
import {
  createBlankGrapesDefinition,
  hasGrapesDefinitionContent,
  isEmptyGrapesDefinition,
  isGrapesDefinition,
  type GrapesTemplateDefinition
} from '../editor/storage';
import type { SaveStatus } from './useGrapesEditor';
import { isTableMutating } from '../editor/tableActions';
import { isTableSheetEditing } from '../editor/tableSheetEditor';

const AUTOSAVE_IDLE_MS = 3500;
const AUTOSAVE_RETRY_MS = 800;

function isAutosaveBlocked(): boolean {
  return isTableSheetEditing() || isTableMutating();
}

export function useTemplateEditor(getTemplateId: () => string) {
  const templateMeta = shallowRef<TemplateRecord | null>(null);
  const loading = ref(true);
  const saveStatus = ref<SaveStatus>('saved');
  const publishBusy = ref(false);
  const previewBusy = ref(false);
  const previewRecordId = ref('');
  const previewRecordLabel = ref('');

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressAutosave = false;
  let serializeFn: (() => GrapesTemplateDefinition) | null = null;
  let loadedDefinitionHadContent = false;

  const templateName = computed(() => String(templateMeta.value?.name || ''));
  const templateDescription = computed(() => String(templateMeta.value?.description || ''));
  const outputFormat = computed(() => String(templateMeta.value?.outputFormat || 'pdf'));

  function resolveDraftDefinition(record: TemplateRecord | null): GrapesTemplateDefinition {
    const draft = record?.draftDefinition;
    if (isGrapesDefinition(draft)) return draft;
    return createBlankGrapesDefinition();
  }

  async function loadTemplate() {
    loading.value = true;
    try {
      const id = getTemplateId();
      templateMeta.value = await fetchTemplate(id);
      const definition = resolveDraftDefinition(templateMeta.value);
      loadedDefinitionHadContent = hasGrapesDefinitionContent(definition);
      return definition;
    } finally {
      loading.value = false;
    }
  }

  function registerSerializer(fn: () => GrapesTemplateDefinition) {
    serializeFn = fn;
  }

  function scheduleAutosave() {
    if (suppressAutosave) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void attemptAutosave();
    }, AUTOSAVE_IDLE_MS);
  }

  function scheduleAutosaveRetry() {
    if (suppressAutosave) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void attemptAutosave();
    }, AUTOSAVE_RETRY_MS);
  }

  async function attemptAutosave() {
    if (suppressAutosave) return;
    if (isAutosaveBlocked()) {
      scheduleAutosaveRetry();
      return;
    }
    try {
      await saveDraft();
    } catch {
      // saveDraft updates saveStatus
    }
  }

  function markDirty() {
    if (suppressAutosave) return;
    saveStatus.value = 'dirty';
    scheduleAutosave();
  }

  async function saveDraft(options: { force?: boolean } = {}) {
    const id = getTemplateId();
    if (!id || !serializeFn) return;

    if (!options.force && isAutosaveBlocked()) {
      scheduleAutosaveRetry();
      return;
    }

    saveStatus.value = 'saving';
    try {
      const jsonDefinition = serializeFn();
      if (
        isEmptyGrapesDefinition(jsonDefinition)
        && loadedDefinitionHadContent
        && !options.force
      ) {
        saveStatus.value = 'dirty';
        return;
      }

      const updated = await updateTemplateDefinition(id, { jsonDefinition });
      templateMeta.value = updated;
      loadedDefinitionHadContent = hasGrapesDefinitionContent(jsonDefinition);
      saveStatus.value = 'saved';
    } catch (error) {
      saveStatus.value = 'error';
      throw error;
    }
  }

  async function updateTemplateMargins(margins: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  }) {
    return patchTemplateMetadata({ margins });
  }

  async function patchTemplateMetadata(payload: TemplateMetadataPatch) {
    const id = getTemplateId();
    if (!id) return;

    saveStatus.value = 'saving';
    try {
      const updated = await updateTemplateDefinition(id, payload);
      templateMeta.value = updated;
      saveStatus.value = 'saved';
      return updated;
    } catch (error) {
      saveStatus.value = 'error';
      throw error;
    }
  }

  function setPreviewRecord(recordId: string, label = '') {
    previewRecordId.value = String(recordId || '');
    previewRecordLabel.value = String(label || '');
  }

  async function runPublish(releaseNotes = '') {
    publishBusy.value = true;
    try {
      await saveDraft({ force: true });
      const updated = await publishTemplate(getTemplateId(), releaseNotes);
      templateMeta.value = updated;
    } finally {
      publishBusy.value = false;
    }
  }

  function setPreviewBusy(value: boolean) {
    previewBusy.value = value;
  }

  async function withAutosaveSuppressed<T>(fn: () => Promise<T> | T): Promise<T> {
    suppressAutosave = true;
    try {
      return await fn();
    } finally {
      suppressAutosave = false;
    }
  }

  return {
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
    updateTemplateMargins,
    patchTemplateMetadata,
    runPublish,
    setPreviewBusy,
    setPreviewRecord,
    previewRecordId,
    previewRecordLabel,
    withAutosaveSuppressed,
    resolveDraftDefinition
  };
}
