<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, te } = useI18n();

function tabDisplayTitle(tab) {
  return resolveTabTitle(tab, t, te);
}
import { useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import clickOutside from '@/directives/clickOutside';
import NotificationBell from '@/components/notifications/NotificationBell.vue';
import UserMenu from '@/components/UserMenu.vue';
import { useUserStatus } from '@/composables/useUserStatus';
import { XMarkIcon } from '@heroicons/vue/20/solid';
import { resolveTabTitle } from '@/utils/navigationLabels';

const route = useRoute();
const authStore = useAuthStore();
const { tabs, activeTabId, switchToTab, closeTab, closeOtherTabs, closeAllTabs } = useTabs();

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=128&h=128&q=80';

const workspaceAvatarUrl = computed(
  () => authStore.user?.avatar || DEFAULT_AVATAR
);

const currentUserId = computed(() => authStore.user?._id || null);
const { currentPreset: userStatusPreset } = useUserStatus(currentUserId);

const showProfileDropdown = ref(false);
const profileDropdownRef = ref(null);

const toggleProfileDropdown = () => {
  showProfileDropdown.value = !showProfileDropdown.value;
};

const closeProfileDropdown = () => {
  showProfileDropdown.value = false;
};

/** Audit layout has no Nav “keeper” bell — TabBar owns SSE there. Platform shell uses Nav’s hidden bell. */
const tabBarNotificationConnectStream = computed(() => {
  const p = route.path || '';
  return p.startsWith('/audit/');
});

function openNotificationsPanel() {
  window.dispatchEvent(new CustomEvent('arivu:open-notifications-panel'));
}

const vClickOutside = clickOutside;

// Create a computed to ensure reactivity in template
// Force reactivity by watching the ref directly
const tabsArray = computed(() => {
  // tabs is a ref, so access .value
  // Force dependency tracking by accessing .value
  const tabsValue = tabs.value || [];
  return tabsValue;
});

// Get sidebar state from parent (App.vue passes it via provide/inject or we calculate it)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920);
const tabBarRef = ref(null);
const DEFAULT_TOP_OFFSET = 64;

// Calculate the actual available width for TabBar
// Account for sidebar width (either 256px expanded or 64px collapsed)
const tabBarWidth = computed(() => {
  // On mobile, full width
  if (viewportWidth.value < 1024) {
    return viewportWidth.value;
  }
  
  // On desktop, we need to check sidebar state
  // Read from localStorage since sidebar state is stored there
  const sidebarCollapsed = localStorage.getItem('arivu-sidebar-collapsed') === 'true';
  const sidebarWidth = sidebarCollapsed ? 64 : 256;
  const calculatedWidth = viewportWidth.value - sidebarWidth;
  
  console.log('📊 TabBar Width:', {
    viewport: viewportWidth.value,
    sidebarCollapsed,
    sidebarWidth,
    tabBarWidth: calculatedWidth,
    totalTabs: tabsArray.value.length
  });
  
  return calculatedWidth;
});

// Calculate the left position for the TabBar
const tabBarLeft = computed(() => {
  // On mobile, always at left: 0
  if (viewportWidth.value < 1024) {
    return '0px';
  }
  
  // On desktop, position based on sidebar state
  const sidebarCollapsed = localStorage.getItem('arivu-sidebar-collapsed') === 'true';
  return sidebarCollapsed ? '64px' : '256px';
});

const updateTabBarOffset = () => {
  const el = tabBarRef.value;

  if (!(el instanceof HTMLElement) || getComputedStyle(el).display === 'none') {
    document.documentElement.style.removeProperty('--tabbar-offset');
    return;
  }

  const rect = el.getBoundingClientRect();
  const offset = Math.max(DEFAULT_TOP_OFFSET, Math.round(rect.bottom));

  document.documentElement.style.setProperty('--tabbar-offset', `${offset}px`);
};

// Drag and drop state
const draggedTabId = ref(null);
const dragOverTabId = ref(null);
const showContextMenu = ref(false);
const contextMenuTab = ref(null);
const contextMenuPosition = ref({ x: 0, y: 0 });

// Chrome-style tab width freeze:
// While the cursor is over the tab strip and the user closes a tab via the X,
// the remaining tabs hold their current pixel width so the next X stays under
// the cursor. Widths un-freeze (and animate back) when the cursor leaves the
// tab area.
const tabsContainerRef = ref(null);
const frozenTabWidth = ref(null);

const tabItemStyle = computed(() => {
  if (frozenTabWidth.value !== null) {
    const w = `${frozenTabWidth.value}px`;
    return {
      flex: '0 0 auto',
      width: w,
      minWidth: '0',
      maxWidth: w,
    };
  }
  return {
    flex: '1 1 0',
    flexBasis: '0',
    minWidth: '0',
    maxWidth: '200px',
  };
});

const releaseFrozenTabWidth = () => {
  if (frozenTabWidth.value !== null) {
    frozenTabWidth.value = null;
  }
};

// Handle tab click
const handleTabClick = (tabId) => {
  switchToTab(tabId);
};

// Handle tab close
const handleCloseTab = (event, tabId) => {
  event.stopPropagation();

  // Snapshot the current rendered width of a tab before removal so the
  // remaining tabs stay the same size until the cursor leaves the strip.
  const container = tabsContainerRef.value;
  if (container) {
    const sample = container.querySelector('[data-tab-item]');
    if (sample) {
      const w = sample.getBoundingClientRect().width;
      if (w > 0) frozenTabWidth.value = w;
    }
  }

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
  const index = tabsArray.value.findIndex(tab => tab.id === tabId);
  if (index === -1) return;
  
  // Get tabs to the right that are closable
  const tabsToClose = tabsArray.value.slice(index + 1).filter(tab => tab.closable);
  tabsToClose.forEach(tab => closeTab(tab.id));
};

// Close context menu on click outside (profile menu uses v-click-outside)
const handleClickOutside = () => {
  if (showContextMenu.value) {
    handleCloseContextMenu();
  }
};

// Update viewport width on resize
const handleResize = () => {
  viewportWidth.value = window.innerWidth;
  updateTabBarOffset();
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
    nextTick(() => {
      updateTabBarOffset();
    });
  }, 0);
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleResize);
  window.addEventListener('sidebar-toggle', handleSidebarToggle);
  
  // Set initial viewport width
  viewportWidth.value = window.innerWidth;
  console.log('📐 TabBar mounted, tabs count:', tabsArray.value.length);
  
  // Force a check - if tabs aren't initialized yet, wait a bit
  if (tabsArray.value.length === 0) {
    console.log('⚠️ [TabBar] No tabs on mount, waiting for initialization...');
    // Wait a bit for initTabs to complete
    setTimeout(() => {
      console.log('🔍 [TabBar] After timeout, tabs count:', tabsArray.value.length);
      updateTabBarOffset();
    }, 100);
  } else {
    nextTick(() => {
      updateTabBarOffset();
    });
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('sidebar-toggle', handleSidebarToggle);
  document.documentElement.style.removeProperty('--tabbar-offset');
});
</script>

<template>
  <div 
    ref="tabBarRef"
    class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-16 left-0 right-0 lg:top-0 lg:left-auto lg:right-auto z-30 transition-all duration-300 ease-in-out"
    :style="{ 
      width: tabBarWidth + 'px',
      maxWidth: tabBarWidth + 'px',
      minWidth: 0,
      left: tabBarLeft
    }"
  >
    <div class="flex items-stretch h-12 min-w-0 w-full gap-6" :style="{ width: '100%', maxWidth: '100%' }">
      <div
        ref="tabsContainerRef"
        class="flex flex-1 min-w-0 items-center h-full overflow-x-hidden"
        @mouseleave="releaseFrozenTabWidth"
      >
      <!-- Tabs - Chrome style: widths shrink to fit, and stay frozen on close
           until the cursor leaves the strip. -->
      <template v-if="tabsArray.length > 0">
        <div
          v-for="tab in tabsArray"
          :key="tab.id"
        data-tab-item
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
        :style="tabItemStyle"
      >
        <!-- Icon -->
        <component 
          :is="tab.icon" 
          class="w-5 h-5 flex-shrink-0 mr-2"
          :class="[
            activeTabId === tab.id
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400'
          ]"
        />
        
        <!-- Title -->
        <span
          :class="[
            'text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0',
            activeTabId === tab.id
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400'
          ]"
        >
          {{ tabDisplayTitle(tab) }}
        </span>
        
        <!-- Close button - collapses to 0 width when hidden -->
        <button
          v-if="tab.closable"
          @click="handleCloseTab($event, tab.id)"
          :aria-label="t('navigation.tabCloseTab')"
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
      </template>
      </div>

      <!-- Tablet (md–lg): profile + bell live in Nav top bar (lg:hidden). Desktop (lg+): show here. -->
      <div
        v-if="authStore.user"
        class="hidden lg:flex relative flex-shrink-0 items-center gap-3 pr-3"
      >
        <NotificationBell
          :connect-stream="tabBarNotificationConnectStream"
          :show-count-on-desktop="true"
          class="!min-h-9 !min-w-9 !p-1.5 rounded-md !border-0 !bg-transparent shadow-none hover:!bg-gray-100 dark:hover:!bg-gray-700 [&_svg]:!w-6 [&_svg]:!h-6"
          @toggle="openNotificationsPanel"
        />
        <div
          ref="profileDropdownRef"
          v-click-outside="closeProfileDropdown"
          class="relative flex items-center"
        >
          <button
            type="button"
            class="relative rounded-full overflow-visible w-8 h-8 flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600 hover:ring-gray-300 dark:hover:ring-gray-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :title="t('navigation.tabAccount')"
            aria-haspopup="true"
            :aria-expanded="showProfileDropdown"
            @click.stop="toggleProfileDropdown"
          >
            <img :src="workspaceAvatarUrl" alt="" class="w-full h-full rounded-full object-cover" />
            <span
              :class="[
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800',
                userStatusPreset.dotClass
              ]"
              aria-hidden="true"
            />
          </button>
          <UserMenu :open="showProfileDropdown" align="right" @close="closeProfileDropdown" />
        </div>
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
          {{ t('navigation.tabClose') }}
        </button>
        
        <!-- Close Others -->
        <button
          @click="handleContextMenuAction('close-others')"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          {{ t('navigation.tabCloseOthers') }}
        </button>
        
        <!-- Close Tabs to the Right -->
        <button
          @click="handleContextMenuAction('close-right')"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          {{ t('navigation.tabCloseToRight') }}
        </button>
        
        <div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
        
        <!-- Close All -->
        <button
          @click="handleContextMenuAction('close-all')"
          class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          {{ t('navigation.tabCloseAll') }}
        </button>
      </div>
    </transition>
  </div>
</template>
