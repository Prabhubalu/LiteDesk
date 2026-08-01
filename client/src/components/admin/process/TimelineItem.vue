<template>
  <div class="flex items-start gap-4">
    <!-- Icon -->
    <div
      :class="[
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        status === 'completed'
          ? 'bg-green-100 dark:bg-green-900/30'
          : status === 'failed'
          ? 'bg-red-100 dark:bg-red-900/30'
          : status === 'skipped'
          ? 'bg-gray-100 dark:bg-gray-700'
          : 'bg-yellow-100 dark:bg-yellow-900/30'
      ]"
    >
      <svg
        v-if="type === 'start'"
        class="w-5 h-5 text-green-600 dark:text-green-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <svg
        v-else-if="type === 'condition'"
        class="w-5 h-5"
        :class="status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <svg
        v-else-if="type === 'behavior'"
        class="w-5 h-5"
        :class="status === 'completed' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <svg
        v-else-if="type === 'action'"
        class="w-5 h-5"
        :class="status === 'completed' ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <svg
        v-else-if="type === 'success'"
        class="w-5 h-5 text-green-600 dark:text-green-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <svg
        v-else-if="type === 'error'"
        class="w-5 h-5 text-red-600 dark:text-red-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ title }}
        </h4>
        <span
          v-if="timestamp"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ formatTime(timestamp) }}
        </span>
      </div>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { formatTime as formatLocaleTime } from '@/utils/localeFormat';
const props = defineProps({
  type: {
    type: String,
    required: true,
    validator: (value) => ['start', 'condition', 'behavior', 'action', 'success', 'error'].includes(value)
  },
  status: {
    type: String,
    default: 'pending',
    validator: (value) => ['pending', 'completed', 'failed', 'skipped'].includes(value)
  },
  title: {
    type: String,
    required: true
  },
  timestamp: {
    type: String,
    default: null
  }
});

const { t } = useI18n();

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return formatLocaleTime(date, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
</script>
