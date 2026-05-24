<template>
  <div>
    <dt class="text-sm text-gray-500 dark:text-gray-400">{{ label }}</dt>
    <dd class="mt-2 text-sm text-gray-900 dark:text-white">
      <slot>
        <span v-if="value !== null && value !== undefined && value !== ''">{{ value }}</span>
        <span v-else class="text-gray-400 dark:text-gray-500">—</span>
      </slot>
    </dd>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
defineProps({
  label: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    default: null
  }
});
</script>

