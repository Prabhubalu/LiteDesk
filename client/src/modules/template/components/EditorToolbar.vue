<template>
  <header :class="ui.toolbar">
    <div :class="ui.toolbarSection">
      <button
        type="button"
        :class="ui.btnIcon"
        :title="t('templates.builderBack')"
        @click="emit('back')"
      >
        <ArrowLeftIcon class="h-4 w-4" />
      </button>

      <div class="flex min-w-0 max-w-[10rem] items-center gap-2 sm:max-w-xs md:max-w-sm">
        <h1 class="truncate text-sm font-semibold">{{ title }}</h1>
        <span
          class="hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline"
          :class="formatBadgeClass"
        >
          {{ formatLabel }}
        </span>
      </div>
    </div>

    <div :class="ui.toolbarCenter">
      <div :class="ui.toolbarStatus">
        <CheckCircleIcon v-if="saveStatus === 'saved'" class="h-4 w-4 text-success-500" aria-hidden="true" />
        <ArrowPathIcon v-else-if="saveStatus === 'saving'" class="h-4 w-4 animate-spin text-warning-500" aria-hidden="true" />
        <ExclamationCircleIcon v-else-if="saveStatus === 'error'" class="h-4 w-4 text-danger-500" aria-hidden="true" />
        <span v-else class="h-2 w-2 rounded-full bg-warning-500" aria-hidden="true" />
        <span :class="saveStatusClass">{{ saveLabel }}</span>
      </div>

      <div
        v-if="isEmailFormat && workspaceView === 'preview'"
        :class="ui.deviceGroup"
        role="group"
        :aria-label="t('templates.builderDevicePreview')"
      >
        <button
          v-for="device in deviceOptions"
          :key="device.value"
          type="button"
          :class="[ui.deviceBtn, previewDevice === device.value ? ui.deviceBtnActive : '']"
          :title="t(device.labelKey)"
          @click="emit('update:previewDevice', device.value)"
        >
          <component :is="device.icon" class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div :class="ui.toolbarActions">
      <button
        type="button"
        :class="ui.btnIcon"
        :disabled="!canUndo || workspaceView !== 'design'"
        :title="`${t('templates.builderUndo')} (${modKey}+Z)`"
        @click="emit('undo')"
      >
        <ArrowUturnLeftIcon class="h-4 w-4" />
      </button>
      <button
        type="button"
        :class="ui.btnIcon"
        :disabled="!canRedo || workspaceView !== 'design'"
        :title="`${t('templates.builderRedo')} (${modKey}+Shift+Z)`"
        @click="emit('redo')"
      >
        <ArrowUturnRightIcon class="h-4 w-4" />
      </button>

      <span :class="ui.toolbarDivider" />

      <Menu v-if="isEmailFormat" as="div" class="relative shrink-0">
        <MenuButton
          :class="ui.btnIcon"
          :disabled="saveStatus === 'saving'"
          :title="t('templates.htmlImport.advancedMenu')"
        >
          <EllipsisHorizontalIcon class="h-4 w-4" />
        </MenuButton>
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <MenuItems :class="[ui.menuItems, 'w-44']">
            <MenuItem v-for="item in advancedItems" :key="item.action" v-slot="{ active }">
              <button type="button" :class="menuItemClass(active)" @click="emit('advanced', item.action)">
                {{ item.label }}
              </button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button type="button" :class="menuItemClass(active)" @click="emit('preview-email-clients')">
                {{ t('templates.htmlImport.previewClients') }}
              </button>
            </MenuItem>
          </MenuItems>
        </Transition>
      </Menu>

      <button
        type="button"
        :class="[ui.btnIcon, rightPanelOpen ? ui.btnIconActive : '']"
        :title="t('templates.builderToggleInspector')"
        @click="emit('toggle-right-panel')"
      >
        <AdjustmentsHorizontalIcon class="h-4 w-4" />
      </button>

      <span :class="ui.toolbarDivider" />

      <button
        type="button"
        :class="ui.btnSecondary"
        :disabled="saveStatus === 'saving'"
        :title="`${t('templates.builderSaveDraft')} (${modKey}+S)`"
        @click="emit('save')"
      >
        {{ t('templates.builderSaveDraft') }}
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
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { Transition } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  AdjustmentsHorizontalIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  CheckCircleIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  EllipsisHorizontalIcon,
  ExclamationCircleIcon
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  title: { type: String, default: '' },
  saveStatus: { type: String, default: 'saved' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  publishBusy: { type: Boolean, default: false },
  isEmailFormat: { type: Boolean, default: false },
  hasImportSnapshot: { type: Boolean, default: false },
  outputFormat: { type: String, default: 'pdf' },
  rightPanelOpen: { type: Boolean, default: true },
  previewDevice: { type: String, default: 'desktop' },
  workspaceView: {
    type: String,
    default: 'design',
    validator: (value) => ['design', 'html', 'preview'].includes(value)
  }
});

const emit = defineEmits([
  'back',
  'undo',
  'redo',
  'preview-email-clients',
  'advanced',
  'save',
  'publish',
  'toggle-right-panel',
  'update:previewDevice',
  'update:workspaceView'
]);

const { t } = useI18n();
const ui = useBuilderUi();

const modKey = computed(() => (
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
    ? '⌘'
    : 'Ctrl'
));

const deviceOptions = [
  { value: 'desktop', labelKey: 'templates.builderDeviceDesktop', icon: ComputerDesktopIcon },
  { value: 'tablet', labelKey: 'templates.builderDeviceTablet', icon: DeviceTabletIcon },
  { value: 'mobile', labelKey: 'templates.builderDeviceMobile', icon: DevicePhoneMobileIcon }
];

const formatLabel = computed(() => {
  const format = String(props.outputFormat || 'pdf').toLowerCase();
  if (format === 'email') return t('templates.formatEmail');
  if (format === 'html') return t('templates.formatHtml');
  return t('templates.formatPdf');
});

const formatBadgeClass = computed(() => {
  const format = String(props.outputFormat || 'pdf').toLowerCase();
  return format === 'email' ? ui.badgeEmail : ui.badgeDefault;
});

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

const saveStatusClass = computed(() => {
  switch (props.saveStatus) {
    case 'saving':
      return ui.toolbarStatusSaving;
    case 'dirty':
      return ui.toolbarStatusDirty;
    case 'error':
      return ui.toolbarStatusError;
    default:
      return ui.toolbarStatusSaved;
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
  return [ui.menuItem, active ? ui.menuItemActive : ''].join(' ');
}
</script>
