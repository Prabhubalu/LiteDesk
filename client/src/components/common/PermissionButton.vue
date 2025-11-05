<template>
  <button
    v-if="hasPermission"
    :class="buttonClasses"
    :disabled="disabled"
    @click="$emit('click', $event)"
    :type="type"
    :title="title"
  >
    <slot name="icon">
      <component v-if="icon" :is="getIconComponent(icon)" :class="iconClass" />
    </slot>
    <slot></slot>
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon
} from '@heroicons/vue/24/outline';

// Icon mapping
const iconMap = {
  plus: PlusIcon,
  edit: PencilSquareIcon,
  delete: TrashIcon,
  view: EyeIcon,
  import: ArrowDownTrayIcon,
  export: ArrowUpTrayIcon,
  cog: Cog6ToothIcon
};

const getIconComponent = (iconName) => {
  return iconMap[iconName] || null;
};

const props = defineProps({
  // Permission props
  module: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  
  // Button props
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'danger', 'success', 'icon'].includes(value)
  },
  icon: {
    type: String,
    default: ''
  },
  iconClass: {
    type: String,
    default: 'w-5 h-5'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'button'
  },
  title: {
    type: String,
    default: ''
  }
});

defineEmits(['click']);

const authStore = useAuthStore();

// Check if user has the required permission
const hasPermission = computed(() => {
  return authStore.can(props.module, props.action);
});

// Button classes based on variant
const buttonClasses = computed(() => {
  const base = 'inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  switch (props.variant) {
    case 'primary':
      return `${base} bg-indigo-600 hover:bg-indigo-700 text-white`;
    case 'secondary':
      return `${base} bg-white border border-gray-200 dark:border-0 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300`;
    case 'danger':
      return `${base} bg-red-600 hover:bg-red-700 text-white`;
    case 'success':
      return `${base} bg-green-600 hover:bg-green-700 text-white`;
    case 'icon':
      return `${base} p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`;
    default:
      return `${base} bg-indigo-600 hover:bg-indigo-700 text-white`;
  }
});
</script>

