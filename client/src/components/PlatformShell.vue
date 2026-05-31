<template>
  <div
    :class="[
      'flex overflow-x-hidden bg-gray-100/70 dark:bg-gray-900',
      useViewportLock ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-screen'
    ]"
  >
    <!-- Sidebar Navigation -->
    <!-- ARCHITECTURE NOTE: GlobalSearch is owned by GlobalSurfacesProvider. -->
    <!-- Sidebar search click dispatches arivu:open-global-search custom event. -->
    <Nav v-model="sidebarCollapsed" />
    
    <!-- Main Content Area - Dynamic margin based on sidebar state -->
    <main
      :class="[
        'flex flex-1 flex-col overflow-x-hidden transition-all duration-300',
        useViewportLock ? 'h-dvh max-h-dvh min-h-0 overflow-hidden' : 'min-h-screen',
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      ]"
    >
      <!-- Tab Bar - Hidden on mobile, visible on tablet and up -->
      <TabBar class="hidden md:block" />
      
      <!-- Content wrapper with padding; min-h-0 so record pages can fill and use internal scroll -->
      <div
        ref="contentWrapperRef"
        :class="[
          'box-border flex min-h-0 flex-1 flex-col overflow-x-hidden',
          useViewportLock
            ? 'min-h-0 overflow-hidden px-4 pb-4 pt-16 md:pt-[7.5rem] lg:px-6 lg:pb-6 lg:pt-14'
            : 'mt-16 overflow-y-auto p-4 md:mt-30 lg:mt-14 lg:p-6'
        ]"
        :style="{ '--table-sticky-offset': tableStickyOffset }"
      >
        <!-- Router view for dynamic routes; flex-1 min-h-0 so full-height record pages get a defined height -->
        <div
          :class="[
            'flex min-h-0 flex-1 flex-col',
            useViewportLock ? 'h-full overflow-hidden' : ''
          ]"
        >
          <RouterView v-slot="{ Component }">
            <!-- Cap cached route trees: each slot can hold a large list/record page. -->
            <keep-alive :max="10">
              <component
                :is="Component"
                :key="routerViewKey"
                :class="routerViewClass"
              />
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

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Nav from '@/components/Nav.vue';
import TabBar from '@/components/TabBar.vue';
import { useAppShellStore } from '@/stores/appShell';
import { useTabs } from '@/composables/useTabs';
import { useSidebarState } from '@/composables/useSidebarState';

const route = useRoute();
const appShellStore = useAppShellStore();

/** Avoid remounting whole views when only query params change (e.g. inbox ?thread=). */
const routerViewKey = computed(() => {
  const name = typeof route.name === 'string' ? route.name : '';
  if (name === 'inbox') return route.path;
  const recordId = route.params?.id ?? route.params?.recordId;
  if (recordId && typeof recordId === 'string') {
    if (
      name === 'helpdesk-cases-detail' ||
      name === 'deal-detail' ||
      name === 'task-detail'
    ) {
      return `${name}:${recordId}`;
    }
  }
  return route.fullPath;
});

const isInboxRoute = computed(() => route.name === 'inbox');
const isSettingsRoute = computed(() => route.path.startsWith('/settings'));
const useViewportLock = computed(() => isInboxRoute.value || isSettingsRoute.value);

const routerViewClass = computed(() => {
  if (useViewportLock.value) {
    return 'flex min-h-0 flex-1 flex-col overflow-hidden h-full';
  }
  return '';
});

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

function setInboxViewportLock(active) {
  document.documentElement.classList.toggle('overflow-hidden', active);
  document.body.classList.toggle('overflow-hidden', active);
}

watch(
  useViewportLock,
  (active) => {
    setInboxViewportLock(active);
  },
  { immediate: true }
);

onMounted(() => {
  collapseSidebarForRecordOnTablet();
  queueContentOffsetUpdate();
  window.addEventListener('resize', handleResize, { passive: true });
});

onUnmounted(() => {
  setInboxViewportLock(false);
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
/* Component-specific styles if needed */
</style>

