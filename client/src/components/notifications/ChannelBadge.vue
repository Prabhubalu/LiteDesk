<template>
  <div
    class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors"
    :class="[badgeClasses, clickable ? 'cursor-pointer hover:opacity-80' : '']"
    :title="tooltip"
    @click="clickable && $emit('click')"
  >
    <component :is="iconComponent" class="w-3.5 h-3.5" />
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
import { useI18n } from 'vue-i18n';
import { computed, h } from 'vue';

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

const { t } = useI18n();

const channelConfig = {
  inApp: {
    label: 'In-App',
    icon: () => h('svg', {
      viewBox: '0 0 20 20',
      fill: 'none',
      'aria-hidden': 'true'
    }, [
      h('path', {
        d: 'M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .696 1.066h13.122a.75.75 0 0 0 .696-1.066A11.95 11.95 0 0 1 16 8a6 6 0 0 0-6-6ZM8.5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
        fill: 'currentColor'
      })
    ])
  },
  email: {
    label: 'Email',
    icon: () => h('svg', {
      viewBox: '0 0 20 20',
      fill: 'none',
      'aria-hidden': 'true'
    }, [
      h('path', {
        d: 'M3 4a2 2 0 0 0-2 2v1.382l7 4.236 7-4.236V6a2 2 0 0 0-2-2H3Zm0 3.618V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.618l-5.5 3.323a1 1 0 0 1-1 0L3 7.618Z',
        fill: 'currentColor'
      })
    ])
  },
  push: {
    label: 'Push',
    icon: () => h('svg', {
      viewBox: '0 0 20 20',
      fill: 'none',
      'aria-hidden': 'true'
    }, [
      h('path', {
        d: 'M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z',
        fill: 'currentColor'
      })
    ])
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: () => h('svg', {
      viewBox: '0 0 20 20',
      fill: 'none',
      'aria-hidden': 'true'
    }, [
      h('path', {
        d: 'M10 2a8 8 0 0 0-7.07 11.97L1 19l5.03-1.93A8 8 0 1 0 10 2Zm4.5 11.5a6.5 6.5 0 0 1-9.5-9.5 6.5 6.5 0 0 1 9.5 9.5Z',
        fill: 'currentColor'
      })
    ])
  },
  sms: {
    label: 'SMS',
    icon: () => h('svg', {
      viewBox: '0 0 20 20',
      fill: 'none',
      'aria-hidden': 'true'
    }, [
      h('path', {
        d: 'M3 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3Zm0 2h14v8H3V6Zm2 2a1 1 0 0 0 0 2h10a1 1 0 1 0 0-2H5Z',
        fill: 'currentColor'
      })
    ])
  }
};

const config = channelConfig[props.channel];
const label = computed(() => config.label);
const iconComponent = computed(() => config.icon);

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

