<template>
  <div class="content-version-history-page flex-1 min-h-0 mt-4 flex flex-col gap-6">
    <h2 v-if="pageTitle" class="text-2xl font-bold text-gray-900 dark:text-white flex-shrink-0">{{ pageTitle }}</h2>
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[1fr] gap-6 min-h-0 flex-1">
      <div class="flex flex-col min-h-0 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden h-full">
        <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div
            v-if="selectedHasContent"
            class="text-md text-gray-900 dark:text-white px-6 py-4 leading-[1.75] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-[1.75] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-4 [&_h3]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-6 [&_ol]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:my-2 [&_blockquote]:text-gray-500 dark:[&_blockquote]:border-gray-600 dark:[&_blockquote]:text-gray-400 [&_a]:text-indigo-600 [&_a]:underline dark:[&_a]:text-indigo-400 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2 [&_img]:block [&_pre]:rounded-lg [&_pre]:bg-gray-100 [&_pre]:p-3 dark:[&_pre]:bg-gray-800"
            v-html="selectedContent"
          />
          <p v-else class="px-6 py-4 text-sm text-gray-400 dark:text-gray-500 italic m-0">
            {{ t('records.genericNoDescInVersion') }}
          </p>
        </div>
      </div>
      <div class="flex flex-col min-h-0 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden h-full">
        <h3 class="font-semibold text-gray-900 dark:text-white px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          {{ t('records.genericVersionHistory') }}
        </h3>
        <div v-if="loading" class="flex items-center justify-center py-8 flex-1 min-h-0 overflow-hidden">
          <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
        <div v-else class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-0">
          <label
            v-for="(ver, idx) in versions"
            :key="ver.isCurrent ? 'current' : `version-${idx}-${ver.createdAt}`"
            :class="[
              'flex items-start gap-3 py-3 px-3 rounded-lg cursor-pointer transition-colors',
              selectedIndex === idx
                ? 'bg-indigo-50 dark:bg-indigo-900/30'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
            ]"
          >
            <input
              :checked="selectedIndex === idx"
              type="radio"
              :name="radioName"
              :value="idx"
              class="mt-1 h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
              @change="$emit('update:selectedIndex', idx)"
            />
            <div class="min-w-0 flex-1">
              <span class="text-sm text-gray-900 dark:text-white block">
                {{ formatContentVersionDate(ver.createdAt) }}
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                <span v-if="ver.isCurrent" class="font-medium text-gray-600 dark:text-gray-300">{{ t('records.genericCurrentVersion') }}</span>
                <template v-else>
                  <Avatar
                    v-if="ver.createdBy"
                    :record="{ name: ver.createdBy }"
                    size="sm"
                    class="shrink-0"
                  />
                  {{ ver.createdBy || t('records.genericSomeone') }}
                </template>
              </span>
            </div>
          </label>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          {{ t('records.genericVersionRetention') }}
        </p>
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            :disabled="selectedIndex === 0 || restoreLoading"
            class="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none"
            @click="$emit('restore')"
          >
            <span v-if="restoreLoading">{{ t('records.genericRestoring') }}</span>
            <span v-else>{{ t('records.genericRestoreVersion') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';
import {
  formatContentVersionDate,
  getSelectedVersionContent
} from '@/utils/contentVersionHistory';

const props = defineProps({
  pageTitle: { type: String, default: '' },
  versions: { type: Array, default: () => [] },
  selectedIndex: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  restoreLoading: { type: Boolean, default: false },
  radioName: { type: String, default: 'content-version' }
});

defineEmits(['update:selectedIndex', 'restore']);

const { t } = useI18n();

const selectedContent = computed(() => getSelectedVersionContent(props.versions, props.selectedIndex));

const selectedHasContent = computed(() => {
  const selected = props.versions[props.selectedIndex];
  return Boolean(selected && String(selected.content || '').trim());
});
</script>
