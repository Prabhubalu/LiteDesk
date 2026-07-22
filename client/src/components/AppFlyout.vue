<template>
  <Teleport to="body">
    <div
      ref="flyoutEl"
      class="app-flyout fixed z-[80] w-[12.5rem]"
      :style="flyoutStyle"
      role="dialog"
      :aria-label="title"
      @mouseenter="$emit('flyout-enter')"
      @mouseleave="$emit('flyout-leave')"
    >
      <span
        class="app-flyout-caret"
        :class="effectiveDark ? 'app-flyout-caret--dark' : ''"
        :style="{ top: `${caretOffsetY}px` }"
        aria-hidden="true"
      />

      <div
        class="app-flyout-panel flex flex-col max-h-[min(36rem,calc(100vh-2rem))] rounded-xl bg-white dark:bg-neutral-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
      >
        <div class="flex items-center gap-1 px-2 pt-3 pb-2 flex-shrink-0">
          <div class="flex min-w-0 flex-1 items-center gap-3 px-3">
            <span
              class="relative flex h-[1.125rem] w-[1.125rem] flex-shrink-0 items-center justify-center overflow-visible"
              aria-hidden="true"
            >
              <span
                class="absolute flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
              >
                <component :is="appIcon" class="h-[1.125rem] w-[1.125rem] shrink-0" />
              </span>
            </span>
            <h2 class="text-[0.875rem] font-semibold text-neutral-900 dark:text-neutral-100 truncate min-w-0">
              {{ title }}
            </h2>
          </div>
        </div>

        <div
          class="flex-1 overflow-y-auto min-h-0 px-2 pb-3"
          :class="isCoreApp ? 'pt-3' : ''"
        >
          <div class="flex flex-col">
            <div
              v-for="(group, gi) in itemGroups"
              :key="group.id"
              class="flex flex-col gap-0.5"
              :class="gi > 0 ? 'mt-3' : ''"
            >
              <div
                v-if="group.labelKey"
                class="px-3 pb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
              >
                {{ t(group.labelKey) }}
              </div>
              <a
                v-for="item in group.items"
                :key="item.id"
                :href="item.route"
                class="app-flyout-item w-full h-9 rounded-lg px-3 gap-3 flex items-center justify-start transition-colors duration-150"
                :class="isActive(item.route)
                  ? 'bg-primary-50 text-primary-800 font-medium dark:bg-neutral-800 dark:text-white'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/80 dark:hover:text-white'"
                @click.prevent="onItemClick(item, $event)"
                @auxclick.prevent="onItemClick(item, $event)"
              >
                <span
                  class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center transition-colors"
                  :class="isActive(item.route)
                    ? 'text-primary-700 dark:text-white'
                    : 'text-neutral-400 dark:text-neutral-500'"
                >
                  <component :is="resolveIcon(item)" class="w-full h-full" />
                </span>
                <span class="text-[0.875rem] flex-1 min-w-0 truncate">
                  {{ itemLabel(item) }}
                </span>
              </a>
            </div>
          </div>

          <div
            v-if="app.items.length === 0"
            class="mx-1 mt-2 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-700 px-3 py-4 text-[0.8125rem] text-neutral-500 dark:text-neutral-400"
          >
            {{ t('navigation.flyoutEmpty') }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CubeIcon,
  LifebuoyIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
} from '@heroicons/vue/24/outline';
import type { AppFlyoutDefinition, SidebarItem } from '@/types/sidebar.types';
import { groupCoreDrawerItems, resolveSidebarItemLabel } from '@/utils/navigationLabels';
import { getNavigationIconComponent, getIconComponent } from '@/utils/navigationIcons';
import { useColorMode } from '@/composables/useColorMode';

/** Gap between sidebar card and flyout panel (caret sits in this gap). */
const SIDEBAR_FLYOUT_GAP_PX = 8;
/** Vertical half-height of caret box (16px tall). */
const CARET_VERTICAL_PX = 8;

const props = defineProps<{
  app: AppFlyoutDefinition;
  activePath: string;
  /** Anchor element for positioning (app rail button). */
  anchorEl: HTMLElement | null;
}>();

const emit = defineEmits<{
  'flyout-enter': [];
  'flyout-leave': [];
  navigate: [payload: { item: SidebarItem; event?: MouseEvent }];
}>();

const { t, te } = useI18n();
const { effectiveDark } = useColorMode();
const flyoutEl = ref<HTMLElement | null>(null);
const position = ref({ top: 0, left: 0 });
const caretOffsetY = ref(16);

const title = computed(() => {
  if (props.app.nameKey && te(props.app.nameKey)) return t(props.app.nameKey);
  return props.app.name;
});

const appIcon = computed(() => resolveAppIcon(props.app));

const isCoreApp = computed(() => String(props.app.id || '').toUpperCase() === 'CORE');

const itemGroups = computed(() => groupCoreDrawerItems(props.app.items, props.app.id));

const flyoutStyle = computed(() => ({
  top: `${position.value.top}px`,
  left: `${position.value.left}px`,
}));

function resolveIconEl(anchor: HTMLElement): HTMLElement {
  const icon = anchor.querySelector('.sidebar-rail-icon');
  return icon instanceof HTMLElement ? icon : anchor;
}

function resolveFlyoutEdgeEl(anchor: HTMLElement): HTMLElement {
  // Anchor to the icon rail — not full chrome — so flyout sits beside icons when drawer is open
  const nav = anchor.closest('.sidebar-nav');
  if (nav instanceof HTMLElement) return nav;
  const chrome = anchor.closest('.sidebar-chrome');
  if (chrome instanceof HTMLElement) return chrome;
  return anchor;
}

function applyCaretY(flyoutTop: number, iconCenterY: number, flyoutHeight: number) {
  const caretCenterOffset = CARET_VERTICAL_PX;
  const raw = iconCenterY - flyoutTop - caretCenterOffset;
  const min = 12;
  const max = Math.max(min, flyoutHeight - 12 - CARET_VERTICAL_PX * 2);
  caretOffsetY.value = Math.min(Math.max(min, raw), max);
}

function updatePosition() {
  const anchor = props.anchorEl;
  if (!anchor) return;

  const iconRect = resolveIconEl(anchor).getBoundingClientRect();
  const edgeRect = resolveFlyoutEdgeEl(anchor).getBoundingClientRect();
  const iconCenterY = iconRect.top + iconRect.height / 2;

  const left = edgeRect.right + SIDEBAR_FLYOUT_GAP_PX;
  let top = iconRect.top - 8;

  position.value = { top, left };

  const measureAndClamp = () => {
    const el = flyoutEl.value;
    const height = el?.offsetHeight || Math.min(576, window.innerHeight - 16);
    const maxTop = window.innerHeight - height - 8;
    top = Math.min(Math.max(8, top), Math.max(8, maxTop));
    position.value = { top, left };
    applyCaretY(top, iconCenterY, height);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(measureAndClamp);
  });
}

function itemLabel(item: SidebarItem): string {
  return resolveSidebarItemLabel(item, t);
}

function isActive(routePath: string): boolean {
  const path = props.activePath || '';
  const base = String(routePath || '').replace(/\/+$/, '');
  if (!base) return false;
  return path === base || path.startsWith(base + '/');
}

function wrapHeroIcon(hero: ReturnType<typeof getNavigationIconComponent>) {
  return {
    name: 'FlyoutHeroIcon',
    setup() {
      return () => h(hero, { class: 'w-full h-full' });
    },
  };
}

function resolveIcon(item: SidebarItem) {
  return wrapHeroIcon(getNavigationIconComponent(item));
}

function resolveAppIcon(app: AppFlyoutDefinition) {
  const appId = (app.id || '').toLowerCase();
  if (appId === 'core') return Squares2X2Icon;
  if (appId.includes('helpdesk')) return LifebuoyIcon;
  if (appId.includes('audit')) return ShieldCheckIcon;
  if (app.icon) return getIconComponent(app.icon);
  return CubeIcon;
}

function onItemClick(item: SidebarItem, event?: MouseEvent) {
  emit('navigate', { item, event });
}

watch(
  () => [props.anchorEl, props.app.id, props.app.items.length],
  async () => {
    await nextTick();
    updatePosition();
  },
  { immediate: true }
);

onMounted(() => {
  updatePosition();
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true);
});

onUnmounted(() => {
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
});
</script>

<style scoped>
.app-flyout {
  position: fixed;
  overflow: visible;
}

.app-flyout-caret {
  position: absolute;
  top: 0;
  left: 0;
  width: 12px;
  height: 16px;
  transform: translate(-100%, 0);
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
}

/* Border layer — slightly larger so the stroke reads after rotate + clip */
.app-flyout-caret::before,
.app-flyout-caret::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  border-radius: 2px;
  transform: translateY(-50%) rotate(45deg);
  box-sizing: border-box;
}

.app-flyout-caret::before {
  width: 12px;
  height: 12px;
  background: rgb(0 0 0 / 0.1);
}

.app-flyout-caret::after {
  width: 10px;
  height: 10px;
  right: -5px;
  background: #ffffff;
}

.app-flyout-caret--dark::before {
  background: rgb(255 255 255 / 0.1);
}

.app-flyout-caret--dark::after {
  background: var(--color-neutral-900);
}
</style>
