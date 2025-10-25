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
      <svg v-if="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" :class="iconClass">
        <path v-if="icon === 'plus'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        <path v-else-if="icon === 'edit'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        <path v-else-if="icon === 'delete'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        <path v-else-if="icon === 'view'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        <path v-else-if="icon === 'import'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        <path v-else-if="icon === 'export'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    </slot>
    <slot></slot>
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

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
  const base = 'inline-flex items-center gap-2 transition-all';
  
  switch (props.variant) {
    case 'primary':
      return `${base} btn-primary`;
    case 'secondary':
      return `${base} btn-secondary`;
    case 'danger':
      return `${base} px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium`;
    case 'success':
      return `${base} px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium`;
    case 'icon':
      return `${base} p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`;
    default:
      return `${base} btn-primary`;
  }
});
</script>

