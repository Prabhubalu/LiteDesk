<template>
  <section class="space-y-0">
    <div v-if="!hideHeader || canEdit" class="mb-3 flex items-center justify-between gap-2">
      <h3 v-if="!hideHeader" class="text-base font-semibold text-gray-900 dark:text-white">
        {{ title }}
      </h3>
      <span
        v-if="statusLabel"
        class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div v-if="isEditing && canEdit" class="document-rich-content-editor">
      <DocumentEditor
        ref="editorRef"
        v-model="editingValue"
        auto-focus
        :placeholder="t('documents.editorPlaceholder')"
        @blur="handleBlurSave"
        @cancel="cancelEdit"
        @image-uploaded="onImageUploaded"
      />
    </div>

    <div
      v-else
      :class="[
        'rounded-lg border border-gray-200/70 dark:border-gray-700/70 bg-white dark:bg-transparent overflow-hidden outline-1 -outline-offset-1 outline-gray-200/40 dark:outline-white/10',
        canEdit ? 'cursor-text' : '',
        !hasContent && canEdit ? 'transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40' : ''
      ]"
      @click="startEdit"
    >
      <div
        v-if="hasContent"
        class="min-h-[320px] px-6 py-4 text-md text-gray-900 dark:text-white leading-[1.75] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-6 [&_ol]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_a]:text-indigo-600 [&_a]:underline dark:[&_a]:text-indigo-400 [&_img]:max-w-full [&_img]:rounded-md"
        v-html="sanitizedContent"
      />
      <p v-else class="min-h-[320px] px-6 py-4 text-sm text-gray-500 dark:text-gray-400 italic m-0">
        {{ canEdit ? t('documents.editorEmptyHint') : t('records.descriptionEmptyReadonly') }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';
import { getRichContentHtml } from '@/utils/documentRichContent';
import {
  deleteOrphanSessionUploads,
  deleteRemovedInlineUploads
} from '@/utils/inlineUploadStorage';
import DocumentEditor from '@/components/documents/DocumentEditor.vue';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();

const title = computed(() => props.adapter?.getRichContentTitle?.(props.record, props.context) || t('documents.editorSectionTitle'));
const contentHtml = computed(() => props.adapter?.getRichContent?.(props.record, props.context) || '');
const sanitizedContent = computed(() => sanitizeRichDescriptionHtml(contentHtml.value || ''));
const hasContent = computed(() => Boolean(String(contentHtml.value || '').trim()));
const canEdit = computed(() => props.adapter?.canEditRichContent?.(props.record, props.context) === true);
const hideHeader = computed(() => props.context?.hideHeader === true);
const statusLabel = computed(() => {
  const status = String(props.record?.status || '').toLowerCase();
  if (status === 'draft') return t('documents.statusDraft');
  if (status === 'published') return t('documents.statusPublished');
  return '';
});

const isEditing = ref(false);
const editingValue = ref('');
const editorRef = ref(null);
const editBaselineHtml = ref('');
const sessionUploadedUrls = ref([]);

watch(contentHtml, (value) => {
  if (!isEditing.value) {
    editingValue.value = String(value || '');
  }
}, { immediate: true });

function startEdit() {
  if (!canEdit.value) return;
  editBaselineHtml.value = String(contentHtml.value || '');
  sessionUploadedUrls.value = [];
  isEditing.value = true;
  editingValue.value = String(contentHtml.value || '');
}

function onImageUploaded(url) {
  const next = String(url || '').trim();
  if (next) sessionUploadedUrls.value.push(next);
}

async function cancelEdit() {
  const savedHtml = String(contentHtml.value || '');
  await deleteOrphanSessionUploads(sessionUploadedUrls.value, savedHtml);
  editingValue.value = savedHtml;
  sessionUploadedUrls.value = [];
  isEditing.value = false;
}

async function flushPendingSave() {
  if (!isEditing.value) return;
  await handleBlurSave();
}

onMounted(() => {
  props.context?.registerRichContentFlush?.(flushPendingSave);
});

onBeforeUnmount(() => {
  props.context?.registerRichContentFlush?.(null);
});

async function handleBlurSave() {
  if (!isEditing.value) return;
  const nextValue = String(editingValue.value || '').trim();
  const savedValue = String(contentHtml.value || '').trim();
  if (nextValue !== savedValue) {
    await props.adapter?.saveRichContent?.(nextValue, props.record, props.context);
  }
  await deleteRemovedInlineUploads(editBaselineHtml.value, nextValue);
  await deleteOrphanSessionUploads(sessionUploadedUrls.value, nextValue);
  sessionUploadedUrls.value = [];
  isEditing.value = false;
}
</script>

<style scoped>
.document-rich-content-editor :deep(.tiptap) {
  min-height: 320px;
}
</style>
