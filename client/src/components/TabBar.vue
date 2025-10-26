<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue';
import { useTabs } from '@/composables/useTabs';
import { XMarkIcon } from '@heroicons/vue/20/solid';

const { tabs, activeTabId, switchToTab, closeTab, closeOtherTabs, closeAllTabs } = useTabs();

// Get sidebar state from parent (App.vue passes it via provide/inject or we calculate it)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920);

// Calculate the actual available width for TabBar
// Account for sidebar width (either 256px expanded or 80px collapsed)
const tabBarWidth = computed(() => {
  // On mobile, full width
  if (viewportWidth.value < 1024) {
    return viewportWidth.value;
  }
  
  // On desktop, we need to check sidebar state
  // Read from localStorage since sidebar state is stored there
  const sidebarCollapsed = localStorage.getItem('litedesk-sidebar-collapsed') === 'true';
  const sidebarWidth = sidebarCollapsed ? 80 : 256;
  const calculatedWidth = viewportWidth.value - sidebarWidth;
  
  console.log('📊 TabBar Width:', {
    viewport: viewportWidth.value,
    sidebarCollapsed,
    sidebarWidth,
    tabBarWidth: calculatedWidth,
    totalTabs: tabs.value.length
  });
  
  return calculatedWidth;
});

// Drag and drop state
const draggedTabId = ref(null);
const dragOverTabId = ref(null);
const showContextMenu = ref(false);
const contextMenuTab = ref(null);
const contextMenuPosition = ref({ x: 0, y: 0 });

// Handle tab click
const handleTabClick = (tabId) => {
  switchToTab(tabId);
};

// Handle tab close
const handleCloseTab = (event, tabId) => {
  event.stopPropagation();
  closeTab(tabId);
};

// Drag and drop handlers
const handleDragStart = (event, tabId) => {
  draggedTabId.value = tabId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', tabId);
  
  // Add dragging class
  event.target.classList.add('opacity-50');
};

const handleDragEnd = (event) => {
  event.target.classList.remove('opacity-50');
  draggedTabId.value = null;
  dragOverTabId.value = null;
};

const handleDragOver = (event, tabId) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  
  if (draggedTabId.value !== tabId) {
    dragOverTabId.value = tabId;
  }
};

const handleDragLeave = () => {
  dragOverTabId.value = null;
};

const handleDrop = (event, targetTabId) => {
  event.preventDefault();
  
  if (draggedTabId.value && draggedTabId.value !== targetTabId) {
    // Find indices
    const fromIndex = tabs.value.findIndex(tab => tab.id === draggedTabId.value);
    const toIndex = tabs.value.findIndex(tab => tab.id === targetTabId);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      // Reorder tabs
      const { reorderTabs } = useTabs();
      reorderTabs(fromIndex, toIndex);
    }
  }
  
  dragOverTabId.value = null;
};

// Context menu handlers
const handleContextMenu = (event, tab) => {
  event.preventDefault();
  contextMenuTab.value = tab;
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  };
  showContextMenu.value = true;
};

const handleCloseContextMenu = () => {
  showContextMenu.value = false;
  contextMenuTab.value = null;
};

const handleContextMenuAction = (action) => {
  if (!contextMenuTab.value) return;
  
  switch (action) {
    case 'close':
      closeTab(contextMenuTab.value.id);
      break;
    case 'close-others':
      closeOtherTabs(contextMenuTab.value.id);
      break;
    case 'close-all':
      closeAllTabs();
      break;
    case 'close-right':
      closeTabsToRight(contextMenuTab.value.id);
      break;
  }
  
  handleCloseContextMenu();
};

const closeTabsToRight = (tabId) => {
  const index = tabs.value.findIndex(tab => tab.id === tabId);
  if (index === -1) return;
  
  // Get tabs to the right that are closable
  const tabsToClose = tabs.value.slice(index + 1).filter(tab => tab.closable);
  tabsToClose.forEach(tab => closeTab(tab.id));
};

// Close context menu on click outside
const handleClickOutside = () => {
  if (showContextMenu.value) {
    handleCloseContextMenu();
  }
};

// Update viewport width on resize
const handleResize = () => {
  viewportWidth.value = window.innerWidth;
};

// Listen for sidebar toggle custom event
const handleSidebarToggle = (e) => {
  console.log('🔔 Sidebar toggled:', e.detail);
  // Force recompute by triggering a viewport "change"
  // This will cause tabBarWidth computed to recalculate
  const currentWidth = viewportWidth.value;
  viewportWidth.value = currentWidth + 1;
  setTimeout(() => {
    viewportWidth.value = currentWidth;
  }, 0);
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleResize);
  window.addEventListener('sidebar-toggle', handleSidebarToggle);
  
  // Set initial viewport width
  viewportWidth.value = window.innerWidth;
  console.log('📐 TabBar mounted');
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('sidebar-toggle', handleSidebarToggle);
});
</script>

<template>
  <div 
    class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 overflow-x-hidden"
    :style="{ 
      width: tabBarWidth + 'px',
      maxWidth: tabBarWidth + 'px',
      minWidth: 0
    }"
  >
    <div class="flex items-center h-12 overflow-x-hidden" :style="{ width: '100%', maxWidth: '100%' }">
      <!-- Tabs - Chrome style shrinking with aggressive overflow prevention -->
      <div
        v-for="tab in tabs"
        :key="tab.id"
        draggable="true"
        @dragstart="handleDragStart($event, tab.id)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver($event, tab.id)"
        @dragleave="handleDragLeave"
        @drop="handleDrop($event, tab.id)"
        @click="handleTabClick(tab.id)"
        @contextmenu="handleContextMenu($event, tab)"
        :class="[
          'group relative flex items-center h-full px-3 border-r border-gray-200 dark:border-gray-700',
          'cursor-pointer select-none transition-all duration-150',
          'hover:bg-gray-50 dark:hover:bg-gray-700',
          'overflow-hidden',
          activeTabId === tab.id
            ? 'bg-gray-50 dark:bg-gray-900 border-b-2 border-b-blue-500'
            : 'bg-white dark:bg-gray-800',
          dragOverTabId === tab.id ? 'border-l-2 border-l-blue-500' : ''
        ]"
        :style="{ 
          flex: '1 1 0',
          minWidth: '0',
          maxWidth: '200px',
          flexBasis: '0'
        }"
      >
        <!-- Icon -->
        <span class="text-base flex-shrink-0 mr-2">{{ tab.icon }}</span>
        
        <!-- Title -->
        <span
          :class="[
            'text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0',
            activeTabId === tab.id
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400'
          ]"
        >
          {{ tab.title }}
        </span>
        
        <!-- Close button - collapses to 0 width when hidden -->
        <button
          v-if="tab.closable"
          @click="handleCloseTab($event, tab.id)"
          :class="[
            'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 overflow-hidden',
            activeTabId === tab.id
              ? 'opacity-100 w-6 ml-2'
              : 'opacity-0 w-0 ml-0 group-hover:opacity-100 group-hover:w-6 group-hover:ml-2'
          ]"
        >
          <XMarkIcon class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        </button>
      </div>
    </div>
    
    <!-- Context Menu -->
    <transition
      enter-active-class="transition-all duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showContextMenu && contextMenuTab"
        :style="{
          position: 'fixed',
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y}px`,
          zIndex: 9999
        }"
        class="min-w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1"
        @click.stop
      >
        <!-- Close -->
        <button
          v-if="contextMenuTab.closable"
          @click="handleContextMenuAction('close')"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          Close
        </button>
        
        <!-- Close Others -->
        <button
          @click="handleContextMenuAction('close-others')"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          Close Others
        </button>
        
        <!-- Close Tabs to the Right -->
        <button
          @click="handleContextMenuAction('close-right')"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          Close Tabs to the Right
        </button>
        
        <div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
        
        <!-- Close All -->
        <button
          @click="handleContextMenuAction('close-all')"
          class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          Close All Tabs
        </button>
      </div>
    </transition>
  </div>
</template>

