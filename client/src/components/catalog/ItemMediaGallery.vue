<template>
  <section
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
  >
    <div class="flex items-center justify-between gap-3" :class="isEmpty ? '' : 'mb-4'">
      <div class="min-w-0">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogMediaTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ isEmpty ? t('platform.catalogMediaEmpty') : t('platform.catalogMediaDesc') }}
        </p>
      </div>
      <label
        v-if="canEdit && !isEmpty"
        class="inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer transition-colors"
      >
        <input type="file" class="hidden" accept="image/*,application/pdf" @change="onFileSelected" :disabled="uploading">
        <span>{{ uploading ? t('common.formUploading') : t('platform.catalogMediaUpload') }}</span>
      </label>
    </div>

    <label
      v-if="canEdit && isEmpty"
      class="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 px-4 py-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20 transition-colors"
    >
      <input type="file" class="hidden" accept="image/*,application/pdf" @change="onFileSelected" :disabled="uploading">
      <span class="text-sm font-medium text-indigo-700 dark:text-indigo-300">
        {{ uploading ? t('common.formUploading') : t('platform.catalogMediaUploadCta') }}
      </span>
      <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('platform.catalogMediaUploadHint') }}</span>
    </label>

    <div v-if="!isEmpty" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      <div
        v-for="entry in sortedMedia"
        :key="entry._id"
        class="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40"
      >
        <div class="aspect-square flex items-center justify-center">
          <img
            v-if="entry.kind === 'image'"
            :src="entry.url"
            :alt="entry.altText || ''"
            class="w-full h-full object-cover"
          >
          <div v-else class="p-4 text-center text-xs text-gray-600 dark:text-gray-300">
            <span class="font-medium block truncate">{{ entry.fileName || t('platform.catalogMediaDocument') }}</span>
          </div>
        </div>

        <div class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-between gap-2">
          <button
            v-if="canEdit && !entry.isPrimary"
            type="button"
            class="text-xs text-white hover:underline"
            @click="emit('set-primary', entry._id)"
          >
            {{ t('platform.catalogMediaSetPrimary') }}
          </button>
          <span v-else class="text-xs text-transparent select-none" aria-hidden="true">·</span>
          <button
            v-if="canEdit"
            type="button"
            class="text-xs text-red-300 hover:underline ml-auto"
            @click="confirmDelete(entry._id)"
          >
            {{ t('actions.remove') }}
          </button>
        </div>

        <span
          v-if="entry.isPrimary"
          class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600 text-white"
        >
          {{ t('platform.catalogMediaPrimary') }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { confirmAction } from '@/composables/useConfirmAction';
const props = defineProps({
  media: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  uploading: { type: Boolean, default: false }
});

const emit = defineEmits(['upload', 'set-primary', 'delete']);

async function confirmDelete(mediaId) {
  if (!props.canEdit) return;
  if (await confirmAction(t('platform.catalogConfirmDeleteMedia'))) {
    emit('delete', mediaId);
  }
}

const { t } = useI18n();

const sortedMedia = computed(() =>
  [...props.media].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
);

const isEmpty = computed(() => sortedMedia.value.length === 0);

const onFileSelected = (event) => {
  const file = event.target?.files?.[0];
  if (file) emit('upload', file);
  if (event.target) event.target.value = '';
};
</script>
