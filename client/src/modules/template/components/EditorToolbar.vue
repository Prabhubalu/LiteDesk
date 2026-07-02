<template>
  <header :class="ui.toolbar">
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" :class="ui.btnGhost" @click="emit('back')">
          <ArrowLeftIcon class="h-4 w-4" />
          <span class="hidden sm:inline">{{ t('templates.builderBack') }}</span>
        </button>
        <div class="min-w-0 border-l pl-3" :class="ui.border">
          <h1 class="truncate text-value font-semibold">{{ title }}</h1>
          <p :class="ui.meta">{{ saveLabel }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :class="ui.btnIcon"
          :disabled="!canUndo"
          :title="t('templates.builderUndo')"
          @click="emit('undo')"
        >
          <ArrowUturnLeftIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          :class="ui.btnIcon"
          :disabled="!canRedo"
          :title="t('templates.builderRedo')"
          @click="emit('redo')"
        >
          <ArrowUturnRightIcon class="h-4 w-4" />
        </button>

        <span class="mx-1 hidden h-5 w-px bg-neutral-200 dark:bg-neutral-700 sm:inline" />

        <Menu v-if="isEmailFormat" as="div" class="relative">
          <MenuButton :class="ui.btnGhost" :disabled="previewBusy">
            {{ previewBusy ? t('templates.rendering') : t('templates.htmlImport.previewMenu') }}
            <ChevronDownIcon class="h-4 w-4" />
          </MenuButton>
          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems class="absolute right-0 z-20 mt-1 w-44 origin-top-right rounded-lg bg-white dark:bg-neutral-900 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none">
              <MenuItem v-slot="{ active }">
                <button type="button" :class="menuItemClass(active)" @click="emit('preview-email', 'desktop')">
                  {{ t('templates.htmlImport.previewDesktop') }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button type="button" :class="menuItemClass(active)" @click="emit('preview-email', 'mobile')">
                  {{ t('templates.htmlImport.previewMobile') }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button type="button" :class="menuItemClass(active)" @click="emit('preview-email-clients')">
                  {{ t('templates.htmlImport.previewClients') }}
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>

        <button
          v-else
          type="button"
          :class="ui.btnGhost"
          :disabled="previewBusy"
          @click="emit('preview')"
        >
          {{ previewBusy ? t('templates.rendering') : t('templates.previewPdf') }}
        </button>

        <Menu v-if="isEmailFormat" as="div" class="relative">
          <MenuButton :class="ui.btnGhost" :disabled="saveStatus === 'saving'">
            {{ t('templates.htmlImport.advancedMenu') }}
            <ChevronDownIcon class="h-4 w-4" />
          </MenuButton>
          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems class="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg bg-white dark:bg-neutral-900 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none">
              <MenuItem v-for="item in advancedItems" :key="item.action" v-slot="{ active }">
                <button type="button" :class="menuItemClass(active)" @click="emit('advanced', item.action)">
                  {{ item.label }}
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>

        <button
          type="button"
          :class="ui.btnPrimary"
          :disabled="saveStatus === 'saving'"
          @click="emit('save')"
        >
          {{ t('actions.save') }}
        </button>
        <button
          type="button"
          :class="ui.btnPrimary"
          :disabled="publishBusy"
          @click="emit('publish')"
        >
          {{ publishBusy ? t('templates.builderPublishing') : t('templates.publish') }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  ArrowLeftIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChevronDownIcon
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  title: { type: String, default: '' },
  saveStatus: { type: String, default: 'saved' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  previewBusy: { type: Boolean, default: false },
  publishBusy: { type: Boolean, default: false },
  isEmailFormat: { type: Boolean, default: false },
  hasImportSnapshot: { type: Boolean, default: false }
});

const emit = defineEmits([
  'back',
  'undo',
  'redo',
  'preview',
  'preview-email',
  'preview-email-clients',
  'advanced',
  'save',
  'publish'
]);

const { t } = useI18n();
const ui = useBuilderUi();

const saveLabel = computed(() => {
  switch (props.saveStatus) {
    case 'saving':
      return t('templates.builderSaveStatusSaving');
    case 'dirty':
      return t('templates.builderSaveStatusDirty');
    case 'error':
      return t('templates.builderSaveStatusError');
    default:
      return t('templates.builderSaveStatusSaved');
  }
});

const advancedItems = computed(() => {
  const items = [
    { action: 'view-html', label: t('templates.htmlImport.actionViewHtml') },
    { action: 'edit-html', label: t('templates.htmlImport.actionEditHtml') },
    { action: 'validate-html', label: t('templates.htmlImport.actionValidateHtml') },
    { action: 'import-html', label: t('templates.htmlImport.actionImportHtml') },
    { action: 'export-html', label: t('templates.htmlImport.actionExportHtml') }
  ];
  if (props.hasImportSnapshot) {
    items.push({
      action: 'restore-snapshot',
      label: t('templates.htmlImport.actionRestoreSnapshot')
    });
  }
  return items;
});

function menuItemClass(active) {
  return [
    active ? 'bg-neutral-100 dark:bg-neutral-800' : '',
    'block w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-200'
  ].join(' ');
}
</script>
