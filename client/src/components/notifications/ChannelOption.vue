<template>
  <label
    :class="[
      'flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer transition-colors min-h-[44px]',
      checked && !disabled
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    ]"
  >
    <div class="flex items-center flex-1">
      <HeadlessCheckbox
        :checked="checked"
        :disabled="disabled"
        checkbox-class="w-4 h-4"
        @change="$emit('update', $event.target.checked)"
        :aria-label="t('notifications.channelOptionAria', { channel: channel.label })"
      />
      <div class="ml-3 flex-1">
        <div class="text-sm font-medium text-gray-900 dark:text-white">
          {{ channel.label }}
        </div>
        <div v-if="disabled" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ t('notifications.channelUnavailable') }}
        </div>
      </div>
    </div>
  </label>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
  channel: {
    type: Object,
    required: true
  },
  checked: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

defineEmits(['update']);
</script>

