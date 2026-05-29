<template>
  <span
    class="inline-flex items-center shrink-0"
    :class="sizeClass"
    :title="title"
    :aria-label="title"
  >
    <CheckIcon
      class="shrink-0"
      :class="[iconSizeClass, checkColorClass]"
      aria-hidden="true"
    />
    <CheckIcon
      v-if="status !== 'sent'"
      class="shrink-0 -ml-2"
      :class="[iconSizeClass, checkColorClass]"
      aria-hidden="true"
    />
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon } from '@heroicons/vue/20/solid';

const props = defineProps({
  status: {
    type: String,
    default: 'sent',
    validator: (v) => ['sent', 'delivered', 'read'].includes(v)
  },
  size: {
    type: String,
    default: 'sm',
    validator: (v) => ['sm', 'md'].includes(v)
  }
});

const { t } = useI18n();

const title = computed(() => {
  if (props.status === 'read') return t('cases.chatReceiptRead');
  if (props.status === 'delivered') return t('cases.chatReceiptDelivered');
  return t('cases.chatReceiptSent');
});

const checkColorClass = computed(() => {
  if (props.status === 'read') return 'text-sky-500 dark:text-sky-400';
  return 'text-gray-400 dark:text-gray-500';
});

const sizeClass = computed(() => (props.size === 'md' ? 'h-4' : 'h-3.5'));
const iconSizeClass = computed(() => (props.size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'));
</script>
