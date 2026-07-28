<template>
  <section v-if="hasDescription || canEdit" class="space-y-0">
    <div v-if="!hideHeader || canEdit" class="flex items-center justify-between gap-2">
      <h3 v-if="!hideHeader" class="text-base font-semibold text-gray-900 dark:text-white">
        {{ title }}
      </h3>
    </div>

    <div v-if="isEditing && canEdit" class="space-y-0">
      <TaskDescriptionEditor
        ref="descriptionEditorRef"
        v-model="editingValue"
        auto-focus
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
        !hasDescription && canEdit ? 'transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40' : ''
      ]"
      @click="onDescriptionAreaClick"
    >
      <div
        v-if="description"
        class="min-h-[120px] px-6 py-4 text-md text-gray-900 dark:text-white leading-[1.75] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-[1.75] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-4 [&_h3]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-6 [&_ol]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal [&_a]:text-indigo-600 [&_a]:underline dark:[&_a]:text-indigo-400 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2 [&_img]:block [&_img]:cursor-zoom-in"
        v-html="sanitizedDescription"
      ></div>
      <p v-else class="px-6 py-2 text-sm text-gray-500 dark:text-gray-400 italic m-0">
        {{ canEdit ? t('records.descriptionAdd') : t('records.descriptionEmptyReadonly') }}
      </p>
    </div>

    <RichDescriptionImageLightbox
      :open="showImagePreview"
      :src="previewImageSrc"
      @close="closeImagePreview"
    />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';
import {
  deleteOrphanSessionUploads,
  deleteRemovedInlineUploads
} from '@/utils/inlineUploadStorage';
import { useRichDescriptionImagePreview } from '@/composables/useRichDescriptionImagePreview';
import RichDescriptionImageLightbox from '@/components/common/RichDescriptionImageLightbox.vue';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: {
    type: Object,
    default: () => ({ module: '' })
  }
});

const { t } = useI18n();
const {
  showImagePreview,
  previewImageSrc,
  closeImagePreview,
  handleRichHtmlClick
} = useRichDescriptionImagePreview();

const title = computed(() => props.adapter?.getDescriptionTitle?.(props.record, props.context) || t('records.descriptionTitle'));
const description = computed(() => props.adapter?.getDescription?.(props.record, props.context) || '');
const sanitizedDescription = computed(() => sanitizeRichDescriptionHtml(description.value || ''));
const hasDescription = computed(() => Boolean(String(description.value || '').trim()));
const canEdit = computed(() => props.adapter?.canEditDescription?.(props.record, props.context) === true);
const hideHeader = computed(() => props.context?.hideHeader === true);

const isEditing = ref(false);
const editingValue = ref('');
const descriptionEditorRef = ref(null);
const editBaselineHtml = ref('');
const sessionUploadedUrls = ref([]);

watch(description, (value) => {
  if (!isEditing.value) {
    editingValue.value = String(value || '');
  }
}, { immediate: true });

const startEdit = () => {
  if (!canEdit.value) return;
  editBaselineHtml.value = String(description.value || '');
  sessionUploadedUrls.value = [];
  isEditing.value = true;
  editingValue.value = String(description.value || '');
};

const onDescriptionAreaClick = (event) => {
  handleRichHtmlClick(event, { onNonImage: startEdit });
};

const onImageUploaded = (url) => {
  const next = String(url || '').trim();
  if (next) sessionUploadedUrls.value.push(next);
};

const cancelEdit = async () => {
  const savedHtml = String(description.value || '');
  await deleteOrphanSessionUploads(sessionUploadedUrls.value, savedHtml);
  editingValue.value = savedHtml;
  sessionUploadedUrls.value = [];
  isEditing.value = false;
};

const handleBlurSave = async () => {
  if (!isEditing.value) return;
  const nextValue = String(editingValue.value || '');
  const savedValue = String(description.value || '');
  if (nextValue !== savedValue) {
    await props.adapter?.saveDescription?.(nextValue, props.record, props.context);
  }
  await deleteRemovedInlineUploads(editBaselineHtml.value, nextValue);
  await deleteOrphanSessionUploads(sessionUploadedUrls.value, nextValue);
  sessionUploadedUrls.value = [];
  isEditing.value = false;
};

</script>
