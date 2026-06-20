<template>
  <div class="space-y-4">
    <div v-if="canCreate" class="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        multiple
        @change="handleFilesSelected"
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('documents.recordUploadTitle') }}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('documents.recordUploadHint') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            @click="openLinkExistingDialog"
          >
            <LinkIcon class="h-4 w-4" />
            {{ t('documents.linkExisting') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="uploading"
            @click="openFilePicker"
          >
            <ArrowUpTrayIcon class="h-4 w-4" />
            {{ uploading ? t('documents.uploading') : t('documents.upload') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('documents.recordDocumentsLoading') }}
    </div>

    <div
      v-else-if="!documents.length"
      class="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center dark:border-gray-600"
    >
      <DocumentDuplicateIcon class="mx-auto h-8 w-8 text-gray-400" />
      <p class="mt-2 text-sm font-medium text-gray-900 dark:text-white">{{ t('documents.recordDocumentsEmpty') }}</p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('documents.recordDocumentsEmptyHint') }}</p>
    </div>

    <ul v-else class="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
      <li
        v-for="doc in documents"
        :key="doc._id"
        class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40"
      >
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          @click="openDocument(doc)"
        >
          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ doc.title }}</p>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {{ doc.documentNumber }}
            <span v-if="doc.fileType"> · {{ doc.fileType }}</span>
            <span v-if="doc.versionNumber"> · {{ t('documents.versionLabel', { version: doc.versionNumber }) }}</span>
          </p>
        </button>
        <div class="flex items-center gap-2">
          <button
            v-if="doc.documentType === 'file'"
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800"
            :title="t('documents.preview')"
            @click="handlePreview(doc)"
          >
            <EyeIcon class="h-4 w-4" />
          </button>
          <button
            v-if="doc.documentType === 'file'"
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800"
            :title="t('documents.download')"
            @click="handleDownload(doc)"
          >
            <ArrowDownTrayIcon class="h-4 w-4" />
          </button>
          <button
            v-if="canEdit && doc.relationshipId"
            type="button"
            class="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            @click="handleDetach(doc)"
          >
            {{ t('documents.detach') }}
          </button>
        </div>
      </li>
    </ul>

    <Dialog :open="showLinkExistingDialog" class="relative z-50" @close="closeLinkExistingDialog">
      <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <DialogTitle class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('documents.linkExistingTitle') }}
            </DialogTitle>
            <button type="button" class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" @click="closeLinkExistingDialog">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <input
              v-model="linkSearchQuery"
              type="search"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              :placeholder="t('documents.linkExistingSearchPlaceholder')"
            />
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <div v-if="linkSearchLoading" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {{ t('documents.recordDocumentsLoading') }}
            </div>
            <div v-else-if="!linkSearchResults.length" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {{ t('documents.linkExistingNoResults') }}
            </div>
            <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
              <li
                v-for="doc in linkSearchResults"
                :key="doc._id"
                class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ doc.title }}</p>
                  <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{{ doc.documentNumber }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="linkingDocumentId === doc._id"
                  @click="handleLinkExisting(doc)"
                >
                  {{ linkingDocumentId === doc._id ? t('documents.linking') : t('documents.linkExistingAction') }}
                </button>
              </li>
            </ul>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <Dialog :open="showPreviewModal" class="relative z-50" @close="showPreviewModal = false">
      <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <DialogTitle class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ previewState.title }}
            </DialogTitle>
            <button type="button" class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" @click="showPreviewModal = false">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="min-h-0 flex-1 bg-gray-50 dark:bg-gray-950">
            <div v-if="previewLoading" class="flex h-full items-center justify-center text-sm text-gray-500">
              {{ t('documents.previewLoading') }}
            </div>
            <iframe
              v-else-if="previewState.mimeType === 'application/pdf'"
              :src="previewState.url"
              class="h-full w-full border-0"
              :title="previewState.title"
            />
            <img
              v-else-if="previewState.url && String(previewState.mimeType || '').startsWith('image/')"
              :src="previewState.url"
              :alt="previewState.title"
              class="mx-auto h-full max-h-full w-auto object-contain"
            />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  LinkIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { useRecordDocuments } from '@/composables/useRecordDocuments';
import { useDocuments } from '@/composables/useDocuments';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import { captureDocumentLinkedToRecord, captureDocumentUploaded } from '@/config/posthogDocuments';

const props = defineProps({
  moduleKey: { type: String, required: true },
  recordId: { type: String, required: true },
  appKey: { type: String, default: '' },
  canCreate: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false }
});

const emit = defineEmits(['documents-changed']);

const { t } = useI18n();
const notifications = useNotifications();
const { openTab } = useTabs();
const { fetchRecordDocuments, uploadAndAttach, unlinkDocument, linkDocument } = useRecordDocuments();
const { getPreviewUrl, getDownloadUrl, fetchDocuments } = useDocuments();

const documents = ref([]);
const loading = ref(false);
const uploading = ref(false);
const fileInputRef = ref(null);
const showPreviewModal = ref(false);
const previewLoading = ref(false);
const previewState = ref({ title: '', url: '', mimeType: '' });
const showLinkExistingDialog = ref(false);
const linkSearchQuery = ref('');
const linkSearchLoading = ref(false);
const linkSearchResults = ref([]);
const linkingDocumentId = ref('');

const linkedDocumentIds = computed(() => new Set(documents.value.map((doc) => String(doc._id))));

function notifyDocumentsChanged(payload = {}) {
  emit('documents-changed', {
    moduleKey: props.moduleKey,
    recordId: props.recordId,
    appKey: props.appKey,
    ...payload
  });
}

async function loadDocuments() {
  if (!props.recordId || props.recordId === 'new') return;
  loading.value = true;
  try {
    documents.value = await fetchRecordDocuments(props.moduleKey, props.recordId, props.appKey);
  } catch (error) {
    notifications.error(error?.message || t('documents.recordDocumentsLoadFailed'));
    documents.value = [];
  } finally {
    loading.value = false;
  }
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function openLinkExistingDialog() {
  showLinkExistingDialog.value = true;
  linkSearchQuery.value = '';
  searchLinkableDocuments();
}

function closeLinkExistingDialog() {
  showLinkExistingDialog.value = false;
  linkSearchQuery.value = '';
  linkSearchResults.value = [];
}

let linkSearchTimer = null;
async function searchLinkableDocuments() {
  linkSearchLoading.value = true;
  try {
    const response = await fetchDocuments({
      page: 1,
      limit: 25,
      search: linkSearchQuery.value.trim()
    });
    const rows = response?.data || [];
    linkSearchResults.value = rows.filter((doc) => !linkedDocumentIds.value.has(String(doc._id)));
  } catch (error) {
    linkSearchResults.value = [];
    notifications.error(error?.message || t('documents.linkExistingSearchFailed'));
  } finally {
    linkSearchLoading.value = false;
  }
}

async function handleLinkExisting(doc) {
  if (!doc?._id) return;
  linkingDocumentId.value = String(doc._id);
  try {
    const result = await linkDocument(doc._id, {
      moduleKey: props.moduleKey,
      recordId: props.recordId,
      appKey: props.appKey
    });
    if (result?.success) {
      notifications.success(t('documents.recordAttachSuccess'));
      captureDocumentLinkedToRecord({
        module_key: props.moduleKey,
        record_id: props.recordId
      });
      closeLinkExistingDialog();
      await loadDocuments();
      notifyDocumentsChanged({ action: 'attach', documents: [doc] });
    } else {
      notifications.error(result?.message || t('documents.linkFailed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.linkFailed'));
  } finally {
    linkingDocumentId.value = '';
  }
}

function isPreviewableMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  return mime.startsWith('image/') || mime === 'application/pdf';
}

async function handleFilesSelected(event) {
  const files = Array.from(event.target?.files || []);
  if (!files.length) return;
  uploading.value = true;
  let successCount = 0;
  const attachedDocs = [];
  try {
    for (const file of files) {
      const result = await uploadAndAttach(file, {
        moduleKey: props.moduleKey,
        recordId: props.recordId,
        appKey: props.appKey,
        title: file.name
      });
      if (result?.success) {
        successCount += 1;
        if (result.data) attachedDocs.push(result.data);
      } else if (result?.code === 'DOCUMENT_IN_TRASH') {
        notifications.error(
          t('documents.uploadInTrash', {
            title: result.title || file.name,
            documentNumber: result.documentNumber || ''
          })
        );
      } else {
        notifications.error(result?.message || t('documents.uploadFailed'));
      }
    }
    if (successCount > 0) {
      notifications.success(t('documents.recordAttachSuccess'));
      captureDocumentUploaded({ count: successCount, source: 'record_panel' });
      await loadDocuments();
      notifyDocumentsChanged({
        action: 'attach',
        documents: attachedDocs.length ? attachedDocs : documents.value.slice(-successCount)
      });
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.uploadFailed'));
  } finally {
    uploading.value = false;
    if (event.target) event.target.value = '';
  }
}

function openDocument(doc) {
  if (!doc?._id) return;
  openTab(`/documents/${doc._id}`, {
    title: doc.title || t('documents.pageTitle'),
    insertAdjacent: true
  });
}

async function handlePreview(doc) {
  if (!doc?._id) return;
  previewLoading.value = true;
  showPreviewModal.value = true;
  previewState.value = { title: doc.title || '', url: '', mimeType: doc.mimeType || '' };
  try {
    const data = await getPreviewUrl(doc._id);
    if (isPreviewableMime(data?.mimeType)) {
      previewState.value = { title: doc.title || '', url: data.url, mimeType: data.mimeType || '' };
    } else if (data?.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
      showPreviewModal.value = false;
    }
  } catch (error) {
    showPreviewModal.value = false;
    notifications.error(error?.message || t('documents.previewFailed'));
  } finally {
    previewLoading.value = false;
  }
}

async function handleDownload(doc) {
  if (!doc?._id) return;
  try {
    const data = await getDownloadUrl(doc._id);
    if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    notifications.error(error?.message || t('documents.downloadFailed'));
  }
}

async function handleDetach(doc) {
  if (!doc?._id || !doc?.relationshipId) return;
  if (!window.confirm(t('documents.detachConfirm'))) return;
  try {
    const result = await unlinkDocument(doc._id, doc.relationshipId);
    if (result?.success) {
      notifications.success(t('documents.detachSuccess'));
      await loadDocuments();
      notifyDocumentsChanged({ action: 'detach', detachedDocumentIds: [String(doc._id)] });
    } else {
      notifications.error(result?.message || t('documents.detachFailed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.detachFailed'));
  }
}

onMounted(loadDocuments);
watch(() => [props.recordId, props.moduleKey], loadDocuments);
watch(linkSearchQuery, () => {
  if (!showLinkExistingDialog.value) return;
  clearTimeout(linkSearchTimer);
  linkSearchTimer = setTimeout(() => {
    searchLinkableDocuments();
  }, 300);
});
</script>
