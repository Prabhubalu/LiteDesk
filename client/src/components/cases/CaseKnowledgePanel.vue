<template>
  <div class="flex h-full flex-col">
    <div class="record-context-panel__header flex shrink-0 items-center border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('cases.recordRailKnowledge') }}</h2>
    </div>
    <div class="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <BookOpenIcon class="h-12 w-12 text-gray-300 dark:text-gray-600" />
      <p class="mt-4 text-sm font-medium text-gray-900 dark:text-white">{{ t('cases.recordKnowledgeTitle') }}</p>
      <p class="mt-2 max-w-xs text-xs text-gray-500 dark:text-gray-400">{{ t('cases.recordKnowledgeSoon') }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { BookOpenIcon } from '@heroicons/vue/24/outline';

const { t } = useI18n();
</script>
