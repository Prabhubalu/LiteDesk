<template>
  <div class="flex items-center gap-1">
    <!-- View Button - Always visible (read permission is required to see the list) -->
    <button 
      @click.stop="$emit('view', row)"
      class="p-2 text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all hover:scale-110" 
      title="View"
    >
      <EyeIcon class="w-5 h-5" />
    </button>

    <!-- Edit Button - Only if user has edit permission -->
    <button 
      v-if="authStore.can(module, 'edit')"
      @click.stop="$emit('edit', row)"
      class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all hover:scale-110" 
      title="Edit"
    >
      <PencilSquareIcon class="w-5 h-5" />
    </button>

    <!-- Delete Button - Only if user has delete permission -->
    <button 
      v-if="authStore.can(module, 'delete')"
      @click.stop="$emit('delete', row)"
      class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all hover:scale-110" 
      title="Delete"
    >
      <TrashIcon class="w-5 h-5" />
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

