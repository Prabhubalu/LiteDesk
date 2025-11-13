<template>
  <div class="flex items-center gap-1">
    <!-- View Button - Always visible (read permission is required to see the list) -->
    <button 
      @click.stop="$emit('view', row)"
      class="inline-flex items-center h-8 gap-1.5 px-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm" 
      title="View"
    >
      <EyeIcon class="w-4 h-4" />
    </button>

    <!-- Edit Button - Only if user has edit permission -->
    <button 
      v-if="authStore.can(module, 'edit')"
      @click.stop="$emit('edit', row)"
      class="inline-flex items-center h-8 gap-1.5 px-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm" 
      title="Edit"
    >
      <PencilSquareIcon class="w-4 h-4" />
    </button>

    <!-- Delete Button - Only if user has delete permission -->
    <button 
      v-if="authStore.can(module, 'delete')"
      @click.stop="$emit('delete', row)"
      class="inline-flex items-center h-8 gap-1.5 px-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm" 
      title="Delete"
    >
      <TrashIcon class="w-4 h-4" />
    </button>

    <!-- Custom Actions Slot -->
    <slot :row="row"></slot>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth';
import { EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline';

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

