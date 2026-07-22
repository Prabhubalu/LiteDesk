<template>
  <div
    :class="[
      'flex overflow-x-hidden bg-neutral-100 dark:bg-neutral-900',
      useViewportLock
        ? 'h-[calc(100dvh-var(--platform-banner-offset,0px))] max-h-[calc(100dvh-var(--platform-banner-offset,0px))] overflow-hidden'
        : 'min-h-0 h-[calc(100dvh-var(--platform-banner-offset,0px))] max-h-[calc(100dvh-var(--platform-banner-offset,0px))] overflow-hidden'
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
        useViewportLock
          ? 'h-full max-h-full min-h-0 overflow-hidden'
          : 'h-full max-h-full min-h-0 overflow-hidden',
        'lg:ml-[var(--arivu-sidebar-chrome-width,calc(3.5rem+1rem))]',
        'lg:box-border lg:py-2 lg:pl-0 lg:pr-[var(--arivu-work-panel-pad-right,0.5rem)]'
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
              useFillHeightContent
                ? 'min-h-0 overflow-hidden pt-16 md:pt-[7.5rem] lg:pt-0 lg:bg-white lg:dark:bg-neutral-900'
                : 'mt-16 overflow-y-auto md:mt-30 lg:mt-0 lg:overflow-y-auto lg:bg-white lg:dark:bg-neutral-900'
            ]"
            :style="{ '--table-sticky-offset': tableStickyOffset }"
          >
            <div
              :class="[
                useFillHeightContent
                  ? 'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden'
                  : 'block w-full flex-none p-4 lg:p-6'
              ]"
            >
              <EmailVerificationBanner
                v-if="!isRecordDetailRoute && !isProcessDesignerRoute && !isInboxRoute && !isAstraRoute && !isFormCreateRoute"
                class="mb-2"
              />

              <RouterView v-slot="{ Component }">
                <keep-alive :max="5">
                  <component
                    v-if="Component"
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

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Nav from '@/components/Nav.vue';
import TabBar from '@/components/TabBar.vue';
import EmailVerificationBanner from '@/components/auth/EmailVerificationBanner.vue';
import OnboardingCoachmarks from '@/components/onboarding/OnboardingCoachmarks.vue';
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
  if (name === 'live-chat-session' || name === 'live-chat-sessions') {
    return 'live-chat-sessions-workspace';
  }
  if (name === 'live-chat-closed-session' && route.params?.sessionId) {
    return `live-chat-closed:${String(route.params.sessionId)}`;
  }
  if (name === 'live-chat-closed') {
    return 'live-chat-closed-workspace';
  }
  if (route.path.startsWith('/live-chat/')) return route.path;
  if (route.path.startsWith('/settings')) return route.path;
  if (route.path.startsWith('/forms/create')) return 'form-create';
  const recordId = route.params?.id ?? route.params?.recordId;
  if (recordId && typeof recordId === 'string') {
    if (
      name === 'helpdesk-cases-detail' ||
      name === 'portal-case-detail' ||
      name === 'deal-detail' ||
      name === 'task-detail' ||
      name === 'form-detail'
    ) {
      return `${name}:${recordId}`;
    }
  }
  return route.fullPath;
});

const isInboxRoute = computed(() => route.name === 'inbox');
const isAstraRoute = computed(
  () => route.name === 'astra'
    || route.name === 'arivu-canvas'
    || String(route.path || '').startsWith('/astra')
);
const isLiveChatRoute = computed(() => String(route.path || '').startsWith('/live-chat/'));
const isAnnouncementsRoute = computed(() => String(route.path || '').startsWith('/announcements'));
/** Only the Settings split-pane shell — not standalone /settings/* admin pages (processes, flows, notifications). */
const isSettingsRoute = computed(() => route.name === 'settings');
const isProcessDesignerRoute = computed(() => {
  const name = typeof route.name === 'string' ? route.name : '';
  return name === 'process-designer' || name === 'process-designer-new';
});
const isFormCreateRoute = computed(() => {
  const name = typeof route.name === 'string' ? route.name : '';
  return name === 'form-create' || route.path.startsWith('/forms/create');
});
const isTemplateBuilderRoute = computed(() => route.name === 'template-builder');
const isContentStudioEditorRoute = computed(() => {
  const name = typeof route.name === 'string' ? route.name : '';
  return name === 'helpdesk-article-new'
    || name === 'helpdesk-article-edit'
    || name === 'marketing-blog-new'
    || name === 'marketing-blog-edit';
});

const useViewportLock = computed(
  () => isInboxRoute.value
    || isAstraRoute.value
    || isLiveChatRoute.value
    || isAnnouncementsRoute.value
    || isSettingsRoute.value
    || isProcessDesignerRoute.value
    || isFormCreateRoute.value
    || isTemplateBuilderRoute.value
    || isContentStudioEditorRoute.value
);

const isRecordDetailRoute = computed(() => {
  const routeName = typeof route.name === 'string' ? route.name : '';
  if (RECORD_DETAIL_ROUTE_NAMES.has(routeName)) return true;

  const path = route.path || '';
  return /^\/(people|deals|tasks|events|items|imports|documents|organizations|groups|responses)\/[^/]+$/.test(path)
    || /^\/forms\/[^/]+\/detail$/.test(path)
    || /^\/forms\/[^/]+\/responses\/[^/]+$/.test(path)
    || /^\/audit\/forms\/[^/]+\/responses\/[^/]+$/.test(path);
});

const useFillHeightContent = computed(
  () => useViewportLock.value
    || isRecordDetailRoute.value
    || route.name === 'template-detail'
    || route.name === 'platform-home'
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
const EXTRA_OFFSET_LIGHT = '0px';
const EXTRA_OFFSET_LARGE = '0px';
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
  'form-detail',
  'form-response-detail',
  'audit-form-response-detail',
  'helpdesk-cases-detail',
  'portal-case-detail',
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
