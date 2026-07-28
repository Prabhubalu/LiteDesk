<template>
  <div class="document-editor-page flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex flex-shrink-0 flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ formatDocumentType(record?.documentType) }}
        </p>
        <h2 class="mt-1 truncate text-2xl font-bold text-gray-900 dark:text-white">
          {{ record?.title || t('documents.pageTitle') }}
        </h2>
        <p v-if="record?.documentNumber" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ record.documentNumber }}
        </p>
      </div>
        <div class="flex items-center gap-2">
        <RecordPresenceAvatars
          v-if="presenceSessions.length"
          :sessions="presenceSessions"
        />
        <span
          v-if="statusLabel"
          class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
        >
          {{ statusLabel }}
        </span>
        <button
          v-if="canPublish"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          @click="$emit('publish')"
        >
          {{ t('documents.publish') }}
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <DocumentEditor
        v-if="canEdit"
        v-model="editingValue"
        full-page
        auto-focus
        :placeholder="t('documents.editorPlaceholder')"
        @blur="handleBlurSave"
        @image-uploaded="onImageUploaded"
        @inline-comment-request="handleInlineCommentRequest"
      />
      <div
        v-else
        class="min-h-[calc(100vh-14rem)] overflow-y-auto px-8 py-6 text-md text-gray-900 dark:text-white leading-[1.75] [&_p]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_pre]:rounded-lg [&_pre]:bg-gray-100 [&_pre]:p-3 dark:[&_pre]:bg-gray-800 [&_img]:max-w-full [&_img]:rounded-md [&_img]:cursor-zoom-in"
        v-html="sanitizedContent"
        @click="handleRichHtmlClick"
      />
    </div>

    <p v-if="saving" class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
      {{ t('documents.editorSaving') }}
    </p>

    <RichDescriptionImageLightbox
      :open="showImagePreview"
      :src="previewImageSrc"
      @close="closeImagePreview"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import DocumentEditor from '@/components/documents/DocumentEditor.vue';
import RecordPresenceAvatars from '@/components/record-page/RecordPresenceAvatars.vue';
import RichDescriptionImageLightbox from '@/components/common/RichDescriptionImageLightbox.vue';
import { useRichDescriptionImagePreview } from '@/composables/useRichDescriptionImagePreview';
import { getRichContentHtml, toRichContentPayload } from '@/utils/documentRichContent';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';
import {
  deleteOrphanSessionUploads,
  deleteRemovedInlineUploads
} from '@/utils/inlineUploadStorage';
import { useDocuments } from '@/composables/useDocuments';

const props = defineProps({
  record: { type: Object, default: null },
  canEdit: { type: Boolean, default: false },
  canPublish: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  typeLabelMap: { type: Object, default: () => ({}) },
  presenceSessions: { type: Array, default: () => [] },
  onSave: { type: Function, default: null }
});

const emit = defineEmits(['save', 'publish', 'inline-comment-request', 'draft-saved']);

const { t } = useI18n();
const { saveDocumentEditDraft, deleteDocumentEditDraft } = useDocuments();
const {
  showImagePreview,
  previewImageSrc,
  closeImagePreview,
  handleRichHtmlClick
} = useRichDescriptionImagePreview();

const editingValue = ref('');
const editBaselineHtml = ref('');
const sessionUploadedUrls = ref([]);
let draftSaveTimer = null;

const contentHtml = computed(() => getRichContentHtml(props.record?.richContent));
const sanitizedContent = computed(() => sanitizeRichDescriptionHtml(contentHtml.value || ''));

const statusLabel = computed(() => {
  const status = String(props.record?.status || '').toLowerCase();
  if (status === 'draft') return t('documents.statusDraft');
  if (status === 'published') return t('documents.statusPublished');
  return '';
});

watch(contentHtml, (value) => {
  editingValue.value = String(value || '');
}, { immediate: true });

watch(editingValue, () => {
  scheduleDraftSave();
});

function handleInlineCommentRequest(anchor) {
  emit('inline-comment-request', anchor);
}

async function persistDraft() {
  if (!props.canEdit || !props.record?._id) return;
  const html = String(editingValue.value || '');
  if (!html.trim()) return;
  try {
    const response = await saveDocumentEditDraft(props.record._id, {
      richContent: toRichContentPayload(html),
      baseVersionNumber: props.record?.versionNumber || 1
    });
    if (response?.success) {
      emit('draft-saved', response.data?.lastSavedAt || new Date().toISOString());
    }
  } catch {
    /* non-blocking */
  }
}

function scheduleDraftSave() {
  if (draftSaveTimer) window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => {
    void persistDraft();
  }, 4000);
}

function formatDocumentType(type) {
  const key = props.typeLabelMap?.[type];
  return key ? t(key) : type || t('documents.typeRichDocument');
}

function onImageUploaded(url) {
  const next = String(url || '').trim();
  if (next) sessionUploadedUrls.value.push(next);
}

async function persistContentSave(nextValue) {
  if (typeof props.onSave === 'function') {
    await props.onSave(nextValue);
    return;
  }
  emit('save', nextValue);
}

async function handleBlurSave() {
  const nextValue = String(editingValue.value || '');
  const savedValue = String(contentHtml.value || '');
  if (nextValue === savedValue) return;
  editBaselineHtml.value = savedValue;
  await persistContentSave(nextValue);
  await deleteRemovedInlineUploads(editBaselineHtml.value, nextValue);
  await deleteOrphanSessionUploads(sessionUploadedUrls.value, nextValue);
  sessionUploadedUrls.value = [];
  editBaselineHtml.value = nextValue;
  if (props.record?._id) {
    await deleteDocumentEditDraft(props.record._id);
  }
}

async function flushPendingSave() {
  await handleBlurSave();
}

defineExpose({ flushPendingSave });

onBeforeUnmount(() => {
  if (draftSaveTimer) window.clearTimeout(draftSaveTimer);
  void flushPendingSave();
});
</script>
