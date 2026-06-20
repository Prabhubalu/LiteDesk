<template>
  <div
    :class="[
      'flex overflow-x-hidden bg-neutral-100 dark:bg-neutral-900',
      useViewportLock
        ? 'h-dvh max-h-dvh overflow-hidden'
        : 'min-h-screen lg:h-dvh lg:max-h-dvh lg:overflow-hidden'
    ]"
  >
    <!-- Sidebar Navigation -->
    <!-- ARCHITECTURE NOTE: GlobalSearch is owned by GlobalSurfacesProvider. -->
    <!-- Sidebar search click dispatches arivu:open-global-search custom event. -->
    <Nav v-model="sidebarCollapsed" />
    <OnboardingCoachmarks />
    
    <!-- Work column: floating panel on desktop (matches sidebar material) -->
    <main
      :class="[
        'flex flex-1 flex-col min-w-0 overflow-x-hidden transition-[margin-left] duration-200 ease-out',
        useViewportLock ? 'h-dvh max-h-dvh min-h-0 overflow-hidden' : 'min-h-screen lg:h-dvh lg:min-h-0 lg:overflow-hidden',
        sidebarCollapsed ? 'lg:ml-[calc(3.5rem+1rem)]' : 'lg:ml-[calc(13.75rem+1rem)]',
        'lg:box-border lg:p-2 lg:pl-0'
      ]"
    >
      <div
        :class="[
          'flex flex-1 flex-col min-h-0 min-w-0',
          'max-lg:contents',
          'lg:overflow-hidden',
          WORK_PANEL_SURFACE_CLASS
        ]"
      >
        <TabBar class="hidden md:block shrink-0" />

        <div
          :id="PLATFORM_WORKSPACE_DRAWER_HOST_ID"
          class="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div
            ref="contentWrapperRef"
            data-platform-scroll-root
            :class="[
              'box-border flex min-h-0 flex-1 flex-col overflow-x-hidden',
              useFillHeightContent ? 'relative' : '',
              useViewportLock
                ? isProcessDesignerRoute || isInboxRoute
                  ? 'min-h-0 overflow-hidden pt-16 md:pt-[7.5rem] lg:pt-0 lg:px-0 lg:pb-0 lg:bg-white lg:dark:bg-neutral-900'
                  : [
                      'min-h-0 overflow-hidden px-4 pb-4 pt-16 md:pt-[7.5rem]',
                      isSettingsRoute
                        ? 'lg:px-0 lg:pb-0 lg:pt-0 lg:bg-white lg:dark:bg-neutral-900'
                        : 'lg:px-6 lg:pb-6 lg:pt-0 lg:bg-white lg:dark:bg-neutral-900',
                    ]
                : isRecordDetailRoute
                  ? 'min-h-0 overflow-hidden pt-16 md:pt-[7.5rem] lg:pt-0 lg:bg-white lg:dark:bg-neutral-900'
                  : 'mt-16 overflow-y-auto p-4 md:mt-30 lg:mt-0 lg:overflow-y-auto lg:p-6 lg:bg-white lg:dark:bg-neutral-900'
            ]"
            :style="{ '--table-sticky-offset': tableStickyOffset }"
          >
            <EmailVerificationBanner
              v-if="!isRecordDetailRoute && !isProcessDesignerRoute && !isInboxRoute"
              class="-mx-4 mb-2 lg:-mx-6"
            />

            <div
              :class="[
                useFillHeightContent
                  ? 'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden'
                  : 'block w-full flex-none'
              ]"
            >
              <RouterView v-slot="{ Component }">
                <keep-alive :max="5">
                  <component
                    :is="Component"
                    :key="routerViewKey"
                    :class="routerViewClass"
                  />
                </keep-alive>
              </RouterView>
            </div>
          </div>
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

import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Nav from '@/components/Nav.vue';
import TabBar from '@/components/TabBar.vue';
const EmailVerificationBanner = defineAsyncComponent(() =>
  import('@/components/auth/EmailVerificationBanner.vue')
);
const OnboardingCoachmarks = defineAsyncComponent(() =>
  import('@/components/onboarding/OnboardingCoachmarks.vue')
);
import { useAppShellStore } from '@/stores/appShell';
import { useTabs } from '@/composables/useTabs';
import { useSidebarState } from '@/composables/useSidebarState';
import { PLATFORM_WORKSPACE_DRAWER_HOST_ID, WORK_PANEL_SURFACE_CLASS } from '@/utils/sidebarLayout';

const route = useRoute();
const appShellStore = useAppShellStore();

/** Avoid remounting whole views when only query params change (e.g. inbox ?thread=, settings ?module=). */
const routerViewKey = computed(() => {
  const name = typeof route.name === 'string' ? route.name : '';
  if (name === 'inbox') return route.path;
  if (name === 'platform-home') return route.fullPath;
  if (route.path.startsWith('/settings')) return route.path;
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
/** Only the Settings split-pane shell — not standalone /settings/* admin pages (processes, flows, notifications). */
const isSettingsRoute = computed(() => route.name === 'settings');
const isProcessDesignerRoute = computed(() => {
  const name = typeof route.name === 'string' ? route.name : '';
  return name === 'process-designer' || name === 'process-designer-new';
});
const useViewportLock = computed(
  () => isInboxRoute.value || isSettingsRoute.value || isProcessDesignerRoute.value
);

const isRecordDetailRoute = computed(() => {
  const routeName = typeof route.name === 'string' ? route.name : '';
  if (RECORD_DETAIL_ROUTE_NAMES.has(routeName)) return true;

  const path = route.path || '';
  return /^\/(people|deals|tasks|events|items|imports|documents|organizations|groups|responses)\/[^/]+$/.test(path)
    || /^\/forms\/[^/]+\/responses\/[^/]+$/.test(path);
});

const useFillHeightContent = computed(
  () => useViewportLock.value || isRecordDetailRoute.value
);

const routerViewClass = computed(() => {
  if (useFillHeightContent.value) {
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
  'document-detail',
  'group-detail',
  'response-detail',
  'form-response-detail',
  'helpdesk-cases-detail',
  'quote-detail',
  'sales-order-detail',
  'invoice-detail',
  'payment-detail',
]);

const collapseSidebarForRecordOnTablet = () => {
  if (window.innerWidth > TABLET_RECORD_COLLAPSE_MAX_WIDTH) return;
  if (!isRecordDetailRoute.value) return;
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

/** keep-alive tab swaps can leave the page scroll root stuck until reflow. */
const syncPageScrollContainer = () => {
  if (useFillHeightContent.value) return;

  nextTick(() => {
    requestAnimationFrame(() => {
      const el = contentWrapperRef.value;
      if (!(el instanceof HTMLElement)) return;

      updateContentOffset();

      void el.offsetHeight;
      el.scrollTop = 0;
      el.style.overflowY = 'scroll';
      void el.offsetHeight;
      el.style.overflowY = '';
      void el.offsetHeight;
    });
  });
};

watch(
  () => route.fullPath,
  () => {
    collapseSidebarForRecordOnTablet();
    queueContentOffsetUpdate();
    syncPageScrollContainer();
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
  window.addEventListener('platform-shell:sync-scroll', syncPageScrollContainer);
});

onUnmounted(() => {
  setInboxViewportLock(false);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('platform-shell:sync-scroll', syncPageScrollContainer);
});
</script>

<style scoped>
/* Component-specific styles if needed */
</style>
