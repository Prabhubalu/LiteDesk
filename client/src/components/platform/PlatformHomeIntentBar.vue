<template>
  <div
    :class="[
      PLATFORM_HOME_CARD_CLASS,
      PLATFORM_HOME_INTENT_GRADIENT_CLASS,
      '@container flex min-h-0 min-w-0 flex-col p-4 sm:p-5 h-auto sm:h-full'
    ]"
  >
    <div class="platform-home-widget-header mb-3 flex min-w-0 items-stretch gap-2">
      <p class="flex min-w-0 shrink items-center select-text text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {{ t('platform.platformHomeIntentPrompt') }}
      </p>
      <PlatformHomeWidgetHeaderDragPad />
    </div>

    <!-- Container queries: Astra rail shrinks the shell without changing viewport `sm:`. -->
    <div class="flex min-w-0 flex-col gap-2 @[22rem]:flex-row @[22rem]:items-center">
      <button
        type="button"
        class="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-colors hover:border-primary-200 hover:bg-white dark:hover:border-primary-500/40 dark:hover:bg-neutral-900/70"
        :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
        @click="openSearch"
      >
        <MagnifyingGlassIcon class="h-5 w-5 shrink-0 text-neutral-400 dark:text-neutral-500" />
        <span class="min-w-0 flex-1 truncate text-sm text-neutral-400 dark:text-neutral-500">
          {{ t('platform.platformHomeIntentPlaceholder') }}
        </span>
        <kbd
          class="hidden shrink-0 rounded-md border border-neutral-200/55 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 shadow-none @[28rem]:inline dark:border-white/[0.10] dark:bg-neutral-900/60 dark:text-neutral-400"
        >
          {{ searchShortcutLabel }}
        </kbd>
      </button>

      <Menu as="div" v-slot="{ open }" class="relative w-full shrink-0 @[22rem]:w-auto">
        <MenuButton
          ref="createMenuButtonRef"
          type="button"
          class="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-primary-200 bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 dark:border-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500 @[22rem]:w-auto"
          :class="PLATFORM_HOME_PRIMARY_BUTTON_CLASS"
        >
          <PlusIcon class="h-4 w-4 shrink-0" />
          <span class="truncate">{{ t('actions.create') }}</span>
          <ChevronDownIcon class="h-4 w-4 shrink-0 opacity-80" />
        </MenuButton>

        <Teleport to="body">
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="scale-95 opacity-0"
            enter-to-class="scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="scale-100 opacity-100"
            leave-to-class="scale-95 opacity-0"
          >
            <MenuItems
              v-if="open"
              :style="createMenuStyle"
              class="fixed z-[10050] w-52 origin-top-right rounded-xl border border-neutral-200/50 bg-white p-1 focus:outline-none dark:border-white/[0.12] dark:bg-neutral-800"
              :class="PLATFORM_HOME_DROPDOWN_CLASS"
              @vue:before-mount="onCreateMenuOpen"
              @vue:unmounted="onCreateMenuClose"
              @mousedown.stop
            >
              <MenuItem v-for="action in createActions" :key="action.id" v-slot="{ active }">
                <button
                  type="button"
                  :class="[
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm',
                    active ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'
                  ]"
                  @click="action.run"
                >
                  <component :is="action.icon" class="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                  {{ action.label }}
                </button>
              </MenuItem>
            </MenuItems>
          </Transition>
        </Teleport>
      </Menu>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { Teleport } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TicketIcon,
  UserGroupIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_DROPDOWN_CLASS,
  PLATFORM_HOME_INSET_CONTROL_CLASS,
  PLATFORM_HOME_INTENT_GRADIENT_CLASS,
  PLATFORM_HOME_PRIMARY_BUTTON_CLASS
} from '@/utils/platformHomeLayout';
import PlatformHomeWidgetHeaderDragPad from '@/components/platform/PlatformHomeWidgetHeaderDragPad.vue';
import {
  capturePlatformHomeCreateAction,
  capturePlatformHomeIntentSearchClick
} from '@/config/posthogPlatformHome';

const { t } = useI18n();

const CREATE_MENU_WIDTH_PX = 208;
const createMenuButtonRef = ref(null);
const createMenuStyle = ref({});
let createMenuViewportListenersBound = false;

function getCreateMenuButtonElement() {
  const raw = createMenuButtonRef.value;
  if (!raw) return null;
  return raw.$el ?? raw;
}

function syncCreateMenuPosition() {
  const el = getCreateMenuButtonElement();
  if (!el?.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  createMenuStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${Math.max(8, rect.right - CREATE_MENU_WIDTH_PX)}px`,
    width: `${CREATE_MENU_WIDTH_PX}px`,
  };
}

function onCreateMenuViewportChange() {
  syncCreateMenuPosition();
}

function bindCreateMenuViewportListeners() {
  if (createMenuViewportListenersBound) return;
  createMenuViewportListenersBound = true;
  window.addEventListener('scroll', onCreateMenuViewportChange, true);
  window.addEventListener('resize', onCreateMenuViewportChange);
}

function unbindCreateMenuViewportListeners() {
  if (!createMenuViewportListenersBound) return;
  createMenuViewportListenersBound = false;
  window.removeEventListener('scroll', onCreateMenuViewportChange, true);
  window.removeEventListener('resize', onCreateMenuViewportChange);
}

function onCreateMenuOpen() {
  syncCreateMenuPosition();
  bindCreateMenuViewportListeners();
}

function onCreateMenuClose() {
  unbindCreateMenuViewportListeners();
}

onBeforeUnmount(() => {
  unbindCreateMenuViewportListeners();
});

const searchShortcutLabel = computed(() => {
  if (typeof navigator === 'undefined') return '⌘K';
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? '⌘K' : 'Ctrl+K';
});

function openSearch() {
  capturePlatformHomeIntentSearchClick();
  window.dispatchEvent(new CustomEvent('arivu:open-global-search'));
}

function dispatchCreate(moduleKey, title) {
  window.dispatchEvent(new CustomEvent('arivu:open-create-drawer', {
    detail: { moduleKey, initialData: {}, title }
  }));
}

const createActions = computed(() => [
  {
    id: 'person',
    label: t('platform.platformHomeCreatePerson'),
    icon: UserGroupIcon,
    run: () => {
      capturePlatformHomeCreateAction('person');
      window.dispatchEvent(new CustomEvent('arivu:open-people-quick-create'));
    }
  },
  {
    id: 'organization',
    label: t('platform.platformHomeCreateOrganization'),
    icon: BuildingOfficeIcon,
    run: () => {
      capturePlatformHomeCreateAction('organization');
      window.dispatchEvent(new CustomEvent('arivu:open-organization-quick-create', {
        detail: { initialData: {}, autoLinkContext: null }
      }));
    }
  },
  {
    id: 'deal',
    label: t('platform.platformHomeCreateDeal'),
    icon: BriefcaseIcon,
    run: () => {
      capturePlatformHomeCreateAction('deal');
      dispatchCreate('deals', t('platform.platformHomeCreateDeal'));
    }
  },
  {
    id: 'task',
    label: t('platform.platformHomeCreateTask'),
    icon: CheckCircleIcon,
    run: () => {
      capturePlatformHomeCreateAction('task');
      dispatchCreate('tasks', t('platform.platformHomeCreateTask'));
    }
  },
  {
    id: 'case',
    label: t('platform.platformHomeCreateCase'),
    icon: TicketIcon,
    run: () => {
      capturePlatformHomeCreateAction('case');
      dispatchCreate('cases', t('platform.platformHomeCreateCase'));
    }
  }
]);
</script>
