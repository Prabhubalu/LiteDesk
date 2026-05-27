<template>
  <div class="flex h-full flex-col">
    <div class="record-context-panel__header flex shrink-0 flex-col gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('cases.recordSideEmail') }}</h2>
      <button
        type="button"
        class="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        @click="$emit('compose-email')"
      >
        {{ t('cases.recordSideComposeEmail') }}
      </button>
    </div>
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <span class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
    <ul v-else-if="threads.length" class="flex-1 divide-y divide-gray-200 overflow-y-auto dark:divide-gray-700">
      <li v-for="thread in threads" :key="thread.threadId">
        <button
          type="button"
          class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/80"
          @click="$emit('open-thread', thread)"
        >
          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
            {{ thread.subject || t('cases.recordSideNoSubject') }}
          </p>
          <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {{ thread.participantDisplay || thread.preview || '' }}
          </p>
        </button>
      </li>
    </ul>
    <p v-else class="flex-1 p-4 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('cases.recordSideNoEmails') }}
    </p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  threads: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
});

defineEmits(['compose-email', 'open-thread']);

const { t } = useI18n();
</script>
