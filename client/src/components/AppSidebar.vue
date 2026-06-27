<template>
  <nav
    class="sidebar-nav sidebar-nav--brand flex grow flex-col h-full overflow-hidden bg-primary-800 dark:bg-neutral-950"
    :style="portalSidebarStyle"
    :class="[
      // Compact, stable widths: expanded 220px, collapsed 56px at a 16px root.
      collapsed ? 'w-[3.5rem]' : 'w-[13.75rem]',
      collapsed ? 'sidebar-nav--collapsed' : 'sidebar-nav--expanded',
      'transition-[width] duration-200 ease-out',
    ]"
  >
    <!-- Header: compact logo + collapse control; icon logo centered when collapsed. -->
    <div
      class="relative h-[2.75rem] border-b border-white/20 dark:border-neutral-800/80 dark:bg-primary-900/30 flex-shrink-0 flex items-center"
      :class="collapsed ? 'justify-center px-0' : 'justify-between pl-[0.875rem] pr-[0.5rem] gap-[0.5rem]'"
    >
      <div
        class="flex items-center min-w-0"
        :class="collapsed ? 'h-[1.75rem] w-[1.75rem] justify-center rounded-lg bg-white/10 dark:bg-neutral-800/50 p-1' : 'h-[1.875rem] flex-1'"
      >
        <img
          :src="sidebarLogoUrl"
          alt=""
          class="h-full w-full object-contain"
          :class="collapsed ? '' : 'object-left max-w-full'"
        />
      </div>
      <button
        v-if="!collapsed"
        type="button"
        @click.stop.prevent="onToggleCollapse?.()"
        class="flex-shrink-0 w-[1rem] h-[1rem] rounded-[0.5rem] flex items-center justify-center hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
        :title="t('navigation.collapseSidebar')"
      >
        <span class="w-full h-full flex items-center justify-center">
          <FigmaSidebarIcon class="w-full h-full" :fill="iconColors.secondary" />
        </span>
      </button>
    </div>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <!-- Search (28px ÷ 12 = 2.333rem height) -->
      <div v-if="searchSurface" class="px-[0.5rem] pt-[0.5rem] pb-[0.5rem]">
      <button
        type="button"
        data-onboarding-target="command_palette"
        @click="handleNavClick(searchSurface.route, searchSurface, $event, { icon: searchSurface.icon })"
        class="sidebar-search-control w-full h-[1.75rem] ring-1 ring-white/20 dark:ring-neutral-700 rounded-[0.5rem] flex items-center justify-start transition-colors hover:ring-white/40 dark:hover:ring-neutral-600 bg-white/10 dark:bg-neutral-800/60 px-[0.5rem] py-[0.25rem]"
        :class="collapsed ? 'justify-center' : 'gap-[0.5rem]'"
        :title="collapsed ? t('actions.search') : ''"
      >
        <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
          <FigmaSearchIcon class="w-full h-full" :fill="iconColors.secondary" />
        </span>
        <span v-if="!collapsed" class="text-[0.875rem] text-white/60 dark:text-neutral-500 flex-1 min-w-0 truncate text-left">{{ t('common.searchPlaceholder') }}</span>
        <kbd
          v-if="!collapsed"
          class="hidden sm:inline-flex items-center text-[0.75rem] font-medium text-white/70 dark:text-neutral-500"
        >{{ searchShortcutLabel }}</kbd>
      </button>
    </div>

    <!-- Shell list -->
    <div class="px-[0.5rem]">
      <div class="flex flex-col gap-[0.25rem]">
        <a
          v-for="item in shellNavItems"
          :key="item.id"
          :href="item.route"
          @click.prevent="handleNavClick(item.route, item, $event, { icon: item.icon })"
          @auxclick.prevent="handleNavClick(item.route, item, $event, { icon: item.icon })"
          class="sidebar-nav-item w-full h-[1.75rem] rounded-[0.5rem] px-[0.5rem] gap-[0.5rem] py-[0.25rem] flex items-center justify-start"
          :class="navItemStateClasses(item.route)"
          :title="collapsed ? navLabel(item) : ''"
        >
          <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
            <component
              :is="getFigmaNavIcon(item)"
              class="w-full h-full"
              :fill="navIconFill(item.route)"
            />
          </span>
          <span
            v-if="!collapsed"
            class="text-[0.875rem] flex-1 min-w-0 truncate"
            :class="navLabelClasses(item.route)"
          >
            {{ navLabel(item) }}
          </span>
        </a>

        <!-- Divider above Core Modules -->
        <div
          v-if="sidebarStructure.coreModules.length > 0"
          class="mt-[0.75rem] h-px bg-white/20 dark:bg-neutral-800"
        />

        <!-- Core Modules Section -->
        <div
          v-if="sidebarStructure.coreModules.length > 0"
          class="w-full"
        >
          <!-- Core header: single button for both sidebar widths so the chevron doesn’t remount (avoids toggle jitter) -->
          <button
            type="button"
            @click="toggleCoreModules"
            class="sidebar-nav-item w-full h-[1.75rem] rounded-[0.5rem] py-[0.25rem] px-[0.5rem] gap-[0.5rem] flex items-center justify-start flex-shrink-0 hover:bg-white/10 dark:hover:bg-white/5"
            :title="t('navigation.coreModules')"
          >
            <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
              <FigmaChevronDown
                class="w-full h-full transition-transform"
                :class="{ 'rotate-180': !coreModulesCollapsed }"
                :fill="iconColors.secondary"
              />
            </span>
            <span
              v-if="!collapsed"
              class="text-[0.75rem] font-medium uppercase tracking-wider text-white/60 dark:text-neutral-500 flex-1 min-w-0 text-left"
            >
              {{ t('navigation.coreSection') }}
            </span>
          </button>

          <!-- Core Modules List (shown when expanded and not collapsed) -->
          <div
            v-if="!collapsed"
            class="overflow-hidden"
            :style="{ 
              maxHeight: !coreModulesCollapsed ? '500px' : '0',
              transition: 'max-height 0.2s ease-out, opacity 0.2s ease-out',
              opacity: !coreModulesCollapsed ? 1 : 0
            }"
          >
            <div
              v-if="!coreModulesCollapsed"
              class="mt-[0.25rem] flex flex-col gap-[0.25rem]"
            >
              <a
                v-for="item in sidebarStructure.coreModules"
                :key="item.id"
                :href="item.route"
                @click.prevent="handleNavClick(item.route, item, $event, { icon: item.icon })"
                @auxclick.prevent="handleNavClick(item.route, item, $event, { icon: item.icon })"
                class="sidebar-nav-item w-full h-[1.75rem] rounded-[0.5rem] py-[0.25rem] flex items-center px-[0.5rem] gap-[0.5rem]"
                :class="navItemStateClasses(item.route)"
                :title="navLabel(item)"
              >
                <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
                  <component
                    :is="getFigmaNavIcon(item)"
                    class="w-full h-full"
                    :fill="navIconFill(item.route)"
                  />
                </span>
                <span
                  class="text-[0.875rem] flex-1 min-w-0 truncate"
                  :class="navLabelClasses(item.route)"
                >
                  {{ navLabel(item) }}
                </span>
              </a>
            </div>
          </div>

          <!-- Core Modules Icons Only (sidebar collapsed AND Core subsection open); mt matches expanded list wrapper -->
          <div
            v-if="collapsed && !coreModulesCollapsed"
            class="mt-[0.25rem] flex flex-col gap-[0.25rem]"
          >
            <a
              v-for="item in sidebarStructure.coreModules"
              :key="item.id"
              :href="item.route"
              @click.prevent="handleNavClick(item.route, item, $event, { icon: item.icon })"
              @auxclick.prevent="handleNavClick(item.route, item, $event, { icon: item.icon })"
              class="sidebar-nav-item w-full h-[1.75rem] rounded-[0.5rem] px-[0.5rem] py-[0.25rem] flex items-center justify-start"
              :class="navItemStateClasses(item.route)"
              :title="navLabel(item)"
            >
              <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
                <component
                  :is="getFigmaNavIcon(item)"
                  class="w-full h-full"
                  :fill="navIconFill(item.route)"
                />
              </span>
            </a>
          </div>
        </div>
      </div>

      <!-- Divider between shell/core and app navigation (skip when shell section is empty) -->
      <div
        v-if="shellNavItems.length > 0 || sidebarStructure.coreModules.length > 0"
        class="mt-[0.75rem] h-px bg-white/20 dark:bg-neutral-800"
      />
    </div>

    <!-- App switcher + app navigation -->
    <div class="px-[0.5rem] pt-[0.75rem] flex flex-col gap-[0.25rem]">
      <!-- App switcher: only when user has more than one entitled app (no pointless dropdown) -->
      <div
        v-if="sidebarStructure.appSwitcher.apps.length > 1"
        ref="appSwitcherDropdownRef"
        v-click-outside="closeAppSwitcherDropdown"
        class="relative w-full"
      >
        <div
          @click="toggleAppSwitcherDropdown"
          class="sidebar-app-switcher-control w-full h-[1.75rem] bg-white/10 dark:bg-neutral-800/60 ring-1 ring-white/20 dark:ring-neutral-700 rounded-[0.333rem] flex items-center justify-start cursor-pointer transition-colors hover:ring-white/40 dark:hover:ring-neutral-600 px-[0.5rem] py-[0.25rem]"
          :class="collapsed ? 'justify-center' : 'gap-[0.5rem]'"
        >
          <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
            <component
              :is="getAppIcon(activeApp || { id: 'SALES', name: 'Sales', dashboardRoute: '/dashboard/sales' })"
              class="w-full h-full"
              :fill="iconColors.primary"
            />
          </span>
          <div v-if="!collapsed" class="flex items-center gap-[0.25rem] flex-1 min-w-0">
            <span class="text-[0.875rem] font-medium text-white dark:text-neutral-200 truncate">
              {{ activeApp ? appDisplayName(activeApp) : t('navigation.salesAppFallback') }}
            </span>
            <span class="w-[0.833rem] h-[0.833rem] flex-shrink-0 flex items-center justify-center transition-transform" :class="{ 'rotate-180': showAppSwitcherDropdown }">
              <FigmaChevronDown class="w-full h-full" :fill="iconColors.chevron" />
            </span>
          </div>
        </div>

        <!-- App Switcher Dropdown Menu -->
        <Transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="showAppSwitcherDropdown && !collapsed"
            class="absolute left-0 top-[calc(100%+0.25rem)] w-full rounded-[0.333rem] ring-1 ring-white/20 dark:ring-neutral-700 bg-primary-900 dark:bg-neutral-900 shadow-xl py-[0.25rem] z-50 max-h-[10rem] overflow-y-auto"
          >
            <button
              v-for="app in sidebarStructure.appSwitcher.apps"
              :key="app.id"
              @click="handleAppSelect(app.id)"
              :class="[
                'sidebar-nav-item w-full h-[1.75rem] rounded-[0.333rem] flex items-center gap-[0.5rem] text-[0.875rem] text-left transition-colors',
                sidebarStructure.appSwitcher.activeAppId === app.id ? 'sidebar-nav-item--active' : ''
              ]"
            >
              <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
                <component
                  :is="getAppIcon(app)"
                  class="w-full h-full"
                  :fill="sidebarStructure.appSwitcher.activeAppId === app.id ? iconColors.active : iconColors.primary"
                />
              </span>
              <span
                class="truncate flex-1 min-w-0"
                :class="sidebarStructure.appSwitcher.activeAppId === app.id
                  ? 'text-white font-medium'
                  : 'text-white/90 dark:text-neutral-400'"
              >
                {{ appDisplayName(app) }}
              </span>
            </button>
          </div>
        </Transition>
      </div>

      <!-- App navigation -->
      <div
        class="flex flex-col gap-[0.25rem]"
        :class="sidebarStructure.appSwitcher.apps.length > 1 ? 'mt-[0.5rem]' : ''"
      >
        <a
          v-if="sidebarStructure.appNav.dashboard"
          :href="sidebarStructure.appNav.dashboard.route"
          @click.prevent="handleNavClick(sidebarStructure.appNav.dashboard.route, sidebarStructure.appNav.dashboard, $event, { isAppContext: true, icon: sidebarStructure.appNav.dashboard.icon })"
          @auxclick.prevent="handleNavClick(sidebarStructure.appNav.dashboard.route, sidebarStructure.appNav.dashboard, $event, { isAppContext: true, icon: sidebarStructure.appNav.dashboard.icon })"
          class="sidebar-nav-item w-full h-[1.75rem] rounded-[0.5rem] px-[0.5rem] gap-[0.5rem] py-[0.25rem] flex items-center justify-start"
          :class="navItemStateClasses(sidebarStructure.appNav.dashboard.route)"
          :title="collapsed ? navLabel(sidebarStructure.appNav.dashboard) : ''"
        >
          <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
            <component
              :is="getFigmaNavIcon(sidebarStructure.appNav.dashboard)"
              class="w-full h-full"
              :fill="navIconFill(sidebarStructure.appNav.dashboard.route)"
            />
          </span>
          <span
            v-if="!collapsed"
            class="text-[0.875rem] flex-1 min-w-0 truncate"
            :class="navLabelClasses(sidebarStructure.appNav.dashboard.route)"
          >
            {{ navLabel(sidebarStructure.appNav.dashboard) }}
          </span>
        </a>

        <a
          v-for="module in sidebarStructure.appNav.modules"
          :key="module.id"
          :href="module.route"
          @click.prevent="handleNavClick(module.route, module, $event, { isAppContext: true, icon: module.icon })"
          @auxclick.prevent="handleNavClick(module.route, module, $event, { isAppContext: true, icon: module.icon })"
          class="sidebar-nav-item w-full h-[1.75rem] rounded-[0.5rem] px-[0.5rem] gap-[0.5rem] py-[0.25rem] flex items-center justify-start"
          :class="navItemStateClasses(module.route)"
          :title="collapsed ? navLabel(module) : ''"
        >
          <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
            <component :is="getFigmaNavIcon(module)" class="w-full h-full" :fill="navIconFill(module.route)" />
          </span>
          <span
            v-if="!collapsed"
            class="text-[0.875rem] flex-1 min-w-0 truncate"
            :class="navLabelClasses(module.route)"
          >
            {{ navLabel(module) }}
          </span>
        </a>
      </div>
    </div>
    </div>

    <!-- Footer: Help only (logo moved to header) -->
    <div v-if="!collapsed" class="flex-shrink-0 border-t border-white/20 dark:border-neutral-800">
      <div class="relative h-[2.75rem] flex items-center px-[0.875rem]">
        <button
          type="button"
          class="h-[1.75rem] rounded-[0.5rem] p-[0.25rem] flex items-center gap-[0.25rem] hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
        >
          <span class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center">
            <FigmaInfoIcon class="w-full h-full" :fill="iconColors.primary" />
          </span>
          <span class="text-[0.875rem] text-white/90 dark:text-neutral-400">{{ t('navigation.help') }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
// This component renders the locked SidebarStructure.
// Do not add new sidebar sections without updating sidebar-invariants.md
/**
 * ============================================================================
 * PLATFORM SIDEBAR: Main Component
 * ============================================================================
 * 
 * Renders the locked `SidebarStructure` contract directly.
 *
 * Invariant:
 * "Sidebar renders platform surfaces, core modules, app lenses, and governance — never raw entities."
 *
 * Strict order:
 * shell → coreModules → appSwitcher → appNav → platform
 * 
 * ============================================================================
 */

import { computed, h, ref, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useColorMode } from '@/composables/useColorMode';

const { t, te } = useI18n(); // te used by appDisplayName
const { effectiveDark } = useColorMode();

function navLabel(item: { labelKey?: string; label?: string }) {
  return resolveSidebarItemLabel(item, t);
}

function appDisplayName(app: AppSummary) {
  if (app.nameKey && te(app.nameKey)) return t(app.nameKey);
  return app.name;
}
import { useRoute, useRouter } from 'vue-router';
import { useSidebarState } from '@/composables/useSidebarState';
import { usePortalBranding, PORTAL_DEFAULT_PRIMARY_COLOR } from '@/composables/usePortalBranding';
import type { SidebarStructure, AppSummary } from '@/types/sidebar.types';
import { useTabs } from '@/composables/useTabs';
import clickOutside from '@/directives/clickOutside';
import logoWordmarkLightUrl from '/assets/logo/Logo_word_light.svg';
import logoLightUrl from '/assets/logo/Logo_light.svg';
import {
  BanknotesIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  LifebuoyIcon,
  PresentationChartLineIcon,
  ShieldCheckIcon,
} from '@heroicons/vue/24/outline';
import { getIconComponent, getNavigationIconComponent } from '@/utils/navigationIcons';
import { resolveSidebarItemLabel } from '@/utils/navigationLabels';

// Props
const props = defineProps<{
  sidebarStructure: SidebarStructure;
  collapsed?: boolean;
  embedded?: boolean;
  onToggleCollapse?: () => void;
}>();

// Router
const route = useRoute();
const router = useRouter();
const { branding, loadBranding } = usePortalBranding();
const isPortalRoute = computed(() => route.path.startsWith('/portal/'));
const { openTab } = useTabs();

// Sidebar state management
const { lastActiveAppId, coreModulesCollapsed } = useSidebarState();

// App switcher dropdown state
const showAppSwitcherDropdown = ref(false);
const appSwitcherDropdownRef = ref<HTMLElement | null>(null);

// Logo in sidebar header: mark when expanded, glyph when collapsed (matches `html.dark`, including system + OS dark)
const sidebarLogoUrl = computed(() => {
  if (isPortalRoute.value && branding.value?.logoUrl) {
    return branding.value.logoUrl;
  }
  if (props.collapsed) {
    return logoLightUrl;
  }
  return logoWordmarkLightUrl;
});

const portalSidebarStyle = computed(() => {
  if (!isPortalRoute.value) return undefined;
  return { backgroundColor: branding.value?.primaryColor || PORTAL_DEFAULT_PRIMARY_COLOR };
});

watch(isPortalRoute, (active) => {
  if (active) {
    void loadBranding();
  }
}, { immediate: true });

// Icon fills — light: brand primary-800 surface; dark: neutral shell with primary active accent
const iconColors = computed(() => {
  if (effectiveDark.value) {
    return {
      primary: 'rgba(255, 255, 255, 0.72)',
      secondary: 'rgba(255, 255, 255, 0.52)',
      tertiary: 'rgba(255, 255, 255, 0.36)',
      active: '#a78bfa',
      chevron: 'rgba(255, 255, 255, 0.52)',
    };
  }
  return {
    primary: 'rgba(255, 255, 255, 0.88)',
    secondary: 'rgba(255, 255, 255, 0.68)',
    tertiary: 'rgba(255, 255, 255, 0.48)',
    active: '#ffffff',
    chevron: 'rgba(255, 255, 255, 0.68)',
  };
});

const searchShortcutLabel = computed(() => {
  if (typeof navigator === 'undefined') return '⌘K';
  return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl+K';
});

function navItemStateClasses(routePath: string): string {
  if (!isActiveRoute(routePath)) return '';
  return 'sidebar-nav-item--active';
}

function navLabelClasses(routePath: string): string {
  return isActiveRoute(routePath)
    ? 'text-white dark:text-white'
    : 'text-white/90 dark:text-neutral-400';
}

function navIconFill(_routePath: string): string {
  return iconColors.value.primary;
}

// Toggle app switcher dropdown
const toggleAppSwitcherDropdown = () => {
  showAppSwitcherDropdown.value = !showAppSwitcherDropdown.value;
};

// Close app switcher dropdown
const closeAppSwitcherDropdown = () => {
  showAppSwitcherDropdown.value = false;
};

// Toggle Core Modules section
const toggleCoreModules = () => {
  coreModulesCollapsed.value = !coreModulesCollapsed.value;
};

// Handle app selection
const handleAppSelect = (appId: string) => {
  switchAppLens(appId);
  closeAppSwitcherDropdown();
};

const vClickOutside = clickOutside;

/**
 * Figma icon helpers (node 5342:2703 subtree).
 * Each icon accepts a `fill` prop (hex string), matching the Figma fills exactly.
 * Icons are responsive and properly constrained to prevent overflow.
 */
function defineFigmaIcon(viewBox: string, d: string) {
  return {
    name: 'FigmaIcon',
    props: { 
      fill: { type: String, default: '#070922' },
      class: { type: String, default: '' }
    },
    setup(props: { fill: string; class?: string }) {
      return () =>
        h('svg', { 
          viewBox, 
          fill: 'none', 
          xmlns: 'http://www.w3.org/2000/svg',
          width: '100%',
          height: '100%',
          preserveAspectRatio: 'xMidYMid meet',
          style: {
            display: 'block',
            flexShrink: 0,
          },
          class: props.class
        }, [
          h('path', { d, fill: props.fill }),
        ]);
    },
  };
}

const FigmaChevronDown = defineFigmaIcon(
  '0 0 6.49844 3.49844',
  'M3.42578 3.42578C3.32891 3.52266 3.16953 3.52266 3.07266 3.42578L0.0726563 0.425781C-0.0242188 0.328906 -0.0242188 0.169531 0.0726563 0.0726563C0.169531 -0.0242188 0.328906 -0.0242188 0.425781 0.0726563L3.24922 2.89609L6.07266 0.0726563C6.16953 -0.0242188 6.32891 -0.0242188 6.42578 0.0726563C6.52266 0.169531 6.52266 0.328906 6.42578 0.425781L3.42578 3.42578Z'
);

const FigmaSearchIcon = defineFigmaIcon(
  '0 0 12.7987 12.7987',
  'M9.6 5.2C9.6 4.62218 9.48619 4.05003 9.26507 3.51619C9.04395 2.98236 8.71985 2.49731 8.31127 2.08873C7.90269 1.68015 7.41764 1.35605 6.88381 1.13493C6.34997 0.913809 5.77782 0.8 5.2 0.8C4.62218 0.8 4.05003 0.913809 3.51619 1.13493C2.98236 1.35605 2.49731 1.68015 2.08873 2.08873C1.68015 2.49731 1.35605 2.98236 1.13493 3.51619C0.913809 4.05003 0.8 4.62218 0.8 5.2C0.8 5.77782 0.913809 6.34997 1.13493 6.88381C1.35605 7.41764 1.68015 7.90269 2.08873 8.31127C2.49731 8.71985 2.98236 9.04395 3.51619 9.26507C4.05003 9.48619 4.62218 9.6 5.2 9.6C5.77782 9.6 6.34997 9.48619 6.88381 9.26507C7.41764 9.04395 7.90269 8.71985 8.31127 8.31127C8.71985 7.90269 9.04395 7.41764 9.26507 6.88381C9.48619 6.34997 9.6 5.77782 9.6 5.2ZM8.5825 9.15C7.675 9.93 6.4925 10.4 5.2 10.4C2.3275 10.4 0 8.0725 0 5.2C0 2.3275 2.3275 0 5.2 0C8.0725 0 10.4 2.3275 10.4 5.2C10.4 6.4925 9.93 7.675 9.15 8.5825L12.6825 12.1175C12.8375 12.2725 12.8375 12.5275 12.6825 12.6825C12.5275 12.8375 12.2725 12.8375 12.1175 12.6825L8.5825 9.15Z'
);

const FigmaHomeIcon = defineFigmaIcon(
  '0 0 14.401 12.7994',
  'M7.46551 0.099375C7.31551 -0.033125 7.08801 -0.033125 6.93551 0.099375L0.135513 6.09937C-0.0294869 6.24437 -0.0469869 6.49937 0.100513 6.66437C0.248013 6.82937 0.500513 6.84687 0.665513 6.69937L1.60051 5.87437V10.7994C1.60051 11.9044 2.49551 12.7994 3.60051 12.7994H10.8005C11.9055 12.7994 12.8005 11.9044 12.8005 10.7994V5.87437L13.7355 6.69937C13.9005 6.84437 14.153 6.82937 14.3005 6.66437C14.448 6.49937 14.4305 6.24687 14.2655 6.09937L7.46551 0.099375ZM2.40051 10.7994V5.16687L7.20051 0.931875L12.0005 5.16687V10.7994C12.0005 11.4619 11.463 11.9994 10.8005 11.9994H9.20051V7.99937C9.20051 7.55687 8.84301 7.19937 8.40051 7.19937H6.00051C5.55801 7.19937 5.20051 7.55687 5.20051 7.99937V11.9994H3.60051C2.93801 11.9994 2.40051 11.4619 2.40051 10.7994ZM6.00051 11.9994V7.99937H8.40051V11.9994H6.00051Z'
);

const FigmaInboxIcon = defineFigmaIcon(
  '0 0 12.8 11.2',
  'M0.8 9.6V7.3975C0.8 7.3325 0.8075 7.2675 0.825 7.2025V7.2H3.3525L3.9325 8.3575C4.0675 8.6275 4.345 8.8 4.6475 8.8H8.1525C8.455 8.8 8.7325 8.63 8.8675 8.3575L9.4475 7.2H11.975V7.2025C11.99 7.265 12 7.33 12 7.3975V9.6C12 10.0425 11.6425 10.4 11.2 10.4H1.6C1.1575 10.4 0.8 10.0425 0.8 9.6ZM11.775 6.4H9.4475C9.145 6.4 8.8675 6.57 8.7325 6.8425L8.1525 8H4.6475L4.0675 6.8425C3.9325 6.5725 3.655 6.4 3.3525 6.4H1.025L2.2725 1.405C2.3625 1.05 2.6825 0.8 3.05 0.8H9.75C10.1175 0.8 10.4375 1.05 10.525 1.405L11.775 6.4ZM0 7.3975V9.6C0 10.4825 0.7175 11.2 1.6 11.2H11.2C12.0825 11.2 12.8 10.4825 12.8 9.6V7.3975C12.8 7.2675 12.785 7.1375 12.7525 7.01L11.3025 1.2125C11.125 0.5 10.485 0 9.75 0H3.05C2.315 0 1.675 0.5 1.4975 1.2125L0.0475 7.01C0.015 7.135 0 7.265 0 7.3975Z'
);

const FigmaPeopleIcon = defineFigmaIcon(
  '0 0 11.2 12.8',
  'M5.6 0.8C5.91517 0.8 6.22726 0.862078 6.51844 0.982689C6.80962 1.1033 7.0742 1.28008 7.29706 1.50294C7.51992 1.7258 7.6967 1.99038 7.81731 2.28156C7.93792 2.57274 8 2.88483 8 3.2C8 3.51517 7.93792 3.82726 7.81731 4.11844C7.6967 4.40962 7.51992 4.67419 7.29706 4.89706C7.0742 5.11992 6.80962 5.2967 6.51844 5.41731C6.22726 5.53792 5.91517 5.6 5.6 5.6C5.28483 5.6 4.97274 5.53792 4.68156 5.41731C4.39038 5.2967 4.1258 5.11992 3.90294 4.89706C3.68008 4.67419 3.5033 4.40962 3.38269 4.11844C3.26208 3.82726 3.2 3.51517 3.2 3.2C3.2 2.88483 3.26208 2.57274 3.38269 2.28156C3.5033 1.99038 3.68008 1.7258 3.90294 1.50294C4.1258 1.28008 4.39038 1.1033 4.68156 0.982689C4.97274 0.862078 5.28483 0.8 5.6 0.8ZM2.4 3.2C2.4 4.04869 2.73714 4.86262 3.33726 5.46274C3.93737 6.06286 4.75131 6.4 5.6 6.4C6.44869 6.4 7.26263 6.06286 7.86274 5.46274C8.46286 4.86262 8.8 4.04869 8.8 3.2C8.8 2.35131 8.46286 1.53737 7.86274 0.937258C7.26263 0.337142 6.44869 0 5.6 0C4.75131 0 3.93737 0.337142 3.33726 0.937258C2.73714 1.53737 2.4 2.35131 2.4 3.2ZM4.8 7.6C4.58 7.6 4.4 7.78 4.4 8C4.4 8.22 4.58 8.4 4.8 8.4H5.045L4.5025 10.025L3.7 8.2875C3.6275 8.13 3.4625 8.0375 3.2925 8.0675C1.42 8.4125 0 10.0575 0 12.0325C0 12.4575 0.345 12.8 0.7675 12.8H10.4325C10.8575 12.8 11.2 12.455 11.2 12.0325C11.2 10.0575 9.78 8.415 7.905 8.0675C7.735 8.035 7.57 8.13 7.4975 8.2875L6.6975 10.025L6.155 8.4H6.4C6.62 8.4 6.8 8.22 6.8 8C6.8 7.78 6.62 7.6 6.4 7.6H5.6H4.8ZM5.2375 11.6125L4.995 11.085L5.6 9.265L6.2075 11.085L5.965 11.6125C5.8225 11.9225 5.3825 11.9225 5.2375 11.6125ZM4.51 11.9475C4.5175 11.965 4.5275 11.9825 4.535 12H0.8C0.815 10.5475 1.7875 9.3225 3.1175 8.93L4.51 11.9475ZM10.4 12H6.665C6.6725 11.9825 6.6825 11.965 6.69 11.9475L8.0825 8.93C9.4125 9.3225 10.385 10.545 10.4 12Z'
);

const FigmaSackDollarIcon = defineFigmaIcon(
  '0 0 12.8 12.8',
  'M5.0375 3.6H7.7625L7.895 3.685C9.265 4.5625 12 6.7075 12 10.4C12 11.2825 11.2825 12 10.4 12H2.4C1.5175 12 0.8 11.2825 0.8 10.4C0.8 6.7075 3.535 4.5625 4.9075 3.685L5.04 3.6H5.0375ZM7.4975 2.8H5.3025L5.135 2.555L3.9225 0.8H8.8775L7.6675 2.555L7.5 2.8H7.4975ZM3.815 3.4625C2.28 4.5925 0 6.835 0 10.4C0 11.725 1.075 12.8 2.4 12.8H10.4C11.725 12.8 12.8 11.725 12.8 10.4C12.8 6.835 10.52 4.5925 8.985 3.4625C8.7425 3.285 8.52 3.1325 8.325 3.01L8.78 2.35L9.7525 0.94C10.025 0.5425 9.74 0 9.2575 0H3.5425C3.06 0 2.775 0.5425 3.0475 0.94L4.02 2.35L4.475 3.01C4.2825 3.1325 4.0575 3.285 3.815 3.4625ZM6.8 5.4C6.8 5.18 6.62 5 6.4 5C6.18 5 6 5.18 6 5.4V5.8325C5.7925 5.87 5.5825 5.94 5.3975 6.05C5.0725 6.2425 4.8 6.5775 4.8025 7.0625C4.805 7.5225 5.0725 7.815 5.37 7.995C5.6325 8.1525 5.965 8.255 6.24 8.3375L6.28 8.35C6.5925 8.445 6.835 8.5225 7.005 8.63C7.1525 8.7225 7.1975 8.805 7.1975 8.92C7.2 9.085 7.13 9.19 7.0025 9.27C6.8575 9.36 6.64 9.41 6.41 9.4025C6.115 9.3925 5.8425 9.3 5.5025 9.185C5.445 9.165 5.385 9.145 5.325 9.125C5.115 9.055 4.89 9.1675 4.82 9.3775C4.75 9.5875 4.8625 9.8125 5.0725 9.8825C5.1225 9.9 5.175 9.9175 5.2275 9.935C5.4575 10.015 5.72 10.105 6 10.1575V10.6C6 10.82 6.18 11 6.4 11C6.62 11 6.8 10.82 6.8 10.6V10.1725C7.0175 10.1375 7.235 10.065 7.4275 9.945C7.76 9.7375 8.0075 9.39 8 8.905C7.995 8.4425 7.735 8.14 7.4325 7.95C7.1575 7.7775 6.8075 7.67 6.525 7.585L6.5125 7.5825C6.1975 7.4875 5.955 7.4125 5.7825 7.31C5.6325 7.22 5.6025 7.15 5.6 7.0575C5.6 6.9225 5.66 6.8225 5.8025 6.7375C5.9575 6.645 6.18 6.595 6.3925 6.6C6.645 6.605 6.9175 6.6575 7.195 6.7325C7.4075 6.79 7.6275 6.6625 7.685 6.45C7.7425 6.2375 7.615 6.0175 7.4025 5.96C7.215 5.91 7.0125 5.8625 6.8 5.8325V5.4Z'
);

const FigmaGridIcon = defineFigmaIcon(
  '0 0 11.2 11.2',
  'M1.2 0.8C0.98 0.8 0.8 0.98 0.8 1.2V3.6C0.8 3.82 0.98 4 1.2 4H3.6C3.82 4 4 3.82 4 3.6V1.2C4 0.98 3.82 0.8 3.6 0.8H1.2ZM0 1.2C0 0.5375 0.5375 0 1.2 0H3.6C4.2625 0 4.8 0.5375 4.8 1.2V3.6C4.8 4.2625 4.2625 4.8 3.6 4.8H1.2C0.5375 4.8 0 4.2625 0 3.6V1.2ZM1.2 7.2C0.98 7.2 0.8 7.38 0.8 7.6V10C0.8 10.22 0.98 10.4 1.2 10.4H3.6C3.82 10.4 4 10.22 4 10V7.6C4 7.38 3.82 7.2 3.6 7.2H1.2ZM0 7.6C0 6.9375 0.5375 6.4 1.2 6.4H3.6C4.2625 6.4 4.8 6.9375 4.8 7.6V10C4.8 10.6625 4.2625 11.2 3.6 11.2H1.2C0.5375 11.2 0 10.6625 0 10V7.6ZM10 0.8H7.6C7.38 0.8 7.2 0.98 7.2 1.2V3.6C7.2 3.82 7.38 4 7.6 4H10C10.22 4 10.4 3.82 10.4 3.6V1.2C10.4 0.98 10.22 0.8 10 0.8ZM7.6 0H10C10.6625 0 11.2 0.5375 11.2 1.2V3.6C11.2 4.2625 10.6625 4.8 10 4.8H7.6C6.9375 4.8 6.4 4.2625 6.4 3.6V1.2C6.4 0.5375 6.9375 0 7.6 0ZM7.6 7.2C7.38 7.2 7.2 7.38 7.2 7.6V10C7.2 10.22 7.38 10.4 7.6 10.4H10C10.22 10.4 10.4 10.22 10.4 10V7.6C10.4 7.38 10.22 7.2 10 7.2H7.6ZM6.4 7.6C6.4 6.9375 6.9375 6.4 7.6 6.4H10C10.6625 6.4 11.2 6.9375 11.2 7.6V10C11.2 10.6625 10.6625 11.2 10 11.2H7.6C6.9375 11.2 6.4 10.6625 6.4 10V7.6Z'
);

const FigmaBriefcaseIcon = defineFigmaIcon(
  '0 0 12.8 12',
  'M4 1.2V2.4H8.8V1.2C8.8 0.98 8.62 0.8 8.4 0.8H4.4C4.18 0.8 4 0.98 4 1.2ZM3.2 2.4V1.2C3.2 0.5375 3.7375 0 4.4 0H8.4C9.0625 0 9.6 0.5375 9.6 1.2V2.4H11.2C12.0825 2.4 12.8 3.1175 12.8 4V10.4C12.8 11.2825 12.0825 12 11.2 12H1.6C0.7175 12 0 11.2825 0 10.4V4C0 3.1175 0.7175 2.4 1.6 2.4H3.2ZM9.2 3.2H3.6H1.6C1.1575 3.2 0.8 3.5575 0.8 4V6.4H4.4H5.2H7.6H8.4H12V4C12 3.5575 11.6425 3.2 11.2 3.2H9.2ZM12 7.2H8.4V8.4C8.4 8.8425 8.0425 9.2 7.6 9.2H5.2C4.7575 9.2 4.4 8.8425 4.4 8.4V7.2H0.8V10.4C0.8 10.8425 1.1575 11.2 1.6 11.2H11.2C11.6425 11.2 12 10.8425 12 10.4V7.2ZM5.2 7.2V8.4H7.6V7.2H5.2Z'
);

const FigmaSidebarIcon = defineFigmaIcon(
  '0 0 11.2 9.8',
  'M9.8 0.7C10.1872 0.7 10.5 1.01281 10.5 1.4V8.4C10.5 8.78719 10.1872 9.1 9.8 9.1H4.9V0.7H9.8ZM1.4 0.7H4.2V9.1H1.4C1.01281 9.1 0.7 8.78719 0.7 8.4V1.4C0.7 1.01281 1.01281 0.7 1.4 0.7ZM1.4 0C0.627812 0 0 0.627813 0 1.4V8.4C0 9.17219 0.627812 9.8 1.4 9.8H9.8C10.5722 9.8 11.2 9.17219 11.2 8.4V1.4C11.2 0.627813 10.5722 0 9.8 0H1.4ZM1.75 1.4C1.5575 1.4 1.4 1.5575 1.4 1.75C1.4 1.9425 1.5575 2.1 1.75 2.1H3.15C3.3425 2.1 3.5 1.9425 3.5 1.75C3.5 1.5575 3.3425 1.4 3.15 1.4H1.75ZM1.4 3.15C1.4 3.3425 1.5575 3.5 1.75 3.5H3.15C3.3425 3.5 3.5 3.3425 3.5 3.15C3.5 2.9575 3.3425 2.8 3.15 2.8H1.75C1.5575 2.8 1.4 2.9575 1.4 3.15ZM1.75 4.2C1.5575 4.2 1.4 4.3575 1.4 4.55C1.4 4.7425 1.5575 4.9 1.75 4.9H3.15C3.3425 4.9 3.5 4.7425 3.5 4.55C3.5 4.3575 3.3425 4.2 3.15 4.2H1.75Z'
);

const FigmaInfoIcon = defineFigmaIcon(
  '0 0 12.8 12.8',
  'M6.4 0.8C7.88521 0.8 9.30959 1.39 10.3598 2.4402C11.41 3.49041 12 4.91479 12 6.4C12 7.88521 11.41 9.30959 10.3598 10.3598C9.30959 11.41 7.88521 12 6.4 12C4.91479 12 3.49041 11.41 2.4402 10.3598C1.39 9.30959 0.8 7.88521 0.8 6.4C0.8 4.91479 1.39 3.49041 2.4402 2.4402C3.49041 1.39 4.91479 0.8 6.4 0.8ZM6.4 12.8C8.09738 12.8 9.72525 12.1257 10.9255 10.9255C12.1257 9.72525 12.8 8.09738 12.8 6.4C12.8 4.70261 12.1257 3.07475 10.9255 1.87452C9.72525 0.674284 8.09738 0 6.4 0C4.70261 0 3.07475 0.674284 1.87452 1.87452C0.674284 3.07475 0 4.70261 0 6.4C0 8.09738 0.674284 9.72525 1.87452 10.9255C3.07475 12.1257 4.70261 12.8 6.4 12.8ZM5.2 8.8C4.98 8.8 4.8 8.98 4.8 9.2C4.8 9.42 4.98 9.6 5.2 9.6H7.6C7.82 9.6 8 9.42 8 9.2C8 8.98 7.82 8.8 7.6 8.8H6.8V6C6.8 5.78 6.62 5.6 6.4 5.6H5.4C5.18 5.6 5 5.78 5 6C5 6.22 5.18 6.4 5.4 6.4H6V8.8H5.2ZM6.4 4.6C6.55913 4.6 6.71174 4.53679 6.82426 4.42426C6.93678 4.31174 7 4.15913 7 4C7 3.84087 6.93678 3.68826 6.82426 3.57574C6.71174 3.46321 6.55913 3.4 6.4 3.4C6.24087 3.4 6.08826 3.46321 5.97574 3.57574C5.86321 3.68826 5.8 3.84087 5.8 4C5.8 4.15913 5.86321 4.31174 5.97574 4.42426C6.08826 4.53679 6.24087 4.6 6.4 4.6Z'
);

function wrapHeroIcon(hero: any) {
  return {
    name: 'HeroIconWrapper',
    props: { fill: { type: String, default: '#070922' } },
    setup(props: { fill: string }) {
      return () => h(hero, { style: { color: props.fill } });
    },
  };
}

function getFigmaNavIcon(item: any) {
  if (item?.kind === 'surface') {
    if (item.id === 'home') return FigmaHomeIcon;
    if (item.id === 'inbox') return FigmaInboxIcon;
    if (item.id === 'live-chat') return wrapHeroIcon(ChatBubbleLeftRightIcon);
    if (item.id === 'attention') return wrapHeroIcon(ExclamationTriangleIcon);
  }
  if (item?.kind === 'coreModule') {
    const moduleKey = item.moduleKey?.toLowerCase() || item.id?.toLowerCase() || '';
    if (moduleKey === 'people') return FigmaPeopleIcon;
    return wrapHeroIcon(getNavigationIconComponent(item));
  }
  if (item?.kind === 'app') {
    const route = String(item.route || '').toLowerCase();
    const label = String(item.label || '').toLowerCase();
    const rawId = String(item.id || '');

    if (route.startsWith('/portal/dashboard')) return FigmaHomeIcon;
    if (route.startsWith('/portal/cases')) return wrapHeroIcon(LifebuoyIcon);
    if (route.startsWith('/portal/invoices')) return wrapHeroIcon(BanknotesIcon);
    if (route.startsWith('/portal/knowledge')) return wrapHeroIcon(BookOpenIcon);

    // App dashboard row (no moduleKey): route-specific analytics icons
    if (!item.moduleKey && label === 'dashboard') {
      if (route.startsWith('/audit/') || rawId.toUpperCase() === 'AUDIT') {
        return wrapHeroIcon(PresentationChartLineIcon);
      }
      if (
        route.startsWith('/sales/')
        || route.startsWith('/dashboard/sales')
        || rawId.toUpperCase() === 'SALES'
      ) {
        return wrapHeroIcon(DocumentChartBarIcon);
      }
      return FigmaGridIcon;
    }

    if (label.includes('deal')) return FigmaBriefcaseIcon;
  }

  // Fallback to existing heroicon mapping, but allow exact `fill` control.
  return wrapHeroIcon(getNavigationIconComponent(item));
}

/**
 * Get icon component for app switcher apps
 */
function getAppIcon(app: AppSummary) {
  const appId = (app.id || '').toLowerCase();
  if (appId.includes('helpdesk')) return wrapHeroIcon(LifebuoyIcon);
  if (appId.includes('audit')) return wrapHeroIcon(ShieldCheckIcon);
  // Use app icon if available, otherwise use default icon based on app name
  if (app.icon) {
    return wrapHeroIcon(getIconComponent(app.icon));
  }

  // Fallback to icon based on app name/ID
  if (appId.includes('sales')) return FigmaSackDollarIcon;
  if (appId.includes('project')) return FigmaGridIcon;
  
  // Default icon
  return wrapHeroIcon(getNavigationIconComponent({}));
}

function getCanonicalAppIconId(app: AppSummary): string | undefined {
  const appId = String(app.id || '').toLowerCase();
  if (appId.includes('helpdesk')) return 'lifebuoy';
  if (appId.includes('audit')) return 'shield-check';
  return app.icon;
}

/**
 * Check if a route is currently active
 */
function isActiveRoute(routePath: string): boolean {
  return route.path === routePath || route.path.startsWith(routePath + '/');
}

const activeApp = computed<AppSummary | undefined>(() => {
  return props.sidebarStructure.appSwitcher.apps.find(
    (a) => a.id === props.sidebarStructure.appSwitcher.activeAppId
  );
});

const searchSurface = computed(() => {
  return props.sidebarStructure.shell.find((i) => i.kind === 'surface' && i.id === 'search');
});

const PORTAL_HIDDEN_SHELL_IDS = new Set(['home', 'inbox', 'approvals', 'attention']);

const shellNavItems = computed(() => {
  let items = props.sidebarStructure.shell.filter((i) => !(i.kind === 'surface' && i.id === 'search'));
  if (isPortalRoute.value) {
    items = items.filter((i) => !PORTAL_HIDDEN_SHELL_IDS.has(i.id));
  }
  return items;
});

function switchAppLens(nextAppId: string): void {
  if (!nextAppId || nextAppId === props.sidebarStructure.appSwitcher.activeAppId) return;

  const app = props.sidebarStructure.appSwitcher.apps.find((a) => a.id === nextAppId);
  if (!app) return;

  // Persist lens explicitly (fallback when route is ambiguous)
  lastActiveAppId.value = app.id;

  // Switching the lens is explicit. We express it by routing to the app dashboard.
  openTab(app.dashboardRoute, {
    titleKey: app.nameKey,
    title: app.name,
    icon: getCanonicalAppIconId(app),
  });
}

function handleNavClick(
  routePath: string,
  navItem: { labelKey?: string; label?: string },
  event?: MouseEvent,
  opts: { isAppContext?: boolean; icon?: string } = {}
): void {
  // Search is a shell surface executed as a modal, not navigation.
  if (routePath === '/search') {
    // Guard for SSR and tests.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arivu:open-global-search'));
    }
    return;
  }

  if (opts.isAppContext) {
    // Keep last active lens in sync with app navigation
    lastActiveAppId.value = props.sidebarStructure.appNav.appId;
  }

  // Preserve tabbed navigation behavior (supports background opens).
  const openInBackground =
    !!event &&
    (event.button === 1 || // middle click
      (event as any).metaKey === true ||
      (event as any).ctrlKey === true);

  openTab(routePath, {
    titleKey: navItem.labelKey,
    title: navLabel(navItem),
    icon: opts.icon,
    background: openInBackground,
  });
}
</script>

<style scoped>
/* Compact product navigation: fixed row/icon dimensions keep hover states stable. */
.sidebar-nav {
  font-size: clamp(0.625rem, 0.75rem, 0.875rem);
}

@media (min-width: 1280px) {
  .sidebar-nav {
    font-size: 0.75rem;
  }
}

@media (max-width: 1024px) and (min-width: 641px) {
  .sidebar-nav {
    font-size: clamp(0.6875rem, 0.71875rem, 0.75rem);
  }
}

@media (max-width: 640px) {
  .sidebar-nav {
    font-size: clamp(0.5625rem, 0.625rem, 0.6875rem);
  }
}

/* Ensure icons maintain aspect ratio and scale properly */
.sidebar-nav svg {
  display: block;
  width: 100%;
  height: 100%;
  flex-shrink: 0;
  overflow: visible;
}

/* Icon colors are now handled reactively via computed properties */

.sidebar-nav-item {
  position: relative;
  transition: background-color 150ms ease;
}

.sidebar-nav--expanded .sidebar-nav-item,
.sidebar-nav--expanded .sidebar-search-control,
.sidebar-nav--expanded .sidebar-app-switcher-control {
  padding-left: 0.6875rem;
  padding-right: 0.5rem;
}

.sidebar-nav--collapsed .sidebar-nav-item,
.sidebar-nav--collapsed .sidebar-search-control,
.sidebar-nav--collapsed .sidebar-app-switcher-control {
  width: 1.75rem;
  margin-left: auto;
  margin-right: auto;
  padding-left: 0;
  padding-right: 0;
  justify-content: center;
}

.sidebar-nav-item:not(.sidebar-nav-item--active):hover {
  background-color: rgb(255 255 255 / 0.12);
}

.sidebar-nav-item--active {
  background-color: rgb(255 255 255 / 0.24);
}

/* Icon wrapper containers - ensure proper sizing and prevent overflow */
.sidebar-nav span[class*="w-\["][class*="h-\["] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 0;
  min-height: 0;
}

/* Prevent flex containers from overflowing */
.sidebar-nav .flex {
  min-width: 0;
}

/* Only apply min-width: 0 to icon containers, not text */
.sidebar-nav .flex > span[class*="w-\["][class*="h-\["] {
  min-width: 0;
}
</style>

<style>
/* Unscoped: Vue scoped :global(html.dark) .sidebar-nav compiles onto <html>, not the nav. */
html.dark .sidebar-nav .sidebar-nav-item:not(.sidebar-nav-item--active):hover {
  background-color: rgb(255 255 255 / 0.05);
}

html.dark .sidebar-nav .sidebar-nav-item--active {
  background-color: rgb(96 73 231 / 0.28);
}
</style>
