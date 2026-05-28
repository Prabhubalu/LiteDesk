<template>
  <div v-if="attachments.length" class="mt-2 space-y-2">
    <div class="flex flex-wrap gap-2">
      <div
        v-for="att in attachments"
        :key="att.id"
        class="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800/80"
      >
        <PaperClipIcon class="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span class="truncate font-medium text-gray-800 dark:text-gray-200" :title="att.originalFileName">
          {{ att.originalFileName }}
        </span>
        <span class="shrink-0 text-gray-500 dark:text-gray-400">{{ formatMailroomAttachmentSize(att.sizeBytes) }}</span>
        <button
          v-if="canPreview(att)"
          type="button"
          class="shrink-0 font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          :disabled="loadingId === att.id"
          @click="openPreview(att)"
        >
          {{ t('cases.recordAttachmentPreview') }}
        </button>
        <button
          type="button"
          class="shrink-0 font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          :disabled="loadingId === att.id"
          @click="download(att)"
        >
          {{ t('cases.recordAttachmentDownload') }}
        </button>
      </div>
    </div>

    <div
      v-if="previewUrl && previewAtt"
      class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
        <span class="truncate text-xs font-medium text-gray-700 dark:text-gray-300">{{ previewAtt.originalFileName }}</span>
        <button
          type="button"
          class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          @click="closePreview"
        >
          {{ t('actions.close') }}
        </button>
      </div>
      <div class="max-h-80 overflow-auto p-2">
        <img
          v-if="isMailroomImageMime(previewAtt.mimeType)"
          :src="previewUrl"
          :alt="previewAtt.originalFileName"
          class="mx-auto max-h-72 object-contain"
        />
        <iframe
          v-else-if="previewAtt.mimeType === 'application/pdf'"
          :src="previewUrl"
          class="h-72 w-full rounded border-0"
          :title="previewAtt.originalFileName"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { PaperClipIcon } from '@heroicons/vue/24/outline';
import {
  downloadMailroomAttachment,
  fetchMailroomAttachmentBlob,
  formatMailroomAttachmentSize,
  isMailroomImageMime,
  isMailroomPreviewableMime
} from '@/utils/mailroomAttachments';

const props = defineProps({
  attachments: { type: Array, default: () => [] }
});

const { t } = useI18n();
const loadingId = ref('');
const previewUrl = ref('');
const previewAtt = ref(null);

function canPreview(att) {
  return isMailroomPreviewableMime(att?.mimeType);
}

async function openPreview(att) {
  if (!att?.id) return;
  closePreview();
  loadingId.value = att.id;
  try {
    const { blob } = await fetchMailroomAttachmentBlob(att.id, { disposition: 'inline' });
    previewUrl.value = URL.createObjectURL(blob);
    previewAtt.value = att;
  } catch {
    previewAtt.value = null;
  } finally {
    loadingId.value = '';
  }
}

async function download(att) {
  loadingId.value = att.id;
  try {
    await downloadMailroomAttachment(att, { disposition: 'attachment' });
  } finally {
    loadingId.value = '';
  }
}

function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  previewAtt.value = null;
}

watch(
  () => props.attachments,
  () => closePreview()
);

onBeforeUnmount(() => {
  closePreview();
});
</script>
