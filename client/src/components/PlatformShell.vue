<template>
  <div class="min-h-screen bg-gray-100/70 dark:bg-gray-900 flex overflow-x-hidden">
    <!-- Sidebar Navigation -->
    <!-- ARCHITECTURE NOTE: GlobalSearch is owned by GlobalSurfacesProvider. -->
    <!-- Sidebar search click dispatches arivu:open-global-search custom event. -->
    <Nav v-model="sidebarCollapsed" />
    
    <!-- Main Content Area - Dynamic margin based on sidebar state -->
    <main 
      :class="[
        'flex-1 flex flex-col transition-all duration-300 min-h-screen overflow-x-hidden',
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      ]"
    >
      <!-- Tab Bar - Hidden on mobile, visible on tablet and up -->
      <TabBar class="hidden md:block" />
      
      <!-- Content wrapper with padding; min-h-0 so record pages can fill and use internal scroll -->
      <div
        ref="contentWrapperRef"
        class="flex-1 min-h-0 flex flex-col p-4 lg:p-6 overflow-y-auto overflow-x-hidden mt-16 md:mt-30 lg:mt-14"
        :style="{ '--table-sticky-offset': tableStickyOffset }"
      >
        <!-- Router view for dynamic routes; flex-1 min-h-0 so full-height record pages get a defined height -->
        <div class="flex-1 min-h-0 flex flex-col">
          <RouterView v-slot="{ Component }">
            <!-- Cap cached route trees: each slot can hold a large list/record page. -->
            <keep-alive :max="5">
              <component :is="Component" :key="$route.fullPath" />
            </keep-alive>
          </RouterView>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
/**
 * ARCHITECTURE NOTE: GlobalSearch is NOT imported here.
 * 
 * GlobalSearch is owned by GlobalSurfacesProvider (mounted in App.vue).
 * This layout triggers search via custom events only (arivu:open-global-search).
 * App layouts must NEVER own global surfaces - see GlobalSurfacesProvider.vue.
 */

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Nav from '@/components/Nav.vue';
import TabBar from '@/components/TabBar.vue';
import { useAppShellStore } from '@/stores/appShell';
import { useTabs } from '@/composables/useTabs';
import { useSidebarState } from '@/composables/useSidebarState';

const route = useRoute();
const appShellStore = useAppShellStore();

// Sidebar state (locked doctrine): collapsed + lastActiveAppId only.
const { collapsed: sidebarCollapsed } = useSidebarState();
watch(sidebarCollapsed, () => queueContentOffsetUpdate());

const DEFAULT_CONTENT_OFFSET = 0;
const EXTRA_OFFSET_LIGHT = '2rem';
const EXTRA_OFFSET_LARGE = '2rem';
const contentWrapperRef = ref(null);
const tableStickyOffset = ref(`calc(${DEFAULT_CONTENT_OFFSET}px + ${EXTRA_OFFSET_LIGHT})`);
const TABLET_RECORD_COLLAPSE_MAX_WIDTH = 1024;

const RECORD_DETAIL_ROUTE_NAMES = new Set([
  'person-detail',
  'organization-detail',
  'deal-detail',
  'task-detail',
  'event-detail',
  'item-detail',
  'import-detail',
  'group-detail',
  'response-detail',
  'form-response-detail'
]);

const isRecordDetailRoute = () => {
  const routeName = typeof route.name === 'string' ? route.name : '';
  if (RECORD_DETAIL_ROUTE_NAMES.has(routeName)) return true;

  const path = route.path || '';
  return /^\/(people|deals|tasks|events|items|imports|organizations|groups|responses)\/[^/]+$/.test(path)
    || /^\/forms\/[^/]+\/responses\/[^/]+$/.test(path);
};

const collapseSidebarForRecordOnTablet = () => {
  if (window.innerWidth > TABLET_RECORD_COLLAPSE_MAX_WIDTH) return;
  if (!isRecordDetailRoute()) return;
  if (sidebarCollapsed.value) return;

  sidebarCollapsed.value = true;
  window.dispatchEvent(new CustomEvent('sidebar-toggle', {
    detail: { collapsed: true, reason: 'record-open-tablet' }
  }));
};

const updateContentOffset = () => {
  const el = contentWrapperRef.value;

  if (!(el instanceof HTMLElement)) {
    tableStickyOffset.value = `calc(${DEFAULT_CONTENT_OFFSET}px + ${EXTRA_OFFSET_LIGHT})`;
    return;
  }

  const rect = el.getBoundingClientRect();
  const baseOffset = Math.max(DEFAULT_CONTENT_OFFSET, Math.round(rect.top));
  const extraSpacing = window.innerWidth >= 1024 ? EXTRA_OFFSET_LARGE : EXTRA_OFFSET_LIGHT;

  tableStickyOffset.value = `calc(${baseOffset}px + ${extraSpacing})`;
};

const queueContentOffsetUpdate = () => {
  nextTick(() => {
    requestAnimationFrame(updateContentOffset);
  });
};

watch(
  () => route.fullPath,
  () => {
    collapseSidebarForRecordOnTablet();
    queueContentOffsetUpdate();
  }
);

watch(sidebarCollapsed, () => {
  queueContentOffsetUpdate();
});

const handleResize = () => {
  updateContentOffset();
};

onMounted(() => {
  collapseSidebarForRecordOnTablet();
  queueContentOffsetUpdate();
  window.addEventListener('resize', handleResize, { passive: true });
});
</script>

<style scoped>
/* Component-specific styles if needed */
</style>

