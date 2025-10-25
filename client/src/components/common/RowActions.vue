<template>
  <div class="flex items-center gap-1">
    <!-- View Button - Always visible (read permission is required to see the list) -->
    <button 
      @click.stop="$emit('view', row)"
      class="p-2 text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all hover:scale-110" 
      title="View"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    </button>

    <!-- Edit Button - Only if user has edit permission -->
    <button 
      v-if="authStore.can(module, 'edit')"
      @click.stop="$emit('edit', row)"
      class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all hover:scale-110" 
      title="Edit"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>

    <!-- Delete Button - Only if user has delete permission -->
    <button 
      v-if="authStore.can(module, 'delete')"
      @click.stop="$emit('delete', row)"
      class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all hover:scale-110" 
      title="Delete"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>

    <!-- Custom Actions Slot -->
    <slot :row="row"></slot>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth';

defineProps({
  row: {
    type: Object,
    required: true
  },
  module: {
    type: String,
    required: true
  }
});

defineEmits(['view', 'edit', 'delete']);

const authStore = useAuthStore();
</script>

