<template>
  <div class="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 px-6 py-12 text-center">
    <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/40">
      <ChartBarIcon class="h-7 w-7 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
    </div>
    <h3 class="mt-4 text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
    <p class="mt-2 max-w-md mx-auto text-sm text-gray-600 dark:text-gray-400">{{ description }}</p>
    <button
      v-if="actionLabel"
      type="button"
      class="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      @click="$emit('action')"
    >
      <PlusIcon class="h-4 w-4" aria-hidden="true" />
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ChartBarIcon, PlusIcon } from '@heroicons/vue/24/outline';

defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  actionLabel: { type: String, default: '' },
});

defineEmits(['action']);
</script>
