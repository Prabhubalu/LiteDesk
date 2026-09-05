<template>
  <div
    class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors"
    :class="[badgeClasses, clickable ? 'cursor-pointer hover:opacity-80' : '']"
    :title="tooltip"
    @click="clickable && $emit('click')"
  >
    <component :is="iconComponent" class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    <span>{{ label }}</span>
    <svg
      v-if="enabled"
      class="w-3 h-3"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16.704 5.29a1 1 0 0 0-1.408-1.42L8 11.293 4.707 8a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8.125Z"
        fill="currentColor"
      />
    </svg>
    <svg
      v-else-if="!available"
      class="w-3 h-3"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 3a7 7 0 1 0 0 14A7 7 0 0 0 10 3ZM5 10a5 5 0 1 1 10 0A5 5 0 0 1 5 10Z"
        fill="currentColor"
      />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  BellAlertIcon,
  BellIcon,
  ChatBubbleLeftIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon
} from '@heroicons/vue/20/solid';

defineEmits(['click']);

const props = defineProps({
  channel: {
    type: String,
    required: true,
    validator: (v) => ['inApp', 'email', 'push', 'whatsapp', 'sms'].includes(v)
  },
  enabled: {
    type: Boolean,
    default: false
  },
  available: {
    type: Boolean,
    default: true
  },
  clickable: {
    type: Boolean,
    default: false
  }
});

const channelConfig = {
  inApp: {
    label: 'In-App',
    icon: BellAlertIcon
  },
  email: {
    label: 'Email',
    icon: EnvelopeIcon
  },
  push: {
    label: 'Push',
    icon: BellIcon
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: ChatBubbleLeftIcon
  },
  sms: {
    label: 'SMS',
    icon: DevicePhoneMobileIcon
  }
};

const config = computed(() => channelConfig[props.channel] || channelConfig.inApp);
const label = computed(() => config.value.label);
const iconComponent = computed(() => config.value.icon);

const badgeClasses = computed(() => {
  if (!props.available) {
    return 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed';
  }
  if (props.enabled) {
    return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300';
  }
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
});

const tooltip = computed(() => {
  if (!props.available) {
    return `${label.value} notifications are not available`;
  }
  if (props.enabled) {
    return `${label.value} notifications are enabled`;
  }
  return `${label.value} notifications are disabled`;
});
</script>
