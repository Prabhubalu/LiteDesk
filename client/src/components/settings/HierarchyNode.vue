<template>
  <div class="flex flex-col items-center">
    <!-- Node Card -->
    <div class="relative">
      <div
        class="org-node bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
        :class="{ 'ring-2 ring-brand-500': isHighlighted }"
        @click="$emit('node-click', node)"
        @mouseenter="isHighlighted = true"
        @mouseleave="isHighlighted = false"
      >
        <!-- Background decoration -->
        <div class="absolute top-0 left-0 right-0 h-20" :style="{ background: `linear-gradient(135deg, ${node.color || '#6366f1'}20, ${node.color || '#6366f1'}05)` }"></div>
        
        <div class="relative p-6 flex flex-col items-center text-center">
          <!-- Avatar/Icon -->
          <div
            class="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-3 relative z-10"
            :style="{ backgroundColor: node.color || '#6366f1' }"
          >
            <!-- Icon based on role icon -->
            <svg v-if="node.icon === 'crown'" class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <svg v-else-if="node.icon === 'shield'" class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <svg v-else-if="node.icon === 'users'" class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            <svg v-else-if="node.icon === 'eye'" class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
            </svg>
            <svg v-else class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
            
            <!-- System Role Badge -->
            <div v-if="node.isSystemRole" class="absolute -top-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
              <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>

          <!-- Role Name -->
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-wide">
            {{ node.name }}
          </h3>

          <!-- Department/Description -->
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 min-h-[40px] max-w-[200px]">
            {{ node.description || 'No description' }}
          </p>

          <!-- Level Badge -->
          <div class="flex items-center gap-2 text-xs">
            <span class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-medium">
              Level {{ node.level }}
            </span>
            <span class="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium flex items-center gap-1">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              {{ node.userCount || 0 }}
            </span>
          </div>
        </div>
      </div>

      <!-- Vertical line down from this node (if has children) -->
      <div v-if="node.children && node.children.length > 0" class="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 mx-auto"></div>
    </div>

    <!-- Children -->
    <div v-if="node.children && node.children.length > 0" class="relative">
      <!-- Horizontal line connecting children -->
      <div v-if="node.children.length > 1" class="absolute top-0 left-0 right-0 h-0.5 bg-gray-300 dark:bg-gray-600" :style="{ left: getChildrenLineStart(), right: getChildrenLineEnd() }"></div>

      <!-- Children container -->
      <div class="flex items-start gap-8 pt-8">
        <div v-for="child in node.children" :key="child._id" class="relative">
          <!-- Vertical line up to child -->
          <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-8 bg-gray-300 dark:bg-gray-600 -mt-8"></div>
          
          <!-- Recursive child node -->
          <HierarchyNode :node="child" @node-click="$emit('node-click', $event)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

defineEmits(['node-click']);

const isHighlighted = ref(false);

const getChildrenLineStart = () => {
  // Calculate the start position of the horizontal connecting line
  return '50%';
};

const getChildrenLineEnd = () => {
  // Calculate the end position of the horizontal connecting line
  return '50%';
};
</script>

<style scoped>
.org-node {
  min-width: 240px;
  max-width: 280px;
  transition: all 0.3s ease;
}

.org-node:hover {
  transform: translateY(-4px);
}
</style>
