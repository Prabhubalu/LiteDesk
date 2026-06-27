<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useTabs, tabShowsHelpdeskAlert } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import clickOutside from '@/directives/clickOutside';
import NotificationBell from '@/components/notifications/NotificationBell.vue';
import PortalSwitcher from '@/components/PortalSwitcher.vue';
import UserMenu from '@/components/UserMenu.vue';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import { useUserStatus } from '@/composables/useUserStatus';
import { XMarkIcon } from '@heroicons/vue/20/solid';
import { resolveTabTitleWithHelpdeskAlerts } from '@/utils/helpdeskTabAlerts';
import { resolveTabTitleWithLiveChatAlerts } from '@/utils/liveChatTabAlerts';
import { resolveTabTitle } from '@/utils/navigationLabels';
import { useHelpdeskBrowserTitle } from '@/composables/useHelpdeskBrowserTitle';
import TabHoverPreview from '@/components/TabHoverPreview.vue';
import {
  getTabPreviewContext,
  isTabTitleTruncated,
  shouldShowTabPreview,
} from '@/utils/tabPreviewContext';
import { sidebarMainColumnOffsetPx } from '@/utils/sidebarLayout';

const { t, te } = useI18n();
useHelpdeskBrowserTitle();
const route = useRoute();
const authStore = useAuthStore();
const { tabs, activeTabId, switchToTab, closeTab, closeOtherTabs, closeAllTabs } = useTabs();

function tabDisplayTitle(tab) {
  const base = resolveTabTitle(tab, t, te);
  const withHelpdesk = resolveTabTitleWithHelpdeskAlerts(tab, t, te);
  if (withHelpdesk !== base) return withHelpdesk;
  return resolveTabTitleWithLiveChatAlerts(tab, t, te);
}

function tabHasHelpdeskAlert(tab) {
  return tabShowsHelpdeskAlert(tab, activeTabId.value);
}

function tabAlertIconColorClass(tab) {
  if (!tabHasHelpdeskAlert(tab)) {
    return activeTabId.value === tab.id
      ? 'text-gray-900 dark:text-white'
      : 'text-gray-600 dark:text-gray-400';
  }
  if (tab.alertKind === 'chat' || tab.alertKind === 'session') {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (tab.alertKind === 'case') {
    return 'text-blue-600 dark:text-blue-400';
  }
  return 'text-amber-600 dark:text-amber-400';
}

function tabAlertRingClass(tab) {
  if (tab.alertKind === 'chat' || tab.alertKind === 'session') return 'tab-helpdesk-alert-icon__ring--chat';
  if (tab.alertKind === 'case') return 'tab-helpdesk-alert-icon__ring--case';
  return 'tab-helpdesk-alert-icon__ring--email';
}

function tabItemClasses(tab, index) {
  const active = activeTabId.value === tab.id;
  const alert = tabHasHelpdeskAlert(tab);
  const dragOver = dragOverTabId.value === tab.id;
  const nextTab = tabsArray.value[index + 1];
  const isLastTab = index === tabsArray.value.length - 1;
  const showInactiveSeparator =
    !active &&
    ((nextTab != null && activeTabId.value !== nextTab.id) || isLastTab);

  const base = [
    'group relative flex items-center min-w-0 px-3 h-full',
    'cursor-pointer select-none transition-all duration-150',
    'overflow-hidden',
  ];

  if (dragOver) {
    base.push('ring-2 ring-inset ring-primary-500/35');
  }

  if (active) {
    return [
      ...base,
      'tab-item--active z-10 overflow-visible',
      'bg-white dark:bg-neutral-900',
    ];
  }

  const inactiveSeparator = showInactiveSeparator ? 'tab-item--separator' : '';

  if (alert) {
    return [
      ...base,
      'tab-item--inactive tab-item--inactive-alert',
      inactiveSeparator,
    ];
  }

  return [
    ...base,
    'tab-item--inactive',
    inactiveSeparator,
  ];
}

function tabTitleClasses(tab) {
  const active = activeTabId.value === tab.id;
  if (active) {
    return 'text-sm font-medium text-neutral-900 dark:text-neutral-100';
  }
  if (tabHasHelpdeskAlert(tab)) {
    return 'text-sm font-normal text-amber-950 dark:text-amber-100';
  }
  return 'text-sm font-normal text-neutral-600 dark:text-neutral-400';
}

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

const isSettingsRouteActive = computed(() => route.path.startsWith('/settings'));

// Get sidebar state from parent (App.vue passes it via provide/inject or we calculate it)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920);
const tabBarRef = ref(null);

const isDesktopShell = computed(() => viewportWidth.value >= 1024);

const tabBarPositionStyle = computed(() => {
  if (isDesktopShell.value) {
    return { width: '100%', maxWidth: '100%', minWidth: 0 };
  }

  const sidebarCollapsed = localStorage.getItem('arivu-sidebar-collapsed') === 'true';
  const width = viewportWidth.value - sidebarMainColumnOffsetPx(sidebarCollapsed);
  return {
    width: `${width}px`,
    maxWidth: `${width}px`,
    minWidth: 0,
    left: `${sidebarMainColumnOffsetPx(sidebarCollapsed)}px`,
  };
});

const updateTabBarOffset = () => {
  const el = tabBarRef.value;

  if (!(el instanceof HTMLElement) || getComputedStyle(el).display === 'none') {
    document.documentElement.style.removeProperty('--tabbar-offset');
    return;
  }

  const rect = el.getBoundingClientRect();
  const offset = Math.round(rect.bottom);

  document.documentElement.style.setProperty('--tabbar-offset', `${offset}px`);
};

// Drag and drop state
const draggedTabId = ref(null);
const dragOverTabId = ref(null);
const showContextMenu = ref(false);
const contextMenuTab = ref(null);
const contextMenuPosition = ref({ x: 0, y: 0 });

const hoveredPreviewTab = ref(null);
const hoveredPreviewAnchor = ref(null);
const previewEnabled = computed(
  () => !draggedTabId.value && !showContextMenu.value
);

function tryShowTabPreview(tab, tabEl) {
  if (!(tabEl instanceof HTMLElement) || !tab) return;
  const titleEl = tabEl.querySelector('[data-tab-title]');
  const { secondary } = getTabPreviewContext(tab, t, te);
  if (!shouldShowTabPreview(tab, {
    isTruncated: isTabTitleTruncated(titleEl),
    secondary,
  })) {
    return;
  }
  hoveredPreviewTab.value = tab;
  hoveredPreviewAnchor.value = tabEl;
}

function clearTabPreview() {
  hoveredPreviewTab.value = null;
  hoveredPreviewAnchor.value = null;
}

function handleTabsContainerMouseOver(event) {
  if (draggedTabId.value) return;
  const tabEl = event.target.closest('[data-tab-item]');
  if (!(tabEl instanceof HTMLElement)) return;
  const tabId = tabEl.dataset.tabId;
  const tab = tabsArray.value.find((item) => item.id === tabId);
  if (tab) tryShowTabPreview(tab, tabEl);
}

function handleTabsContainerMouseLeave() {
  releaseFrozenTabWidth();
  clearTabPreview();
}

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
  clearTabPreview();
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
  clearTabPreview();
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

const handleSidebarToggle = () => {
  if (isDesktopShell.value) {
    nextTick(() => updateTabBarOffset());
    return;
  }

  const currentWidth = viewportWidth.value;
  viewportWidth.value = currentWidth + 1;
  setTimeout(() => {
    viewportWidth.value = currentWidth;
    nextTick(() => updateTabBarOffset());
  }, 0);
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleResize);
  window.addEventListener('sidebar-toggle', handleSidebarToggle);
  
  viewportWidth.value = window.innerWidth;

  if (tabsArray.value.length === 0) {
    setTimeout(() => updateTabBarOffset(), 100);
  } else {
    nextTick(() => updateTabBarOffset());
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
    data-onboarding-target="tabs"
    class="tab-strip bg-neutral-100 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700 fixed top-16 left-0 right-0 z-30 transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:z-40 lg:w-full lg:max-w-full lg:flex-shrink-0 lg:border-b-0"
    :class="{ 'tab-strip--settings-active': isSettingsRouteActive }"
    :style="tabBarPositionStyle"
  >
    <div class="flex items-center h-11 min-w-0 w-full gap-2 pl-0 pr-2" :style="{ width: '100%', maxWidth: '100%' }">
      <div
        ref="tabsContainerRef"
        class="flex flex-1 min-w-0 items-center gap-0 h-full overflow-x-hidden"
        @mouseleave="handleTabsContainerMouseLeave"
        @mouseover="handleTabsContainerMouseOver"
      >
      <!-- Tabs - Chrome style: widths shrink to fit, and stay frozen on close
           until the cursor leaves the strip. -->
      <template v-if="tabsArray.length > 0">
        <div
          v-for="(tab, index) in tabsArray"
          :key="tab.id"
        data-tab-item
        :data-tab-id="tab.id"
        draggable="true"
        @dragstart="handleDragStart($event, tab.id)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver($event, tab.id)"
        @dragleave="handleDragLeave"
        @drop="handleDrop($event, tab.id)"
        @click="handleTabClick(tab.id)"
        @contextmenu="handleContextMenu($event, tab)"
        :class="tabItemClasses(tab, index)"
        :style="tabItemStyle"
      >
        <!-- Icon (pulse + ring when unread helpdesk activity on background tab) -->
        <span
          class="relative flex h-5 w-5 flex-shrink-0 items-center justify-center mr-2"
          :class="{ 'tab-helpdesk-alert-icon': tabHasHelpdeskAlert(tab) }"
        >
          <span
            v-if="tabHasHelpdeskAlert(tab)"
            class="tab-helpdesk-alert-icon__ring pointer-events-none absolute inset-0 rounded-full"
            :class="tabAlertRingClass(tab)"
            aria-hidden="true"
          />
          <component
            :is="tab.icon"
            class="tab-helpdesk-alert-icon__glyph relative z-[1] h-5 w-5"
            :class="tabAlertIconColorClass(tab)"
          />
        </span>
        
        <!-- Title -->
        <span
          data-tab-title
          :class="[
            'overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0 leading-none',
            tabTitleClasses(tab),
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
            'inline-flex items-center justify-center shrink-0 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-150 overflow-hidden h-6 w-6',
            activeTabId === tab.id
              ? 'opacity-100 ml-2'
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
        class="hidden lg:flex relative flex-shrink-0 self-center items-center gap-3 pr-1"
      >
        <PortalSwitcher />
        <NotificationBell
          :show-count-on-desktop="true"
          class="!min-h-8 !min-w-8 !p-1 cursor-pointer rounded-md !border-0 !bg-transparent shadow-none hover:!bg-neutral-200 dark:hover:!bg-neutral-700 [&_svg]:!w-5 [&_svg]:!h-5 [&_span.notification-bell-badge]:min-w-4 [&_span.notification-bell-badge]:h-4 [&_span.notification-bell-badge]:text-[9px]"
          @toggle="openNotificationsPanel"
        />
        <div
          ref="profileDropdownRef"
          v-click-outside="closeProfileDropdown"
          class="relative z-50 flex items-center"
        >
          <button
            type="button"
            class="relative rounded-full overflow-visible w-8 h-8 flex-shrink-0 ring-1 ring-neutral-200 dark:ring-neutral-600 hover:ring-neutral-300 dark:hover:ring-neutral-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            :title="t('navigation.tabAccount')"
            aria-haspopup="true"
            :aria-expanded="showProfileDropdown"
            @click.stop="toggleProfileDropdown"
          >
            <AvatarInitials
              :first-name="authStore.user?.firstName"
              :last-name="authStore.user?.lastName"
              :email="authStore.user?.email"
              :username="authStore.user?.username"
              :avatar="authStore.user?.avatar"
              size="sm"
            />
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

    <TabHoverPreview
      :tab="hoveredPreviewTab"
      :anchor-el="hoveredPreviewAnchor"
      :enabled="previewEnabled"
    />
  </div>
</template>

<style scoped>
.tab-strip {
  --tab-strip-padding-y: 0.1875rem;
  --tab-strip-separator-inset-y: 0.625rem;
}

@media (min-width: 1024px) {
  /* Overlap the content surface by 1px so the active tab white bridges cleanly */
  .tab-strip--settings-active {
    margin-bottom: -1px;
  }
}

[data-tab-item] {
  align-self: stretch;
  display: flex;
  align-items: center;
}

/* Compact hover pill + separator share padded vertical inset */
.tab-item--inactive::before {
  content: '';
  position: absolute;
  left: 0.375rem;
  right: 0.375rem;
  top: var(--tab-strip-padding-y);
  bottom: var(--tab-strip-padding-y);
  height: auto;
  border-radius: 0.25rem;
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none;
  z-index: 0;
}

.tab-item--inactive:hover::before {
  opacity: 1;
  background-color: color-mix(in srgb, var(--color-neutral-200) 70%, transparent);
}

.tab-item--inactive-alert:hover::before {
  background-color: color-mix(in srgb, var(--color-warning-200) 80%, transparent);
}

.tab-item--inactive > * {
  position: relative;
  z-index: 1;
}

/* Short vertical separator between inactive tabs (Chrome-style) */
.tab-item--separator::after {
  content: '';
  position: absolute;
  right: 0.375rem;
  top: var(--tab-strip-separator-inset-y);
  bottom: var(--tab-strip-separator-inset-y);
  width: 1px;
  height: auto;
  background-color: var(--color-neutral-300);
  opacity: 0.45;
  pointer-events: none;
  z-index: 1;
  transition: opacity 120ms ease;
}


.tab-item--separator:hover::after,
.tab-item--separator:has(+ [data-tab-item]:hover)::after {
  opacity: 0;
}

/* Active tab surface continues into content (Chrome-style) */
.tab-item--active {
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
  box-shadow: 0 1px 0 0 #ffffff;
}


@keyframes tab-helpdesk-icon-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
  }
}

@keyframes tab-helpdesk-icon-wiggle {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
  }
  20% {
    transform: rotate(-8deg) scale(1.12);
  }
  40% {
    transform: rotate(8deg) scale(1.14);
  }
  60% {
    transform: rotate(-5deg) scale(1.1);
  }
  80% {
    transform: rotate(4deg) scale(1.08);
  }
}

@keyframes tab-helpdesk-icon-ring {
  0% {
    transform: scale(0.75);
    opacity: 0.65;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

.tab-helpdesk-alert-icon__glyph {
  transform-origin: center;
}

.tab-helpdesk-alert-icon .tab-helpdesk-alert-icon__glyph {
  animation: tab-helpdesk-icon-wiggle 1.35s ease-in-out infinite;
}

.tab-helpdesk-alert-icon__ring--email {
  background-color: rgb(245 158 11 / 0.45);
  animation: tab-helpdesk-icon-ring 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.tab-helpdesk-alert-icon__ring--chat {
  background-color: rgb(16 185 129 / 0.4);
  animation: tab-helpdesk-icon-ring 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.tab-helpdesk-alert-icon__ring--case {
  background-color: rgb(59 130 246 / 0.4);
  animation: tab-helpdesk-icon-ring 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.tab-helpdesk-alert-icon:has(.tab-helpdesk-alert-icon__ring--chat) .tab-helpdesk-alert-icon__glyph,
.tab-helpdesk-alert-icon:has(.tab-helpdesk-alert-icon__ring--case) .tab-helpdesk-alert-icon__glyph {
  animation: tab-helpdesk-icon-pulse 1.1s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .tab-helpdesk-alert-icon__glyph,
  .tab-helpdesk-alert-icon__ring {
    animation: none !important;
  }

  .tab-helpdesk-alert-icon__glyph {
    transform: scale(1.1);
  }
}
</style>

<style>
/* Unscoped: Vue scoped :global(html.dark) compiles onto <html>, so dark overrides never apply. */
html.dark .tab-item--inactive:hover::before {
  background-color: rgb(255 255 255 / 0.06);
}

html.dark .tab-item--inactive-alert:hover::before {
  background-color: color-mix(in srgb, var(--color-warning-900) 55%, transparent);
}

html.dark .tab-item--separator::after {
  background-color: var(--color-neutral-600);
  opacity: 0.65;
}

html.dark .tab-item--active {
  box-shadow: 0 1px 0 0 var(--color-neutral-900);
}
</style>
