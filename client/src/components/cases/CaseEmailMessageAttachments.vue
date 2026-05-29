<template>
  <div v-if="attachments.length" class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800" @click.stop>
    <button
      type="button"
      class="flex w-full items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
      :aria-expanded="expanded"
      @click.stop="expanded = !expanded"
    >
      <ChevronRightIcon
        class="h-4 w-4 shrink-0 text-gray-400 transition-transform"
        :class="{ 'rotate-90': expanded }"
      />
      {{ t('cases.recordActivityAttachments', { count: attachments.length }) }}
    </button>

    <div v-show="expanded" class="mt-3">
      <div v-if="imageAttachments.length" class="flex flex-wrap gap-2">
        <button
          v-for="att in imageAttachments"
          :key="att.id"
          type="button"
          class="group relative h-28 w-36 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
          :title="att.originalFileName"
          :disabled="loadingKey === getCaseEmailAttachmentKey(att)"
          @click.stop="openInModal(att)"
        >
          <img
            v-if="thumbUrls[att.id]"
            :src="thumbUrls[att.id]"
            :alt="att.originalFileName"
            class="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
          <span
            v-else
            class="flex h-full w-full items-center justify-center text-xs text-gray-400"
          >
            …
          </span>
        </button>
      </div>

      <div v-if="fileAttachments.length" class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="att in fileAttachments"
          :key="att.id"
          type="button"
          class="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
          :disabled="loadingKey === getCaseEmailAttachmentKey(att)"
          @click.stop="openInModal(att)"
        >
          <PaperClipIcon class="h-4 w-4 shrink-0 text-gray-400" />
          <span class="truncate font-medium text-gray-800 dark:text-gray-200">{{ att.originalFileName }}</span>
          <span class="shrink-0 text-gray-500">{{ formatMailroomAttachmentSize(att.sizeBytes) }}</span>
        </button>
      </div>
    </div>

    <CaseEmailAttachmentPreviewModal
      :show="modalOpen"
      :attachment="modalAtt"
      :preview-url="modalPreviewUrl"
      :loading="modalLoading"
      :error="modalError"
      @close="closeModal"
      @download="downloadModalAttachment"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon, PaperClipIcon } from '@heroicons/vue/24/outline';
import CaseEmailAttachmentPreviewModal from '@/components/cases/CaseEmailAttachmentPreviewModal.vue';
import {
  caseEmailAttachmentIsAccessible,
  downloadCaseEmailAttachment,
  fetchCaseEmailAttachmentBlob,
  formatMailroomAttachmentSize,
  getCaseEmailAttachmentKey,
  isMailroomImageMime,
  isMailroomPreviewableMime
} from '@/utils/caseEmailAttachments';

const props = defineProps({
  attachments: { type: Array, default: () => [] },
  defaultExpanded: { type: Boolean, default: true }
});

const { t } = useI18n();
const expanded = ref(props.defaultExpanded);
const thumbUrls = ref({});
const loadingKey = ref('');

const modalOpen = ref(false);
const modalAtt = ref(null);
const modalPreviewUrl = ref('');
const modalLoading = ref(false);
const modalError = ref('');

const accessibleAttachments = computed(() =>
  props.attachments.filter((a) => caseEmailAttachmentIsAccessible(a))
);

const imageAttachments = computed(() =>
  accessibleAttachments.value.filter((a) => isMailroomImageMime(a.mimeType))
);
const fileAttachments = computed(() =>
  accessibleAttachments.value.filter((a) => !isMailroomImageMime(a.mimeType))
);

async function loadThumbnails() {
  const next = { ...thumbUrls.value };
  for (const att of imageAttachments.value) {
    if (next[att.id]) continue;
    try {
      const { blob } = await fetchCaseEmailAttachmentBlob(att, { disposition: 'inline' });
      next[att.id] = URL.createObjectURL(blob);
    } catch {
      /* skip failed thumb */
    }
  }
  thumbUrls.value = next;
}

function revokeThumbs() {
  for (const url of Object.values(thumbUrls.value)) {
    if (url) URL.revokeObjectURL(url);
  }
  thumbUrls.value = {};
}

function revokeModalPreview() {
  if (modalPreviewUrl.value) URL.revokeObjectURL(modalPreviewUrl.value);
  modalPreviewUrl.value = '';
}

function closeModal() {
  modalOpen.value = false;
  modalAtt.value = null;
  modalError.value = '';
  modalLoading.value = false;
  revokeModalPreview();
}

async function openInModal(att) {
  if (!caseEmailAttachmentIsAccessible(att)) return;

  closeModal();
  modalAtt.value = att;
  modalOpen.value = true;
  modalLoading.value = true;
  modalError.value = '';
  loadingKey.value = getCaseEmailAttachmentKey(att);

  try {
    if (isMailroomPreviewableMime(att.mimeType)) {
      const { blob, contentType } = await fetchCaseEmailAttachmentBlob(att, { disposition: 'inline' });
      modalAtt.value = { ...att, mimeType: contentType || att.mimeType };
      modalPreviewUrl.value = URL.createObjectURL(blob);
    }
  } catch {
    modalError.value = t('cases.recordAttachmentPreviewFailed');
  } finally {
    modalLoading.value = false;
    loadingKey.value = '';
  }
}

async function downloadModalAttachment() {
  if (!modalAtt.value) return;
  await download(modalAtt.value);
}

async function download(att) {
  if (!caseEmailAttachmentIsAccessible(att)) return;
  loadingKey.value = getCaseEmailAttachmentKey(att);
  try {
    await downloadCaseEmailAttachment(att, { disposition: 'attachment' });
  } finally {
    loadingKey.value = '';
  }
}

watch(
  () => props.attachments,
  () => {
    closeModal();
    revokeThumbs();
    if (expanded.value) loadThumbnails();
  },
  { immediate: true, deep: true }
);

watch(expanded, (on) => {
  if (on) loadThumbnails();
});

onBeforeUnmount(() => {
  closeModal();
  revokeThumbs();
});
</script>
