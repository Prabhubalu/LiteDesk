<template>
  <article
    class="document-grid-card group relative flex w-full flex-col overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900 dark:hover:border-indigo-600"
  >
    <div
      class="relative aspect-[4/3] w-full cursor-pointer overflow-hidden bg-gray-50 dark:bg-gray-800/60"
      role="button"
      tabindex="0"
      @click="emit('click', $event)"
      @keydown.enter="emit('click', $event)"
    >
      <DocumentGridThumbnail
        class="absolute inset-0 h-full w-full"
        fill
        :doc="doc"
        :get-preview-url="getPreviewUrl"
        :format-document-type="formatDocumentType"
      />

      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />

      <span
        class="absolute bottom-2 left-2 max-w-[calc(100%-3rem)] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm"
        :class="typeBadgeClass"
      >
        {{ typeLabel }}
      </span>

      <button
        type="button"
        class="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1 text-gray-400 shadow-sm backdrop-blur-sm transition hover:text-amber-500 dark:bg-gray-900/90"
        :class="favorite ? 'text-amber-500' : ''"
        :title="favorite ? t('documents.unfavorite') : t('documents.favorite')"
        @click.stop="emit('toggle-favorite', $event)"
      >
        <StarIconSolid v-if="favorite" class="h-3.5 w-3.5" />
        <StarIcon v-else class="h-3.5 w-3.5" />
      </button>

      <div
        class="absolute inset-0 z-10 flex items-center justify-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <button
          v-if="doc.documentType === 'file'"
          type="button"
          class="rounded-lg bg-white/95 p-2 text-gray-700 shadow-sm transition hover:bg-white hover:text-indigo-600 dark:bg-gray-900/95 dark:text-gray-200 dark:hover:text-indigo-400"
          :title="t('documents.preview')"
          @click.stop="emit('preview')"
        >
          <EyeIcon class="h-4 w-4" />
        </button>
        <button
          v-if="doc.documentType === 'file'"
          type="button"
          class="rounded-lg bg-white/95 p-2 text-gray-700 shadow-sm transition hover:bg-white hover:text-indigo-600 dark:bg-gray-900/95 dark:text-gray-200 dark:hover:text-indigo-400"
          :title="t('documents.download')"
          @click.stop="emit('download')"
        >
          <ArrowDownTrayIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="rounded-lg bg-white/95 p-2 text-gray-700 shadow-sm transition hover:bg-white hover:text-indigo-600 dark:bg-gray-900/95 dark:text-gray-200 dark:hover:text-indigo-400"
          :title="t('common.viewRecord')"
          @click.stop="emit('click', $event)"
        >
          <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div
      class="flex min-h-[5.5rem] cursor-pointer flex-col gap-1.5 p-3"
      role="button"
      tabindex="0"
      @click="emit('click', $event)"
      @keydown.enter="emit('click', $event)"
    >
      <h3 class="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-white">
        {{ doc.title }}
      </h3>
      <p class="truncate text-xs text-gray-500 dark:text-gray-400">
        <FolderIcon class="mr-1 inline h-3.5 w-3.5 -translate-y-px text-gray-400" />
        {{ doc.folderName || t('documents.allDocuments') }}
      </p>
      <div class="mt-auto flex items-center justify-between gap-2 pt-0.5">
        <BadgeCell :value="statusLabel" :variant-map="statusVariantMap" />
        <span class="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{{ updatedLabel }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  FolderIcon,
  StarIcon
} from '@heroicons/vue/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DocumentGridThumbnail from '@/components/documents/DocumentGridThumbnail.vue';

const props = defineProps({
  doc: { type: Object, required: true },
  favorite: { type: Boolean, default: false },
  getPreviewUrl: { type: Function, required: true },
  formatDocumentType: { type: Function, required: true },
  formatStatus: { type: Function, required: true },
  statusVariantMap: { type: Object, required: true },
  getFileTypeTone: { type: Function, required: true }
});

const emit = defineEmits(['click', 'toggle-favorite', 'preview', 'download']);

const { t } = useI18n();

const typeLabel = computed(() => (
  props.doc?.fileType || props.formatDocumentType(props.doc?.documentType)
));

const typeBadgeClass = computed(() => {
  const tone = props.getFileTypeTone(props.doc?.fileType);
  if (tone) return `${tone} bg-white/90 dark:bg-gray-900/90`;
  return 'bg-white/90 text-gray-700 dark:bg-gray-900/90 dark:text-gray-200';
});

const statusLabel = computed(() => props.formatStatus(props.doc?.status));

const updatedLabel = computed(() => {
  const value = props.doc?.updatedAt;
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
});
</script>
