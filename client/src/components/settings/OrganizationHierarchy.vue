<template>
  <div class="space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Role Hierarchy Chart</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Visual representation of your organization's role structure
          </p>
        </div>
        <button
          @click="refreshHierarchy"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
        >
          <svg class="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="hierarchy.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p class="text-sm text-gray-600 dark:text-gray-400">No roles in hierarchy</p>
      </div>

      <!-- Org Chart -->
      <div v-else class="org-chart-container">
        <div class="flex flex-col items-center">
          <!-- Render top-level roles -->
          <div v-for="(rootNode, index) in hierarchy" :key="rootNode._id" class="w-full">
            <div v-if="index > 0" class="h-8"></div>
            <HierarchyNode :node="rootNode" @node-click="handleNodeClick" />
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
      <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Understanding the Hierarchy</h4>
      <ul class="text-xs text-blue-800 dark:text-blue-400 space-y-1">
        <li>• <strong>Level 0:</strong> Top-level roles (typically Owner/Admin)</li>
        <li>• <strong>Parent Role:</strong> Determines position in hierarchy</li>
        <li>• <strong>Connecting Lines:</strong> Show reporting structure</li>
        <li>• <strong>User Count:</strong> Number of users assigned to each role</li>
        <li>• <strong>Click on any role</strong> to view or edit its details</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import apiClient from '@/utils/apiClient';
import HierarchyNode from './HierarchyNode.vue';

const props = defineProps({
  roles: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['refresh', 'node-click']);

const hierarchy = ref([]);
const loading = ref(false);

const fetchHierarchy = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get('/roles/hierarchy');
    
    if (response.success) {
      hierarchy.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
  } finally {
    loading.value = false;
  }
};

const refreshHierarchy = () => {
  fetchHierarchy();
  emit('refresh');
};

const handleNodeClick = (node) => {
  emit('node-click', node);
};

watch(() => props.roles, () => {
  fetchHierarchy();
}, { immediate: true });
</script>

<style scoped>
.org-chart-container {
  overflow-x: auto;
  padding: 20px;
  min-height: 300px;
}

/* Custom scrollbar */
.org-chart-container::-webkit-scrollbar {
  height: 8px;
}

.org-chart-container::-webkit-scrollbar-track {
  background: rgb(243 244 246);
  border-radius: 4px;
}

:global(.dark) .org-chart-container::-webkit-scrollbar-track {
  background: rgb(31 41 55);
}

.org-chart-container::-webkit-scrollbar-thumb {
  background: rgb(209 213 219);
  border-radius: 4px;
}

:global(.dark) .org-chart-container::-webkit-scrollbar-thumb {
  background: rgb(75 85 99);
}

.org-chart-container::-webkit-scrollbar-thumb:hover {
  background: rgb(156 163 175);
}

:global(.dark) .org-chart-container::-webkit-scrollbar-thumb:hover {
  background: rgb(107 114 128);
}
</style>
