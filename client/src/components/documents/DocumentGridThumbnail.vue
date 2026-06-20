<template>
  <div
    class="document-grid-thumbnail relative overflow-hidden bg-gray-50 dark:bg-gray-800/60"
    :class="[
      fill ? 'h-full w-full' : 'h-28 rounded-lg border border-gray-100 dark:border-gray-700/60',
      !imageUrl && !hasRichPreview && !fill ? `bg-gradient-to-br ${typeAccentClass}` : '',
      !imageUrl && !hasRichPreview && fill ? `bg-gradient-to-br ${typeAccentClass}` : ''
    ]"
  >
    <div
      v-if="imageLoading"
      class="absolute inset-0 animate-pulse bg-gray-200/70 dark:bg-gray-700/50"
    />
    <img
      v-else-if="imageUrl"
      :src="imageUrl"
      :alt="doc.title || ''"
      class="h-full w-full object-cover"
      loading="lazy"
      @error="imageFailed = true"
    />
    <div
      v-else-if="hasRichPreview"
      class="document-grid-thumbnail__rich pointer-events-none absolute inset-0 overflow-hidden p-3"
      v-html="richPreviewHtml"
    />
    <div
      v-else-if="isPdfFile"
      class="flex h-full flex-col items-center justify-center gap-1 text-red-500"
    >
      <DocumentTextIcon class="h-10 w-10" />
      <span class="text-[10px] font-semibold uppercase tracking-wide">PDF</span>
    </div>
    <div
      v-else
      class="flex h-full flex-col items-center justify-center gap-1.5 px-2"
      :class="isFileDocument(doc) ? 'text-gray-400' : 'text-indigo-500 dark:text-indigo-400'"
    >
      <DocumentTypeIcon :doc="doc" size="lg" />
      <span
        v-if="!isFileDocument(doc)"
        class="max-w-full truncate text-center text-[10px] font-medium uppercase tracking-wide text-indigo-600/80 dark:text-indigo-300/80"
      >
        {{ typeLabel }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { DocumentTextIcon } from '@heroicons/vue/24/outline';
import DocumentTypeIcon from '@/components/documents/DocumentTypeIcon.vue';
import { getRichContentHtml, isFileDocument } from '@/utils/documentRichContent';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';

const props = defineProps({
  doc: { type: Object, required: true },
  getPreviewUrl: { type: Function, required: true },
  formatDocumentType: { type: Function, default: null },
  fill: { type: Boolean, default: false }
});

const { t } = useI18n();

const imageUrl = ref('');
const imageLoading = ref(false);
const imageFailed = ref(false);

const isImageFile = computed(() => {
  const mime = String(props.doc?.mimeType || '').toLowerCase();
  return isFileDocument(props.doc) && mime.startsWith('image/') && !imageFailed.value;
});

const isPdfFile = computed(() => (
  isFileDocument(props.doc)
  && String(props.doc?.mimeType || '').toLowerCase() === 'application/pdf'
));

const richPreviewHtml = computed(() => {
  if (isFileDocument(props.doc)) return '';
  const html = getRichContentHtml(props.doc?.richContent);
  return html ? sanitizeRichDescriptionHtml(html) : '';
});

const hasRichPreview = computed(() => Boolean(richPreviewHtml.value));

const typeLabel = computed(() => {
  if (typeof props.formatDocumentType === 'function') {
    return props.formatDocumentType(props.doc?.documentType);
  }
  return props.doc?.documentType || t('documents.typeRichDocument');
});

const typeAccentClass = computed(() => {
  const type = String(props.doc?.documentType || '');
  const map = {
    meeting_notes: 'from-sky-50 to-sky-100 dark:from-sky-950/40 dark:to-sky-900/30',
    sop: 'from-violet-50 to-violet-100 dark:from-violet-950/40 dark:to-violet-900/30',
    checklist: 'from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/30',
    template: 'from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/30',
    knowledge_article: 'from-indigo-50 to-indigo-100 dark:from-indigo-950/40 dark:to-indigo-900/30',
    playbook: 'from-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/30'
  };
  return map[type] || 'from-indigo-50/80 to-indigo-100/80 dark:from-indigo-950/30 dark:to-indigo-900/20';
});

onMounted(async () => {
  if (!isImageFile.value || !props.doc?._id) return;
  imageLoading.value = true;
  try {
    const data = await props.getPreviewUrl(props.doc._id);
    if (data?.url && String(data?.mimeType || '').startsWith('image/')) {
      imageUrl.value = data.url;
    } else {
      imageFailed.value = true;
    }
  } catch {
    imageFailed.value = true;
  } finally {
    imageLoading.value = false;
  }
});
</script>

<style scoped>
.document-grid-thumbnail__rich {
  font-size: 10px;
  line-height: 1.35;
  color: rgb(55 65 81);
}

.dark .document-grid-thumbnail__rich {
  color: rgb(209 213 219);
}

.document-grid-thumbnail__rich :deep(p),
.document-grid-thumbnail__rich :deep(li),
.document-grid-thumbnail__rich :deep(blockquote) {
  margin: 0 0 0.25rem;
}

.document-grid-thumbnail__rich :deep(h1) {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.document-grid-thumbnail__rich :deep(h2) {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.document-grid-thumbnail__rich :deep(h3) {
  font-size: 11px;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.document-grid-thumbnail__rich :deep(ul),
.document-grid-thumbnail__rich :deep(ol) {
  margin: 0;
  padding-left: 1rem;
}

.document-grid-thumbnail__rich :deep(img) {
  display: none;
}

.document-grid-thumbnail__rich :deep(a) {
  color: inherit;
  text-decoration: none;
  pointer-events: none;
}

.document-grid-thumbnail__rich :deep(pre) {
  margin: 0;
  padding: 0.25rem;
  border-radius: 0.25rem;
  background: rgb(243 244 246);
  font-size: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .document-grid-thumbnail__rich :deep(pre) {
  background: rgb(31 41 55);
}
</style>
