<template>
  <div v-if="record?._id" class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="text-sm font-medium text-gray-900 dark:text-white">
          {{ record.fileType || t('documents.typeFile') }}
          <span v-if="record.versionNumber" class="text-gray-500 dark:text-gray-400">
            · {{ t('documents.versionLabel', { version: record.versionNumber }) }}
          </span>
        </p>
        <p v-if="record.fileSizeBytes" class="text-xs text-gray-500 dark:text-gray-400">
          {{ formatFileSize(record.fileSizeBytes) }}
          <span v-if="record.mimeType"> · {{ record.mimeType }}</span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="hasFile"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          @click="handlePreview"
        >
          <EyeIcon class="h-4 w-4" />
          {{ t('documents.preview') }}
        </button>
        <button
          v-if="hasFile"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          @click="handleDownload"
        >
          <ArrowDownTrayIcon class="h-4 w-4" />
          {{ t('documents.download') }}
        </button>
        <button
          v-if="canEdit && hasFile"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="uploadingVersion"
          @click="openVersionUpload"
        >
          <ArrowUpTrayIcon class="h-4 w-4" />
          {{ t('documents.uploadNewVersion') }}
        </button>
      </div>
    </div>

    <input
      ref="versionInputRef"
      type="file"
      class="hidden"
      @change="handleVersionFileSelected"
    />

    <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/60">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.versionHistory') }}</h3>
        <button
          v-if="versions.length >= 2"
          type="button"
          class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          @click="showCompareModal = true"
        >
          {{ t('documents.versionCompareAction') }}
        </button>
      </div>
      <div v-if="versionsLoading" class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
        {{ t('documents.versionsLoading') }}
      </div>
      <div v-else-if="!versions.length" class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
        {{ t('documents.noVersions') }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-white dark:bg-gray-900">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.columnVersion') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.versionUploadedBy') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.versionUploadedAt') }}</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.versionChangeSummary') }}</th>
              <th v-if="canEdit" class="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.columnActions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            <tr v-for="version in versions" :key="version._id">
              <td class="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                {{ t('documents.versionLabel', { version: version.versionNumber }) }}
                <span
                  v-if="version.versionNumber === record.versionNumber"
                  class="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                >
                  {{ t('documents.currentVersion') }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ formatUser(version.createdBy) }}</td>
              <td class="whitespace-nowrap px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ formatDate(version.createdAt) }}</td>
              <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ version.changeSummary || '—' }}</td>
              <td v-if="canEdit" class="px-4 py-2.5 text-right">
                <button
                  v-if="version.versionNumber !== record.versionNumber"
                  type="button"
                  class="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 dark:text-indigo-400"
                  :disabled="restoringVersion === version.versionNumber"
                  @click="handleRestore(version.versionNumber)"
                >
                  {{ t('documents.restoreVersion') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Dialog :open="showPreviewModal" class="relative z-50" @close="showPreviewModal = false">
      <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <DialogTitle class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ record.title }}
            </DialogTitle>
            <button
              type="button"
              class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="showPreviewModal = false"
            >
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
              :title="record.title"
            />
            <img
              v-else-if="previewState.url && String(previewState.mimeType || '').startsWith('image/')"
              :src="previewState.url"
              :alt="record.title"
              class="mx-auto h-full max-h-full w-auto object-contain"
            />
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    <DocumentVersionCompareModal
      :is-open="showCompareModal"
      :versions="versions"
      @close="showCompareModal = false"
      @compared="handleVersionCompared"
    />

    <DocumentUploadConflictDialog
      :is-open="showConflictDialog"
      :base-version="conflictState.baseVersion"
      :current-version="conflictState.currentVersion"
      :forcing="uploadingVersion"
      @cancel="handleConflictCancel"
      @compare="handleConflictCompare"
      @force-upload="handleConflictForceUpload"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import DocumentVersionCompareModal from '@/components/documents/DocumentVersionCompareModal.vue';
import DocumentUploadConflictDialog from '@/components/documents/DocumentUploadConflictDialog.vue';
import { useDocuments } from '@/composables/useDocuments';
import { useNotifications } from '@/composables/useNotifications';
import { captureDocumentVersionCompared } from '@/config/posthogDocuments';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const notifications = useNotifications();
const {
  getPreviewUrl,
  getDownloadUrl,
  fetchVersions,
  uploadNewVersion,
  restoreVersion
} = useDocuments();

const versions = ref([]);
const versionsLoading = ref(false);
const uploadingVersion = ref(false);
const restoringVersion = ref(null);
const versionInputRef = ref(null);
const showPreviewModal = ref(false);
const showCompareModal = ref(false);
const showConflictDialog = ref(false);
const previewLoading = ref(false);
const previewState = ref({ url: '', mimeType: '' });
const pendingVersionFile = ref(null);
const conflictState = ref({
  baseVersion: null,
  currentVersion: null,
  conflictId: null
});

const hasFile = computed(() => Boolean(props.record?.storagePath));
const canEdit = computed(() => {
  if (props.context?.canEditFile === false) return false;
  if (props.context?.canEditFile === true) return true;
  return props.adapter?.canEditDetails?.(props.record) === true;
});

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatUser(user) {
  if (!user || typeof user !== 'object') return '—';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '—';
}

function isPreviewableMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  return mime.startsWith('image/') || mime === 'application/pdf';
}

async function loadVersions() {
  if (!props.record?._id) return;
  versionsLoading.value = true;
  try {
    versions.value = await fetchVersions(props.record._id);
  } catch (error) {
    notifications.error(error?.message || t('documents.versionsLoadFailed'));
    versions.value = [];
  } finally {
    versionsLoading.value = false;
  }
}

async function handlePreview() {
  if (!props.record?._id) return;
  previewLoading.value = true;
  showPreviewModal.value = true;
  previewState.value = { url: '', mimeType: props.record.mimeType || '' };
  try {
    const data = await getPreviewUrl(props.record._id);
    if (isPreviewableMime(data?.mimeType)) {
      previewState.value = { url: data.url, mimeType: data.mimeType || '' };
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

async function handleDownload() {
  if (!props.record?._id) return;
  try {
    const data = await getDownloadUrl(props.record._id);
    if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    notifications.error(error?.message || t('documents.downloadFailed'));
  }
}

function openVersionUpload() {
  versionInputRef.value?.click();
}

async function handleVersionFileSelected(event) {
  const file = event.target?.files?.[0];
  if (!file || !props.record?._id) return;
  pendingVersionFile.value = file;
  uploadingVersion.value = true;
  try {
    const result = await uploadNewVersion(props.record._id, file, {
      baseVersion: props.record.versionNumber || 1
    });
    if (result?.success) {
      notifications.success(t('documents.versionUploadSuccess'));
      pendingVersionFile.value = null;
      props.context?.onFileUpdated?.();
      await loadVersions();
      return;
    }
    if (result?.code === 'VERSION_CONFLICT') {
      conflictState.value = {
        baseVersion: result.baseVersion ?? props.record.versionNumber ?? 1,
        currentVersion: result.currentVersion ?? props.record.versionNumber ?? 1,
        conflictId: result.conflictId || null
      };
      showConflictDialog.value = true;
      return;
    }
    notifications.error(result?.message || t('documents.versionUploadFailed'));
  } catch (error) {
    notifications.error(error?.message || t('documents.versionUploadFailed'));
  } finally {
    uploadingVersion.value = false;
    if (event.target) event.target.value = '';
  }
}

function handleConflictCancel() {
  showConflictDialog.value = false;
  pendingVersionFile.value = null;
  conflictState.value = { baseVersion: null, currentVersion: null, conflictId: null };
}

function handleConflictCompare() {
  showConflictDialog.value = false;
  showCompareModal.value = true;
}

async function handleConflictForceUpload() {
  const file = pendingVersionFile.value;
  if (!file || !props.record?._id) return;
  uploadingVersion.value = true;
  try {
    const result = await uploadNewVersion(props.record._id, file, {
      baseVersion: conflictState.value.baseVersion ?? props.record.versionNumber ?? 1,
      forceUpload: true
    });
    if (result?.success) {
      notifications.success(t('documents.versionUploadSuccess'));
      showConflictDialog.value = false;
      pendingVersionFile.value = null;
      conflictState.value = { baseVersion: null, currentVersion: null, conflictId: null };
      props.context?.onFileUpdated?.();
      await loadVersions();
    } else {
      notifications.error(result?.message || t('documents.versionUploadFailed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.versionUploadFailed'));
  } finally {
    uploadingVersion.value = false;
  }
}

async function handleRestore(versionNumber) {
  if (!props.record?._id) return;
  if (!window.confirm(t('documents.restoreVersionConfirm'))) return;
  restoringVersion.value = versionNumber;
  try {
    const result = await restoreVersion(props.record._id, versionNumber);
    if (result?.success) {
      notifications.success(t('documents.restoreVersionSuccess'));
      props.context?.onFileUpdated?.();
      await loadVersions();
    } else {
      notifications.error(result?.message || t('documents.restoreVersionFailed'));
    }
  } catch (error) {
    notifications.error(error?.message || t('documents.restoreVersionFailed'));
  } finally {
    restoringVersion.value = null;
  }
}

function handleVersionCompared(payload) {
  captureDocumentVersionCompared({
    documentId: props.record?._id,
    leftVersion: payload?.leftVersion,
    rightVersion: payload?.rightVersion,
    checksumMatch: payload?.checksumMatch
  });
}

onMounted(loadVersions);
watch(() => props.record?._id, loadVersions);
watch(() => props.record?.versionNumber, loadVersions);
</script>
