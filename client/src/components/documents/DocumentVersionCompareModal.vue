<template>
  <Dialog :open="isOpen" class="relative z-50" @close="handleClose">
    <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('documents.versionCompareTitle') }}
          </DialogTitle>
          <button type="button" class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" @click="handleClose">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4 overflow-y-auto px-5 py-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('documents.versionCompareLeft') }}
              </label>
              <select
                v-model="leftVersionNumber"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option v-for="version in versions" :key="`left-${version.versionNumber}`" :value="String(version.versionNumber)">
                  {{ t('documents.versionLabel', { version: version.versionNumber }) }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('documents.versionCompareRight') }}
              </label>
              <select
                v-model="rightVersionNumber"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option v-for="version in versions" :key="`right-${version.versionNumber}`" :value="String(version.versionNumber)">
                  {{ t('documents.versionLabel', { version: version.versionNumber }) }}
                </option>
              </select>
            </div>
          </div>

          <div v-if="leftVersion && rightVersion" class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.versionCompareField') }}</th>
                  <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ leftLabel }}</th>
                  <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ rightLabel }}</th>
                  <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('documents.versionCompareResult') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                <tr v-for="row in comparisonRows" :key="row.key">
                  <td class="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">{{ row.label }}</td>
                  <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ row.left }}</td>
                  <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ row.right }}</td>
                  <td class="px-4 py-2.5">
                    <span
                      class="rounded px-2 py-0.5 text-xs font-medium"
                      :class="row.same
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'"
                    >
                      {{ row.same ? t('documents.versionCompareSame') : t('documents.versionCompareDifferent') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="checksumMatch" class="text-sm text-gray-600 dark:text-gray-300">
            {{ t('documents.versionCompareChecksumMatch') }}
          </p>
          <p v-else-if="leftVersion && rightVersion" class="text-sm text-gray-600 dark:text-gray-300">
            {{ t('documents.versionCompareChecksumDifferent') }}
          </p>
        </div>

        <div class="flex justify-end border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="handleClose"
          >
            {{ t('actions.close') }}
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  versions: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'compared']);

const { t } = useI18n();

const leftVersionNumber = ref('');
const rightVersionNumber = ref('');

const sortedVersions = computed(() =>
  [...(props.versions || [])].sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))
);

const leftVersion = computed(() =>
  sortedVersions.value.find((row) => String(row.versionNumber) === String(leftVersionNumber.value)) || null
);

const rightVersion = computed(() =>
  sortedVersions.value.find((row) => String(row.versionNumber) === String(rightVersionNumber.value)) || null
);

const leftLabel = computed(() => (
  leftVersion.value
    ? t('documents.versionLabel', { version: leftVersion.value.versionNumber })
    : '—'
));

const rightLabel = computed(() => (
  rightVersion.value
    ? t('documents.versionLabel', { version: rightVersion.value.versionNumber })
    : '—'
));

function formatUser(user) {
  if (!user || typeof user !== 'object') return '—';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '—';
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '—';
  return formatUserDateTime(value);
}

function compareValue(left, right) {
  const leftValue = left == null || left === '' ? '—' : String(left);
  const rightValue = right == null || right === '' ? '—' : String(right);
  return {
    left: leftValue,
    right: rightValue,
    same: leftValue === rightValue
  };
}

const comparisonRows = computed(() => {
  if (!leftVersion.value || !rightVersion.value) return [];
  const left = leftVersion.value;
  const right = rightVersion.value;

  const rows = [
    { key: 'fileType', label: t('documents.columnType'), ...compareValue(left.fileType, right.fileType) },
    { key: 'mimeType', label: t('documents.versionCompareMimeType'), ...compareValue(left.mimeType, right.mimeType) },
    { key: 'fileSizeBytes', label: t('documents.versionCompareSize'), left: formatFileSize(left.fileSizeBytes), right: formatFileSize(right.fileSizeBytes), same: Number(left.fileSizeBytes || 0) === Number(right.fileSizeBytes || 0) },
    { key: 'checksum', label: t('documents.versionCompareChecksum'), ...compareValue(left.checksum, right.checksum) },
    { key: 'changeSummary', label: t('documents.versionChangeSummary'), ...compareValue(left.changeSummary, right.changeSummary) },
    { key: 'createdBy', label: t('documents.versionUploadedBy'), left: formatUser(left.createdBy), right: formatUser(right.createdBy), same: String(left.createdBy?._id || left.createdBy || '') === String(right.createdBy?._id || right.createdBy || '') },
    { key: 'createdAt', label: t('documents.versionUploadedAt'), left: formatDate(left.createdAt), right: formatDate(right.createdAt), same: String(left.createdAt || '') === String(right.createdAt || '') }
  ];
  return rows;
});

const checksumMatch = computed(() => {
  if (!leftVersion.value || !rightVersion.value) return false;
  const left = String(leftVersion.value.checksum || '');
  const right = String(rightVersion.value.checksum || '');
  return Boolean(left) && left === right;
});

watch(() => props.isOpen, (open) => {
  if (!open || sortedVersions.value.length < 2) return;
  leftVersionNumber.value = String(sortedVersions.value[1]?.versionNumber || sortedVersions.value[0]?.versionNumber || '');
  rightVersionNumber.value = String(sortedVersions.value[0]?.versionNumber || '');
});

watch([leftVersionNumber, rightVersionNumber], () => {
  if (!props.isOpen || !leftVersion.value || !rightVersion.value) return;
  emit('compared', {
    leftVersion: leftVersion.value.versionNumber,
    rightVersion: rightVersion.value.versionNumber,
    checksumMatch: checksumMatch.value
  });
});

function handleClose() {
  emit('close');
}
</script>
